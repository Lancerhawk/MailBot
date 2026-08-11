import { JobType } from '@prisma/client';
import { logger } from '../../../config/logger';
import { jobService } from '../job.service';
import { GmailSyncService } from '../../gmail/services/gmail.sync.service';

const syncService = new GmailSyncService();

export class SyncWorker {
  private workerId: string;
  private isRunning: boolean = false;

  constructor(id: number) {
    this.workerId = `sync-worker-${id}`;
  }

  public async start() {
    this.isRunning = true;
    logger.info(`Started ${this.workerId}`);
    this.poll();
  }

  public stop() {
    this.isRunning = false;
    logger.info(`Stopped ${this.workerId}`);
  }

  private async poll() {
    while (this.isRunning) {
      try {
        const job = await jobService.claimJob(this.workerId, JobType.EMAIL_SYNC);

        if (job) {
          await this.processJob(job);
        } else {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        logger.error({ error, workerId: this.workerId }, 'Error in sync worker polling loop');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  private async processJob(job: any) {
    const userId = job.entityId;

    try {
      logger.info({ jobId: job.id, userId }, 'Starting background email sync');
      
      // Execute the actual sync logic
      await syncService.startSync(userId);

      logger.info({ jobId: job.id, userId }, 'Completed background email sync');
      await jobService.completeJob(job.id);
    } catch (error: any) {
      logger.error({ err: error, jobId: job.id, userId }, 'Failed background email sync');
      await jobService.failJob(job.id, error.message || 'Unknown error during sync');
    }
  }
}
