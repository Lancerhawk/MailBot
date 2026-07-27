import { prisma } from '../../lib/prisma';
import { ProcessingStatus, Prisma } from '@prisma/client';
import { ApiError } from '../../utils/ApiError';

const MAX_STORAGE_PER_USER = 500 * 1024 * 1024;
const MAX_DOCUMENTS_PER_USER = 100;

export class KnowledgeDbService {
  async createDocument(userId: string, data: {
    title: string;
    description?: string;
    fileType: string;
    mimeType: string;
    fileSize: number;
    originalFileName: string;
    folder?: string;
    storageKey: string;
    storageProvider?: string;
    fileHash: string;
    source?: string;
  }) {
    return prisma.knowledgeBaseDocument.create({
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
        storageProvider: data.storageProvider as any || 'S3',
        fileHash: data.fileHash,
        source: data.source as any || 'UPLOAD',
        processingStatus: ProcessingStatus.PROCESSING,
      },
    });
  }

  async getDocument(userId: string, documentId: string) {
    return prisma.knowledgeBaseDocument.findFirst({
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

  async listDocuments(
    userId: string,
    options: {
      folder?: string;
      processingStatus?: string;
      isArchived?: boolean;
      search?: string;
      sort?: string;
      page?: number;
      limit?: number;
    } = {}
  ) {
    const { folder, processingStatus, isArchived, search, sort = 'newest', page = 1, limit = 20 } = options;

    const where: Prisma.KnowledgeBaseDocumentWhereInput = {
      userId,
      deletedAt: null,
    };

    if (folder && folder !== 'All') {
      where.folder = folder;
    }

    if (processingStatus) {
      where.processingStatus = processingStatus as ProcessingStatus;
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

    let orderBy: Prisma.KnowledgeBaseDocumentOrderByWithRelationInput;
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
      prisma.knowledgeBaseDocument.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.knowledgeBaseDocument.count({ where }),
    ]);

    return {
      documents,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateDocument(userId: string, documentId: string, data: Partial<{
    title: string;
    description: string;
    folder: string;
  }>) {
    const result = await prisma.knowledgeBaseDocument.updateMany({
      where: { id: documentId, userId, deletedAt: null },
      data,
    });
    if (result.count === 0) {
      throw new ApiError(404, 'Document not found or unauthorized');
    }
    return result;
  }

  async archiveDocument(userId: string, documentId: string) {
    const result = await prisma.knowledgeBaseDocument.updateMany({
      where: { id: documentId, userId, deletedAt: null },
      data: { isArchived: true },
    });
    if (result.count === 0) {
      throw new ApiError(404, 'Document not found or unauthorized');
    }
    return result;
  }

  async restoreDocument(userId: string, documentId: string) {
    const result = await prisma.knowledgeBaseDocument.updateMany({
      where: { id: documentId, userId, deletedAt: null },
      data: { isArchived: false },
    });
    if (result.count === 0) {
      throw new ApiError(404, 'Document not found or unauthorized');
    }
    return result;
  }

  async softDeleteDocument(userId: string, documentId: string) {
    const result = await prisma.knowledgeBaseDocument.updateMany({
      where: { id: documentId, userId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (result.count === 0) {
      throw new ApiError(404, 'Document not found or unauthorized');
    }
    return result;
  }

  async hardDeleteChunks(documentId: string) {
    return prisma.knowledgeBaseChunk.deleteMany({
      where: { documentId },
    });
  }

  async softDeleteChunks(documentId: string) {
    return prisma.$executeRawUnsafe(
      `UPDATE "KnowledgeBaseChunk" SET "deletedAt" = NOW() WHERE "documentId" = $1 AND "deletedAt" IS NULL`,
      documentId
    );
  }

  async getStats(userId: string) {
    const [totalDocs, embeddedCount, processingCount, failedCount, storageResult, retrievalResult] = await Promise.all([
      prisma.knowledgeBaseDocument.count({
        where: { userId, deletedAt: null },
      }),
      prisma.knowledgeBaseDocument.count({
        where: { userId, deletedAt: null, processingStatus: ProcessingStatus.COMPLETED, isEmbedded: true },
      }),
      prisma.knowledgeBaseDocument.count({
        where: { userId, deletedAt: null, processingStatus: { in: [ProcessingStatus.PROCESSING, ProcessingStatus.PENDING] } },
      }),
      prisma.knowledgeBaseDocument.count({
        where: { userId, deletedAt: null, processingStatus: ProcessingStatus.FAILED },
      }),
      prisma.knowledgeBaseDocument.aggregate({
        where: { userId, deletedAt: null },
        _sum: { fileSize: true },
      }),
      prisma.knowledgeBaseDocument.aggregate({
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

  async getFolderCounts(userId: string) {
    const results = await prisma.knowledgeBaseDocument.groupBy({
      by: ['folder'],
      where: { userId, deletedAt: null },
      _count: { _all: true },
    });

    const counts: Record<string, number> = {};
    let total = 0;
    for (const r of results) {
      counts[r.folder] = r._count._all;
      total += r._count._all;
    }
    counts['All'] = total;

    return counts;
  }

  async findByFileHash(userId: string, fileHash: string) {
    return prisma.knowledgeBaseDocument.findFirst({
      where: {
        userId,
        fileHash,
        deletedAt: null,
      },
    });
  }

  async hasActiveDocuments(userId: string): Promise<boolean> {
    const count = await prisma.knowledgeBaseDocument.count({
      where: {
        userId,
        deletedAt: null,
        isArchived: false,
        processingStatus: ProcessingStatus.COMPLETED,
        isEmbedded: true,
      },
      take: 1,
    });
    return count > 0;
  }

  async incrementRetrievalCount(documentId: string) {
    return prisma.knowledgeBaseDocument.update({
      where: { id: documentId },
      data: {
        retrievalCount: { increment: 1 },
        lastRetrievedAt: new Date(),
      },
    });
  }

  async insertChunksWithEmbeddings(
    documentId: string,
    chunks: {
      content: string;
      chunkIndex: number;
      tokenCount: number;
      heading: string | null;
      section: string | null;
      pageNumber: number | null;
      sourceOffsetStart: number;
      sourceOffsetEnd: number;
      documentVersion: number;
      embedding: number[] | null;
    }[]
  ) {
    if (chunks.length === 0) return;

    const values: any[] = [];
    const placeholders: string[] = [];
    let i = 1;

    for (const chunk of chunks) {
      const embeddingStr = chunk.embedding ? `[${chunk.embedding.join(',')}]` : null;
      const embeddingModel = chunk.embedding ? 'bge-small-en-v1.5' : null;

      placeholders.push(`(gen_random_uuid(), $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}::vector, $${i++}::jsonb, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++})`);
      
      values.push(
        documentId,
        chunk.chunkIndex,
        chunk.content,
        chunk.tokenCount,
        embeddingModel,
        embeddingStr,
        JSON.stringify({}),
        chunk.pageNumber,
        chunk.heading,
        chunk.section,
        chunk.sourceOffsetStart,
        chunk.sourceOffsetEnd,
        chunk.documentVersion
      );
    }

    const query = `
      INSERT INTO "KnowledgeBaseChunk" (
        id, "documentId", "chunkIndex", content, "tokenCount",
        "embeddingModel", embedding, metadata,
        "pageNumber", heading, section,
        "sourceOffsetStart", "sourceOffsetEnd", "documentVersion"
      ) VALUES ${placeholders.join(', ')}
    `;

    await prisma.$executeRawUnsafe(query, ...values);
  }

  async updateDocumentStatus(
    documentId: string,
    status: ProcessingStatus,
    extra?: Partial<{
      chunkCount: number;
      processedAt: Date;
      embeddedAt: Date;
      isEmbedded: boolean;
      processingError: string;
    }>
  ) {
    return prisma.knowledgeBaseDocument.update({
      where: { id: documentId },
      data: {
        processingStatus: status,
        ...extra,
      },
    });
  }

  async getUserStorageUsed(userId: string): Promise<number> {
    const result = await prisma.knowledgeBaseDocument.aggregate({
      where: { userId, deletedAt: null },
      _sum: { fileSize: true },
    });
    return result._sum.fileSize || 0;
  }

  async getUserDocumentCount(userId: string): Promise<number> {
    return prisma.knowledgeBaseDocument.count({
      where: { userId, deletedAt: null },
    });
  }

  async updateDocumentVersion(documentId: string) {
    return prisma.knowledgeBaseDocument.update({
      where: { id: documentId },
      data: {
        version: { increment: 1 },
      },
    });
  }
}
