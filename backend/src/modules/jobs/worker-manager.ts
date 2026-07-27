import { logger } from '../../config/logger';

export interface StoppableWorker {
  stop: () => void;
}

export class WorkerManager {
  private static workers: StoppableWorker[] = [];
  private static recoveryInterval: NodeJS.Timeout | null = null;
  private static renewalInterval: NodeJS.Timeout | null = null;

  public static register(worker: StoppableWorker): void {
    this.workers.push(worker);
  }

  public static setRecoveryInterval(interval: NodeJS.Timeout): void {
    this.recoveryInterval = interval;
  }

  public static setRenewalInterval(interval: NodeJS.Timeout): void {
    this.renewalInterval = interval;
  }

  public static stopAll(): void {
    logger.info(`[WorkerManager] Stopping ${this.workers.length} background workers...`);
    for (const worker of this.workers) {
      try {
        worker.stop();
      } catch (error) {
        logger.error({ err: error }, '[WorkerManager] Failed to stop worker');
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
    logger.info('[WorkerManager] All workers and background intervals stopped gracefully.');
  }
}
