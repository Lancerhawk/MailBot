import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { EmailProvider, ActivityType } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { env } from '../config/env';
import { encryptToken } from '../utils/encryption';
import { ApiError } from '../utils/ApiError';

const oauth2Client = new OAuth2Client(
  env.GOOGLE_CLIENT_ID,
  env.GOOGLE_CLIENT_SECRET,
  `${env.API_URL}/api/v1/auth/google/callback`
);

export class AuthService {
  static generateAuthUrl(state: string) {
    const scopes = [
      'openid',
      'email',
      'profile',
      'https://www.googleapis.com/auth/gmail.modify',
    ];

    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: scopes,
      state,
      include_granted_scopes: true,
    });
  }

  static generateState(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  static async handleGoogleCallback(code: string, ipAddress?: string, userAgent?: string) {
    try {
      const { tokens } = await oauth2Client.getToken(code);
      oauth2Client.setCredentials(tokens);

      if (!tokens.access_token || !tokens.id_token) {
        throw new ApiError(400, 'Invalid tokens received from Google');
      }

      const ticket = await oauth2Client.verifyIdToken({
        idToken: tokens.id_token,
        audience: env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.email || !payload.sub) {
        throw new ApiError(400, 'Invalid token payload');
      }

      const email = payload.email;
      const name = payload.name || '';
      const avatarUrl = payload.picture || '';
      const providerAccountId = payload.sub;

      const refreshToken = tokens.refresh_token || '';
      
      const encryptedAccessToken = encryptToken(tokens.access_token);
      const encryptedRefreshToken = refreshToken ? encryptToken(refreshToken) : '';
      
      const accessTokenExpiresAt = tokens.expiry_date 
        ? new Date(tokens.expiry_date) 
        : new Date(Date.now() + 3600 * 1000);

      const user = await prisma.$transaction(async (tx) => {
        const existingUser = await tx.user.findUnique({ where: { email } });
        
        let targetUserId = '';
        let isNewUser = false;

        if (existingUser) {
          targetUserId = existingUser.id;
          await tx.user.update({
            where: { id: existingUser.id },
            data: {
              name: existingUser.name || name,
              avatarUrl: existingUser.avatarUrl || avatarUrl,
            }
          });
        } else {
          isNewUser = true;
          const newUser = await tx.user.create({
            data: {
              email,
              name,
              avatarUrl,
              settings: {
                create: {}
              }
            }
          });
          targetUserId = newUser.id;
        }

        await tx.emailAccountConnection.upsert({
          where: {
            userId_providerAccountId: {
              userId: targetUserId,
              providerAccountId,
            }
          },
          update: {
            encryptedAccessToken,
            ...(refreshToken ? { encryptedRefreshToken } : {}),
            accessTokenExpiresAt,
            emailAddress: email,
            isActive: true,
            scope: tokens.scope || '',
          },
          create: {
            userId: targetUserId,
            providerAccountId,
            emailAddress: email,
            provider: EmailProvider.GMAIL,
            encryptedAccessToken,
            encryptedRefreshToken,
            accessTokenExpiresAt,
            scope: tokens.scope || '',
          }
        });

        await tx.activityLog.create({
          data: {
            userId: targetUserId,
            action: ActivityType.LOGIN,
            ipAddress,
            userAgent,
            metadata: { provider: 'google', isNewUser },
          }
        });

        return tx.user.findUnique({ where: { id: targetUserId } });
      });

      return user!;
    } catch (error: any) {
      console.error('Google callback error:', error);
      throw new ApiError(500, 'Authentication failed during Google OAuth callback');
    }
  }

  static async logLogout(userId: string, ipAddress?: string, userAgent?: string) {
    try {
      await prisma.activityLog.create({
        data: {
          userId,
          action: ActivityType.LOGIN, 
          ipAddress,
          userAgent,
          metadata: { action: 'logout' }
        }
      });
    } catch (error) {
      console.error('Failed to log logout:', error);
    }
  }
}
