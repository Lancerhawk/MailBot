import { JobType } from '@prisma/client';
import { logger } from '../../../config/logger';
import { jobService } from '../job.service';
import { DraftService } from '../../draft/draft.service';

const draftService = new DraftService();

export class DraftWorker {
  private workerId: string;
  private isRunning: boolean = false;

  constructor(id: number) {
    this.workerId = `draft-worker-${id}`;
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
        const job = await jobService.claimJob(this.workerId, JobType.DRAFT_GENERATION);

        if (job) {
          await this.processJob(job);
        } else {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        logger.error({ error, workerId: this.workerId }, 'Error in draft worker polling loop');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  private async processJob(job: any) {
    const userId = job.userId;
    const emailId = job.entityId;

    try {
      logger.info({ jobId: job.id, userId, emailId }, 'Starting background draft generation');
      
      // Execute the actual draft logic
      // Note: the force flag is passed as true so it regenerates if necessary
      await draftService.generateDraft(userId, emailId, true);

      logger.info({ jobId: job.id, userId, emailId }, 'Completed background draft generation');
      await jobService.completeJob(job.id);
    } catch (error: any) {
      logger.error({ err: error, jobId: job.id, userId, emailId }, 'Failed background draft generation');
      await jobService.failJob(job.id, error.message || 'Unknown error during draft generation');
    }
  }
}
