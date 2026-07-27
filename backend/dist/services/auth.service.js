"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const google_auth_library_1 = require("google-auth-library");
const client_1 = require("@prisma/client");
const prisma_1 = require("../lib/prisma");
const env_1 = require("../config/env");
const encryption_1 = require("../utils/encryption");
const ApiError_1 = require("../utils/ApiError");
const oauth2Client = new google_auth_library_1.OAuth2Client(env_1.env.GOOGLE_CLIENT_ID, env_1.env.GOOGLE_CLIENT_SECRET, `${env_1.env.API_URL}/api/v1/auth/google/callback`);
class AuthService {
    static generateAuthUrl(state) {
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
    static generateState() {
        return crypto_1.default.randomBytes(32).toString('hex');
    }
    static async handleGoogleCallback(code, ipAddress, userAgent) {
        try {
            const { tokens } = await oauth2Client.getToken(code);
            oauth2Client.setCredentials(tokens);
            if (!tokens.access_token || !tokens.id_token) {
                throw new ApiError_1.ApiError(400, 'Invalid tokens received from Google');
            }
            const ticket = await oauth2Client.verifyIdToken({
                idToken: tokens.id_token,
                audience: env_1.env.GOOGLE_CLIENT_ID,
            });
            const payload = ticket.getPayload();
            if (!payload || !payload.email || !payload.sub) {
                throw new ApiError_1.ApiError(400, 'Invalid token payload');
            }
            const email = payload.email;
            const name = payload.name || '';
            const avatarUrl = payload.picture || '';
            const providerAccountId = payload.sub;
            const refreshToken = tokens.refresh_token || '';
            const encryptedAccessToken = (0, encryption_1.encryptToken)(tokens.access_token);
            const encryptedRefreshToken = refreshToken ? (0, encryption_1.encryptToken)(refreshToken) : '';
            const accessTokenExpiresAt = tokens.expiry_date
                ? new Date(tokens.expiry_date)
                : new Date(Date.now() + 3600 * 1000);
            const user = await prisma_1.prisma.$transaction(async (tx) => {
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
                }
                else {
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
                        provider: client_1.EmailProvider.GMAIL,
                        encryptedAccessToken,
                        encryptedRefreshToken,
                        accessTokenExpiresAt,
                        scope: tokens.scope || '',
                    }
                });
                await tx.activityLog.create({
                    data: {
                        userId: targetUserId,
                        action: client_1.ActivityType.LOGIN,
                        ipAddress,
                        userAgent,
                        metadata: { provider: 'google', isNewUser },
                    }
                });
                return tx.user.findUnique({ where: { id: targetUserId } });
            });
            return user;
        }
        catch (error) {
            console.error('Google callback error:', error);
            throw new ApiError_1.ApiError(500, 'Authentication failed during Google OAuth callback');
        }
    }
    static async logLogout(userId, ipAddress, userAgent) {
        try {
            await prisma_1.prisma.activityLog.create({
                data: {
                    userId,
                    action: client_1.ActivityType.LOGOUT,
                    ipAddress,
                    userAgent,
                    metadata: { action: 'logout' }
                }
            });
        }
        catch (error) {
            console.error('Failed to log logout:', error);
        }
    }
}
exports.AuthService = AuthService;
