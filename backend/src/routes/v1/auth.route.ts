import { Router } from 'express';
import { googleAuth, googleCallback, getCurrentUser, logout } from '../../controllers/auth.controller';
import { requireAuth, csrfProtection } from '../../middlewares/auth.middleware';
import { authLimiter } from '../../middlewares/rateLimiter';

const router = Router();

router.get('/google', authLimiter, googleAuth);
router.get('/google/callback', authLimiter, googleCallback);
router.get('/me', requireAuth, getCurrentUser);
router.post('/logout', authLimiter, csrfProtection, requireAuth, logout);

export default router;
