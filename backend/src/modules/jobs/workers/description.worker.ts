import { JobType, ProcessingStatus } from '@prisma/client';
import { logger } from '../../../config/logger';
import { jobService } from '../job.service';
import { GroqService } from '../../ai/groq.service';
import { prisma } from '../../../lib/prisma';
import { emitToUser } from '../../../socket';

const groqService = new GroqService();

export class DescriptionWorker {
  private workerId: string;
  private isRunning: boolean = false;

  constructor(id: number) {
    this.workerId = `description-worker-${id}`;
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
        const job = await jobService.claimJob(this.workerId, JobType.DOCUMENT_DESCRIPTION);

        if (job) {
          await this.processJob(job);
        } else {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        logger.error({ error, workerId: this.workerId }, 'Error in description worker polling loop');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  private async processJob(job: any) {
    const documentId = job.entityId;
    const userId = job.userId;

    try {
      logger.info({ jobId: job.id, documentId }, `${this.workerId} processing description job`);

      const doc = await prisma.knowledgeBaseDocument.findUnique({
        where: { id: documentId }
      });

      if (!doc || doc.deletedAt !== null) {
        logger.warn({ jobId: job.id, documentId }, 'Document deleted or ineligible. Aborting job gracefully.');
        await jobService.failJob(job.id, 'Document deleted', ProcessingStatus.SKIPPED);
        return;
      }

      if (doc.description && doc.description.trim().length > 0) {
        logger.info({ documentId }, 'Document already has a description. Skipping AI generation to preserve existing/user metadata.');
        await jobService.completeJob(job.id);
        return;
      }

      const chunks = await prisma.knowledgeBaseChunk.findMany({
        where: { documentId, deletedAt: null },
        orderBy: { chunkIndex: 'asc' },
        select: { content: true, heading: true, chunkIndex: true }
      });

      if (chunks.length === 0) {
        await jobService.completeJob(job.id);
        return;
      }

      const MAX_CHARS = 12000;
      let sampledChunks = [];
      const totalChars = chunks.reduce((acc, c) => acc + c.content.length, 0);

      if (totalChars <= MAX_CHARS) {
        sampledChunks = chunks;
      } else {
        const beginning = chunks.slice(0, 2);
        const end = chunks.slice(-2);
        const withHeadings = chunks.filter(c => c.heading && c.heading.length > 0);

        const middleIndex = Math.floor(chunks.length / 2);
        const middle = chunks.slice(Math.max(0, middleIndex - 1), Math.min(chunks.length, middleIndex + 1));

        const uniqueChunks = new Map();
        [...beginning, ...withHeadings, ...middle, ...end].forEach(c => {
          uniqueChunks.set(c.chunkIndex, c);
        });

        let currentChars = 0;
        const sortedUnique = Array.from(uniqueChunks.values()).sort((a, b) => a.chunkIndex - b.chunkIndex);

        for (const c of sortedUnique) {
          if (currentChars + c.content.length <= MAX_CHARS) {
            sampledChunks.push(c);
            currentChars += c.content.length;
          }
        }
      }

      const sampledText = sampledChunks.map(c => c.content).join('\n\n');

      const summary = await groqService.generateDocumentDescription(userId, sampledText);

      if (summary && summary.trim().length > 0) {
        const currentDoc = await prisma.knowledgeBaseDocument.findUnique({
          where: { id: documentId },
          select: { description: true }
        });

        if (!currentDoc?.description) {
          await prisma.knowledgeBaseDocument.update({
            where: { id: documentId },
            data: { description: summary.trim() }
          });
          emitToUser(userId, 'knowledge:updated', { documentId });
        }
      }

      await jobService.completeJob(job.id);
      logger.info({ jobId: job.id, documentId }, `${this.workerId} completed job`);

    } catch (error: any) {
      logger.error({ error, jobId: job.id, documentId }, 'Description job processing failed');
      await jobService.failJob(job.id, error.message || 'Unknown error');
    }
  }
}
