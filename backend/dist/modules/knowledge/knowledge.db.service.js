"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KnowledgeDbService = void 0;
const prisma_1 = require("../../lib/prisma");
const client_1 = require("@prisma/client");
const ApiError_1 = require("../../utils/ApiError");
const MAX_STORAGE_PER_USER = 500 * 1024 * 1024;
const MAX_DOCUMENTS_PER_USER = 100;
class KnowledgeDbService {
    async createDocument(userId, data) {
        return prisma_1.prisma.knowledgeBaseDocument.create({
            data: {
                userId,
                title: data.title,
                description: data.description,
                fileType: data.fileType,
                mimeType: data.mimeType,
                fileSize: data.fileSize,
                originalFileName: data.originalFileName,
                folder: data.folder || 'Personal',
                storageKey: data.storageKey,
                storageProvider: data.storageProvider || 'S3',
                fileHash: data.fileHash,
                source: data.source || 'UPLOAD',
                processingStatus: client_1.ProcessingStatus.PROCESSING,
            },
        });
    }
    async getDocument(userId, documentId) {
        return prisma_1.prisma.knowledgeBaseDocument.findFirst({
            where: {
                id: documentId,
                userId,
                deletedAt: null,
            },
            include: {
                _count: {
                    select: {
                        chunks: {
                            where: { deletedAt: null },
                        },
                    },
                },
            },
        });
    }
    async listDocuments(userId, options = {}) {
        const { folder, processingStatus, isArchived, search, sort = 'newest', page = 1, limit = 20 } = options;
        const where = {
            userId,
            deletedAt: null,
        };
        if (folder && folder !== 'All') {
            where.folder = folder;
        }
        if (processingStatus) {
            where.processingStatus = processingStatus;
        }
        if (isArchived !== undefined) {
            where.isArchived = isArchived;
        }
        if (search) {
            where.OR = [
                { title: { contains: search, mode: 'insensitive' } },
                { originalFileName: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
            ];
        }
        let orderBy;
        switch (sort) {
            case 'oldest':
                orderBy = { createdAt: 'asc' };
                break;
            case 'a-z':
                orderBy = { title: 'asc' };
                break;
            case 'z-a':
                orderBy = { title: 'desc' };
                break;
            case 'largest':
                orderBy = { fileSize: 'desc' };
                break;
            case 'smallest':
                orderBy = { fileSize: 'asc' };
                break;
            case 'most-retrieved':
                orderBy = { retrievalCount: 'desc' };
                break;
            case 'recently-used':
                orderBy = { lastRetrievedAt: 'desc' };
                break;
            default:
                orderBy = { createdAt: 'desc' };
        }
        const [documents, total] = await Promise.all([
            prisma_1.prisma.knowledgeBaseDocument.findMany({
                where,
                orderBy,
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma_1.prisma.knowledgeBaseDocument.count({ where }),
        ]);
        return {
            documents,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }
    async updateDocument(userId, documentId, data) {
        const result = await prisma_1.prisma.knowledgeBaseDocument.updateMany({
            where: {
                id: documentId,
                userId,
                deletedAt: null,
                processingStatus: { notIn: [client_1.ProcessingStatus.PROCESSING, client_1.ProcessingStatus.PENDING] }
            },
            data,
        });
        if (result.count === 0) {
            throw new ApiError_1.ApiError(404, 'Document not found or unauthorized');
        }
        return result;
    }
    async archiveDocument(userId, documentId) {
        const result = await prisma_1.prisma.knowledgeBaseDocument.updateMany({
            where: {
                id: documentId,
                userId,
                deletedAt: null,
                processingStatus: { notIn: [client_1.ProcessingStatus.PROCESSING, client_1.ProcessingStatus.PENDING] }
            },
            data: { isArchived: true },
        });
        if (result.count === 0) {
            throw new ApiError_1.ApiError(404, 'Document not found or unauthorized');
        }
        return result;
    }
    async restoreDocument(userId, documentId) {
        const result = await prisma_1.prisma.knowledgeBaseDocument.updateMany({
            where: {
                id: documentId,
                userId,
                deletedAt: null,
                processingStatus: { notIn: [client_1.ProcessingStatus.PROCESSING, client_1.ProcessingStatus.PENDING] }
            },
            data: { isArchived: false },
        });
        if (result.count === 0) {
            throw new ApiError_1.ApiError(404, 'Document not found or unauthorized');
        }
        return result;
    }
    async softDeleteDocument(userId, documentId) {
        const result = await prisma_1.prisma.knowledgeBaseDocument.updateMany({
            where: { id: documentId, userId, deletedAt: null },
            data: { deletedAt: new Date() },
        });
        if (result.count === 0) {
            throw new ApiError_1.ApiError(404, 'Document not found or unauthorized');
        }
        return result;
    }
    async hardDeleteChunks(documentId) {
        return prisma_1.prisma.knowledgeBaseChunk.deleteMany({
            where: { documentId },
        });
    }
    async softDeleteChunks(documentId) {
        return prisma_1.prisma.$executeRawUnsafe(`UPDATE "KnowledgeBaseChunk" SET "deletedAt" = NOW() WHERE "documentId" = $1 AND "deletedAt" IS NULL`, documentId);
    }
    async getStats(userId) {
        const [totalDocs, embeddedCount, processingCount, failedCount, storageResult, retrievalResult] = await Promise.all([
            prisma_1.prisma.knowledgeBaseDocument.count({
                where: { userId, deletedAt: null },
            }),
            prisma_1.prisma.knowledgeBaseDocument.count({
                where: { userId, deletedAt: null, processingStatus: client_1.ProcessingStatus.COMPLETED, isEmbedded: true },
            }),
            prisma_1.prisma.knowledgeBaseDocument.count({
                where: { userId, deletedAt: null, processingStatus: { in: [client_1.ProcessingStatus.PROCESSING, client_1.ProcessingStatus.PENDING] } },
            }),
            prisma_1.prisma.knowledgeBaseDocument.count({
                where: { userId, deletedAt: null, processingStatus: client_1.ProcessingStatus.FAILED },
            }),
            prisma_1.prisma.knowledgeBaseDocument.aggregate({
                where: { userId, deletedAt: null },
                _sum: { fileSize: true },
            }),
            prisma_1.prisma.knowledgeBaseDocument.aggregate({
                where: { userId, deletedAt: null },
                _sum: { retrievalCount: true },
            }),
        ]);
        return {
            totalDocuments: totalDocs,
            embeddedCount,
            processingCount,
            failedCount,
            totalStorageBytes: storageResult._sum.fileSize || 0,
            maxStorageBytes: MAX_STORAGE_PER_USER,
            totalRetrievals: retrievalResult._sum.retrievalCount || 0,
            maxDocuments: MAX_DOCUMENTS_PER_USER,
        };
    }
    async getFolderCounts(userId) {
        const results = await prisma_1.prisma.knowledgeBaseDocument.groupBy({
            by: ['folder'],
            where: { userId, deletedAt: null },
            _count: { _all: true },
        });
        const counts = {};
        let total = 0;
        for (const r of results) {
            counts[r.folder] = r._count._all;
            total += r._count._all;
        }
        counts['All'] = total;
        return counts;
    }
    async findByFileHash(userId, fileHash) {
        return prisma_1.prisma.knowledgeBaseDocument.findFirst({
            where: {
                userId,
                fileHash,
                deletedAt: null,
            },
        });
    }
    async hasActiveDocuments(userId) {
        const count = await prisma_1.prisma.knowledgeBaseDocument.count({
            where: {
                userId,
                deletedAt: null,
                isArchived: false,
                processingStatus: client_1.ProcessingStatus.COMPLETED,
                isEmbedded: true,
            },
            take: 1,
        });
        return count > 0;
    }
    async incrementRetrievalCount(documentId) {
        return prisma_1.prisma.knowledgeBaseDocument.update({
            where: { id: documentId },
            data: {
                retrievalCount: { increment: 1 },
                lastRetrievedAt: new Date(),
            },
        });
    }
    async insertChunksWithEmbeddings(documentId, chunks) {
        if (chunks.length === 0)
            return;
        const values = [];
        const placeholders = [];
        let i = 1;
        for (const chunk of chunks) {
            const embeddingStr = chunk.embedding ? `[${chunk.embedding.join(',')}]` : null;
            const embeddingModel = chunk.embedding ? 'bge-small-en-v1.5' : null;
            placeholders.push(`(gen_random_uuid(), $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}::vector, $${i++}::jsonb, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++})`);
            values.push(documentId, chunk.chunkIndex, chunk.content, chunk.tokenCount, embeddingModel, embeddingStr, JSON.stringify({}), chunk.pageNumber, chunk.heading, chunk.section, chunk.sourceOffsetStart, chunk.sourceOffsetEnd, chunk.documentVersion);
        }
        const query = `
      INSERT INTO "KnowledgeBaseChunk" (
        id, "documentId", "chunkIndex", content, "tokenCount",
        "embeddingModel", embedding, metadata,
        "pageNumber", heading, section,
        "sourceOffsetStart", "sourceOffsetEnd", "documentVersion"
      ) VALUES ${placeholders.join(', ')}
    `;
        await prisma_1.prisma.$executeRawUnsafe(query, ...values);
    }
    async updateDocumentStatus(documentId, status, extra) {
        return prisma_1.prisma.knowledgeBaseDocument.update({
            where: { id: documentId },
            data: {
                processingStatus: status,
                ...extra,
            },
        });
    }
    async getUserStorageUsed(userId) {
        const result = await prisma_1.prisma.knowledgeBaseDocument.aggregate({
            where: { userId, deletedAt: null },
            _sum: { fileSize: true },
        });
        return result._sum.fileSize || 0;
    }
    async getUserDocumentCount(userId) {
        return prisma_1.prisma.knowledgeBaseDocument.count({
            where: { userId, deletedAt: null },
        });
    }
    async updateDocumentVersion(documentId) {
        return prisma_1.prisma.knowledgeBaseDocument.update({
            where: { id: documentId },
            data: {
                version: { increment: 1 },
            },
        });
    }
}
exports.KnowledgeDbService = KnowledgeDbService;
