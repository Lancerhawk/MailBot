import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../../middlewares/auth.middleware';
import { KnowledgeController } from './knowledge.controller';

const router = Router();
const controller = new KnowledgeController();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

router.use(requireAuth);

router.post('/upload', upload.single('file'), controller.upload);

router.get('/', controller.list);
router.get('/stats', controller.getStats);
router.get('/folders', controller.getFolders);
router.get('/search', controller.search);
router.get('/download/:id', controller.download);

router.get('/:id', controller.getOne);
router.patch('/:id', controller.update);
router.patch('/:id/archive', controller.archive);
router.patch('/:id/restore', controller.restore);
router.patch('/:id/retry', controller.retry);
router.post('/:id/replace', upload.single('file'), controller.replace);
router.delete('/:id', controller.remove);

export default router;
