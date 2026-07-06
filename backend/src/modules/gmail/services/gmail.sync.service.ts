import { GmailClientService } from "./gmail.client.service";
import { GmailParserService, ParsedEmail } from "./gmail.parser.service";
import { GmailDbService } from "./gmail.db.service";
import { gmail_v1 } from "googleapis";

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

const syncMemoryMap = new Map<string, SyncProgress>();

const MAX_INITIAL_THREADS = 100;
const MAX_INITIAL_MESSAGES = 1000;
const BATCH_SIZE = 5;

export class GmailSyncService {
  private clientService = new GmailClientService();
  private parserService = new GmailParserService();
  private dbService = new GmailDbService();

  isSyncRunning(userId: string): boolean {
    const state = syncMemoryMap.get(userId);
    return state?.status === "SYNCING";
  }

  getSyncStatus(userId: string): SyncProgress | null {
    return syncMemoryMap.get(userId) || null;
  }

  async stopSync(userId: string) {
    const state = syncMemoryMap.get(userId);
    if (state) {
      state.stopRequested = true;
      state.status = "IDLE";
      state.currentStage = "Stopped";
    }
    await this.dbService.updateSyncStatus(userId, "IDLE");
  }

  async startSync(userId: string) {
    if (this.isSyncRunning(userId)) return;

    const connection = await this.clientService.getConnection(userId);
    if (!connection) {
      console.error(`No connection found for user ${userId}`);
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
    syncMemoryMap.set(userId, state);
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
      await this.dbService.updateSyncStatus(userId, "IDLE");

    } catch (error: any) {
      console.error(`Sync failed for user ${userId}:`, error);
      state.status = "ERROR";
      state.lastError = error.message;
      await this.dbService.updateSyncStatus(userId, "ERROR", error.message);
    } finally {
      setTimeout(() => {
        syncMemoryMap.delete(userId);
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

      console.time(`Gmail-FetchChunk`);
      const fetchedThreads = await Promise.all(chunk.map(async (threadId) => {
        try {
          const threadRes = await gmail.users.threads.get({ userId: "me", id: threadId, format: "full" });
          return threadRes.data;
        } catch (e) {
          console.error(`Failed to fetch thread ${threadId} from Gmail:`, e);
          return null;
        }
      }));
      console.timeEnd(`Gmail-FetchChunk`);

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
        } catch (e) {
          console.error(`Failed to process thread in DB:`, e);
        }
      }
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
  ) {
    state.currentStage = "Checking for updates...";
    try {
      console.time(`Gmail-HistoryList`);
      const res = await gmail.users.history.list({ userId: "me", startHistoryId });
      console.timeEnd(`Gmail-HistoryList`);

      if (res.data.historyId) {
        await this.dbService.updateLastHistoryId(userId, BigInt(res.data.historyId));
      }

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
      }

      if (threadsToProcess.size === 0) {
        await new Promise(resolve => setTimeout(resolve, 800));
        state.currentStage = "Up to date";
        return;
      }

      state.totalEmailsEstimated = Array.from(threadsToProcess.values()).reduce((sum, set) => sum + set.size, 0);
      state.currentStage = "Importing new conversations...";

      for (const [threadId, messageIds] of threadsToProcess.entries()) {
        if (state.stopRequested) {
          console.log(`Sync stopped by user ${userId}`);
          break;
        }
        try {
          console.time(`Prisma-ThreadCheck-${threadId}`);
          const existingThread = await this.dbService.getThread(userId, threadId);
          console.timeEnd(`Prisma-ThreadCheck-${threadId}`);

          if (existingThread) {
            console.time(`Gmail-MissingMessages-${threadId}`);
            const fetchedMessages = await Promise.all(Array.from(messageIds).map(async (msgId) => {
              const fullMsgRes = await gmail.users.messages.get({ userId: "me", id: msgId, format: "full" });
              return fullMsgRes.data;
            }));
            console.timeEnd(`Gmail-MissingMessages-${threadId}`);

            const parsedEmails = fetchedMessages.map(m => this.parserService.parseMessage(m));
            parsedEmails.sort((a, b) => a.internalDate.getTime() - b.internalDate.getTime());
            await this.dbService.upsertThreadAndEmails(userId, connectionId, parsedEmails);
            state.emailsProcessed += parsedEmails.length;
          } else {
            console.time(`Gmail-FullThread-${threadId}`);
            const threadRes = await gmail.users.threads.get({ userId: "me", id: threadId, format: "full" });
            console.timeEnd(`Gmail-FullThread-${threadId}`);
            const threadMessages = threadRes.data.messages || [];
            const parsedEmails = threadMessages.map(m => this.parserService.parseMessage(m));
            parsedEmails.sort((a, b) => a.internalDate.getTime() - b.internalDate.getTime());
            await this.dbService.upsertThreadAndEmails(userId, connectionId, parsedEmails);
            state.emailsProcessed += parsedEmails.length;
          }

        } catch (e) {
          console.error(`Failed to process thread ${threadId}:`, e);
        }
      }

      state.currentStage = "Finalizing...";
    } catch (error: any) {
      if (error.code === 404) {
        console.log(`History expired for user ${userId}. Restarting First Sync.`);
        await this.dbService.updateLastHistoryId(userId, null);
        await this.performFirstSync(userId, connectionId, gmail, state);
      } else {
        throw error;
      }
    }
  }
}
