import { Request, Response, NextFunction } from "express";
import { ContactService } from "./contact.service";
import { ApiError } from "../../utils/ApiError";

const contactService = new ContactService();

export class ContactController {

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new ApiError(401, "Unauthorized");

      const result = await contactService.listContacts(userId, req.query as Record<string, string>);

      res.json({
        status: "success",
        data: result.contacts,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  async getOne(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new ApiError(401, "Unauthorized");

      const contact = await contactService.getContact(userId, req.params.id);
      res.json({ status: "success", data: contact });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new ApiError(401, "Unauthorized");

      const updated = await contactService.updateContact(userId, req.params.id, req.body);
      res.json({ status: "success", data: updated });
    } catch (error) {
      next(error);
    }
  }

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new ApiError(401, "Unauthorized");

      await contactService.deleteContact(userId, req.params.id);
      res.json({ status: "success", message: "Contact deleted" });
    } catch (error) {
      next(error);
    }
  }

  async archive(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new ApiError(401, "Unauthorized");

      await contactService.archiveContact(userId, req.params.id);
      res.json({ status: "success", message: "Contact archived" });
    } catch (error) {
      next(error);
    }
  }

  async restore(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new ApiError(401, "Unauthorized");

      await contactService.restoreContact(userId, req.params.id);
      res.json({ status: "success", message: "Contact restored" });
    } catch (error) {
      next(error);
    }
  }

  async merge(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new ApiError(401, "Unauthorized");

      const { secondaryId } = req.body;

      const merged = await contactService.mergeContacts(userId, req.params.id, secondaryId);
      res.json({ status: "success", data: merged });
    } catch (error) {
      next(error);
    }
  }

  async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new ApiError(401, "Unauthorized");

      const stats = await contactService.getStats(userId);
      res.json({ status: "success", data: stats });
    } catch (error) {
      next(error);
    }
  }

  async getRecent(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new ApiError(401, "Unauthorized");

      const limit = parseInt(req.query.limit as string) || 10;
      const contacts = await contactService.getRecentContacts(userId, limit);
      res.json({ status: "success", data: contacts });
    } catch (error) {
      next(error);
    }
  }

  async getTop(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new ApiError(401, "Unauthorized");

      const limit = parseInt(req.query.limit as string) || 10;
      const contacts = await contactService.getTopContacts(userId, limit);
      res.json({ status: "success", data: contacts });
    } catch (error) {
      next(error);
    }
  }

  async getFavorites(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new ApiError(401, "Unauthorized");

      const contacts = await contactService.getFavorites(userId);
      res.json({ status: "success", data: contacts });
    } catch (error) {
      next(error);
    }
  }

  async getPinned(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new ApiError(401, "Unauthorized");

      const contacts = await contactService.getPinnedContacts(userId);
      res.json({ status: "success", data: contacts });
    } catch (error) {
      next(error);
    }
  }

  async getEmails(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new ApiError(401, "Unauthorized");

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await contactService.getContactEmails(userId, req.params.id, page, limit);
      res.json({ status: "success", data: result.emails, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  async getTimeline(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new ApiError(401, "Unauthorized");

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 30;

      const result = await contactService.getContactTimeline(userId, req.params.id, page, limit);
      res.json({ status: "success", data: result.timeline, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  async listOrganizations(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new ApiError(401, "Unauthorized");

      const search = req.query.search as string;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await contactService.listOrganizations(userId, search, page, limit);
      res.json({ status: "success", data: result.organizations, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  async getOrganization(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new ApiError(401, "Unauthorized");

      const org = await contactService.getOrganization(userId, req.params.id);
      res.json({ status: "success", data: org });
    } catch (error) {
      next(error);
    }
  }
}
