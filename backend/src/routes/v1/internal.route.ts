import { Router, Request, Response } from 'express';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { emitToUser } from '../../socket';

const router = Router();

router.post('/jobs/callback', (req: Request, res: Response) => {
  const secret = req.headers['x-internal-secret'];

  if (!secret || secret !== env.INTERNAL_WORKER_SECRET) {
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
