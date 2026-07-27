"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GmailSyncService = void 0;
const gmail_client_service_1 = require("./gmail.client.service");
const gmail_parser_service_1 = require("./gmail.parser.service");
const gmail_db_service_1 = require("./gmail.db.service");
const logger_1 = require("../../../config/logger");
const syncMemoryMap = new Map();
const pendingWebhooksMap = new Map();
const MAX_INITIAL_THREADS = 100;
const MAX_INITIAL_MESSAGES = 1000;
const BATCH_SIZE = 5;
class GmailSyncService {
    clientService = new gmail_client_service_1.GmailClientService();
    parserService = new gmail_parser_service_1.GmailParserService();
    dbService = new gmail_db_service_1.GmailDbService();
    isSyncRunning(userId) {
        const state = syncMemoryMap.get(userId);
        return state?.status === "SYNCING";
    }
    getSyncStatus(userId) {
        return syncMemoryMap.get(userId) || null;
    }
    async stopSync(userId) {
        const state = syncMemoryMap.get(userId);
        if (state) {
            state.stopRequested = true;
            state.status = "IDLE";
            state.currentStage = "Stopped";
        }
        await this.dbService.updateSyncStatus(userId, "IDLE");
    }
    async startSync(userId) {
        if (this.isSyncRunning(userId))
            return;
        const connection = await this.clientService.getConnection(userId);
        if (!connection) {
            console.error(`No connection found for user ${userId}`);
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
        syncMemoryMap.set(userId, state);
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
            await this.dbService.updateSyncStatus(userId, "IDLE");
        }
        catch (error) {
            logger_1.logger.error({ err: error, userId }, `Sync failed for user ${userId}`);
            state.status = "ERROR";
            state.lastError = error.message;
            await this.dbService.updateSyncStatus(userId, "ERROR", error.message);
        }
        finally {
            setTimeout(() => {
                syncMemoryMap.delete(userId);
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
            if (state.stopRequested) {
                console.log(`Sync stopped by user ${userId}`);
                break;
            }
            if (totalMessagesProcessed >= MAX_INITIAL_MESSAGES) {
                console.log(`Reached MAX_INITIAL_MESSAGES (${MAX_INITIAL_MESSAGES}) for user ${userId}. Truncating first sync.`);
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
        }
        if (!state.stopRequested) {
            state.currentStage = "Finalizing...";
            const profileRes = await gmail.users.getProfile({ userId: "me" });
            if (profileRes.data.historyId) {
                await this.dbService.updateLastHistoryId(userId, BigInt(profileRes.data.historyId));
            }
        }
        else {
            console.log(`First sync for user ${userId} was halted manually. Not saving historyId to allow resume.`);
        }
    }
    async performIncrementalSync(userId, connectionId, startHistoryId, gmail, state) {
        state.currentStage = "Checking for updates...";
        const processedEmailIds = [];
        const deletedMessageIds = new Set();
        try {
            const res = await gmail.users.history.list({ userId: "me", startHistoryId });
            if (res.data.historyId) {
                await this.dbService.updateLastHistoryId(userId, BigInt(res.data.historyId));
            }
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
                await new Promise(resolve => setTimeout(resolve, 800));
                state.currentStage = "Up to date";
                return [];
            }
            state.totalEmailsEstimated = Array.from(threadsToProcess.values()).reduce((sum, set) => sum + set.size, 0);
            state.currentStage = "Importing new conversations...";
            for (const [threadId, messageIds] of threadsToProcess.entries()) {
                if (state.stopRequested) {
                    console.log(`Sync stopped by user ${userId}`);
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
                    }
                }
                catch (e) {
                    logger_1.logger.error({ err: e, threadId, userId }, `Failed to process thread ${threadId} during incremental sync`);
                }
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
            console.warn(`[Gmail Webhook] No active database connection found for email: ${emailAddress}`);
            return;
        }
        if (connection.lastHistoryId && newHistoryId <= connection.lastHistoryId) {
            console.log(`[Gmail Webhook] Ignoring duplicate webhook for ${emailAddress} (historyId: ${newHistoryId} <= ${connection.lastHistoryId})`);
            return;
        }
        const userId = connection.userId;
        console.log(`[Gmail Webhook] Triggering incremental sync for ${emailAddress} (userId: ${userId}, newHistoryId: ${newHistoryId})`);
        if (this.isSyncRunning(userId)) {
            console.log(`Sync already running for ${userId}, queuing concurrent webhook execution.`);
            const currentPending = pendingWebhooksMap.get(userId) || BigInt(0);
            if (newHistoryId > currentPending) {
                pendingWebhooksMap.set(userId, newHistoryId);
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
        syncMemoryMap.set(userId, state);
        const { emitToUser } = require('../../../socket');
        emitToUser(userId, 'sync:started', { source: 'webhook' });
        let processedEmailIds = [];
        try {
            const gmail = await this.clientService.getAuthenticatedClient(userId);
            const startHistoryId = connection.lastHistoryId ? connection.lastHistoryId.toString() : (newHistoryId - BigInt(1)).toString();
            processedEmailIds = await this.performIncrementalSync(userId, connection.id, startHistoryId, gmail, state);
            if (processedEmailIds && processedEmailIds.length > 0) {
                state.currentStage = "Generating AI drafts...";
                const { AiPipelineService } = require('../../ai/ai.pipeline.service');
                const aiPipeline = new AiPipelineService();
                const aiPromises = processedEmailIds.map(emailId => aiPipeline.scheduleAnalysis(userId, emailId));
                await Promise.all(aiPromises);
            }
            state.status = "IDLE";
            state.currentStage = "Sync complete";
            await this.dbService.updateSyncStatus(userId, "IDLE");
            emitToUser(userId, 'sync:completed', {
                emailsProcessed: state.emailsProcessed
            });
        }
        catch (error) {
            logger_1.logger.error({ err: error, userId }, `Webhook Sync failed for user ${userId}`);
            state.status = "ERROR";
            state.lastError = error.message;
            emitToUser(userId, 'sync:error', { error: error.message });
        }
        finally {
            syncMemoryMap.delete(userId);
            const pendingHistoryId = pendingWebhooksMap.get(userId);
            if (pendingHistoryId) {
                pendingWebhooksMap.delete(userId);
                console.log(`Executing queued webhook for ${userId} with historyId ${pendingHistoryId}`);
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
