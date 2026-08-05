import app, { pgPool } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { prisma } from './lib/prisma';
import { Server } from 'http';
import { initSocket } from './socket';
import { localEmbeddingService } from './modules/knowledge/services/local-embedding.service';
import { EmbeddingWorker } from './modules/jobs/workers/embedding.worker';
import { DescriptionWorker } from './modules/jobs/workers/description.worker';
import { jobService } from './modules/jobs/job.service';
import { WatchRenewalService } from './modules/gmail/services/watch-renewal.service';
import { WorkerManager } from './modules/jobs/worker-manager';

let server: Server;

const startServer = async () => {
  (BigInt.prototype as any).toJSON = function () {
    return this.toString();
  };

  try {
    await prisma.$connect();
    logger.info('Connected to PostgreSQL Database via Prisma');

    server = app.listen(env.PORT, () => {
      logger.info(`Server is running on port ${env.PORT} in ${env.NODE_ENV} mode`);
    });

    initSocket(server);

    const renewalService = new WatchRenewalService();
    renewalService.runRenewalJob().catch((e: any) => logger.error({ err: e }, 'Failed initial watch renewal'));
    const renewalInterval = setInterval(() => {
      renewalService.runRenewalJob().catch((e: any) => logger.error({ err: e }, 'Failed scheduled watch renewal'));
    }, 24 * 60 * 60 * 1000);
    WorkerManager.setRenewalInterval(renewalInterval);

    if (env.WORKER_MODE === 'local') {
      logger.info('[WorkerMode: LOCAL] Initializing local embedding service and background workers...');
      await localEmbeddingService.init();

      const workerCount = env.EMBEDDING_WORKERS;
      const workers: EmbeddingWorker[] = [];
      const descWorkers: DescriptionWorker[] = [];
      for (let i = 1; i <= workerCount; i++) {
        const worker = new EmbeddingWorker(i);
        worker.start();
        workers.push(worker);
        WorkerManager.register(worker);

        const descWorker = new DescriptionWorker(i);
        descWorker.start();
        descWorkers.push(descWorker);
        WorkerManager.register(descWorker);
      }

      const recoveryInterval = setInterval(() => {
        jobService.recoverStaleJobs().catch((e: any) => logger.error({ err: e }, 'Failed to recover stale jobs'));
      }, 5 * 60 * 1000);
      WorkerManager.setRecoveryInterval(recoveryInterval);
    } else {
      logger.info('[WorkerMode: REMOTE] Skipping local embedding & description workers. Standalone worker service will process ProcessingJob queue.');
    }

  } catch (error: any) {
    logger.fatal({ err: error, errorMessage: error.message }, 'Failed to start server');
    process.exit(1);
  }
};

startServer();

const unexpectedErrorHandler = (error: Error) => {
  logger.error({ error }, 'Uncaught Exception or Unhandled Rejection');
  if (server) {
    server.close(() => {
      logger.info('Server closed');
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
};

process.on('uncaughtException', unexpectedErrorHandler);
process.on('unhandledRejection', unexpectedErrorHandler);

process.on('SIGTERM', () => {
  logger.info('SIGTERM received');
  WorkerManager.stopAll();
  if (server) {
    server.close(() => {
      logger.info('Server closed gracefully');
      Promise.all([prisma.$disconnect(), pgPool.end()]).then(() => {
        logger.info('Database connections closed gracefully');
        process.exit(0);
      });
    });
  } else {
    Promise.all([prisma.$disconnect(), pgPool.end()]).then(() => {
      process.exit(0);
    });
  }
});

process.on('SIGINT', () => {
  logger.info('SIGINT received');
  WorkerManager.stopAll();
  if (server) {
    server.close(() => {
      logger.info('Server closed gracefully');
      Promise.all([prisma.$disconnect(), pgPool.end()]).then(() => {
        logger.info('Database connections closed gracefully');
        process.exit(0);
      });
    });
  } else {
    Promise.all([prisma.$disconnect(), pgPool.end()]).then(() => {
      process.exit(0);
    });
  }
});
