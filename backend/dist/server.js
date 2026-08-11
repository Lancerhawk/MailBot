"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importStar(require("./app"));
const env_1 = require("./config/env");
const logger_1 = require("./config/logger");
const prisma_1 = require("./lib/prisma");
const socket_1 = require("./socket");
const local_embedding_service_1 = require("./modules/knowledge/services/local-embedding.service");
const embedding_worker_1 = require("./modules/jobs/workers/embedding.worker");
const description_worker_1 = require("./modules/jobs/workers/description.worker");
const sync_worker_1 = require("./modules/jobs/workers/sync.worker");
const draft_worker_1 = require("./modules/jobs/workers/draft.worker");
const job_service_1 = require("./modules/jobs/job.service");
const watch_renewal_service_1 = require("./modules/gmail/services/watch-renewal.service");
const worker_manager_1 = require("./modules/jobs/worker-manager");
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
        const renewalInterval = setInterval(() => {
            renewalService.runRenewalJob().catch((e) => logger_1.logger.error({ err: e }, 'Failed scheduled watch renewal'));
        }, 24 * 60 * 60 * 1000);
        worker_manager_1.WorkerManager.setRenewalInterval(renewalInterval);
        if (env_1.env.WORKER_MODE === 'local') {
            logger_1.logger.info('[WorkerMode: LOCAL] Initializing local embedding service and background workers...');
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
            const recoveryInterval = setInterval(() => {
                job_service_1.jobService.recoverStaleJobs().catch((e) => logger_1.logger.error({ err: e }, 'Failed to recover stale jobs'));
            }, 5 * 60 * 1000);
            worker_manager_1.WorkerManager.setRecoveryInterval(recoveryInterval);
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
    worker_manager_1.WorkerManager.stopAll();
    if (server) {
        server.close(() => {
            logger_1.logger.info('Server closed gracefully');
            Promise.all([prisma_1.prisma.$disconnect(), app_1.pgPool.end()]).then(() => {
                logger_1.logger.info('Database connections closed gracefully');
                process.exit(0);
            });
        });
    }
    else {
        Promise.all([prisma_1.prisma.$disconnect(), app_1.pgPool.end()]).then(() => {
            process.exit(0);
        });
    }
});
process.on('SIGINT', () => {
    logger_1.logger.info('SIGINT received');
    worker_manager_1.WorkerManager.stopAll();
    if (server) {
        server.close(() => {
            logger_1.logger.info('Server closed gracefully');
            Promise.all([prisma_1.prisma.$disconnect(), app_1.pgPool.end()]).then(() => {
                logger_1.logger.info('Database connections closed gracefully');
                process.exit(0);
            });
        });
    }
    else {
        Promise.all([prisma_1.prisma.$disconnect(), app_1.pgPool.end()]).then(() => {
            process.exit(0);
        });
    }
});
