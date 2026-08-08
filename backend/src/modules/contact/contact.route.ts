import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { ContactController } from "./contact.controller";
import { mergeContactSchema } from "./contact.validation";

const router = Router();
const controller = new ContactController();

router.use(requireAuth);

router.get("/stats", controller.getStats.bind(controller));
router.get("/recent", controller.getRecent.bind(controller));
router.get("/top", controller.getTop.bind(controller));
router.get("/favorites", controller.getFavorites.bind(controller));
router.get("/pinned", controller.getPinned.bind(controller));

router.get("/organizations", controller.listOrganizations.bind(controller));
router.get("/organizations/:id", controller.getOrganization.bind(controller));

router.get("/", controller.list.bind(controller));
router.get("/:id", controller.getOne.bind(controller));
router.patch("/:id", controller.update.bind(controller));
router.delete("/:id", controller.remove.bind(controller));

router.post("/:id/archive", controller.archive.bind(controller));
router.post("/:id/restore", controller.restore.bind(controller));
router.post("/:id/merge", validate(mergeContactSchema), controller.merge.bind(controller));

router.get("/:id/emails", controller.getEmails.bind(controller));
router.get("/:id/timeline", controller.getTimeline.bind(controller));

export default router;
