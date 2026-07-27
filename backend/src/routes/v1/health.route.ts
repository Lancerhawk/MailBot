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

    const isHealthy = isDbConnected;
    const statusCode = isHealthy ? 200 : 503;
    const statusMessage = isHealthy ? 'Health check passed' : 'Service Degraded: Database disconnected';

    const healthData = {
      status: isHealthy ? 'ok' : 'degraded',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      database: isDbConnected ? 'connected' : 'disconnected',
    };

    res.status(statusCode).json(new ApiResponse(healthData, statusMessage));
  })
);

export default router;
