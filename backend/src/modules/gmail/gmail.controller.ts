import { Request, Response } from "express";
import { GmailSyncService } from "./services/gmail.sync.service";
import { GmailDbService } from "./services/gmail.db.service";

export class GmailController {
  private syncService = new GmailSyncService();
  private dbService = new GmailDbService();

  async webhook(req: Request, res: Response) {
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

    } catch (error) {
      console.error('Webhook error:', error);
      res.status(200).send('OK');
    }
  }

  async sync(req: Request, res: Response) {
    const userId = req.session.userId!;

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
    } catch (error) {
      console.error(error);
      res.status(500).json({ status: "error", message: "Failed to start synchronization" });
    }
  }

  async stopSync(req: Request, res: Response) {
    const userId = req.session.userId!;
    try {
      await this.syncService.stopSync(userId);
      res.json({ status: "success", message: "Stop requested" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ status: "error", message: "Failed to stop synchronization" });
    }
  }

  async getStatus(req: Request, res: Response) {
    const userId = req.session.userId!;
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
    } catch (error) {
      console.error(error);
      res.status(500).json({ status: "error", message: "Failed to fetch status" });
    }
  }

  async getProfile(req: Request, res: Response) {
    res.json({ status: "success", data: {} });
  }

  async listThreads(req: Request, res: Response) {
    const userId = req.session.userId!;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    try {
      const threads = await this.dbService.listThreads(userId, page, limit);
      res.json({ status: "success", data: threads });
    } catch (error) {
      res.status(500).json({ status: "error", message: "Failed to list threads" });
    }
  }

  async getThread(req: Request, res: Response) {
    const userId = req.session.userId!;
    const threadId = req.params.id;

    try {
      const thread = await this.dbService.getThread(userId, threadId);
      if (!thread) {
        return res.status(404).json({ status: "error", message: "Thread not found" });
      }
      res.json({ status: "success", data: thread });
    } catch (error) {
      res.status(500).json({ status: "error", message: "Failed to get thread" });
    }
  }

  async getEmail(req: Request, res: Response) {
    res.json({ status: "success", data: {} });
  }
}
