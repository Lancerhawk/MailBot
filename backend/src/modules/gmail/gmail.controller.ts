import { Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import { env } from "../../config/env";
import { GmailSyncService } from "./services/gmail.sync.service";
import { GmailDbService } from "./services/gmail.db.service";
import { GmailActionsService } from "./services/gmail.actions.service";
import { GmailSendService } from "./services/gmail.send.service";
import { ApiError } from "../../utils/ApiError";
import { WatchRenewalService } from "./services/watch-renewal.service";
import { logger } from "../../config/logger";
import { prisma } from "../../lib/prisma";

export class GmailController {
  private syncService = new GmailSyncService();
  private dbService = new GmailDbService();
  private actionsService = new GmailActionsService();
  private sendService = new GmailSendService();
  private oauth2Client = new OAuth2Client();

  private async verifyWebhookAuth(req: Request): Promise<boolean> {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const idToken = authHeader.split(' ')[1];
      try {
        const ticket = await this.oauth2Client.verifyIdToken({
          idToken,
          audience: env.GMAIL_WEBHOOK_AUDIENCE || `${env.API_URL}/api/v1/gmail/webhook`,
        });
        const payload = ticket.getPayload();
        if (payload && (payload.iss === 'https://accounts.google.com' || payload.iss === 'accounts.google.com')) {
          if (env.GMAIL_WEBHOOK_SERVICE_ACCOUNT_EMAIL && payload.email !== env.GMAIL_WEBHOOK_SERVICE_ACCOUNT_EMAIL) {
            logger.warn({ expected: env.GMAIL_WEBHOOK_SERVICE_ACCOUNT_EMAIL, received: payload.email }, "[Webhook Security] OIDC email claim mismatch");
            return false;
          }
          return true;
        }
        return false;
      } catch (error) {
        logger.warn({ err: error }, "[Webhook Security] OIDC verification failed");
        return false;
      }
    }

    if (env.GMAIL_WEBHOOK_SECRET) {
      const channelToken = req.headers['x-goog-channel-token'] || req.headers['x-webhook-secret'];
      if (channelToken) {
        return channelToken === env.GMAIL_WEBHOOK_SECRET;
      }
    }

    if (env.GMAIL_WEBHOOK_REQUIRE_OIDC) {
      logger.warn("[Webhook Security] Rejected webhook request: GMAIL_WEBHOOK_REQUIRE_OIDC=true and no valid OIDC token/secret was provided.");
      return false;
    }

    logger.warn("[Webhook Security] Webhook received without OIDC token. Ensure Pub/Sub OIDC auth is enabled in Google Cloud Console.");
    return true;
  }

  async webhook(req: Request, res: Response) {
    try {
      logger.info({ ip: req.ip }, "[Gmail Webhook] Received POST request");
      const isAuthorized = await this.verifyWebhookAuth(req);
      if (!isAuthorized) {
        logger.warn({ ip: req.ip }, "[Webhook Security] Rejected unauthorized webhook POST");
        return res.status(403).send('Forbidden: Invalid webhook authentication');
      }

      const message = req.body?.message;
      if (!message || !message.data) {
        logger.warn('[Gmail Webhook] Missing message or message.data in request body');
        return res.status(400).send('Bad Request');
      }

      const decodedData = Buffer.from(message.data, 'base64').toString('utf8');
      const payload = JSON.parse(decodedData);

      const emailAddress = payload.emailAddress;
      const historyId = payload.historyId;

      if (!emailAddress || !historyId) {
        logger.warn({ payload }, '[Gmail Webhook] Missing emailAddress or historyId in decoded payload');
        return res.status(400).send('Invalid payload');
      }

      logger.info({ emailAddress, historyId }, '[Gmail Webhook] Valid push notification received');

      res.status(200).send('OK');

      this.syncService.processWebhook(emailAddress, BigInt(historyId)).catch(err => {
        logger.error({ err, emailAddress }, 'Webhook processing failed');
      });

    } catch (error) {
      logger.error({ err: error }, 'Webhook error');
      res.status(200).send('OK');
    }
  }

  async sync(req: Request, res: Response) {
    const userId = req.session.userId!;

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
        logger.error({ err, userId }, "Background sync failed");
      });

      res.status(202).json({
        status: "success",
        message: "Synchronization started",
      });
    } catch (error) {
      logger.error({ err: error, userId }, "Failed to start synchronization");
      res.status(500).json({ status: "error", message: "Failed to start synchronization" });
    }
  }

  async stopSync(req: Request, res: Response) {
    const userId = req.session.userId!;
    try {
      await this.syncService.stopSync(userId);
      res.json({ status: "success", message: "Stop requested" });
    } catch (error) {
      logger.error({ err: error, userId }, "Failed to stop synchronization");
      res.status(500).json({ status: "error", message: "Failed to stop synchronization" });
    }
  }

  async registerWatch(req: Request, res: Response) {
    const userId = req.session.userId!;
    try {
      const watchService = new WatchRenewalService();
      await watchService.registerWatch(userId, true);
      res.json({ status: "success", message: "Gmail watch registered successfully" });
    } catch (error: any) {
      logger.error({ err: error, userId }, "Watch registration failed");
      res.status(500).json({ status: "error", message: error?.message || "Failed to register Gmail watch" });
    }
  }

  async getStatus(req: Request, res: Response) {
    const userId = req.session.userId!;
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
    } catch (error) {
      logger.error({ err: error, userId }, "Failed to fetch status");
      res.status(500).json({ status: "error", message: "Failed to fetch status" });
    }
  }

  async getProfile(req: Request, res: Response) {
    const userId = req.session.userId!;
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          timezone: true,
          connections: {
            where: { provider: 'GMAIL' },
            select: {
              id: true,
              emailAddress: true,
              syncStatus: true,
              lastSuccessfulSyncAt: true,
              lastSyncError: true,
              isActive: true,
            },
          },
        },
      });

      if (!user) {
        return res.status(404).json({ status: "error", message: "User profile not found" });
      }

      res.json({ status: "success", data: user });
    } catch (error) {
      logger.error({ err: error, userId }, "Failed to get profile");
      res.status(500).json({ status: "error", message: "Failed to get profile" });
    }
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
    } catch {
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
    } catch {
      res.status(500).json({ status: "error", message: "Failed to get thread" });
    }
  }

  async getThreadsBulk(req: Request, res: Response) {
    const userId = req.session.userId!;
    const threadIds = req.body.threadIds;

    if (!Array.isArray(threadIds)) {
      return res.status(400).json({ status: "error", message: "threadIds must be an array" });
    }

    try {
      const threads = await this.dbService.getThreadsBulk(userId, threadIds);
      res.json({ status: "success", data: threads });
    } catch {
      res.status(500).json({ status: "error", message: "Failed to get threads bulk" });
    }
  }

  async getEmail(req: Request, res: Response) {
    const userId = req.session.userId!;
    const emailId = req.params.id;

    try {
      const email = await this.dbService.getEmailByIdWithConnection(userId, emailId);
      if (!email) {
        return res.status(404).json({ status: "error", message: "Email not found" });
      }
      res.json({ status: "success", data: email });
    } catch (error) {
      logger.error({ err: error, userId, emailId }, "Failed to get email");
      res.status(500).json({ status: "error", message: "Failed to get email" });
    }
  }

  private async handleAction(req: Request, res: Response, actionFn: (userId: string, emailId: string) => Promise<void>) {
    const userId = req.session.userId;
    if (!userId) throw new ApiError(401, 'Unauthorized');
    const emailId = req.params.id;
    try {
      await actionFn.call(this.actionsService, userId, emailId);
      res.json({ status: 'success' });
    } catch (err: unknown) {
      const error = err as Error & { statusCode?: number };
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
    const targetEmailId = req.body.emailId;
    const editedText = req.body.editedText;
    if (!targetEmailId) throw new ApiError(400, 'emailId is required in body');
    try {
      await this.sendService.sendReply(userId, targetEmailId, editedText);
      res.json({ status: 'success' });
    } catch (err: unknown) {
      const error = err as Error & { statusCode?: number };
      res.status(error.statusCode || 500).json({ status: 'error', message: error.message });
    }
  }

  async sendCompose(req: Request, res: Response) {
    const userId = req.session.userId;
    if (!userId) throw new ApiError(401, 'Unauthorized');
    try {
      await this.sendService.sendCompose(userId, req.body);
      res.json({ status: 'success' });
    } catch (err: unknown) {
      const error = err as Error & { statusCode?: number };
      res.status(error.statusCode || 500).json({ status: 'error', message: error.message });
    }
  }
}
