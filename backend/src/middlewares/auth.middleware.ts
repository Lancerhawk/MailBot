import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { ApiError } from '../utils/ApiError';

declare module 'express-session' {
  interface SessionData {
    userId: string;
    oauthState?: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

import { prisma } from '../lib/prisma';


export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.session || !req.session.userId) {
      throw new ApiError(401, 'Unauthorized: No active session');
    }

    const user = await prisma.user.findUnique({
      where: { id: req.session.userId },
    });

    if (!user || user.deletedAt) {
      req.session.destroy(() => {});
      throw new ApiError(401, 'Unauthorized: Invalid session');
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const origin = req.get('origin');
    const referer = req.get('referer');
    
    if (!origin && !referer) {
      return next(new ApiError(403, 'CSRF token missing or incorrect'));
    }
  }
  next();
};
