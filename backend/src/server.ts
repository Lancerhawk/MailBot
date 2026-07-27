import app from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { prisma } from './lib/prisma';
import { Server } from 'http';
import { initSocket } from './socket';
import { localEmbeddingService } from './modules/knowledge/services/local-embedding.service';
import { EmbeddingWorker } from './modules/jobs/workers/embedding.worker';
import { DescriptionWorker } from './modules/jobs/workers/description.worker';
import { jobService } from './modules/jobs/job.service';

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

    const WatchRenewalService = require('./modules/gmail/services/watch-renewal.service').WatchRenewalService;
    const renewalService = new WatchRenewalService();
    renewalService.runRenewalJob().catch((e: any) => logger.error({ err: e }, 'Failed initial watch renewal'));
    setInterval(() => {
      renewalService.runRenewalJob().catch((e: any) => logger.error({ err: e }, 'Failed scheduled watch renewal'));
    }, 24 * 60 * 60 * 1000);

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

        const descWorker = new DescriptionWorker(i);
        descWorker.start();
        descWorkers.push(descWorker);
      }

      setInterval(() => {
        jobService.recoverStaleJobs().catch((e: any) => logger.error({ err: e }, 'Failed to recover stale jobs'));
      }, 5 * 60 * 1000);
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
  if (server) {
    server.close(() => {
      logger.info('Server closed gracefully');
      prisma.$disconnect().then(() => {
        logger.info('Prisma disconnected gracefully');
        process.exit(0);
      });
    });
  }
});

process.on('SIGINT', () => {
  logger.info('SIGINT received');
  if (server) {
    server.close(() => {
      logger.info('Server closed gracefully');
      prisma.$disconnect().then(() => {
        logger.info('Prisma disconnected gracefully');
        process.exit(0);
      });
    });
  }
});
