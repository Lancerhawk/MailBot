import { Request, Response } from 'express';
import { catchAsync } from '../utils/catchAsync';
import { AuthService } from '../services/auth.service';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';
import { WatchRenewalService } from '../modules/gmail/services/watch-renewal.service';

export const googleAuth = catchAsync(async (req: Request, res: Response) => {
  const state = AuthService.generateState();
  req.session.oauthState = state;

  await new Promise<void>((resolve, reject) => {
    req.session.save((err) => {
      if (err) {
        console.error("Session save error:", err);
        return reject(new ApiError(500, 'Failed to save session state'));
      }
      resolve();
    });
  });

  const url = AuthService.generateAuthUrl(state);
  res.redirect(url);
});

export const googleCallback = catchAsync(async (req: Request, res: Response) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect(`${env.FRONTEND_URL}/?error=oauth_denied`);
  }

  if (!code || typeof code !== 'string') {
    return res.redirect(`${env.FRONTEND_URL}/?error=missing_code`);
  }

  if (!state || state !== req.session.oauthState) {
    return res.redirect(`${env.FRONTEND_URL}/?error=invalid_state`);
  }

  req.session.oauthState = undefined;

  const ipAddress = req.ip || req.socket.remoteAddress;
  const userAgent = req.get('user-agent');

  try {
    const user = await AuthService.handleGoogleCallback(code, ipAddress, userAgent);

    req.session.userId = user.id;

    await new Promise<void>((resolve, reject) => {
      req.session.save((err) => {
        if (err) {
          console.error("Session save error in callback:", err);
          return reject(new ApiError(500, 'Failed to save authenticated session'));
        }
        resolve();
      });
    });

    const watchService = new WatchRenewalService();
    watchService.registerWatch(user.id).catch((err: unknown) => console.error("Watch registration error:", err));

    res.redirect(`${env.FRONTEND_URL}/auth/callback?success=true`);
  } catch (err) {
    console.error('Callback handling error:', err);
    res.redirect(`${env.FRONTEND_URL}/?error=auth_failed`);
  }
});

import { prisma } from '../lib/prisma';

export const getCurrentUser = catchAsync(async (req: Request, res: Response) => {
  const userWithConnections = await prisma.user.findUnique({
    where: { id: req.user!.id },
    include: { connections: true }
  });

  const connection = userWithConnections?.connections[0];
  const hasGmailAccess = connection ? connection.scope.includes('gmail.modify') : false;

  res.status(200).json({
    status: 'success',
    data: {
      user: {
        ...req.user,
        hasGmailAccess,
      },
    }
  });
});

export const logout = catchAsync(async (req: Request, res: Response) => {
  if (req.session.userId) {
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.get('user-agent');

    await AuthService.logLogout(req.session.userId, ipAddress, userAgent);
  }

  await new Promise<void>((resolve, reject) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Session destroy error:", err);
        return reject(new ApiError(500, 'Failed to destroy session'));
      }
      resolve();
    });
  });

  res.clearCookie('connect.sid');
  res.status(200).json({ status: 'success', message: 'Logged out successfully' });
});
