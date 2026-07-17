import { ProcessingJob, JobType, ProcessingEntityType, ProcessingStatus } from '@prisma/client';
import { logger } from '../../config/logger';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';

export class JobService {

  async createJob(
    userId: string,
    jobType: JobType,
    entityType: ProcessingEntityType,
    entityId: string,
    priority: number = 0
  ): Promise<ProcessingJob | null> {

    const existing = await prisma.processingJob.findFirst({
      where: {
        entityId,
        jobType,
        status: { in: [ProcessingStatus.PENDING, ProcessingStatus.PROCESSING] }
      }
    });

    if (existing) {
      logger.info({ jobId: existing.id, jobType, entityId }, 'Job already exists in PENDING or PROCESSING state. Skipping creation.');
      return null;
    }

    const job = await prisma.processingJob.create({
      data: {
        userId,
        jobType,
        entityType,
        entityId,
        priority,
        status: ProcessingStatus.PENDING
      }
    });

    logger.info({ jobId: job.id, jobType, entityId }, 'Created new ProcessingJob');
    return job;
  }

  async claimJob(workerId: string, jobType: JobType): Promise<ProcessingJob | null> {
    try {
      const rawJob: any[] = await prisma.$queryRawUnsafe(`
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
        return rawJob[0] as ProcessingJob;
      }
      return null;
    } catch (error) {
      logger.error({ error, workerId, jobType }, 'Failed to atomically claim job');
      return null;
    }
  }
  async completeJob(jobId: string): Promise<void> {
    await prisma.processingJob.update({
      where: { id: jobId },
      data: {
        status: ProcessingStatus.COMPLETED,
        completedAt: new Date()
      }
    });
  }

  async failJob(jobId: string, errorMsg: string, status: ProcessingStatus = ProcessingStatus.FAILED): Promise<void> {
    const job = await prisma.processingJob.findUnique({ where: { id: jobId } });
    if (!job) return;

    const attempts = job.attempts + 1;
    let nextStatus = status;

    if (status === ProcessingStatus.FAILED && attempts < job.maxAttempts) {
      nextStatus = ProcessingStatus.PENDING;
    }

    await prisma.processingJob.update({
      where: { id: jobId },
      data: {
        status: nextStatus,
        errorLog: errorMsg,
        attempts: attempts
      }
    });
  }

  async recoverStaleJobs(): Promise<number> {
    const timeoutMs = env.PROCESSING_JOB_TIMEOUT;
    const staleThreshold = new Date(Date.now() - timeoutMs);

    const result = await prisma.processingJob.updateMany({
      where: {
        status: ProcessingStatus.PROCESSING,
        startedAt: {
          lt: staleThreshold
        }
      },
      data: {
        status: ProcessingStatus.PENDING,
        workerId: null,
        errorLog: 'Recovered stale job due to timeout'
      }
    });

    if (result.count > 0) {
      logger.warn(`Recovered ${result.count} stale ProcessingJobs`);
    }
    return result.count;
  }
}

export const jobService = new JobService();
