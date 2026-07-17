"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmbeddingWorker = void 0;
const client_1 = require("@prisma/client");
const logger_1 = require("../../../config/logger");
const env_1 = require("../../../config/env");
const job_service_1 = require("../job.service");
const local_embedding_service_1 = require("../../knowledge/services/local-embedding.service");
const retrieval_service_1 = require("../../knowledge/services/retrieval.service");
const socket_1 = require("../../../socket");
const prisma_1 = require("../../../lib/prisma");
const retrievalService = new retrieval_service_1.RetrievalService();
class EmbeddingWorker {
    workerId;
    isRunning = false;
    constructor(id) {
        this.workerId = `embedding-worker-${id}`;
    }
    async start() {
        this.isRunning = true;
        logger_1.logger.info(`Started ${this.workerId}`);
        this.poll();
    }
    stop() {
        this.isRunning = false;
        logger_1.logger.info(`Stopped ${this.workerId}`);
    }
    async poll() {
        while (this.isRunning) {
            try {
                const job = await job_service_1.jobService.claimJob(this.workerId, client_1.JobType.DOCUMENT_EMBEDDING);
                if (job) {
                    await this.processJob(job);
                }
                else {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
            catch (error) {
                logger_1.logger.error({ error, workerId: this.workerId }, 'Error in worker polling loop');
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
    }
    async processJob(job) {
        const documentId = job.entityId;
        const userId = job.userId;
        try {
            logger_1.logger.info({ jobId: job.id, documentId }, `${this.workerId} processing job`);
            (0, socket_1.emitToUser)(userId, 'knowledge:embedding_started', { documentId });
            const chunks = await prisma_1.prisma.knowledgeBaseChunk.findMany({
                where: { documentId, deletedAt: null },
                orderBy: { chunkIndex: 'asc' }
            });
            if (chunks.length === 0) {
                await job_service_1.jobService.completeJob(job.id);
                return;
            }
            const totalChunks = chunks.length;
            const batchSize = env_1.env.EMBEDDING_BATCH_SIZE;
            for (let i = 0; i < totalChunks; i += batchSize) {
                const docCheck = await prisma_1.prisma.knowledgeBaseDocument.findUnique({
                    where: { id: documentId },
                    select: { deletedAt: true, processingStatus: true }
                });
                if (!docCheck || docCheck.deletedAt !== null) {
                    logger_1.logger.warn({ jobId: job.id, documentId }, 'Document deleted or ineligible. Aborting job gracefully.');
                    await job_service_1.jobService.failJob(job.id, 'Document deleted during processing', client_1.ProcessingStatus.SKIPPED);
                    return;
                }
                const batch = chunks.slice(i, i + batchSize);
                const texts = batch.map(c => c.content);
                const embeddings = await local_embedding_service_1.localEmbeddingService.embedBatch(texts);
                const updatePromises = batch.map((chunk, j) => {
                    const embeddingStr = `[${embeddings[j].join(',')}]`;
                    return prisma_1.prisma.$executeRawUnsafe(`
            UPDATE "KnowledgeBaseChunk"
            SET embedding = $1::vector, "embeddingModel" = 'bge-small-en-v1.5'
            WHERE id = $2
          `, embeddingStr, chunk.id);
                });
                // Execute all updates for this batch in a single transaction (1 network round-trip)
                await prisma_1.prisma.$transaction(updatePromises);
                const progress = Math.min(100, Math.round(((i + batch.length) / totalChunks) * 100));
                (0, socket_1.emitToUser)(userId, 'knowledge:embedding_progress', { documentId, progress, processedChunks: i + batch.length, totalChunks });
                await new Promise(resolve => setImmediate(resolve));
            }
            await prisma_1.prisma.knowledgeBaseDocument.update({
                where: { id: documentId },
                data: {
                    isEmbedded: true,
                    embeddedAt: new Date(),
                    processingStatus: client_1.ProcessingStatus.COMPLETED,
                    chunkCount: totalChunks
                }
            });
            await job_service_1.jobService.completeJob(job.id);
            retrievalService.clearCacheForUser(userId);
            logger_1.logger.info({ jobId: job.id, documentId }, `${this.workerId} completed job`);
            (0, socket_1.emitToUser)(userId, 'knowledge:ready', { documentId, chunkCount: totalChunks });
        }
        catch (error) {
            logger_1.logger.error({ error, jobId: job.id, documentId }, 'Job processing failed');
            await job_service_1.jobService.failJob(job.id, error.message || 'Unknown error');
            (0, socket_1.emitToUser)(userId, 'knowledge:failed', { documentId, error: 'Failed to process document embeddings' });
        }
    }
}
exports.EmbeddingWorker = EmbeddingWorker;
