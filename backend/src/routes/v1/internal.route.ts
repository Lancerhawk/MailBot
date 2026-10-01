import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { emitToUser } from '../../socket';

const router = Router();

router.post('/jobs/callback', (req: Request, res: Response) => {
  const secretHeader = req.headers['x-internal-secret'];
  const secret = Array.isArray(secretHeader) ? secretHeader[0] : secretHeader;

  const isSecretValid = (): boolean => {
    if (!secret || typeof secret !== 'string') return false;
    const secretBuffer = Buffer.from(secret);
    const expectedBuffer = Buffer.from(env.INTERNAL_WORKER_SECRET);
    if (secretBuffer.length !== expectedBuffer.length) return false;
    return crypto.timingSafeEqual(secretBuffer, expectedBuffer);
  };

  if (!isSecretValid()) {
    logger.warn('[SECURITY WARNING] Rejected unauthorized call to /api/v1/internal/jobs/callback');
    res.status(403).json({ error: 'Forbidden: Invalid internal worker secret' });
    return;
  }

  const { userId, event, data } = req.body;

  if (!userId || !event) {
    res.status(400).json({ error: 'Missing userId or event in callback payload' });
    return;
  }

  logger.info({ userId, event }, '[Internal Callback] Received job completion event from remote worker');
  emitToUser(userId, event, data);

  res.status(200).json({ success: true });
});

export default router;
