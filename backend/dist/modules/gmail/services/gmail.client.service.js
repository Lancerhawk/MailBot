"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GmailClientService = void 0;
const googleapis_1 = require("googleapis");
const prisma_1 = require("../../../lib/prisma");
const encryption_1 = require("../../../utils/encryption");
const env_1 = require("../../../config/env");
const logger_1 = require("../../../config/logger");
class GmailClientService {
    async getAuthenticatedClient(userId) {
        const connection = await prisma_1.prisma.emailAccountConnection.findFirst({
            where: { userId, provider: 'GMAIL' }
        });
        if (!connection) {
            throw new Error("No Gmail connection found for user");
        }
        const oauth2Client = new googleapis_1.google.auth.OAuth2(env_1.env.GOOGLE_CLIENT_ID, env_1.env.GOOGLE_CLIENT_SECRET, `${env_1.env.API_URL}/api/v1/auth/google/callback`);
        const decryptedAccessToken = (0, encryption_1.decryptToken)(connection.encryptedAccessToken);
        const decryptedRefreshToken = (0, encryption_1.decryptToken)(connection.encryptedRefreshToken);
        oauth2Client.setCredentials({
            access_token: decryptedAccessToken,
            refresh_token: decryptedRefreshToken,
            expiry_date: connection.accessTokenExpiresAt.getTime(),
        });
        oauth2Client.on('tokens', async (tokens) => {
            if (tokens.access_token) {
                try {
                    const dataToUpdate = {
                        encryptedAccessToken: (0, encryption_1.encryptToken)(tokens.access_token),
                        accessTokenExpiresAt: tokens.expiry_date
                            ? new Date(tokens.expiry_date)
                            : new Date(Date.now() + 3600 * 1000),
                    };
                    if (tokens.refresh_token) {
                        dataToUpdate.encryptedRefreshToken = (0, encryption_1.encryptToken)(tokens.refresh_token);
                    }
                    await prisma_1.prisma.emailAccountConnection.update({
                        where: { id: connection.id },
                        data: dataToUpdate,
                    });
                    logger_1.logger.info({ connectionId: connection.id }, `[OAuth Refresh] Updated refreshed access token in DB`);
                }
                catch (error) {
                    logger_1.logger.error({ err: error, connectionId: connection.id }, `[OAuth Refresh Error] Failed to update token in DB`);
                }
            }
        });
        return googleapis_1.google.gmail({ version: 'v1', auth: oauth2Client });
    }
    async getConnection(userId) {
        return prisma_1.prisma.emailAccountConnection.findFirst({
            where: { userId, provider: 'GMAIL' }
        });
    }
}
exports.GmailClientService = GmailClientService;
