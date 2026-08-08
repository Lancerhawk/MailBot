import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware';
import { regenerateLimiter } from '../../middlewares/rateLimiter';
import { validate } from '../../middlewares/validate.middleware';
import { DraftController } from './draft.controller';
import { updateDraftSchema } from './draft.validation';

const router = Router();
const draftController = new DraftController();

router.use(requireAuth);

router.get('/:emailId', draftController.getLatestDraft);
router.post('/:emailId/regenerate', regenerateLimiter, draftController.regenerateDraft);
router.put('/:draftId', validate(updateDraftSchema), draftController.updateDraft);
router.delete('/:draftId', draftController.discardDraft);

export default router;