"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WatchRenewalService = void 0;
const client_1 = require("@prisma/client");
const prisma_1 = require("../../../lib/prisma");
const gmail_client_service_1 = require("./gmail.client.service");
const logger_1 = require("../../../config/logger");
const env_1 = require("../../../config/env");
const gmailClient = new gmail_client_service_1.GmailClientService();
class WatchRenewalService {
    isRenewing = false;
    pubSubTopic = env_1.env.GMAIL_PUBSUB_TOPIC || 'projects/your-project-id/topics/gmail-webhooks';
    constructor() {
        if (!env_1.env.GMAIL_PUBSUB_TOPIC || this.pubSubTopic === 'projects/your-project-id/topics/gmail-webhooks') {
            logger_1.logger.warn('[WatchRenewal] GMAIL_PUBSUB_TOPIC is not set in environment variables. Falling back to placeholder topic. Gmail watch registration will fail in production.');
        }
    }
    async registerWatch(userId, force = false) {
        const connection = await gmailClient.getConnection(userId);
        if (!connection) {
            logger_1.logger.warn(`No active Gmail connection found for user ${userId}. Skipping watch registration.`);
            return;
        }
        const now = new Date();
        if (!force && connection.watchExpiration && connection.watchExpiration > new Date(now.getTime() + 24 * 60 * 60 * 1000)) {
            if (connection.syncStatus !== client_1.SyncStatus.ERROR) {
                logger_1.logger.info(`Watch for user ${userId} is still valid until ${connection.watchExpiration}. Skipping registration.`);
                return;
            }
        }
        await this.performWatchRegistration(userId, 1, force);
    }
    async performWatchRegistration(userId, attempt = 1, force = false) {
        try {
            const client = await gmailClient.getAuthenticatedClient(userId);
            if (force) {
                try {
                    await client.users.stop({ userId: 'me' });
                    logger_1.logger.info(`[WatchRenewal] Cleared old Gmail watch state for user ${userId}`);
                }
                catch (stopErr) {
                    logger_1.logger.warn(`[WatchRenewal] Could not stop existing watch (benign if none existed): ${stopErr?.message}`);
                }
            }
            const res = await client.users.watch({
                userId: 'me',
                requestBody: {
                    topicName: this.pubSubTopic
                }
            });
            const expirationStr = res.data.expiration;
            const watchExpiration = expirationStr ? new Date(parseInt(expirationStr, 10)) : new Date(Date.now() + 6 * 24 * 60 * 60 * 1000);
            const historyIdStr = res.data.historyId;
            await prisma_1.prisma.emailAccountConnection.updateMany({
                where: { userId, provider: 'GMAIL' },
                data: {
                    watchExpiration,
                    syncStatus: client_1.SyncStatus.IDLE,
                    ...(historyIdStr && await this.isFirstTimeRegistration(userId) ? { lastHistoryId: BigInt(historyIdStr) } : {})
                }
            });
            logger_1.logger.info(`Successfully registered Gmail Watch for user ${userId}. Expires at ${watchExpiration}`);
        }
        catch (error) {
            const errorMsg = error?.message || JSON.stringify(error || {});
            const isScopeError = errorMsg.includes('insufficientPermissions') || errorMsg.includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT') || error?.code === 403 || error?.code === 401;
            if (isScopeError) {
                logger_1.logger.warn(`[WatchRenewal] User ${userId} has insufficient Gmail OAuth scopes or expired token. Skipping retries until re-authentication.`);
                await prisma_1.prisma.emailAccountConnection.updateMany({
                    where: { userId, provider: 'GMAIL' },
                    data: { syncStatus: client_1.SyncStatus.ERROR }
                });
                return;
            }
            const isTransient = attempt <= 3;
            if (isTransient) {
                const backoff = Math.pow(2, attempt) * 1000;
                logger_1.logger.warn(`Failed to register watch for user ${userId}. Retrying in ${backoff}ms...`);
                await new Promise(r => setTimeout(r, backoff));
                return this.performWatchRegistration(userId, attempt + 1);
            }
            logger_1.logger.error({ error, userId }, 'Failed to register Gmail watch after multiple attempts.');
            await prisma_1.prisma.emailAccountConnection.updateMany({
                where: { userId, provider: 'GMAIL' },
                data: { syncStatus: client_1.SyncStatus.ERROR }
            });
        }
    }
    async isFirstTimeRegistration(userId) {
        const conn = await gmailClient.getConnection(userId);
        return conn?.lastHistoryId == null;
    }
    async runRenewalJob() {
        if (this.isRenewing)
            return;
        this.isRenewing = true;
        try {
            const threshold = new Date(Date.now() + 48 * 60 * 60 * 1000);
            const connectionsToRenew = await prisma_1.prisma.emailAccountConnection.findMany({
                where: {
                    provider: 'GMAIL',
                    isActive: true,
                    OR: [
                        { watchExpiration: null },
                        { watchExpiration: { lt: threshold } },
                        { syncStatus: client_1.SyncStatus.ERROR }
                    ]
                },
                select: { userId: true }
            });
            for (const conn of connectionsToRenew) {
                await this.performWatchRegistration(conn.userId);
            }
        }
        catch (error) {
            logger_1.logger.error({ error }, 'Error during bulk watch renewal job.');
        }
        finally {
            this.isRenewing = false;
        }
    }
}
exports.WatchRenewalService = WatchRenewalService;
