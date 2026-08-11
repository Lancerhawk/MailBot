"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const env_1 = require("./config/env");
const logger_1 = require("./config/logger");
const prisma_1 = require("./lib/prisma");
const local_embedding_service_1 = require("./modules/knowledge/services/local-embedding.service");
const embedding_worker_1 = require("./modules/jobs/workers/embedding.worker");
const description_worker_1 = require("./modules/jobs/workers/description.worker");
const sync_worker_1 = require("./modules/jobs/workers/sync.worker");
const draft_worker_1 = require("./modules/jobs/workers/draft.worker");
const job_service_1 = require("./modules/jobs/job.service");
const worker_manager_1 = require("./modules/jobs/worker-manager");
const startWorkerService = async () => {
    BigInt.prototype.toJSON = function () {
        return this.toString();
    };
    if (env_1.env.WORKER_MODE === 'local') {
        logger_1.logger.warn('[Worker Microservice] WORKER_MODE is set to "local" in .env. The API server already runs workers in local mode.');
        logger_1.logger.warn('[Worker Microservice] Exiting standalone worker process. Set WORKER_MODE="remote" in .env to run this service.');
        process.exit(0);
    }
    try {
        await prisma_1.prisma.$connect();
        logger_1.logger.info('Connected to PostgreSQL Database via Prisma for Standalone Worker Service');
        logger_1.logger.info('[Worker Microservice] Initializing local embedding service and loading Transformers.js models...');
        await local_embedding_service_1.localEmbeddingService.init();
        const workerCount = env_1.env.EMBEDDING_WORKERS;
        const workers = [];
        const descWorkers = [];
        const syncWorkers = [];
        const draftWorkers = [];
        for (let i = 1; i <= workerCount; i++) {
            const worker = new embedding_worker_1.EmbeddingWorker(i);
            worker.start();
            workers.push(worker);
            worker_manager_1.WorkerManager.register(worker);
            const descWorker = new description_worker_1.DescriptionWorker(i);
            descWorker.start();
            descWorkers.push(descWorker);
            worker_manager_1.WorkerManager.register(descWorker);
            const syncWorker = new sync_worker_1.SyncWorker(i);
            syncWorker.start();
            syncWorkers.push(syncWorker);
            worker_manager_1.WorkerManager.register(syncWorker);
            const draftWorker = new draft_worker_1.DraftWorker(i);
            draftWorker.start();
            draftWorkers.push(draftWorker);
            worker_manager_1.WorkerManager.register(draftWorker);
        }
        logger_1.logger.info(`[Worker Microservice] Successfully booted ${workerCount} EmbeddingWorkers, DescriptionWorkers, SyncWorkers, and DraftWorkers.`);
        logger_1.logger.info(`[Worker Microservice] Polling ProcessingJob table. Mode: ${env_1.env.WORKER_MODE} (Callback URL: ${env_1.env.API_SERVER_URL})`);
        const recoveryInterval = setInterval(() => {
            job_service_1.jobService.recoverStaleJobs().catch((e) => logger_1.logger.error({ err: e }, 'Failed to recover stale jobs'));
        }, 5 * 60 * 1000);
        worker_manager_1.WorkerManager.setRecoveryInterval(recoveryInterval);
    }
    catch (error) {
        logger_1.logger.fatal({ err: error, errorMessage: error.message }, 'Failed to start Standalone Worker Service');
        process.exit(1);
    }
};
startWorkerService();
const unexpectedErrorHandler = (error) => {
    logger_1.logger.error({ error }, 'Uncaught Exception or Unhandled Rejection in Worker Service');
    prisma_1.prisma.$disconnect().then(() => {
        process.exit(1);
    });
};
process.on('uncaughtException', unexpectedErrorHandler);
process.on('unhandledRejection', unexpectedErrorHandler);
process.on('SIGTERM', () => {
    logger_1.logger.info('SIGTERM received by Worker Service');
    worker_manager_1.WorkerManager.stopAll();
    prisma_1.prisma.$disconnect().then(() => {
        logger_1.logger.info('Prisma disconnected gracefully');
        process.exit(0);
    });
});
process.on('SIGINT', () => {
    logger_1.logger.info('SIGINT received by Worker Service');
    worker_manager_1.WorkerManager.stopAll();
    prisma_1.prisma.$disconnect().then(() => {
        logger_1.logger.info('Prisma disconnected gracefully');
        process.exit(0);
    });
});
