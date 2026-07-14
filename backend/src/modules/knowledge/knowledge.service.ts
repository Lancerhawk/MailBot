import { ProcessingStatus } from '@prisma/client';
import { KnowledgeDbService } from './knowledge.db.service';
import { StorageService } from './services/storage.service';
import { ParserService } from './services/parser.service';
import { ChunkingService } from './services/chunking.service';
import { EmbeddingService } from './services/embedding.service';
import { RetrievalService } from './services/retrieval.service';
import { emitToUser } from '../../socket';
import { ApiError } from '../../utils/ApiError';
import { logger } from '../../config/logger';

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const MAX_STORAGE_PER_USER = 500 * 1024 * 1024;
const MAX_DOCUMENTS_PER_USER = 100;
const MAX_CHUNKS_PER_DOCUMENT = 500;

const dbService = new KnowledgeDbService();
const storageService = new StorageService();
const parserService = new ParserService();
const chunkingService = new ChunkingService();
const embeddingService = new EmbeddingService();
const retrievalService = new RetrievalService();

export class KnowledgeService {

  async uploadDocument(
    userId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    options: { title?: string; description?: string; folder?: string } = {}
  ) {
    if (!storageService.validateMimeType(file.mimetype)) {
      throw new ApiError(400, `Unsupported file type: ${file.mimetype}`);
    }

    if (!storageService.validateFileSize(file.size)) {
      throw new ApiError(400, `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    const docCount = await dbService.getUserDocumentCount(userId);
    if (docCount >= MAX_DOCUMENTS_PER_USER) {
      throw new ApiError(400, `Maximum of ${MAX_DOCUMENTS_PER_USER} documents reached`);
    }

    const storageUsed = await dbService.getUserStorageUsed(userId);
    if (storageUsed + file.size > MAX_STORAGE_PER_USER) {
      throw new ApiError(400, `Storage limit of ${MAX_STORAGE_PER_USER / 1024 / 1024}MB would be exceeded`);
    }

    const fileHash = storageService.calculateChecksum(file.buffer);

    const existingDoc = await dbService.findByFileHash(userId, fileHash);
    if (existingDoc) {
      throw new ApiError(409, 'This file has already been uploaded', true);
    }

    const { storageKey } = await storageService.uploadFile(
      userId, file.buffer, file.originalname, file.mimetype
    );

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

    emitToUser(userId, 'knowledge:upload_started', { documentId: document.id, title: document.title });
    emitToUser(userId, 'knowledge:uploaded', { documentId: document.id, title: document.title });

    this.processDocumentPipeline(userId, document.id, file.buffer, file.mimetype, document.version)
      .catch(err => {
        logger.error({ err, documentId: document.id }, 'Knowledge document processing pipeline failed');
      });

    return document;
  }


  private async processDocumentPipeline(
    userId: string,
    documentId: string,
    buffer: Buffer,
    mimeType: string,
    version: number
  ) {
    console.time(`Knowledge-TotalPipeline-${documentId}`);

    try {
      if (storageService.isImageType(mimeType)) {
        await dbService.updateDocumentStatus(documentId, ProcessingStatus.COMPLETED, {
          processedAt: new Date(),
        });
        emitToUser(userId, 'knowledge:ready', { documentId, chunkCount: 0, isImage: true });
        console.timeEnd(`Knowledge-TotalPipeline-${documentId}`);
        return;
      }

      emitToUser(userId, 'knowledge:parsing', { documentId });
      console.time(`Knowledge-Parse-${documentId}`);
      const parseResult = await parserService.extractText(buffer, mimeType, '');
      console.timeEnd(`Knowledge-Parse-${documentId}`);

      if (!parseResult.text || parseResult.text.trim().length === 0) {
        await dbService.updateDocumentStatus(documentId, ProcessingStatus.COMPLETED, {
          processedAt: new Date(),
          chunkCount: 0,
        });
        emitToUser(userId, 'knowledge:ready', { documentId, chunkCount: 0, noText: true });
        console.timeEnd(`Knowledge-TotalPipeline-${documentId}`);
        return;
      }

      emitToUser(userId, 'knowledge:chunking', { documentId });
      console.time(`Knowledge-Chunk-${documentId}`);
      const chunks = chunkingService.chunkText(parseResult.text, version);
      console.timeEnd(`Knowledge-Chunk-${documentId}`);

      if (chunks.length === 0) {
        await dbService.updateDocumentStatus(documentId, ProcessingStatus.COMPLETED, {
          processedAt: new Date(),
          chunkCount: 0,
        });
        emitToUser(userId, 'knowledge:ready', { documentId, chunkCount: 0 });
        console.timeEnd(`Knowledge-TotalPipeline-${documentId}`);
        return;
      }

      if (chunks.length > MAX_CHUNKS_PER_DOCUMENT) {
        throw new Error(`Document produces ${chunks.length} chunks, exceeding the limit of ${MAX_CHUNKS_PER_DOCUMENT}`);
      }

      emitToUser(userId, 'knowledge:embedding', { documentId, chunkCount: chunks.length });
      console.time(`Knowledge-Embed-${documentId}`);
      const texts = chunks.map(c => c.content);
      const embeddings = await embeddingService.embedTexts(texts);
      console.timeEnd(`Knowledge-Embed-${documentId}`);

      const chunksWithEmbeddings = chunks.map((chunk, i) => ({
        ...chunk,
        embedding: embeddings[i],
      }));

      await dbService.insertChunksWithEmbeddings(documentId, chunksWithEmbeddings);

      await dbService.updateDocumentStatus(documentId, ProcessingStatus.COMPLETED, {
        chunkCount: chunks.length,
        processedAt: new Date(),
        embeddedAt: new Date(),
        isEmbedded: true,
      });

      retrievalService.clearCacheForUser(userId);

      emitToUser(userId, 'knowledge:ready', { documentId, chunkCount: chunks.length });
      logger.info({ documentId, chunkCount: chunks.length }, 'Knowledge document processing completed');

    } catch (error: any) {
      logger.error({ error, documentId }, 'Knowledge document processing failed');
      await dbService.updateDocumentStatus(documentId, ProcessingStatus.FAILED, {
        processingError: error.message || 'Unknown processing error',
      });
      emitToUser(userId, 'knowledge:failed', { documentId, error: error.message });
    } finally {
      console.timeEnd(`Knowledge-TotalPipeline-${documentId}`);
    }
  }


  async replaceDocument(
    userId: string,
    documentId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number }
  ) {
    const doc = await dbService.getDocument(userId, documentId);
    if (!doc) throw new ApiError(404, 'Document not found');

    if (!storageService.validateMimeType(file.mimetype)) {
      throw new ApiError(400, `Unsupported file type: ${file.mimetype}`);
    }
    if (!storageService.validateFileSize(file.size)) {
      throw new ApiError(400, `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    console.time(`Knowledge-Replace-${documentId}`);

    await dbService.softDeleteChunks(documentId);

    const fileHash = storageService.calculateChecksum(file.buffer);
    const { storageKey } = await storageService.uploadFile(
      userId, file.buffer, file.originalname, file.mimetype
    );

    if (doc.storageKey) {
      await storageService.deleteFile(doc.storageKey).catch(err => {
        logger.warn({ err, storageKey: doc.storageKey }, 'Failed to delete old S3 file during replace');
      });
    }

    await dbService.updateDocumentVersion(documentId);
    const fileType = this.getFileType(file.originalname, file.mimetype);

    await dbService.updateDocumentStatus(documentId, ProcessingStatus.PROCESSING, {
      chunkCount: 0,
      isEmbedded: false,
      processingError: undefined,
    });

    const { prisma } = await import('../../lib/prisma');
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

    emitToUser(userId, 'knowledge:replaced', { documentId, version: newVersion });

    this.processDocumentPipeline(userId, documentId, file.buffer, file.mimetype, newVersion)
      .catch(err => {
        logger.error({ err, documentId }, 'Knowledge replacement processing failed');
      });

    console.timeEnd(`Knowledge-Replace-${documentId}`);
    return updatedDoc;
  }


  async deleteDocument(userId: string, documentId: string) {
    const doc = await dbService.getDocument(userId, documentId);
    if (!doc) throw new ApiError(404, 'Document not found');

    console.time(`Knowledge-Delete-${documentId}`);

    if (doc.storageKey) {
      await storageService.deleteFile(doc.storageKey).catch(err => {
        logger.warn({ err, storageKey: doc.storageKey }, 'Failed to delete S3 file');
      });
    }

    await dbService.hardDeleteChunks(documentId);

    await dbService.softDeleteDocument(userId, documentId);

    retrievalService.clearCacheForUser(userId);

    emitToUser(userId, 'knowledge:deleted', { documentId });
    console.timeEnd(`Knowledge-Delete-${documentId}`);
  }


  async archiveDocument(userId: string, documentId: string) {
    const doc = await dbService.getDocument(userId, documentId);
    if (!doc) throw new ApiError(404, 'Document not found');

    await dbService.archiveDocument(userId, documentId);
    retrievalService.clearCacheForUser(userId);
    emitToUser(userId, 'knowledge:archived', { documentId });
  }

  async restoreDocument(userId: string, documentId: string) {
    const doc = await dbService.getDocument(userId, documentId);
    if (!doc) throw new ApiError(404, 'Document not found');

    await dbService.restoreDocument(userId, documentId);
    retrievalService.clearCacheForUser(userId);
    emitToUser(userId, 'knowledge:restored', { documentId });
  }


  async retryProcessing(userId: string, documentId: string) {
    const doc = await dbService.getDocument(userId, documentId);
    if (!doc) throw new ApiError(404, 'Document not found');
    if (doc.processingStatus !== ProcessingStatus.FAILED) {
      throw new ApiError(400, 'Only failed documents can be retried');
    }

    if (!doc.storageKey) {
      throw new ApiError(400, 'Document has no stored file to reprocess');
    }

    const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
    const { env } = await import('../../config/env');

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
    if (!bodyStream) throw new ApiError(500, 'Failed to download file from S3');

    const chunks: Buffer[] = [];
    for await (const chunk of bodyStream as any) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);

    await dbService.hardDeleteChunks(documentId);

    await dbService.updateDocumentStatus(documentId, ProcessingStatus.PROCESSING, {
      processingError: undefined,
      chunkCount: 0,
      isEmbedded: false,
    });

    this.processDocumentPipeline(userId, documentId, buffer, doc.mimeType || '', doc.version)
      .catch(err => {
        logger.error({ err, documentId }, 'Knowledge retry processing failed');
      });
  }


  async listDocuments(userId: string, options: any) {
    return dbService.listDocuments(userId, options);
  }

  async getDocument(userId: string, documentId: string) {
    const doc = await dbService.getDocument(userId, documentId);
    if (!doc) throw new ApiError(404, 'Document not found');
    return doc;
  }

  async updateDocument(userId: string, documentId: string, data: any) {
    const doc = await dbService.getDocument(userId, documentId);
    if (!doc) throw new ApiError(404, 'Document not found');

    const allowed: any = {};
    if (data.title !== undefined) allowed.title = data.title;
    if (data.description !== undefined) allowed.description = data.description;
    if (data.folder !== undefined) allowed.folder = data.folder;

    await dbService.updateDocument(userId, documentId, allowed);
    return dbService.getDocument(userId, documentId);
  }

  async getStats(userId: string) {
    return dbService.getStats(userId);
  }

  async getFolderCounts(userId: string) {
    return dbService.getFolderCounts(userId);
  }

  async getDownloadUrl(userId: string, documentId: string) {
    const doc = await dbService.getDocument(userId, documentId);
    if (!doc) throw new ApiError(404, 'Document not found');
    if (!doc.storageKey) throw new ApiError(400, 'No file available for download');

    const url = await storageService.generateSignedUrl(doc.storageKey);

    const { prisma } = await import('../../lib/prisma');
    await prisma.knowledgeBaseDocument.update({
      where: { id: documentId },
      data: { lastAccessedAt: new Date() },
    });

    return { url, filename: doc.originalFileName || doc.title };
  }

  async searchDocuments(userId: string, query: string) {
    return dbService.listDocuments(userId, { search: query, limit: 20 });
  }


  private getFileType(filename: string, mimeType: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext) return ext.toUpperCase();

    const mimeMap: Record<string, string> = {
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
