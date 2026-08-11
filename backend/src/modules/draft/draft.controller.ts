import { Request, Response, NextFunction } from 'express';
import { DraftService } from './draft.service';
import { DraftDbService } from './draft.db.service';
import { ApiError } from '../../utils/ApiError';
import { AnalyticsEventService, AnalyticsEventType } from '../analytics/services/analytics-event.service';
import { logger } from '../../config/logger';
import { jobService } from '../jobs/job.service';
import { JobType, ProcessingEntityType } from '@prisma/client';

const draftService = new DraftService();
const draftDbService = new DraftDbService();

export class DraftController {
  async getLatestDraft(req: Request, res: Response, next: NextFunction) {
    try {
      const { emailId } = req.params;
      const userId = req.user?.id;

      if (!userId) throw new ApiError(401, 'Unauthorized');

      const draft = await draftDbService.getLatestFinalDraft(emailId, userId);

      if (!draft) {
        return res.status(200).json({ status: 'success', data: null });
      }

      res.status(200).json({ status: 'success', data: draft });
    } catch (error) {
      next(error);
    }
  }

  async regenerateDraft(req: Request, res: Response, next: NextFunction) {
    try {
      const { emailId } = req.params;
      const userId = req.user?.id;

      if (!userId) throw new ApiError(401, 'Unauthorized');

      if (await draftService.isGenerating(emailId)) {
        throw new ApiError(409, 'Draft generation already in progress for this email');
      }

      await jobService.createJob(
        userId,
        JobType.DRAFT_GENERATION,
        ProcessingEntityType.EMAIL,
        emailId
      );

      res.status(202).json({ status: 'success', message: 'Draft regeneration started' });
    } catch (error) {
      next(error);
    }
  }

  async updateDraft(req: Request, res: Response, next: NextFunction) {
    try {
      const { draftId } = req.params;
      const { editedText } = req.body;
      const userId = req.user?.id;

      if (!userId) throw new ApiError(401, 'Unauthorized');

      await draftDbService.updateDraftEditedText(draftId, userId, editedText);

      res.status(200).json({ status: 'success', message: 'Draft updated' });
    } catch (error) {
      next(error);
    }
  }

  async discardDraft(req: Request, res: Response, next: NextFunction) {
    try {
      const { draftId } = req.params;
      const userId = req.user?.id;

      if (!userId) throw new ApiError(401, 'Unauthorized');

      await draftDbService.discardDraft(draftId, userId);

      AnalyticsEventService.recordEvent(userId, AnalyticsEventType.DRAFT_REJECTED);

      res.status(200).json({ status: 'success', message: 'Draft discarded' });
    } catch (error) {
      next(error);
    }
  }
}
