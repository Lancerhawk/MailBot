"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GmailController = void 0;
const google_auth_library_1 = require("google-auth-library");
const env_1 = require("../../config/env");
const gmail_sync_service_1 = require("./services/gmail.sync.service");
const gmail_db_service_1 = require("./services/gmail.db.service");
const gmail_actions_service_1 = require("./services/gmail.actions.service");
const gmail_send_service_1 = require("./services/gmail.send.service");
const ApiError_1 = require("../../utils/ApiError");
const watch_renewal_service_1 = require("./services/watch-renewal.service");
const logger_1 = require("../../config/logger");
class GmailController {
    syncService = new gmail_sync_service_1.GmailSyncService();
    dbService = new gmail_db_service_1.GmailDbService();
    actionsService = new gmail_actions_service_1.GmailActionsService();
    sendService = new gmail_send_service_1.GmailSendService();
    oauth2Client = new google_auth_library_1.OAuth2Client();
    async verifyWebhookAuth(req) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const idToken = authHeader.split(' ')[1];
            try {
                const ticket = await this.oauth2Client.verifyIdToken({
                    idToken,
                    audience: env_1.env.GMAIL_WEBHOOK_AUDIENCE || `${env_1.env.API_URL}/api/v1/gmail/webhook`,
                });
                const payload = ticket.getPayload();
                if (payload && (payload.iss === 'https://accounts.google.com' || payload.iss === 'accounts.google.com')) {
                    if (env_1.env.GMAIL_WEBHOOK_SERVICE_ACCOUNT_EMAIL && payload.email !== env_1.env.GMAIL_WEBHOOK_SERVICE_ACCOUNT_EMAIL) {
                        logger_1.logger.warn({ expected: env_1.env.GMAIL_WEBHOOK_SERVICE_ACCOUNT_EMAIL, received: payload.email }, "[Webhook Security] OIDC email claim mismatch");
                        return false;
                    }
                    return true;
                }
                return false;
            }
            catch (error) {
                logger_1.logger.warn({ err: error }, "[Webhook Security] OIDC verification failed");
                return false;
            }
        }
        if (env_1.env.GMAIL_WEBHOOK_SECRET) {
            const channelToken = req.headers['x-goog-channel-token'] || req.headers['x-webhook-secret'];
            if (channelToken) {
                return channelToken === env_1.env.GMAIL_WEBHOOK_SECRET;
            }
        }
        if (env_1.env.GMAIL_WEBHOOK_REQUIRE_OIDC) {
            logger_1.logger.warn("[Webhook Security] Rejected webhook request: GMAIL_WEBHOOK_REQUIRE_OIDC=true and no valid OIDC token/secret was provided.");
            return false;
        }
        logger_1.logger.warn("[Webhook Security] Webhook received without OIDC token. Ensure Pub/Sub OIDC auth is enabled in Google Cloud Console.");
        return true;
    }
    async webhook(req, res) {
        try {
            logger_1.logger.info({ ip: req.ip }, "[Gmail Webhook] Received POST request");
            const isAuthorized = await this.verifyWebhookAuth(req);
            if (!isAuthorized) {
                logger_1.logger.warn({ ip: req.ip }, "[Webhook Security] Rejected unauthorized webhook POST");
                return res.status(403).send('Forbidden: Invalid webhook authentication');
            }
            const message = req.body?.message;
            if (!message || !message.data) {
                logger_1.logger.warn('[Gmail Webhook] Missing message or message.data in request body');
                return res.status(400).send('Bad Request');
            }
            const decodedData = Buffer.from(message.data, 'base64').toString('utf8');
            const payload = JSON.parse(decodedData);
            const emailAddress = payload.emailAddress;
            const historyId = payload.historyId;
            if (!emailAddress || !historyId) {
                logger_1.logger.warn({ payload }, '[Gmail Webhook] Missing emailAddress or historyId in decoded payload');
                return res.status(400).send('Invalid payload');
            }
            logger_1.logger.info({ emailAddress, historyId }, '[Gmail Webhook] Valid push notification received');
            res.status(200).send('OK');
            this.syncService.processWebhook(emailAddress, BigInt(historyId)).catch(err => {
                logger_1.logger.error({ err, emailAddress }, 'Webhook processing failed');
            });
        }
        catch (error) {
            logger_1.logger.error({ err: error }, 'Webhook error');
            res.status(200).send('OK');
        }
    }
    async sync(req, res) {
        const userId = req.session.userId;
        try {
            const isRunning = await this.syncService.isSyncRunning(userId);
            if (isRunning) {
                return res.status(409).json({
                    status: "error",
                    message: "Synchronization already in progress.",
                    data: await this.syncService.getSyncStatus(userId)
                });
            }
            this.syncService.startSync(userId).catch(err => {
                logger_1.logger.error({ err, userId }, "Background sync failed");
            });
            res.status(202).json({
                status: "success",
                message: "Synchronization started",
            });
        }
        catch (error) {
            logger_1.logger.error({ err: error, userId }, "Failed to start synchronization");
            res.status(500).json({ status: "error", message: "Failed to start synchronization" });
        }
    }
    async stopSync(req, res) {
        const userId = req.session.userId;
        try {
            await this.syncService.stopSync(userId);
            res.json({ status: "success", message: "Stop requested" });
        }
        catch (error) {
            logger_1.logger.error({ err: error, userId }, "Failed to stop synchronization");
            res.status(500).json({ status: "error", message: "Failed to stop synchronization" });
        }
    }
    async registerWatch(req, res) {
        const userId = req.session.userId;
        try {
            const watchService = new watch_renewal_service_1.WatchRenewalService();
            await watchService.registerWatch(userId, true);
            res.json({ status: "success", message: "Gmail watch registered successfully" });
        }
        catch (error) {
            logger_1.logger.error({ err: error, userId }, "Watch registration failed");
            res.status(500).json({ status: "error", message: error?.message || "Failed to register Gmail watch" });
        }
    }
    async getStatus(req, res) {
        const userId = req.session.userId;
        try {
            const dbStatus = await this.dbService.getConnectionStatus(userId);
            if (!dbStatus) {
                return res.status(404).json({ status: "error", message: "Gmail connection not found" });
            }
            const activeSync = await this.syncService.getSyncStatus(userId);
            res.json({
                status: "success",
                data: {
                    connectionStatus: dbStatus.syncStatus,
                    lastSuccessfulSyncAt: dbStatus.lastSuccessfulSyncAt,
                    lastSyncError: dbStatus.lastSyncError,
                    activeSync: activeSync || null
                },
            });
        }
        catch (error) {
            logger_1.logger.error({ err: error, userId }, "Failed to fetch status");
            res.status(500).json({ status: "error", message: "Failed to fetch status" });
        }
    }
    async getProfile(req, res) {
        res.json({ status: "success", data: {} });
    }
    async listThreads(req, res) {
        const userId = req.session.userId;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const filter = req.query.filter;
        const search = req.query.search;
        try {
            const threads = await this.dbService.listThreads(userId, page, limit, filter, search);
            res.json({ status: "success", data: threads });
        }
        catch {
            res.status(500).json({ status: "error", message: "Failed to list threads" });
        }
    }
    async getThread(req, res) {
        const userId = req.session.userId;
        const threadId = req.params.id;
        try {
            const thread = await this.dbService.getThread(userId, threadId);
            if (!thread) {
                return res.status(404).json({ status: "error", message: "Thread not found" });
            }
            res.json({ status: "success", data: thread });
        }
        catch {
            res.status(500).json({ status: "error", message: "Failed to get thread" });
        }
    }
    async getThreadsBulk(req, res) {
        const userId = req.session.userId;
        const threadIds = req.body.threadIds;
        if (!Array.isArray(threadIds)) {
            return res.status(400).json({ status: "error", message: "threadIds must be an array" });
        }
        try {
            const threads = await this.dbService.getThreadsBulk(userId, threadIds);
            res.json({ status: "success", data: threads });
        }
        catch {
            res.status(500).json({ status: "error", message: "Failed to get threads bulk" });
        }
    }
    async getEmail(req, res) {
        res.json({ status: "success", data: {} });
    }
    async handleAction(req, res, actionFn) {
        const userId = req.session.userId;
        if (!userId)
            throw new ApiError_1.ApiError(401, 'Unauthorized');
        const emailId = req.params.id;
        try {
            await actionFn.call(this.actionsService, userId, emailId);
            res.json({ status: 'success' });
        }
        catch (err) {
            const error = err;
            res.status(error.statusCode || 500).json({ status: 'error', message: error.message });
        }
    }
    markRead = async (req, res) => this.handleAction(req, res, this.actionsService.markRead);
    markUnread = async (req, res) => this.handleAction(req, res, this.actionsService.markUnread);
    star = async (req, res) => this.handleAction(req, res, this.actionsService.star);
    unstar = async (req, res) => this.handleAction(req, res, this.actionsService.unstar);
    archive = async (req, res) => this.handleAction(req, res, this.actionsService.archive);
    unarchive = async (req, res) => this.handleAction(req, res, this.actionsService.unarchive);
    deleteToTrash = async (req, res) => this.handleAction(req, res, this.actionsService.deleteToTrash);
    restoreFromTrash = async (req, res) => this.handleAction(req, res, this.actionsService.restoreFromTrash);
    markSpam = async (req, res) => this.handleAction(req, res, this.actionsService.markSpam);
    unmarkSpam = async (req, res) => this.handleAction(req, res, this.actionsService.unmarkSpam);
    permanentlyDelete = async (req, res) => this.handleAction(req, res, this.actionsService.permanentlyDelete);
    threadMarkRead = async (req, res) => this.handleAction(req, res, this.actionsService.threadMarkRead);
    threadMarkUnread = async (req, res) => this.handleAction(req, res, this.actionsService.threadMarkUnread);
    threadStar = async (req, res) => this.handleAction(req, res, this.actionsService.threadStar);
    threadUnstar = async (req, res) => this.handleAction(req, res, this.actionsService.threadUnstar);
    threadArchive = async (req, res) => this.handleAction(req, res, this.actionsService.threadArchive);
    threadUnarchive = async (req, res) => this.handleAction(req, res, this.actionsService.threadUnarchive);
    threadDeleteToTrash = async (req, res) => this.handleAction(req, res, this.actionsService.threadDeleteToTrash);
    threadRestoreFromTrash = async (req, res) => this.handleAction(req, res, this.actionsService.threadRestoreFromTrash);
    threadMarkSpam = async (req, res) => this.handleAction(req, res, this.actionsService.threadMarkSpam);
    threadUnmarkSpam = async (req, res) => this.handleAction(req, res, this.actionsService.threadUnmarkSpam);
    threadPermanentlyDelete = async (req, res) => this.handleAction(req, res, this.actionsService.threadPermanentlyDelete);
    async sendReply(req, res) {
        const userId = req.session.userId;
        if (!userId)
            throw new ApiError_1.ApiError(401, 'Unauthorized');
        const targetEmailId = req.body.emailId;
        const editedText = req.body.editedText;
        if (!targetEmailId)
            throw new ApiError_1.ApiError(400, 'emailId is required in body');
        try {
            await this.sendService.sendReply(userId, targetEmailId, editedText);
            res.json({ status: 'success' });
        }
        catch (err) {
            const error = err;
            res.status(error.statusCode || 500).json({ status: 'error', message: error.message });
        }
    }
    async sendCompose(req, res) {
        const userId = req.session.userId;
        if (!userId)
            throw new ApiError_1.ApiError(401, 'Unauthorized');
        try {
            await this.sendService.sendCompose(userId, req.body);
            res.json({ status: 'success' });
        }
        catch (err) {
            const error = err;
            res.status(error.statusCode || 500).json({ status: 'error', message: error.message });
        }
    }
}
exports.GmailController = GmailController;
