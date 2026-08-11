"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DraftWorker = void 0;
const client_1 = require("@prisma/client");
const logger_1 = require("../../../config/logger");
const job_service_1 = require("../job.service");
const draft_service_1 = require("../../draft/draft.service");
const draftService = new draft_service_1.DraftService();
class DraftWorker {
    workerId;
    isRunning = false;
    constructor(id) {
        this.workerId = `draft-worker-${id}`;
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
                const job = await job_service_1.jobService.claimJob(this.workerId, client_1.JobType.DRAFT_GENERATION);
                if (job) {
                    await this.processJob(job);
                }
                else {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
            catch (error) {
                logger_1.logger.error({ error, workerId: this.workerId }, 'Error in draft worker polling loop');
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
    }
    async processJob(job) {
        const userId = job.userId;
        const emailId = job.entityId;
        try {
            logger_1.logger.info({ jobId: job.id, userId, emailId }, 'Starting background draft generation');
            // Execute the actual draft logic
            // Note: the force flag is passed as true so it regenerates if necessary
            await draftService.generateDraft(userId, emailId, true);
            logger_1.logger.info({ jobId: job.id, userId, emailId }, 'Completed background draft generation');
            await job_service_1.jobService.completeJob(job.id);
        }
        catch (error) {
            logger_1.logger.error({ err: error, jobId: job.id, userId, emailId }, 'Failed background draft generation');
            await job_service_1.jobService.failJob(job.id, error.message || 'Unknown error during draft generation');
        }
    }
}
exports.DraftWorker = DraftWorker;
