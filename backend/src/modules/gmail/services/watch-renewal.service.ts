import { PrismaClient, SyncStatus } from '@prisma/client';
import { GmailClientService } from './gmail.client.service';
import { logger } from '../../../config/logger';

const prisma = new PrismaClient();
const gmailClient = new GmailClientService();

export class WatchRenewalService {
  private isRenewing = false;
  private readonly pubSubTopic = process.env.GMAIL_PUBSUB_TOPIC || 'projects/your-project-id/topics/gmail-webhooks';


  async registerWatch(userId: string): Promise<void> {
    const connection = await gmailClient.getConnection(userId);
    if (!connection) {
      logger.error(`Cannot register watch: no connection for user ${userId}`);
      return;
    }

    const now = new Date();
    if (connection.watchExpiration && connection.watchExpiration > new Date(now.getTime() + 24 * 60 * 60 * 1000)) {
      if (connection.syncStatus !== SyncStatus.ERROR) {
        logger.info(`Watch for user ${userId} is still valid until ${connection.watchExpiration}. Skipping registration.`);
        return;
      }
    }

    await this.performWatchRegistration(userId);
  }

  private async performWatchRegistration(userId: string, attempt = 1): Promise<void> {
    try {
      const client = await gmailClient.getAuthenticatedClient(userId);
      const res = await client.users.watch({
        userId: 'me',
        requestBody: {
          topicName: this.pubSubTopic
        }
      });

      const expirationStr = res.data.expiration;
      const watchExpiration = expirationStr ? new Date(parseInt(expirationStr, 10)) : new Date(Date.now() + 6 * 24 * 60 * 60 * 1000);

      const historyIdStr = res.data.historyId;

      await prisma.emailAccountConnection.updateMany({
        where: { userId, provider: 'GMAIL' },
        data: {
          watchExpiration,
          syncStatus: SyncStatus.IDLE,
          ...(historyIdStr && await this.isFirstTimeRegistration(userId) ? { lastHistoryId: BigInt(historyIdStr) } : {})
        }
      });

      logger.info(`Successfully registered Gmail Watch for user ${userId}. Expires at ${watchExpiration}`);
    } catch (error) {
      const isTransient = attempt <= 3;
      if (isTransient) {
        const backoff = Math.pow(2, attempt) * 1000;
        logger.warn(`Failed to register watch for user ${userId}. Retrying in ${backoff}ms...`);
        await new Promise(r => setTimeout(r, backoff));
        return this.performWatchRegistration(userId, attempt + 1);
      }

      logger.error({ error, userId }, 'Failed to register Gmail watch after multiple attempts.');
      await prisma.emailAccountConnection.updateMany({
        where: { userId, provider: 'GMAIL' },
        data: { syncStatus: SyncStatus.ERROR }
      });
    }
  }

  private async isFirstTimeRegistration(userId: string): Promise<boolean> {
    const conn = await gmailClient.getConnection(userId);
    return conn?.lastHistoryId == null;
  }


  async runRenewalJob(): Promise<void> {
    if (this.isRenewing) return;
    this.isRenewing = true;

    try {
      const threshold = new Date(Date.now() + 48 * 60 * 60 * 1000);

      const connectionsToRenew = await prisma.emailAccountConnection.findMany({
        where: {
          provider: 'GMAIL',
          isActive: true,
          OR: [
            { watchExpiration: null },
            { watchExpiration: { lt: threshold } },
            { syncStatus: SyncStatus.ERROR }
          ]
        },
        select: { userId: true }
      });

      for (const conn of connectionsToRenew) {
        await this.performWatchRegistration(conn.userId);
      }
    } catch (error) {
      logger.error({ error }, 'Error during bulk watch renewal job.');
    } finally {
      this.isRenewing = false;
    }
  }
}
