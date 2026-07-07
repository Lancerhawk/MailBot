import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware';
import { DraftController } from './draft.controller';

const router = Router();
const draftController = new DraftController();

router.use(requireAuth);

router.get('/:emailId', draftController.getLatestDraft);
router.post('/:emailId/regenerate', draftController.regenerateDraft);
router.put('/:draftId', draftController.updateDraft);
router.delete('/:draftId', draftController.discardDraft);

export default router;
