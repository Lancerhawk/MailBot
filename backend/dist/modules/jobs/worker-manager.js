"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkerManager = void 0;
const logger_1 = require("../../config/logger");
class WorkerManager {
    static workers = [];
    static recoveryInterval = null;
    static renewalInterval = null;
    static register(worker) {
        this.workers.push(worker);
    }
    static setRecoveryInterval(interval) {
        this.recoveryInterval = interval;
    }
    static setRenewalInterval(interval) {
        this.renewalInterval = interval;
    }
    static stopAll() {
        logger_1.logger.info(`[WorkerManager] Stopping ${this.workers.length} background workers...`);
        for (const worker of this.workers) {
            try {
                worker.stop();
            }
            catch (error) {
                logger_1.logger.error({ err: error }, '[WorkerManager] Failed to stop worker');
            }
        }
        if (this.recoveryInterval) {
            clearInterval(this.recoveryInterval);
            this.recoveryInterval = null;
        }
        if (this.renewalInterval) {
            clearInterval(this.renewalInterval);
            this.renewalInterval = null;
        }
        this.workers = [];
        logger_1.logger.info('[WorkerManager] All workers and background intervals stopped gracefully.');
    }
}
exports.WorkerManager = WorkerManager;
