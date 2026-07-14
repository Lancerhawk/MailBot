import { Request, Response, NextFunction } from 'express';
import { KnowledgeService } from './knowledge.service';
import { ApiError } from '../../utils/ApiError';

const knowledgeService = new KnowledgeService();

export class KnowledgeController {
  async upload(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new ApiError(401, 'Unauthorized');

      const file = req.file;
      if (!file) throw new ApiError(400, 'No file provided');

      const { title, description, folder } = req.body;

      const document = await knowledgeService.uploadDocument(userId, {
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      }, { title, description, folder });

      res.status(201).json({ status: 'success', data: document });
    } catch (error) {
      next(error);
    }
  }

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new ApiError(401, 'Unauthorized');

      const {
        folder,
        processingStatus,
        isArchived,
        search,
        sort,
        page,
        limit,
      } = req.query;

      const result = await knowledgeService.listDocuments(userId, {
        folder: folder as string,
        processingStatus: processingStatus as string,
        isArchived: isArchived === 'true' ? true : isArchived === 'false' ? false : undefined,
        search: search as string,
        sort: sort as string,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });

      res.json({ status: 'success', data: result });
    } catch (error) {
      next(error);
    }
  }

  async getOne(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new ApiError(401, 'Unauthorized');

      const document = await knowledgeService.getDocument(userId, req.params.id);
      res.json({ status: 'success', data: document });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new ApiError(401, 'Unauthorized');

      const { title, description, folder } = req.body;
      const document = await knowledgeService.updateDocument(userId, req.params.id, {
        title, description, folder,
      });

      res.json({ status: 'success', data: document });
    } catch (error) {
      next(error);
    }
  }

  async archive(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new ApiError(401, 'Unauthorized');

      await knowledgeService.archiveDocument(userId, req.params.id);
      res.json({ status: 'success', message: 'Document archived' });
    } catch (error) {
      next(error);
    }
  }

  async restore(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new ApiError(401, 'Unauthorized');

      await knowledgeService.restoreDocument(userId, req.params.id);
      res.json({ status: 'success', message: 'Document restored' });
    } catch (error) {
      next(error);
    }
  }

  async retry(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new ApiError(401, 'Unauthorized');

      await knowledgeService.retryProcessing(userId, req.params.id);
      res.json({ status: 'success', message: 'Processing retried' });
    } catch (error) {
      next(error);
    }
  }

  async replace(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new ApiError(401, 'Unauthorized');

      const file = req.file;
      if (!file) throw new ApiError(400, 'No file provided');

      const document = await knowledgeService.replaceDocument(userId, req.params.id, {
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      });

      res.json({ status: 'success', data: document });
    } catch (error) {
      next(error);
    }
  }

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new ApiError(401, 'Unauthorized');

      await knowledgeService.deleteDocument(userId, req.params.id);
      res.json({ status: 'success', message: 'Document deleted' });
    } catch (error) {
      next(error);
    }
  }

  async download(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new ApiError(401, 'Unauthorized');

      const result = await knowledgeService.getDownloadUrl(userId, req.params.id);
      res.json({ status: 'success', data: result });
    } catch (error) {
      next(error);
    }
  }

  async search(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new ApiError(401, 'Unauthorized');

      const query = req.query.q as string;
      if (!query) throw new ApiError(400, 'Search query is required');

      const result = await knowledgeService.searchDocuments(userId, query);
      res.json({ status: 'success', data: result });
    } catch (error) {
      next(error);
    }
  }

  async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new ApiError(401, 'Unauthorized');

      const stats = await knowledgeService.getStats(userId);
      res.json({ status: 'success', data: stats });
    } catch (error) {
      next(error);
    }
  }

  async getFolders(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new ApiError(401, 'Unauthorized');

      const counts = await knowledgeService.getFolderCounts(userId);
      res.json({ status: 'success', data: counts });
    } catch (error) {
      next(error);
    }
  }
}
