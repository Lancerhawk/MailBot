import { GmailClientService } from "./gmail.client.service";
import { GmailParserService } from "./gmail.parser.service";
import { GmailDbService } from "./gmail.db.service";
import { gmail_v1 } from "googleapis";
import { logger } from "../../../config/logger";
import { cacheService } from "../../../lib/cache.service";
import { emitToUser } from "../../../socket";
import { AiPipelineService } from "../../ai/ai.pipeline.service";

interface SyncProgress {
  status: "SYNCING" | "IDLE" | "ERROR";
  currentStage: string;
  emailsProcessed: number;
  threadsProcessed: number;
  totalEmailsEstimated: number;
  startedAt: Date;
  lastError: string | null;
  stopRequested?: boolean;
}

const MAX_INITIAL_THREADS = 100;
const MAX_INITIAL_MESSAGES = 1000;
const BATCH_SIZE = 5;

export class GmailSyncService {
  private clientService = new GmailClientService();
  private parserService = new GmailParserService();
  private dbService = new GmailDbService();
  private aiPipelineService = new AiPipelineService();

  async isSyncRunning(userId: string): Promise<boolean> {
    const state = await this.getSyncStatus(userId);
    return state?.status === "SYNCING";
  }

  async getSyncStatus(userId: string): Promise<SyncProgress | null> {
    return await cacheService.get<SyncProgress>(`sync:progress:${userId}`);
  }

  private async saveProgress(userId: string, state: SyncProgress): Promise<void> {
    await cacheService.set(`sync:progress:${userId}`, state, 1800);
  }

  async stopSync(userId: string) {
    const state = await this.getSyncStatus(userId);
    if (state) {
      state.stopRequested = true;
      state.status = "IDLE";
      state.currentStage = "Stopped";
      await this.saveProgress(userId, state);
    }
    await this.dbService.updateSyncStatus(userId, "IDLE");
  }

