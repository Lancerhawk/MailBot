import { Request, Response, NextFunction } from 'express';
import { User } from '@prisma/client';
import { ApiError } from '../utils/ApiError';

declare module 'express-session' {
  interface SessionData {
    userId: string;
    oauthState?: string;
  }
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

import { prisma } from '../lib/prisma';
import { env } from '../config/env';

const validateCsrfOrigin = (req: Request): { valid: boolean; reason?: string } => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return { valid: true };
  }

  const origin = req.get('origin');
  const referer = req.get('referer');

  if (!origin && !referer) {
    return {
      valid: false,
      reason: 'CSRF Protection: Origin or Referer header is required for state-changing requests',
    };
  }

  try {
    const headerValue = (origin || referer)!;
    const requestOrigin = headerValue.startsWith('http')
      ? new URL(headerValue).origin
      : headerValue.replace(/\/$/, '');

    const allowedFrontend = env.FRONTEND_URL.replace(/\/$/, '');
    const allowedApi = env.API_URL.replace(/\/$/, '');

    if (env.NODE_ENV !== 'production') {
      if (requestOrigin.includes('localhost') || requestOrigin.includes('127.0.0.1')) {
        return { valid: true };
      }
    }

    if (requestOrigin === allowedFrontend || requestOrigin === allowedApi) {
      return { valid: true };
    }

    return {
      valid: false,
      reason: `CSRF Protection: Origin '${requestOrigin}' does not match allowed frontend origin`,
    };
  } catch {
    return { valid: false, reason: 'CSRF Protection: Malformed Origin or Referer header' };
  }
};

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const csrfResult = validateCsrfOrigin(req);
    if (!csrfResult.valid) {
      throw new ApiError(403, csrfResult.reason || 'CSRF token missing or incorrect');
    }

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
  const csrfResult = validateCsrfOrigin(req);
  if (!csrfResult.valid) {
    return next(new ApiError(403, csrfResult.reason || 'CSRF token missing or incorrect'));
  }
  next();
};
