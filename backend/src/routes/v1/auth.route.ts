import { Router } from 'express';
import { googleAuth, googleCallback, getCurrentUser, logout } from '../../controllers/auth.controller';
import { requireAuth, csrfProtection } from '../../middlewares/auth.middleware';

const router = Router();

router.get('/google', googleAuth);
router.get('/google/callback', googleCallback);
router.get('/me', requireAuth, getCurrentUser);
router.post('/logout', csrfProtection, requireAuth, logout);

export default router;
