import { env } from './config/env';
import { logger } from './config/logger';
import { prisma } from './lib/prisma';
import { localEmbeddingService } from './modules/knowledge/services/local-embedding.service';
import { EmbeddingWorker } from './modules/jobs/workers/embedding.worker';
import { DescriptionWorker } from './modules/jobs/workers/description.worker';
import { SyncWorker } from './modules/jobs/workers/sync.worker';
import { DraftWorker } from './modules/jobs/workers/draft.worker';
import { jobService } from './modules/jobs/job.service';
import { WorkerManager } from './modules/jobs/worker-manager';

const startWorkerService = async () => {
  (BigInt.prototype as any).toJSON = function () {
    return this.toString();
  };

  if (env.WORKER_MODE === 'local') {
    logger.warn('[Worker Microservice] WORKER_MODE is set to "local" in .env. The API server already runs workers in local mode.');
    logger.warn('[Worker Microservice] Exiting standalone worker process. Set WORKER_MODE="remote" in .env to run this service.');
    process.exit(0);
  }

  try {
    await prisma.$connect();
    logger.info('Connected to PostgreSQL Database via Prisma for Standalone Worker Service');

    logger.info('[Worker Microservice] Initializing local embedding service and loading Transformers.js models...');
    await localEmbeddingService.init();

    const workerCount = env.EMBEDDING_WORKERS;
    const workers: EmbeddingWorker[] = [];
    const descWorkers: DescriptionWorker[] = [];
    const syncWorkers: SyncWorker[] = [];
    const draftWorkers: DraftWorker[] = [];

    for (let i = 1; i <= workerCount; i++) {
      const worker = new EmbeddingWorker(i);
      worker.start();
      workers.push(worker);
      WorkerManager.register(worker);

      const descWorker = new DescriptionWorker(i);
      descWorker.start();
      descWorkers.push(descWorker);
      WorkerManager.register(descWorker);

      const syncWorker = new SyncWorker(i);
      syncWorker.start();
      syncWorkers.push(syncWorker);
      WorkerManager.register(syncWorker);

      const draftWorker = new DraftWorker(i);
      draftWorker.start();
      draftWorkers.push(draftWorker);
      WorkerManager.register(draftWorker);
    }

    logger.info(`[Worker Microservice] Successfully booted ${workerCount} EmbeddingWorkers, DescriptionWorkers, SyncWorkers, and DraftWorkers.`);
    logger.info(`[Worker Microservice] Polling ProcessingJob table. Mode: ${env.WORKER_MODE} (Callback URL: ${env.API_SERVER_URL})`);

    const recoveryInterval = setInterval(() => {
      jobService.recoverStaleJobs().catch((e: any) => logger.error({ err: e }, 'Failed to recover stale jobs'));
    }, 5 * 60 * 1000);
    WorkerManager.setRecoveryInterval(recoveryInterval);

  } catch (error: any) {
    logger.fatal({ err: error, errorMessage: error.message }, 'Failed to start Standalone Worker Service');
    process.exit(1);
  }
};

startWorkerService();

const unexpectedErrorHandler = (error: Error) => {
  logger.error({ error }, 'Uncaught Exception or Unhandled Rejection in Worker Service');
  prisma.$disconnect().then(() => {
    process.exit(1);
  });
};

process.on('uncaughtException', unexpectedErrorHandler);
process.on('unhandledRejection', unexpectedErrorHandler);

process.on('SIGTERM', () => {
  logger.info('SIGTERM received by Worker Service');
  WorkerManager.stopAll();
  prisma.$disconnect().then(() => {
    logger.info('Prisma disconnected gracefully');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received by Worker Service');
  WorkerManager.stopAll();
  prisma.$disconnect().then(() => {
    logger.info('Prisma disconnected gracefully');
    process.exit(0);
  });
});
