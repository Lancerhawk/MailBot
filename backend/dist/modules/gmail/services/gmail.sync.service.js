"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GmailSyncService = void 0;
const gmail_client_service_1 = require("./gmail.client.service");
const gmail_parser_service_1 = require("./gmail.parser.service");
const gmail_db_service_1 = require("./gmail.db.service");
const logger_1 = require("../../../config/logger");
const cache_service_1 = require("../../../lib/cache.service");
const socket_1 = require("../../../socket");
const ai_pipeline_service_1 = require("../../ai/ai.pipeline.service");
const MAX_INITIAL_THREADS = 100;
const MAX_INITIAL_MESSAGES = 1000;
const BATCH_SIZE = 5;
class GmailSyncService {
    clientService = new gmail_client_service_1.GmailClientService();
    parserService = new gmail_parser_service_1.GmailParserService();
    dbService = new gmail_db_service_1.GmailDbService();
    aiPipelineService = new ai_pipeline_service_1.AiPipelineService();
    async isSyncRunning(userId) {
        const state = await this.getSyncStatus(userId);
        return state?.status === "SYNCING";
    }
    async getSyncStatus(userId) {
        return await cache_service_1.cacheService.get(`sync:progress:${userId}`);
    }
    async saveProgress(userId, state) {
        await cache_service_1.cacheService.set(`sync:progress:${userId}`, state, 1800);
        (0, socket_1.emitToUser)(userId, 'sync:progress', state);
    }
    async stopSync(userId) {
        const state = await this.getSyncStatus(userId);
        if (state) {
            state.stopRequested = true;
            state.status = "IDLE";
            state.currentStage = "Stopped";
            await this.saveProgress(userId, state);
        }
        await this.dbService.updateSyncStatus(userId, "IDLE");
        (0, socket_1.emitToUser)(userId, 'sync:completed', { source: 'stopped' });
    }
    async startSync(userId) {
        if (await this.isSyncRunning(userId))
            return;
        const locked = await cache_service_1.cacheService.acquireLock(`sync:lock:${userId}`, 600);
        if (!locked) {
            logger_1.logger.info({ userId }, `Sync already running (lock busy)`);
            return;
        }
        const connection = await this.clientService.getConnection(userId);
        if (!connection) {
            logger_1.logger.error({ userId }, `No connection found for user`);
            await cache_service_1.cacheService.releaseLock(`sync:lock:${userId}`);
            return;
        }
        const state = {
            status: "SYNCING",
            currentStage: "Initializing...",
            emailsProcessed: 0,
            threadsProcessed: 0,
            totalEmailsEstimated: 0,
            startedAt: new Date(),
            lastError: null
        };
        await this.saveProgress(userId, state);
        await this.dbService.updateSyncStatus(userId, "SYNCING");
        try {
            const gmail = await this.clientService.getAuthenticatedClient(userId);
            if (!connection.lastHistoryId) {
                await this.performFirstSync(userId, connection.id, gmail, state);
            }
            else {
                await this.performIncrementalSync(userId, connection.id, connection.lastHistoryId.toString(), gmail, state);
            }
            state.status = "IDLE";
            if (state.currentStage !== "Up to date") {
                state.currentStage = "Sync complete";
            }
            await this.saveProgress(userId, state);
            await this.dbService.updateSyncStatus(userId, "IDLE");
        }
        catch (error) {
            logger_1.logger.error({ err: error, userId }, `Sync failed for user ${userId}`);
            state.status = "ERROR";
            state.lastError = error.message;
            await this.saveProgress(userId, state);
            await this.dbService.updateSyncStatus(userId, "ERROR", error.message);
        }
        finally {
            await cache_service_1.cacheService.releaseLock(`sync:lock:${userId}`);
            setTimeout(() => {
                cache_service_1.cacheService.delete(`sync:progress:${userId}`);
            }, 10000);
        }
    }
    async performFirstSync(userId, connectionId, gmail, state) {
        state.currentStage = "Fetching latest threads...";
        const res = await gmail.users.messages.list({ userId: "me", maxResults: MAX_INITIAL_THREADS });
        const messages = res.data.messages || [];
        if (messages.length === 0)
            return;
        const threadIds = Array.from(new Set(messages.map(m => m.threadId).filter(Boolean)));
        state.totalEmailsEstimated = threadIds.length;
        state.currentStage = "Importing complete conversations...";
        let totalMessagesProcessed = 0;
        const chunkArray = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size));
        const threadChunks = chunkArray(threadIds, BATCH_SIZE);
        for (const chunk of threadChunks) {
            const currentProgress = await this.getSyncStatus(userId);
            if (state.stopRequested || currentProgress?.stopRequested || currentProgress?.status === "IDLE") {
                state.stopRequested = true;
                logger_1.logger.info({ userId }, `Sync stopped by user`);
                break;
            }
            if (totalMessagesProcessed >= MAX_INITIAL_MESSAGES) {
                logger_1.logger.info({ userId, maxMessages: MAX_INITIAL_MESSAGES }, `Reached MAX_INITIAL_MESSAGES. Truncating first sync.`);
                break;
            }
            const fetchedThreads = await Promise.all(chunk.map(async (threadId) => {
                try {
                    const threadRes = await gmail.users.threads.get({ userId: "me", id: threadId, format: "full" });
                    return threadRes.data;
                }
                catch (e) {
                    logger_1.logger.error({ err: e, threadId, userId }, `Failed to fetch thread ${threadId} from Gmail`);
                    return null;
                }
            }));
            for (const threadData of fetchedThreads) {
                if (!threadData)
                    continue;
                try {
                    const threadMessages = threadData.messages || [];
                    const parsedEmails = threadMessages.map(m => this.parserService.parseMessage(m));
                    parsedEmails.sort((a, b) => a.internalDate.getTime() - b.internalDate.getTime());
                    await this.dbService.upsertThreadAndEmails(userId, connectionId, parsedEmails);
                    totalMessagesProcessed += parsedEmails.length;
                    state.emailsProcessed = totalMessagesProcessed;
                    state.threadsProcessed++;
                }
                catch (e) {
                    logger_1.logger.error({ err: e, threadId: threadData.id, userId }, `Failed to process thread in DB`);
                }
            }
            await this.saveProgress(userId, state);
        }
        if (!state.stopRequested) {
            state.currentStage = "Finalizing...";
            const profileRes = await gmail.users.getProfile({ userId: "me" });
            if (profileRes.data.historyId) {
                await this.dbService.updateLastHistoryId(userId, BigInt(profileRes.data.historyId));
            }
        }
        else {
            logger_1.logger.info({ userId }, `First sync halted manually. Not saving historyId to allow resume.`);
        }
    }
    async performIncrementalSync(userId, connectionId, startHistoryId, gmail, state) {
        state.currentStage = "Checking for updates...";
        await this.saveProgress(userId, state);
        const processedEmailIds = [];
        const deletedMessageIds = new Set();
        try {
            const res = await gmail.users.history.list({ userId: "me", startHistoryId });
            const historyRecords = res.data.history || [];
            const threadsToProcess = new Map();
            for (const record of historyRecords) {
                if (record.messagesAdded) {
                    for (const msgAdded of record.messagesAdded) {
                        if (msgAdded.message?.id && msgAdded.message?.threadId) {
                            if (!threadsToProcess.has(msgAdded.message.threadId)) {
                                threadsToProcess.set(msgAdded.message.threadId, new Set());
                            }
                            threadsToProcess.get(msgAdded.message.threadId).add(msgAdded.message.id);
                        }
                    }
                }
                if (record.labelsAdded) {
                    for (const labelAdded of record.labelsAdded) {
                        if (labelAdded.message?.id && labelAdded.message?.threadId) {
                            if (!threadsToProcess.has(labelAdded.message.threadId)) {
                                threadsToProcess.set(labelAdded.message.threadId, new Set());
                            }
                            threadsToProcess.get(labelAdded.message.threadId).add(labelAdded.message.id);
                        }
                    }
                }
                if (record.labelsRemoved) {
                    for (const labelRemoved of record.labelsRemoved) {
                        if (labelRemoved.message?.id && labelRemoved.message?.threadId) {
                            if (!threadsToProcess.has(labelRemoved.message.threadId)) {
                                threadsToProcess.set(labelRemoved.message.threadId, new Set());
                            }
                            threadsToProcess.get(labelRemoved.message.threadId).add(labelRemoved.message.id);
                        }
                    }
                }
                if (record.messagesDeleted) {
                    for (const msgDeleted of record.messagesDeleted) {
                        if (msgDeleted.message?.id) {
                            deletedMessageIds.add(msgDeleted.message.id);
                            if (msgDeleted.message.threadId && threadsToProcess.has(msgDeleted.message.threadId)) {
                                threadsToProcess.get(msgDeleted.message.threadId).delete(msgDeleted.message.id);
                                if (threadsToProcess.get(msgDeleted.message.threadId).size === 0) {
                                    threadsToProcess.delete(msgDeleted.message.threadId);
                                }
                            }
                        }
                    }
                }
            }
            if (deletedMessageIds.size > 0) {
                await this.dbService.markMessagesAsDeleted(userId, connectionId, Array.from(deletedMessageIds));
            }
            if (threadsToProcess.size === 0) {
                if (res.data.historyId) {
                    await this.dbService.updateLastHistoryId(userId, BigInt(res.data.historyId));
                }
                await new Promise(resolve => setTimeout(resolve, 800));
                state.currentStage = "Up to date";
                return [];
            }
            state.totalEmailsEstimated = Array.from(threadsToProcess.values()).reduce((sum, set) => sum + set.size, 0);
            state.currentStage = "Importing new conversations...";
            await this.saveProgress(userId, state);
            let hasErrors = false;
            for (const [threadId, messageIds] of threadsToProcess.entries()) {
                const currentProgress = await this.getSyncStatus(userId);
                if (state.stopRequested || currentProgress?.stopRequested || currentProgress?.status === "IDLE") {
                    state.stopRequested = true;
                    logger_1.logger.info({ userId }, `Sync stopped by user`);
                    break;
                }
                try {
                    const existingThread = await this.dbService.getThreadByProviderId(userId, threadId);
                    if (existingThread) {
                        const fetchedMessagesRaw = await Promise.all(Array.from(messageIds).map(async (msgId) => {
                            try {
                                const fullMsgRes = await gmail.users.messages.get({ userId: "me", id: msgId, format: "full" });
                                return fullMsgRes.data;
                            }
                            catch (err) {
                                if (err.code === 404 || err.status === 404)
                                    return null;
                                throw err;
                            }
                        }));
                        const fetchedMessages = fetchedMessagesRaw.filter(m => m !== null);
                        const parsedEmails = fetchedMessages.map(m => this.parserService.parseMessage(m));
                        parsedEmails.sort((a, b) => a.internalDate.getTime() - b.internalDate.getTime());
                        const savedEmails = await this.dbService.upsertThreadAndEmails(userId, connectionId, parsedEmails);
                        if (savedEmails) {
                            processedEmailIds.push(...savedEmails.map((e) => e.id));
                        }
                        state.emailsProcessed += parsedEmails.length;
                        await this.saveProgress(userId, state);
                    }
                    else {
                        const threadRes = await gmail.users.threads.get({ userId: "me", id: threadId, format: "full" });
                        const threadMessages = threadRes.data.messages || [];
                        const parsedEmails = threadMessages.map(m => this.parserService.parseMessage(m));
                        parsedEmails.sort((a, b) => a.internalDate.getTime() - b.internalDate.getTime());
                        const savedEmails = await this.dbService.upsertThreadAndEmails(userId, connectionId, parsedEmails);
                        if (savedEmails) {
                            processedEmailIds.push(...savedEmails.map((e) => e.id));
                        }
                        state.emailsProcessed += parsedEmails.length;
                        await this.saveProgress(userId, state);
                    }
                }
                catch (e) {
                    if (e.code === 404 || e.status === 404) {
                        logger_1.logger.info({ threadId, userId }, `Thread ${threadId} not found (404) in Gmail during incremental sync; skipping.`);
                        continue;
                    }
                    hasErrors = true;
                    logger_1.logger.error({ err: e, threadId, userId }, `Failed to process thread ${threadId} during incremental sync`);
                }
            }
            if (res.data.historyId && !state.stopRequested && !hasErrors) {
                await this.dbService.updateLastHistoryId(userId, BigInt(res.data.historyId));
            }
            else if (hasErrors) {
                logger_1.logger.warn({ userId }, 'One or more threads failed during incremental sync; not advancing historyId watermark so failed threads can be retried.');
            }
            state.currentStage = "Finalizing...";
            return processedEmailIds;
        }
        catch (error) {
            if (error.code === 404) {
                logger_1.logger.warn({ userId }, `History expired for user ${userId}. Restarting First Sync.`);
                await this.dbService.updateLastHistoryId(userId, null);
                await this.performFirstSync(userId, connectionId, gmail, state);
                return [];
            }
            else {
                throw error;
            }
        }
    }
    async processWebhook(emailAddress, newHistoryId) {
        const connection = await this.dbService.getConnectionByEmail(emailAddress);
        if (!connection) {
            logger_1.logger.warn({ emailAddress }, `[Gmail Webhook] No active database connection found for email`);
            return;
        }
        if (connection.lastHistoryId && newHistoryId <= connection.lastHistoryId) {
            logger_1.logger.info({ emailAddress, newHistoryId, lastHistoryId: connection.lastHistoryId }, `[Gmail Webhook] Ignoring duplicate webhook`);
            return;
        }
        const userId = connection.userId;
        logger_1.logger.info({ emailAddress, userId, newHistoryId }, `[Gmail Webhook] Triggering incremental sync`);
        if (await this.isSyncRunning(userId)) {
            logger_1.logger.info({ userId }, `Sync already running, queuing concurrent webhook execution.`);
            const currentPendingStr = await cache_service_1.cacheService.get(`sync:webhook:${userId}`);
            const currentPending = currentPendingStr ? BigInt(currentPendingStr) : BigInt(0);
            if (newHistoryId > currentPending) {
                await cache_service_1.cacheService.set(`sync:webhook:${userId}`, newHistoryId.toString(), 1800);
            }
            return;
        }
        const locked = await cache_service_1.cacheService.acquireLock(`sync:lock:${userId}`, 600);
        if (!locked) {
            logger_1.logger.info({ userId }, `Sync already running (lock busy), queuing webhook.`);
            const currentPendingStr = await cache_service_1.cacheService.get(`sync:webhook:${userId}`);
            const currentPending = currentPendingStr ? BigInt(currentPendingStr) : BigInt(0);
            if (newHistoryId > currentPending) {
                await cache_service_1.cacheService.set(`sync:webhook:${userId}`, newHistoryId.toString(), 1800);
            }
            return;
        }
        const state = {
            status: "SYNCING",
            currentStage: "Processing Webhook...",
            emailsProcessed: 0,
            threadsProcessed: 0,
            totalEmailsEstimated: 0,
            startedAt: new Date(),
            lastError: null
        };
        await this.saveProgress(userId, state);
        (0, socket_1.emitToUser)(userId, 'sync:started', { source: 'webhook' });
        let processedEmailIds = [];
        try {
            const gmail = await this.clientService.getAuthenticatedClient(userId);
            const startHistoryId = connection.lastHistoryId ? connection.lastHistoryId.toString() : (newHistoryId - BigInt(1)).toString();
            processedEmailIds = await this.performIncrementalSync(userId, connection.id, startHistoryId, gmail, state);
            if (processedEmailIds && processedEmailIds.length > 0) {
                const pendingEmailIds = await this.dbService.getPendingEmailIds(processedEmailIds);
                if (pendingEmailIds.length > 0) {
                    state.currentStage = "Generating AI drafts...";
                    await this.saveProgress(userId, state);
                    const aiPromises = pendingEmailIds.map(emailId => this.aiPipelineService.scheduleAnalysis(userId, emailId));
                    await Promise.all(aiPromises);
                }
            }
            state.status = "IDLE";
            state.currentStage = "Sync complete";
            await this.saveProgress(userId, state);
            await this.dbService.updateSyncStatus(userId, "IDLE");
            (0, socket_1.emitToUser)(userId, 'sync:completed', {
                emailsProcessed: state.emailsProcessed
            });
        }
        catch (error) {
            logger_1.logger.error({ err: error, userId }, `Webhook Sync failed for user ${userId}`);
            state.status = "ERROR";
            state.lastError = error.message;
            await this.saveProgress(userId, state);
            (0, socket_1.emitToUser)(userId, 'sync:error', { error: error.message });
        }
        finally {
            await cache_service_1.cacheService.releaseLock(`sync:lock:${userId}`);
            await cache_service_1.cacheService.delete(`sync:progress:${userId}`);
            const pendingHistoryIdStr = await cache_service_1.cacheService.get(`sync:webhook:${userId}`);
            if (pendingHistoryIdStr) {
                await cache_service_1.cacheService.delete(`sync:webhook:${userId}`);
                const pendingHistoryId = BigInt(pendingHistoryIdStr);
                logger_1.logger.info({ userId, pendingHistoryId }, `Executing queued webhook`);
                setTimeout(() => {
                    this.processWebhook(emailAddress, pendingHistoryId).catch(err => {
                        logger_1.logger.error({ err, emailAddress }, `Queued webhook failed for ${emailAddress}`);
                    });
                }, 1000);
            }
        }
    }
}
exports.GmailSyncService = GmailSyncService;
