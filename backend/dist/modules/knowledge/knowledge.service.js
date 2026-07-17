"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.KnowledgeService = void 0;
const client_1 = require("@prisma/client");
const knowledge_db_service_1 = require("./knowledge.db.service");
const storage_service_1 = require("./services/storage.service");
const parser_service_1 = require("./services/parser.service");
const chunking_service_1 = require("./services/chunking.service");
const retrieval_service_1 = require("./services/retrieval.service");
const analytics_event_service_1 = require("../analytics/services/analytics-event.service");
const job_service_1 = require("../jobs/job.service");
const socket_1 = require("../../socket");
const ApiError_1 = require("../../utils/ApiError");
const logger_1 = require("../../config/logger");
const env_1 = require("../../config/env");
const MAX_FILE_SIZE = env_1.env.MAX_DOCUMENT_SIZE_MB * 1024 * 1024;
const MAX_STORAGE_PER_USER = 500 * 1024 * 1024;
const MAX_DOCUMENTS_PER_USER = 100;
const MAX_CHUNKS_PER_DOCUMENT = env_1.env.MAX_CHUNKS_PER_DOCUMENT;
const dbService = new knowledge_db_service_1.KnowledgeDbService();
const storageService = new storage_service_1.StorageService();
const parserService = new parser_service_1.ParserService();
const chunkingService = new chunking_service_1.ChunkingService();
const retrievalService = new retrieval_service_1.RetrievalService();
class KnowledgeService {
    async uploadDocument(userId, file, options = {}) {
        if (!storageService.validateMimeType(file.mimetype)) {
            throw new ApiError_1.ApiError(400, `Unsupported file type: ${file.mimetype}`);
        }
        if (!storageService.validateFileSize(file.size)) {
            throw new ApiError_1.ApiError(400, `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
        }
        const docCount = await dbService.getUserDocumentCount(userId);
        if (docCount >= MAX_DOCUMENTS_PER_USER) {
            throw new ApiError_1.ApiError(400, `Maximum of ${MAX_DOCUMENTS_PER_USER} documents reached`);
        }
        const storageUsed = await dbService.getUserStorageUsed(userId);
        if (storageUsed + file.size > MAX_STORAGE_PER_USER) {
            throw new ApiError_1.ApiError(400, `Storage limit of ${MAX_STORAGE_PER_USER / 1024 / 1024}MB would be exceeded`);
        }
        const fileHash = storageService.calculateChecksum(file.buffer);
        const existingDoc = await dbService.findByFileHash(userId, fileHash);
        if (existingDoc) {
            throw new ApiError_1.ApiError(409, 'This file has already been uploaded', true);
        }
        const { storageKey } = await storageService.uploadFile(userId, file.buffer, file.originalname, file.mimetype);
        const fileType = this.getFileType(file.originalname, file.mimetype);
        const title = options.title || file.originalname.replace(/\.[^.]+$/, '');
        const document = await dbService.createDocument(userId, {
            title,
            description: options.description,
            fileType,
            mimeType: file.mimetype,
            fileSize: file.size,
            originalFileName: file.originalname,
            folder: options.folder,
            storageKey,
            storageProvider: 'S3',
            fileHash,
        });
        analytics_event_service_1.AnalyticsEventService.recordEvent(userId, analytics_event_service_1.AnalyticsEventType.DOCUMENT_UPLOADED, {
            storageUsedBytes: file.size
        });
        (0, socket_1.emitToUser)(userId, 'knowledge:upload_started', { documentId: document.id, title: document.title });
        (0, socket_1.emitToUser)(userId, 'knowledge:uploaded', { documentId: document.id, title: document.title });
        this.processDocumentPipeline(userId, document.id, file.buffer, file.mimetype, document.version)
            .catch(err => {
            logger_1.logger.error({ err, documentId: document.id }, 'Knowledge document processing pipeline failed');
        });
        return document;
    }
    async processDocumentPipeline(userId, documentId, buffer, mimeType, version) {
        console.time(`Knowledge-TotalPipeline-${documentId}`);
        try {
            if (storageService.isImageType(mimeType)) {
                await dbService.updateDocumentStatus(documentId, client_1.ProcessingStatus.COMPLETED, {
                    processedAt: new Date(),
                });
                analytics_event_service_1.AnalyticsEventService.recordEvent(userId, analytics_event_service_1.AnalyticsEventType.DOCUMENT_EMBEDDED);
                (0, socket_1.emitToUser)(userId, 'knowledge:ready', { documentId, chunkCount: 0, isImage: true });
                return;
            }
            (0, socket_1.emitToUser)(userId, 'knowledge:parsing', { documentId });
            const parseResult = await parserService.extractText(buffer, mimeType, '');
            if (!parseResult.text || parseResult.text.trim().length === 0) {
                await dbService.updateDocumentStatus(documentId, client_1.ProcessingStatus.COMPLETED, {
                    processedAt: new Date(),
                    chunkCount: 0,
                });
                (0, socket_1.emitToUser)(userId, 'knowledge:ready', { documentId, chunkCount: 0, noText: true });
                return;
            }
            const chunks = chunkingService.chunkText(parseResult.text, version);
            if (chunks.length === 0) {
                await dbService.updateDocumentStatus(documentId, client_1.ProcessingStatus.COMPLETED, {
                    processedAt: new Date(),
                    chunkCount: 0,
                });
                (0, socket_1.emitToUser)(userId, 'knowledge:ready', { documentId, chunkCount: 0 });
                return;
            }
            if (chunks.length > MAX_CHUNKS_PER_DOCUMENT) {
                throw new Error(`Document produces ${chunks.length} chunks, exceeding the limit of ${MAX_CHUNKS_PER_DOCUMENT}`);
            }
            const chunksWithEmbeddings = chunks.map((chunk) => ({
                ...chunk,
                embedding: null,
            }));
            await dbService.insertChunksWithEmbeddings(documentId, chunksWithEmbeddings);
            (0, socket_1.emitToUser)(userId, 'knowledge:queued', { documentId, chunkCount: chunks.length });
            await job_service_1.jobService.createJob(userId, client_1.JobType.DOCUMENT_EMBEDDING, client_1.ProcessingEntityType.DOCUMENT, documentId, 1);
        }
        catch (error) {
            logger_1.logger.error({ error, documentId }, 'Knowledge document processing failed');
            await dbService.updateDocumentStatus(documentId, client_1.ProcessingStatus.FAILED, {
                processingError: error.message || 'Unknown processing error',
            });
            analytics_event_service_1.AnalyticsEventService.recordEvent(userId, analytics_event_service_1.AnalyticsEventType.PROCESSING_FAILURE);
            (0, socket_1.emitToUser)(userId, 'knowledge:failed', { documentId, error: error.message });
        }
        finally {
            console.timeEnd(`Knowledge-TotalPipeline-${documentId}`);
        }
    }
    async replaceDocument(userId, documentId, file) {
        const doc = await dbService.getDocument(userId, documentId);
        if (!doc)
            throw new ApiError_1.ApiError(404, 'Document not found');
        if (!storageService.validateMimeType(file.mimetype)) {
            throw new ApiError_1.ApiError(400, `Unsupported file type: ${file.mimetype}`);
        }
        if (!storageService.validateFileSize(file.size)) {
            throw new ApiError_1.ApiError(400, `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
        }
        console.time(`Knowledge-Replace-${documentId}`);
        await dbService.softDeleteChunks(documentId);
        const fileHash = storageService.calculateChecksum(file.buffer);
        const { storageKey } = await storageService.uploadFile(userId, file.buffer, file.originalname, file.mimetype);
        if (doc.storageKey) {
            await storageService.deleteFile(doc.storageKey).catch(err => {
                logger_1.logger.warn({ err, storageKey: doc.storageKey }, 'Failed to delete old S3 file during replace');
            });
        }
        await dbService.updateDocumentVersion(documentId);
        const fileType = this.getFileType(file.originalname, file.mimetype);
        await dbService.updateDocumentStatus(documentId, client_1.ProcessingStatus.PROCESSING, {
            chunkCount: 0,
            isEmbedded: false,
            processingError: undefined,
        });
        const { prisma } = await Promise.resolve().then(() => __importStar(require('../../lib/prisma')));
        await prisma.knowledgeBaseDocument.update({
            where: { id: documentId },
            data: {
                fileType,
                mimeType: file.mimetype,
                fileSize: file.size,
                originalFileName: file.originalname,
                storageKey,
                fileHash,
                embeddedAt: null,
                processedAt: null,
            },
        });
        const updatedDoc = await dbService.getDocument(userId, documentId);
        const newVersion = updatedDoc?.version || doc.version + 1;
        (0, socket_1.emitToUser)(userId, 'knowledge:replaced', { documentId, version: newVersion });
        this.processDocumentPipeline(userId, documentId, file.buffer, file.mimetype, newVersion)
            .catch(err => {
            logger_1.logger.error({ err, documentId }, 'Knowledge replacement processing failed');
        });
        console.timeEnd(`Knowledge-Replace-${documentId}`);
        return updatedDoc;
    }
    async deleteDocument(userId, documentId) {
        const doc = await dbService.getDocument(userId, documentId);
        if (!doc)
            throw new ApiError_1.ApiError(404, 'Document not found');
        console.time(`Knowledge-Delete-${documentId}`);
        if (doc.storageKey) {
            await storageService.deleteFile(doc.storageKey).catch(err => {
                logger_1.logger.warn({ err, storageKey: doc.storageKey }, 'Failed to delete S3 file');
            });
        }
        await dbService.hardDeleteChunks(documentId);
        await dbService.softDeleteDocument(userId, documentId);
        retrievalService.clearCacheForUser(userId);
        (0, socket_1.emitToUser)(userId, 'knowledge:deleted', { documentId });
        console.timeEnd(`Knowledge-Delete-${documentId}`);
    }
    async archiveDocument(userId, documentId) {
        const doc = await dbService.getDocument(userId, documentId);
        if (!doc)
            throw new ApiError_1.ApiError(404, 'Document not found');
        await dbService.archiveDocument(userId, documentId);
        retrievalService.clearCacheForUser(userId);
        (0, socket_1.emitToUser)(userId, 'knowledge:archived', { documentId });
    }
    async restoreDocument(userId, documentId) {
        const doc = await dbService.getDocument(userId, documentId);
        if (!doc)
            throw new ApiError_1.ApiError(404, 'Document not found');
        await dbService.restoreDocument(userId, documentId);
        retrievalService.clearCacheForUser(userId);
        (0, socket_1.emitToUser)(userId, 'knowledge:restored', { documentId });
    }
    async retryProcessing(userId, documentId) {
        const doc = await dbService.getDocument(userId, documentId);
        if (!doc)
            throw new ApiError_1.ApiError(404, 'Document not found');
        if (doc.processingStatus !== client_1.ProcessingStatus.FAILED) {
            throw new ApiError_1.ApiError(400, 'Only failed documents can be retried');
        }
        if (!doc.storageKey) {
            throw new ApiError_1.ApiError(400, 'Document has no stored file to reprocess');
        }
        const { S3Client, GetObjectCommand } = await Promise.resolve().then(() => __importStar(require('@aws-sdk/client-s3')));
        const { env } = await Promise.resolve().then(() => __importStar(require('../../config/env')));
        const s3Client = new S3Client({
            region: env.AWS_REGION,
            credentials: {
                accessKeyId: env.AWS_ACCESS_KEY_ID,
                secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
            },
        });
        const command = new GetObjectCommand({
            Bucket: env.AWS_S3_BUCKET,
            Key: doc.storageKey,
        });
        const response = await s3Client.send(command);
        const bodyStream = response.Body;
        if (!bodyStream)
            throw new ApiError_1.ApiError(500, 'Failed to download file from S3');
        const chunks = [];
        for await (const chunk of bodyStream) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        const buffer = Buffer.concat(chunks);
        await dbService.hardDeleteChunks(documentId);
        await dbService.updateDocumentStatus(documentId, client_1.ProcessingStatus.PROCESSING, {
            processingError: undefined,
            chunkCount: 0,
            isEmbedded: false,
        });
        this.processDocumentPipeline(userId, documentId, buffer, doc.mimeType || '', doc.version)
            .catch(err => {
            logger_1.logger.error({ err, documentId }, 'Knowledge retry processing failed');
        });
    }
    async listDocuments(userId, options) {
        return dbService.listDocuments(userId, options);
    }
    async getDocument(userId, documentId) {
        const doc = await dbService.getDocument(userId, documentId);
        if (!doc)
            throw new ApiError_1.ApiError(404, 'Document not found');
        return doc;
    }
    async updateDocument(userId, documentId, data) {
        const doc = await dbService.getDocument(userId, documentId);
        if (!doc)
            throw new ApiError_1.ApiError(404, 'Document not found');
        const allowed = {};
        if (data.title !== undefined)
            allowed.title = data.title;
        if (data.description !== undefined)
            allowed.description = data.description;
        if (data.folder !== undefined)
            allowed.folder = data.folder;
        await dbService.updateDocument(userId, documentId, allowed);
        return dbService.getDocument(userId, documentId);
    }
    async getStats(userId) {
        return dbService.getStats(userId);
    }
    async getFolderCounts(userId) {
        return dbService.getFolderCounts(userId);
    }
    async getDownloadUrl(userId, documentId) {
        const doc = await dbService.getDocument(userId, documentId);
        if (!doc)
            throw new ApiError_1.ApiError(404, 'Document not found');
        if (!doc.storageKey)
            throw new ApiError_1.ApiError(400, 'No file available for download');
        const url = await storageService.generateSignedUrl(doc.storageKey);
        const { prisma } = await Promise.resolve().then(() => __importStar(require('../../lib/prisma')));
        await prisma.knowledgeBaseDocument.update({
            where: { id: documentId },
            data: { lastAccessedAt: new Date() },
        });
        return { url, filename: doc.originalFileName || doc.title };
    }
    async searchDocuments(userId, query) {
        return dbService.listDocuments(userId, { search: query, limit: 20 });
    }
    getFileType(filename, mimeType) {
        const ext = filename.split('.').pop()?.toLowerCase();
        if (ext)
            return ext.toUpperCase();
        const mimeMap = {
            'application/pdf': 'PDF',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
            'text/plain': 'TXT',
            'text/markdown': 'MD',
            'text/csv': 'CSV',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
            'image/png': 'PNG',
            'image/jpeg': 'JPEG',
            'image/webp': 'WEBP',
        };
        return mimeMap[mimeType] || 'OTHER';
    }
}
exports.KnowledgeService = KnowledgeService;
