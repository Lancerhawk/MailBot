import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware";
import { GmailController } from "./gmail.controller";
import { refreshRateLimiter } from "../../middlewares/rateLimiter";

const router = Router();
const gmailController = new GmailController();

router.post("/webhook", gmailController.webhook.bind(gmailController));

router.use(requireAuth);

router.post("/sync", gmailController.sync.bind(gmailController));
router.post("/sync/stop", gmailController.stopSync.bind(gmailController));
router.post("/watch/register", gmailController.registerWatch.bind(gmailController));
router.get("/debug/state", gmailController.debugState.bind(gmailController));
router.get("/status", gmailController.getStatus.bind(gmailController));
router.get("/profile", gmailController.getProfile.bind(gmailController));
router.get("/threads", refreshRateLimiter, gmailController.listThreads.bind(gmailController));
router.get("/threads/:id", refreshRateLimiter, gmailController.getThread.bind(gmailController));
router.post("/threads/bulk", refreshRateLimiter, gmailController.getThreadsBulk.bind(gmailController));
router.get("/emails/:id", gmailController.getEmail.bind(gmailController));

router.post('/emails/:id/read', gmailController.markRead);
router.post('/emails/:id/unread', gmailController.markUnread);
router.post('/emails/:id/star', gmailController.star);
router.post('/emails/:id/unstar', gmailController.unstar);
router.post('/emails/:id/archive', gmailController.archive);
router.post('/emails/:id/unarchive', gmailController.unarchive);
router.post('/emails/:id/delete', gmailController.deleteToTrash);
router.post('/emails/:id/restore', gmailController.restoreFromTrash);
router.post('/emails/:id/spam', gmailController.markSpam);
router.post('/emails/:id/unspam', gmailController.unmarkSpam);
router.delete('/emails/:id/permanent', gmailController.permanentlyDelete);

router.post('/threads/:id/read', gmailController.threadMarkRead);
router.post('/threads/:id/unread', gmailController.threadMarkUnread);
router.post('/threads/:id/star', gmailController.threadStar);
router.post('/threads/:id/unstar', gmailController.threadUnstar);
router.post('/threads/:id/archive', gmailController.threadArchive);
router.post('/threads/:id/unarchive', gmailController.threadUnarchive);
router.post('/threads/:id/delete', gmailController.threadDeleteToTrash);
router.post('/threads/:id/restore', gmailController.threadRestoreFromTrash);
router.post('/threads/:id/spam', gmailController.threadMarkSpam);
router.post('/threads/:id/unspam', gmailController.threadUnmarkSpam);
router.delete('/threads/:id/permanent', gmailController.threadPermanentlyDelete);

router.post('/send/reply', gmailController.sendReply.bind(gmailController));
router.post('/send/compose', gmailController.sendCompose.bind(gmailController));

export default router;
