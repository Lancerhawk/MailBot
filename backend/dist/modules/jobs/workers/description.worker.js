"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DescriptionWorker = void 0;
const client_1 = require("@prisma/client");
const logger_1 = require("../../../config/logger");
const job_service_1 = require("../job.service");
const groq_service_1 = require("../../ai/groq.service");
const prisma_1 = require("../../../lib/prisma");
const socket_1 = require("../../../socket");
const groqService = new groq_service_1.GroqService();
class DescriptionWorker {
    workerId;
    isRunning = false;
    constructor(id) {
        this.workerId = `description-worker-${id}`;
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
                const job = await job_service_1.jobService.claimJob(this.workerId, client_1.JobType.DOCUMENT_DESCRIPTION);
                if (job) {
                    await this.processJob(job);
                }
                else {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
            catch (error) {
                logger_1.logger.error({ error, workerId: this.workerId }, 'Error in description worker polling loop');
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
    }
    async processJob(job) {
        const documentId = job.entityId;
        const userId = job.userId;
        try {
            logger_1.logger.info({ jobId: job.id, documentId }, `${this.workerId} processing description job`);
            const doc = await prisma_1.prisma.knowledgeBaseDocument.findUnique({
                where: { id: documentId }
            });
            if (!doc || doc.deletedAt !== null) {
                logger_1.logger.warn({ jobId: job.id, documentId }, 'Document deleted or ineligible. Aborting job gracefully.');
                await job_service_1.jobService.failJob(job.id, 'Document deleted', client_1.ProcessingStatus.SKIPPED);
                return;
            }
            if (doc.description && doc.description.trim().length > 0) {
                logger_1.logger.info({ documentId }, 'Document already has a description. Skipping AI generation to preserve existing/user metadata.');
                await job_service_1.jobService.completeJob(job.id);
                return;
            }
            const chunks = await prisma_1.prisma.knowledgeBaseChunk.findMany({
                where: { documentId, deletedAt: null },
                orderBy: { chunkIndex: 'asc' },
                select: { content: true, heading: true, chunkIndex: true }
            });
            if (chunks.length === 0) {
                await job_service_1.jobService.completeJob(job.id);
                return;
            }
            const MAX_CHARS = 12000;
            let sampledChunks = [];
            const totalChars = chunks.reduce((acc, c) => acc + c.content.length, 0);
            if (totalChars <= MAX_CHARS) {
                sampledChunks = chunks;
            }
            else {
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
                const currentDoc = await prisma_1.prisma.knowledgeBaseDocument.findUnique({
                    where: { id: documentId },
                    select: { description: true }
                });
                if (!currentDoc?.description) {
                    await prisma_1.prisma.knowledgeBaseDocument.update({
                        where: { id: documentId },
                        data: { description: summary.trim() }
                    });
                    (0, socket_1.emitToUser)(userId, 'knowledge:updated', { documentId });
                }
            }
            await job_service_1.jobService.completeJob(job.id);
            logger_1.logger.info({ jobId: job.id, documentId }, `${this.workerId} completed job`);
        }
        catch (error) {
            logger_1.logger.error({ error, jobId: job.id, documentId }, 'Description job processing failed');
            await job_service_1.jobService.failJob(job.id, error.message || 'Unknown error');
        }
    }
}
exports.DescriptionWorker = DescriptionWorker;
