import { Request, Response } from "express";
import { GmailSyncService } from "./services/gmail.sync.service";
import { GmailDbService } from "./services/gmail.db.service";

export class GmailController {
  private syncService = new GmailSyncService();
  private dbService = new GmailDbService();

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
      console.time(`API GET /status dbCheck`);
      const dbStatus = await this.dbService.getConnectionStatus(userId);
      console.timeEnd(`API GET /status dbCheck`);

      if (!dbStatus) {
        return res.status(404).json({ status: "error", message: "Gmail connection not found" });
      }

      console.time(`API GET /status memCheck`);
      const activeSync = this.syncService.getSyncStatus(userId);
      console.timeEnd(`API GET /status memCheck`);

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
      console.time(`API GET /threads dbQuery`);
      const threads = await this.dbService.listThreads(userId, page, limit);
      console.timeEnd(`API GET /threads dbQuery`);
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
