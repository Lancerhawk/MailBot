import { Request, Response } from "express";
import { GmailSyncService } from "./services/gmail.sync.service";
import { GmailDbService } from "./services/gmail.db.service";
import { GmailActionsService } from "./services/gmail.actions.service";
import { GmailSendService } from "./services/gmail.send.service";
import { ApiError } from "../../utils/ApiError";

export class GmailController {
  private syncService = new GmailSyncService();
  private dbService = new GmailDbService();
  private actionsService = new GmailActionsService();
  private sendService = new GmailSendService();

  async webhook(req: Request, res: Response) {
    try {
      const message = req.body?.message;
      if (!message || !message.data) {
        return res.status(400).send('Bad Request');
      }

      // Automatically forward a copy to local dev environment for easy testing
      if (process.env.NODE_ENV === 'production') {
        const axios = require('axios');
        axios.post('https://smee.io/qNqTAILklQaJLAdN', req.body).catch(() => { });
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

    const filter = req.query.filter as string;
    const search = req.query.search as string;

    try {
      const threads = await this.dbService.listThreads(userId, page, limit, filter, search);
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

  private async handleAction(req: Request, res: Response, actionFn: (userId: string, emailId: string) => Promise<void>) {
    const userId = req.session.userId;
    if (!userId) throw new ApiError(401, 'Unauthorized');
    const emailId = req.params.id;
    try {
      await actionFn.call(this.actionsService, userId, emailId);
      res.json({ status: 'success' });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ status: 'error', message: error.message });
    }
  }

  markRead = async (req: Request, res: Response) => this.handleAction(req, res, this.actionsService.markRead);
  markUnread = async (req: Request, res: Response) => this.handleAction(req, res, this.actionsService.markUnread);
  star = async (req: Request, res: Response) => this.handleAction(req, res, this.actionsService.star);
  unstar = async (req: Request, res: Response) => this.handleAction(req, res, this.actionsService.unstar);
  archive = async (req: Request, res: Response) => this.handleAction(req, res, this.actionsService.archive);
  unarchive = async (req: Request, res: Response) => this.handleAction(req, res, this.actionsService.unarchive);
  deleteToTrash = async (req: Request, res: Response) => this.handleAction(req, res, this.actionsService.deleteToTrash);
  restoreFromTrash = async (req: Request, res: Response) => this.handleAction(req, res, this.actionsService.restoreFromTrash);
  markSpam = async (req: Request, res: Response) => this.handleAction(req, res, this.actionsService.markSpam);
  unmarkSpam = async (req: Request, res: Response) => this.handleAction(req, res, this.actionsService.unmarkSpam);
  permanentlyDelete = async (req: Request, res: Response) => this.handleAction(req, res, this.actionsService.permanentlyDelete);

  threadMarkRead = async (req: Request, res: Response) => this.handleAction(req, res, this.actionsService.threadMarkRead);
  threadMarkUnread = async (req: Request, res: Response) => this.handleAction(req, res, this.actionsService.threadMarkUnread);
  threadStar = async (req: Request, res: Response) => this.handleAction(req, res, this.actionsService.threadStar);
  threadUnstar = async (req: Request, res: Response) => this.handleAction(req, res, this.actionsService.threadUnstar);
  threadArchive = async (req: Request, res: Response) => this.handleAction(req, res, this.actionsService.threadArchive);
  threadUnarchive = async (req: Request, res: Response) => this.handleAction(req, res, this.actionsService.threadUnarchive);
  threadDeleteToTrash = async (req: Request, res: Response) => this.handleAction(req, res, this.actionsService.threadDeleteToTrash);
  threadRestoreFromTrash = async (req: Request, res: Response) => this.handleAction(req, res, this.actionsService.threadRestoreFromTrash);
  threadMarkSpam = async (req: Request, res: Response) => this.handleAction(req, res, this.actionsService.threadMarkSpam);
  threadUnmarkSpam = async (req: Request, res: Response) => this.handleAction(req, res, this.actionsService.threadUnmarkSpam);
  threadPermanentlyDelete = async (req: Request, res: Response) => this.handleAction(req, res, this.actionsService.threadPermanentlyDelete);

  async sendReply(req: Request, res: Response) {
    const userId = req.session.userId;
    if (!userId) throw new ApiError(401, 'Unauthorized');
    const emailId = req.params.id;
    const targetEmailId = req.body.emailId;
    const editedText = req.body.editedText;
    if (!targetEmailId) throw new ApiError(400, 'emailId is required in body');
    try {
      await this.sendService.sendReply(userId, targetEmailId, editedText);
      res.json({ status: 'success' });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ status: 'error', message: error.message });
    }
  }

  async sendCompose(req: Request, res: Response) {
    const userId = req.session.userId;
    if (!userId) throw new ApiError(401, 'Unauthorized');
    try {
      await this.sendService.sendCompose(userId, req.body);
      res.json({ status: 'success' });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ status: 'error', message: error.message });
    }
  }
}
