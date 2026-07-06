import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware";
import { GmailController } from "./gmail.controller";

const router = Router();
const gmailController = new GmailController();

router.post("/webhook", gmailController.webhook.bind(gmailController));

router.use(requireAuth);

router.post("/sync", gmailController.sync.bind(gmailController));
router.post("/sync/stop", gmailController.stopSync.bind(gmailController));
router.get("/status", gmailController.getStatus.bind(gmailController));
router.get("/profile", gmailController.getProfile.bind(gmailController));
router.get("/threads", gmailController.listThreads.bind(gmailController));
router.get("/threads/:id", gmailController.getThread.bind(gmailController));
router.get("/emails/:id", gmailController.getEmail.bind(gmailController));

export default router;