  async startSync(userId: string) {
    if (await this.isSyncRunning(userId)) return;

    const locked = await cacheService.acquireLock(`sync:lock:${userId}`, 600);
    if (!locked) {
      console.log(`Sync already running for ${userId} (lock busy)`);
      return;
    }

    const connection = await this.clientService.getConnection(userId);
    if (!connection) {
      console.error(`No connection found for user ${userId}`);
      await cacheService.releaseLock(`sync:lock:${userId}`);
      return;
    }

    const state: SyncProgress = {
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
      } else {
        await this.performIncrementalSync(userId, connection.id, connection.lastHistoryId.toString(), gmail, state);
      }

      state.status = "IDLE";
      if (state.currentStage !== "Up to date") {
        state.currentStage = "Sync complete";
      }
      await this.saveProgress(userId, state);
      await this.dbService.updateSyncStatus(userId, "IDLE");

    } catch (error: any) {
      logger.error({ err: error, userId }, `Sync failed for user ${userId}`);
      state.status = "ERROR";
      state.lastError = error.message;
      await this.saveProgress(userId, state);
      await this.dbService.updateSyncStatus(userId, "ERROR", error.message);
    } finally {
      await cacheService.releaseLock(`sync:lock:${userId}`);
      setTimeout(() => {
        cacheService.delete(`sync:progress:${userId}`);
      }, 10000);
    }
  }

  private async performFirstSync(
    userId: string,
    connectionId: string,
    gmail: gmail_v1.Gmail,
    state: SyncProgress
  ) {
    state.currentStage = "Fetching latest threads...";
    const res = await gmail.users.messages.list({ userId: "me", maxResults: MAX_INITIAL_THREADS });
    const messages = res.data.messages || [];

    if (messages.length === 0) return;

    const threadIds = Array.from(new Set(messages.map(m => m.threadId).filter(Boolean))) as string[];
    state.totalEmailsEstimated = threadIds.length;
    state.currentStage = "Importing complete conversations...";

    let totalMessagesProcessed = 0;

    const chunkArray = (arr: string[], size: number) =>
      Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
        arr.slice(i * size, i * size + size)
      );

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
        } catch (e: any) {
          logger.error({ err: e, threadId, userId }, `Failed to fetch thread ${threadId} from Gmail`);
          return null;
        }
      }));

      for (const threadData of fetchedThreads) {
        if (!threadData) continue;
        try {
          const threadMessages = threadData.messages || [];
          const parsedEmails = threadMessages.map(m => this.parserService.parseMessage(m));
          parsedEmails.sort((a, b) => a.internalDate.getTime() - b.internalDate.getTime());

          await this.dbService.upsertThreadAndEmails(userId, connectionId, parsedEmails);

          totalMessagesProcessed += parsedEmails.length;
          state.emailsProcessed = totalMessagesProcessed;
          state.threadsProcessed++;
        } catch (e: any) {
          logger.error({ err: e, threadId: threadData.id, userId }, `Failed to process thread in DB`);
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
    } else {
      console.log(`First sync for user ${userId} was halted manually. Not saving historyId to allow resume.`);
    }
  }

  private async performIncrementalSync(
    userId: string,
    connectionId: string,
    startHistoryId: string,
    gmail: gmail_v1.Gmail,
    state: SyncProgress
  ): Promise<string[]> {
    state.currentStage = "Checking for updates...";
    const processedEmailIds: string[] = [];
    const deletedMessageIds = new Set<string>();

    try {
      const res = await gmail.users.history.list({ userId: "me", startHistoryId });

      const historyRecords = res.data.history || [];
      const threadsToProcess = new Map<string, Set<string>>();

      for (const record of historyRecords) {
        if (record.messagesAdded) {
          for (const msgAdded of record.messagesAdded) {
            if (msgAdded.message?.id && msgAdded.message?.threadId) {
              if (!threadsToProcess.has(msgAdded.message.threadId)) {
                threadsToProcess.set(msgAdded.message.threadId, new Set());
              }
              threadsToProcess.get(msgAdded.message.threadId)!.add(msgAdded.message.id);
            }
          }
        }
        if (record.labelsAdded) {
          for (const labelAdded of record.labelsAdded) {
            if (labelAdded.message?.id && labelAdded.message?.threadId) {
              if (!threadsToProcess.has(labelAdded.message.threadId)) {
                threadsToProcess.set(labelAdded.message.threadId, new Set());
              }
              threadsToProcess.get(labelAdded.message.threadId)!.add(labelAdded.message.id);
            }
          }
        }
        if (record.labelsRemoved) {
          for (const labelRemoved of record.labelsRemoved) {
            if (labelRemoved.message?.id && labelRemoved.message?.threadId) {
              if (!threadsToProcess.has(labelRemoved.message.threadId)) {
                threadsToProcess.set(labelRemoved.message.threadId, new Set());
              }
              threadsToProcess.get(labelRemoved.message.threadId)!.add(labelRemoved.message.id);
            }
          }
        }
        if (record.messagesDeleted) {
          for (const msgDeleted of record.messagesDeleted) {
            if (msgDeleted.message?.id) {
              deletedMessageIds.add(msgDeleted.message.id);
              if (msgDeleted.message.threadId && threadsToProcess.has(msgDeleted.message.threadId)) {
                threadsToProcess.get(msgDeleted.message.threadId)!.delete(msgDeleted.message.id);
                if (threadsToProcess.get(msgDeleted.message.threadId)!.size === 0) {
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

      let hasErrors = false;
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
              } catch (err: any) {
                if (err.code === 404 || err.status === 404) return null;
                throw err;
              }
            }));
            const fetchedMessages = fetchedMessagesRaw.filter(m => m !== null);

            const parsedEmails = fetchedMessages.map(m => this.parserService.parseMessage(m));
            parsedEmails.sort((a, b) => a.internalDate.getTime() - b.internalDate.getTime());
            const savedEmails = await this.dbService.upsertThreadAndEmails(userId, connectionId, parsedEmails);
            if (savedEmails) {
              processedEmailIds.push(...savedEmails.map((e: any) => e.id));
            }
            state.emailsProcessed += parsedEmails.length;
          } else {
            const threadRes = await gmail.users.threads.get({ userId: "me", id: threadId, format: "full" });
            const threadMessages = threadRes.data.messages || [];
            const parsedEmails = threadMessages.map(m => this.parserService.parseMessage(m));
            parsedEmails.sort((a, b) => a.internalDate.getTime() - b.internalDate.getTime());
            const savedEmails = await this.dbService.upsertThreadAndEmails(userId, connectionId, parsedEmails);
            if (savedEmails) {
              processedEmailIds.push(...savedEmails.map((e: any) => e.id));
            }
            state.emailsProcessed += parsedEmails.length;
            await this.saveProgress(userId, state);
          }

        } catch (e: any) {
          hasErrors = true;
          logger.error({ err: e, threadId, userId }, `Failed to process thread ${threadId} during incremental sync`);
        }
      }

      if (res.data.historyId && !state.stopRequested && !hasErrors) {
        await this.dbService.updateLastHistoryId(userId, BigInt(res.data.historyId));
      } else if (hasErrors) {
        logger.warn({ userId }, 'One or more threads failed during incremental sync; not advancing historyId watermark so failed threads can be retried.');
      }

      state.currentStage = "Finalizing...";
      return processedEmailIds;
    } catch (error: any) {
      if (error.code === 404) {
        logger.warn({ userId }, `History expired for user ${userId}. Restarting First Sync.`);
        await this.dbService.updateLastHistoryId(userId, null);
        await this.performFirstSync(userId, connectionId, gmail, state);
        return [];
      } else {
        throw error;
      }
    }
  }
  async processWebhook(emailAddress: string, newHistoryId: bigint) {
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
    if (await this.isSyncRunning(userId)) {
      console.log(`Sync already running for ${userId}, queuing concurrent webhook execution.`);
      const currentPendingStr = await cacheService.get<string>(`sync:webhook:${userId}`);
      const currentPending = currentPendingStr ? BigInt(currentPendingStr) : BigInt(0);
      if (newHistoryId > currentPending) {
        await cacheService.set(`sync:webhook:${userId}`, newHistoryId.toString(), 1800);
      }
      return;
    }

    const locked = await cacheService.acquireLock(`sync:lock:${userId}`, 600);
    if (!locked) {
      console.log(`Sync already running for ${userId} (lock busy), queuing webhook.`);
      const currentPendingStr = await cacheService.get<string>(`sync:webhook:${userId}`);
      const currentPending = currentPendingStr ? BigInt(currentPendingStr) : BigInt(0);
      if (newHistoryId > currentPending) {
        await cacheService.set(`sync:webhook:${userId}`, newHistoryId.toString(), 1800);
      }
      return;
    }

    const state: SyncProgress = {
      status: "SYNCING",
      currentStage: "Processing Webhook...",
      emailsProcessed: 0,
      threadsProcessed: 0,
      totalEmailsEstimated: 0,
      startedAt: new Date(),
      lastError: null
    };
    await this.saveProgress(userId, state);

    emitToUser(userId, 'sync:started', { source: 'webhook' });

    let processedEmailIds: string[] = [];

    try {
      const gmail = await this.clientService.getAuthenticatedClient(userId);
      const startHistoryId = connection.lastHistoryId ? connection.lastHistoryId.toString() : (newHistoryId - BigInt(1)).toString();

      processedEmailIds = await this.performIncrementalSync(userId, connection.id, startHistoryId, gmail, state);

      if (processedEmailIds && processedEmailIds.length > 0) {
        state.currentStage = "Generating AI drafts...";
        await this.saveProgress(userId, state);

        const aiPromises = processedEmailIds.map(emailId => this.aiPipelineService.scheduleAnalysis(userId, emailId));
        await Promise.all(aiPromises);
      }

      state.status = "IDLE";
      state.currentStage = "Sync complete";
      await this.saveProgress(userId, state);
      await this.dbService.updateSyncStatus(userId, "IDLE");

      emitToUser(userId, 'sync:completed', {
        emailsProcessed: state.emailsProcessed
      });

    } catch (error: any) {
      logger.error({ err: error, userId }, `Webhook Sync failed for user ${userId}`);
      state.status = "ERROR";
      state.lastError = error.message;
      await this.saveProgress(userId, state);
      emitToUser(userId, 'sync:error', { error: error.message });
    } finally {
      await cacheService.releaseLock(`sync:lock:${userId}`);
      await cacheService.delete(`sync:progress:${userId}`);

      const pendingHistoryIdStr = await cacheService.get<string>(`sync:webhook:${userId}`);
      if (pendingHistoryIdStr) {
        await cacheService.delete(`sync:webhook:${userId}`);
        const pendingHistoryId = BigInt(pendingHistoryIdStr);
        console.log(`Executing queued webhook for ${userId} with historyId ${pendingHistoryId}`);
        setTimeout(() => {
          this.processWebhook(emailAddress, pendingHistoryId).catch(err => {
            logger.error({ err, emailAddress }, `Queued webhook failed for ${emailAddress}`);
          });
        }, 1000);
      }
    }
  }
}
