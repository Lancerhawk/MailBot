"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jobService = exports.JobService = void 0;
const client_1 = require("@prisma/client");
const logger_1 = require("../../config/logger");
const env_1 = require("../../config/env");
const prisma_1 = require("../../lib/prisma");
class JobService {
    async createJob(userId, jobType, entityType, entityId, priority = 0) {
        const existing = await prisma_1.prisma.processingJob.findFirst({
            where: {
                entityId,
                jobType,
                status: { in: [client_1.ProcessingStatus.PENDING, client_1.ProcessingStatus.PROCESSING] }
            }
        });
        if (existing) {
            logger_1.logger.info({ jobId: existing.id, jobType, entityId }, 'Job already exists in PENDING or PROCESSING state. Skipping creation.');
            return null;
        }
        const job = await prisma_1.prisma.processingJob.create({
            data: {
                userId,
                jobType,
                entityType,
                entityId,
                priority,
                status: client_1.ProcessingStatus.PENDING
            }
        });
        logger_1.logger.info({ jobId: job.id, jobType, entityId }, 'Created new ProcessingJob');
        return job;
    }
    async claimJob(workerId, jobType) {
        try {
            const rawJob = await prisma_1.prisma.$queryRawUnsafe(`
        UPDATE "ProcessingJob"
        SET status = 'PROCESSING', "workerId" = $1, "startedAt" = NOW(), "updatedAt" = NOW()
        WHERE id = (
          SELECT id
          FROM "ProcessingJob"
          WHERE status = 'PENDING' AND "jobType" = $2::"JobType"
          ORDER BY priority DESC, "createdAt" ASC
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        )
        RETURNING *;
      `, workerId, jobType);
            if (rawJob && rawJob.length > 0) {
                return rawJob[0];
            }
            return null;
        }
        catch (error) {
            logger_1.logger.error({ error, workerId, jobType }, 'Failed to atomically claim job');
            return null;
        }
    }
    async completeJob(jobId) {
        await prisma_1.prisma.processingJob.update({
            where: { id: jobId },
            data: {
                status: client_1.ProcessingStatus.COMPLETED,
                completedAt: new Date()
            }
        });
    }
    async failJob(jobId, errorMsg, status = client_1.ProcessingStatus.FAILED) {
        const job = await prisma_1.prisma.processingJob.findUnique({ where: { id: jobId } });
        if (!job)
            return;
        const attempts = job.attempts + 1;
        let nextStatus = status;
        if (status === client_1.ProcessingStatus.FAILED && attempts < job.maxAttempts) {
            nextStatus = client_1.ProcessingStatus.PENDING;
        }
        await prisma_1.prisma.processingJob.update({
            where: { id: jobId },
            data: {
                status: nextStatus,
                errorLog: errorMsg,
                attempts: attempts
            }
        });
    }
    async recoverStaleJobs() {
        const timeoutMs = env_1.env.PROCESSING_JOB_TIMEOUT;
        const staleThreshold = new Date(Date.now() - timeoutMs);
        const result = await prisma_1.prisma.processingJob.updateMany({
            where: {
                status: client_1.ProcessingStatus.PROCESSING,
                startedAt: {
                    lt: staleThreshold
                }
            },
            data: {
                status: client_1.ProcessingStatus.PENDING,
                workerId: null,
                errorLog: 'Recovered stale job due to timeout'
            }
        });
        if (result.count > 0) {
            logger_1.logger.warn(`Recovered ${result.count} stale ProcessingJobs`);
        }
        return result.count;
    }
}
exports.JobService = JobService;
exports.jobService = new JobService();
