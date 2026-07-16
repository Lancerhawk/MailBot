import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware';
import { AnalyticsController } from './analytics.controller';

const router = Router();
const controller = new AnalyticsController();

router.use(requireAuth);


router.get('/overview', controller.getOverview.bind(controller));
router.get('/charts', controller.getCharts.bind(controller));
router.get('/email', controller.getEmail.bind(controller));
router.get('/ai', controller.getAi.bind(controller));
router.get('/knowledge', controller.getKnowledge.bind(controller));
router.get('/contacts', controller.getContacts.bind(controller));
router.get('/activity', controller.getActivity.bind(controller));
router.get('/export', controller.exportData.bind(controller));
router.get('/export-json', controller.exportJson.bind(controller));

export { router as analyticsRouter };
