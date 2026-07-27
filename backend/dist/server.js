"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const env_1 = require("./config/env");
const logger_1 = require("./config/logger");
const prisma_1 = require("./lib/prisma");
const socket_1 = require("./socket");
const local_embedding_service_1 = require("./modules/knowledge/services/local-embedding.service");
const embedding_worker_1 = require("./modules/jobs/workers/embedding.worker");
const description_worker_1 = require("./modules/jobs/workers/description.worker");
const job_service_1 = require("./modules/jobs/job.service");
const watch_renewal_service_1 = require("./modules/gmail/services/watch-renewal.service");
let server;
const startServer = async () => {
    BigInt.prototype.toJSON = function () {
        return this.toString();
    };
    try {
        await prisma_1.prisma.$connect();
        logger_1.logger.info('Connected to PostgreSQL Database via Prisma');
        server = app_1.default.listen(env_1.env.PORT, () => {
            logger_1.logger.info(`Server is running on port ${env_1.env.PORT} in ${env_1.env.NODE_ENV} mode`);
        });
        (0, socket_1.initSocket)(server);
        const renewalService = new watch_renewal_service_1.WatchRenewalService();
        renewalService.runRenewalJob().catch((e) => logger_1.logger.error({ err: e }, 'Failed initial watch renewal'));
        setInterval(() => {
            renewalService.runRenewalJob().catch((e) => logger_1.logger.error({ err: e }, 'Failed scheduled watch renewal'));
        }, 24 * 60 * 60 * 1000);
        if (env_1.env.WORKER_MODE === 'local') {
            logger_1.logger.info('[WorkerMode: LOCAL] Initializing local embedding service and background workers...');
            await local_embedding_service_1.localEmbeddingService.init();
            const workerCount = env_1.env.EMBEDDING_WORKERS;
            const workers = [];
            const descWorkers = [];
            for (let i = 1; i <= workerCount; i++) {
                const worker = new embedding_worker_1.EmbeddingWorker(i);
                worker.start();
                workers.push(worker);
                const descWorker = new description_worker_1.DescriptionWorker(i);
                descWorker.start();
                descWorkers.push(descWorker);
            }
            setInterval(() => {
                job_service_1.jobService.recoverStaleJobs().catch((e) => logger_1.logger.error({ err: e }, 'Failed to recover stale jobs'));
            }, 5 * 60 * 1000);
        }
        else {
            logger_1.logger.info('[WorkerMode: REMOTE] Skipping local embedding & description workers. Standalone worker service will process ProcessingJob queue.');
        }
    }
    catch (error) {
        logger_1.logger.fatal({ err: error, errorMessage: error.message }, 'Failed to start server');
        process.exit(1);
    }
};
startServer();
const unexpectedErrorHandler = (error) => {
    logger_1.logger.error({ error }, 'Uncaught Exception or Unhandled Rejection');
    if (server) {
        server.close(() => {
            logger_1.logger.info('Server closed');
            process.exit(1);
        });
    }
    else {
        process.exit(1);
    }
};
process.on('uncaughtException', unexpectedErrorHandler);
process.on('unhandledRejection', unexpectedErrorHandler);
process.on('SIGTERM', () => {
    logger_1.logger.info('SIGTERM received');
    if (server) {
        server.close(() => {
            logger_1.logger.info('Server closed gracefully');
            prisma_1.prisma.$disconnect().then(() => {
                logger_1.logger.info('Prisma disconnected gracefully');
                process.exit(0);
            });
        });
    }
});
process.on('SIGINT', () => {
    logger_1.logger.info('SIGINT received');
    if (server) {
        server.close(() => {
            logger_1.logger.info('Server closed gracefully');
            prisma_1.prisma.$disconnect().then(() => {
                logger_1.logger.info('Prisma disconnected gracefully');
                process.exit(0);
            });
        });
    }
});
