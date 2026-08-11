"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncWorker = void 0;
const client_1 = require("@prisma/client");
const logger_1 = require("../../../config/logger");
const job_service_1 = require("../job.service");
const gmail_sync_service_1 = require("../../gmail/services/gmail.sync.service");
const syncService = new gmail_sync_service_1.GmailSyncService();
class SyncWorker {
    workerId;
    isRunning = false;
    constructor(id) {
        this.workerId = `sync-worker-${id}`;
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
                const job = await job_service_1.jobService.claimJob(this.workerId, client_1.JobType.EMAIL_SYNC);
                if (job) {
                    await this.processJob(job);
                }
                else {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
            catch (error) {
                logger_1.logger.error({ error, workerId: this.workerId }, 'Error in sync worker polling loop');
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
    }
    async processJob(job) {
        const userId = job.entityId;
        try {
            logger_1.logger.info({ jobId: job.id, userId }, 'Starting background email sync');
            // Execute the actual sync logic
            await syncService.startSync(userId);
            logger_1.logger.info({ jobId: job.id, userId }, 'Completed background email sync');
            await job_service_1.jobService.completeJob(job.id);
        }
        catch (error) {
            logger_1.logger.error({ err: error, jobId: job.id, userId }, 'Failed background email sync');
            await job_service_1.jobService.failJob(job.id, error.message || 'Unknown error during sync');
        }
    }
}
exports.SyncWorker = SyncWorker;
