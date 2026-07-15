"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GmailController = void 0;
const gmail_sync_service_1 = require("./services/gmail.sync.service");
const gmail_db_service_1 = require("./services/gmail.db.service");
const gmail_actions_service_1 = require("./services/gmail.actions.service");
const gmail_send_service_1 = require("./services/gmail.send.service");
const ApiError_1 = require("../../utils/ApiError");
class GmailController {
    syncService = new gmail_sync_service_1.GmailSyncService();
    dbService = new gmail_db_service_1.GmailDbService();
    actionsService = new gmail_actions_service_1.GmailActionsService();
    sendService = new gmail_send_service_1.GmailSendService();
    async webhook(req, res) {
        try {
            const message = req.body?.message;
            if (!message || !message.data) {
                return res.status(400).send('Bad Request');
            }
            const decodedData = Buffer.from(message.data, 'base64').toString('utf8');
            const payload = JSON.parse(decodedData);
            const emailAddress = payload.emailAddress;
            const historyId = payload.historyId;
            if (!emailAddress || !historyId) {
                return res.status(400).send('Invalid payload');
            }
            res.status(200).send('OK');
            this.syncService.processWebhook(emailAddress, BigInt(historyId)).catch(err => {
                console.error(`Webhook processing failed for ${emailAddress}:`, err);
            });
        }
        catch (error) {
            console.error('Webhook error:', error);
            res.status(200).send('OK');
        }
    }
    async sync(req, res) {
        const userId = req.session.userId;
        try {
            const isRunning = this.syncService.isSyncRunning(userId);
            if (isRunning) {
                return res.status(409).json({
                    status: "error",
                    message: "Synchronization already in progress.",
                    data: this.syncService.getSyncStatus(userId)
                });
            }
            this.syncService.startSync(userId).catch(err => {
                console.error(`Background sync failed for user ${userId}:`, err);
            });
            res.status(202).json({
                status: "success",
                message: "Synchronization started",
            });
        }
        catch (error) {
            console.error(error);
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
            console.error(error);
            res.status(500).json({ status: "error", message: "Failed to stop synchronization" });
        }
    }
    async getStatus(req, res) {
        const userId = req.session.userId;
        try {
            const dbStatus = await this.dbService.getConnectionStatus(userId);
            if (!dbStatus) {
                return res.status(404).json({ status: "error", message: "Gmail connection not found" });
            }
            const activeSync = this.syncService.getSyncStatus(userId);
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
            console.error(error);
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
