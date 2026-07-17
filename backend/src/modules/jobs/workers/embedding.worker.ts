import { JobType, ProcessingStatus } from '@prisma/client';
import { logger } from '../../../config/logger';
import { env } from '../../../config/env';
import { jobService } from '../job.service';
import { localEmbeddingService } from '../../knowledge/services/local-embedding.service';
import { RetrievalService } from '../../knowledge/services/retrieval.service';
import { emitToUser } from '../../../socket';
import { prisma } from '../../../lib/prisma';

const retrievalService = new RetrievalService();

export class EmbeddingWorker {
  private workerId: string;
  private isRunning: boolean = false;

  constructor(id: number) {
    this.workerId = `embedding-worker-${id}`;
  }

  public async start() {
    this.isRunning = true;
    logger.info(`Started ${this.workerId}`);
    this.poll();
  }

  public stop() {
    this.isRunning = false;
    logger.info(`Stopped ${this.workerId}`);
  }

  private async poll() {
    while (this.isRunning) {
      try {
        const job = await jobService.claimJob(this.workerId, JobType.DOCUMENT_EMBEDDING);

        if (job) {
          await this.processJob(job);
        } else {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        logger.error({ error, workerId: this.workerId }, 'Error in worker polling loop');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  private async processJob(job: any) {
    const documentId = job.entityId;
    const userId = job.userId;

    try {
      logger.info({ jobId: job.id, documentId }, `${this.workerId} processing job`);

      emitToUser(userId, 'knowledge:embedding_started', { documentId });

      const chunks = await prisma.knowledgeBaseChunk.findMany({
        where: { documentId, deletedAt: null },
        orderBy: { chunkIndex: 'asc' }
      });

      if (chunks.length === 0) {
        await jobService.completeJob(job.id);
        return;
      }

      const totalChunks = chunks.length;
      const batchSize = env.EMBEDDING_BATCH_SIZE;

      for (let i = 0; i < totalChunks; i += batchSize) {
        const docCheck = await prisma.knowledgeBaseDocument.findUnique({
          where: { id: documentId },
          select: { deletedAt: true, processingStatus: true }
        });

        if (!docCheck || docCheck.deletedAt !== null) {
          logger.warn({ jobId: job.id, documentId }, 'Document deleted or ineligible. Aborting job gracefully.');
          await jobService.failJob(job.id, 'Document deleted during processing', ProcessingStatus.SKIPPED);
          return;
        }

        const batch = chunks.slice(i, i + batchSize);
        const texts = batch.map(c => c.content);

        const embeddings = await localEmbeddingService.embedBatch(texts);

        for (let j = 0; j < batch.length; j++) {
          const chunk = batch[j];
          const embeddingStr = `[${embeddings[j].join(',')}]`;

          await prisma.$executeRawUnsafe(`
            UPDATE "KnowledgeBaseChunk"
            SET embedding = $1::vector, "embeddingModel" = 'bge-small-en-v1.5'
            WHERE id = $2
          `, embeddingStr, chunk.id);
        }

        const progress = Math.min(100, Math.round(((i + batch.length) / totalChunks) * 100));
        emitToUser(userId, 'knowledge:embedding_progress', { documentId, progress, processedChunks: i + batch.length, totalChunks });

        await new Promise(resolve => setImmediate(resolve));
      }

      await prisma.knowledgeBaseDocument.update({
        where: { id: documentId },
        data: {
          isEmbedded: true,
          embeddedAt: new Date(),
          processingStatus: ProcessingStatus.COMPLETED,
          chunkCount: totalChunks
        }
      });

      await jobService.completeJob(job.id);
      retrievalService.clearCacheForUser(userId);
      logger.info({ jobId: job.id, documentId }, `${this.workerId} completed job`);
      emitToUser(userId, 'knowledge:ready', { documentId, chunkCount: totalChunks });

    } catch (error: any) {
      logger.error({ error, jobId: job.id, documentId }, 'Job processing failed');
      await jobService.failJob(job.id, error.message || 'Unknown error');
      emitToUser(userId, 'knowledge:failed', { documentId, error: 'Failed to process document embeddings' });
    }
  }
}
