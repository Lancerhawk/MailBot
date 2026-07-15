import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { catchAsync } from '../../utils/catchAsync';
import { ApiResponse } from '../../utils/ApiResponse';

const router = Router();

router.get(
  '/',
  catchAsync(async (_req, res) => {
    let isDbConnected = false;
    try {
      await prisma.$queryRaw`SELECT 1`;
      isDbConnected = true;
    } catch (_error) {
      isDbConnected = false;
    }

    const healthData = {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      database: isDbConnected ? 'connected' : 'disconnected',
    };

    res.status(200).json(new ApiResponse(healthData, 'Health check passed'));
  })
);

export default router;
