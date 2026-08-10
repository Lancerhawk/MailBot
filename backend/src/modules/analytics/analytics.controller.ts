import { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { logger } from '../../config/logger';
import { cacheService } from '../../lib/cache.service';

function serializeData(obj: any) {
  return JSON.parse(
    JSON.stringify(obj, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    )
  );
}

export class AnalyticsController {

  private buildDateFilter(req: Request) {
    const { startDate, endDate } = req.query;
    const filter: any = {};
    if (startDate) {
      filter.gte = new Date(startDate as string);
    }
    if (endDate) {
      const end = new Date(endDate as string);
      end.setUTCHours(23, 59, 59, 999);
      filter.lte = end;
    }
    return Object.keys(filter).length > 0 ? filter : undefined;
  }

  public async getOverview(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const cacheKey = `analytics:overview:${userId}:${req.originalUrl}`;
      
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        res.json(cached);
        return;
      }

      const dateFilter = this.buildDateFilter(req);
      const where: any = { userId };
      if (dateFilter) where.date = dateFilter;

      const aggregate = await prisma.analytics.aggregate({
        where,
        _sum: {
          emailsReceived: true,
          emailsClassified: true,
          emailsSummarized: true,
          emailsReplied: true,
          draftsGenerated: true,
          draftsApproved: true,
          draftsRejected: true,
          totalPromptTokens: true,
          totalCompletionTokens: true,
          estimatedCost: true,
          timeSavedSeconds: true,
          knowledgeRetrievalCount: true,
          documentsUploaded: true,
          documentsEmbedded: true,
          processingFailures: true,
          contactsCreated: true,
          organizationsCreated: true,
        },
        _avg: {
          averageConfidence: true,
          averageLatency: true,
          averageReplyGenerationTime: true,
        }
      });

      const actualStorage = await prisma.knowledgeBaseDocument.aggregate({
        where: { userId, deletedAt: null },
        _sum: { fileSize: true }
      });
      const activeDocsCount = await prisma.knowledgeBaseDocument.count({
        where: { userId, deletedAt: null }
      });
      
      (aggregate as any)._max = { storageUsedBytes: actualStorage._sum.fileSize || 0 };
      (aggregate as any)._sum.documentsUploaded = activeDocsCount;

      const payload = serializeData(aggregate);
      await cacheService.set(cacheKey, payload, 300);
      res.json(payload);
    } catch (error) {
      logger.error({ err: error }, '[AnalyticsController] overview error');
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  public async getCharts(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const cacheKey = `analytics:charts:${userId}:${req.originalUrl}`;
      
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        res.json(cached);
        return;
      }

      const dateFilter = this.buildDateFilter(req);
      const where: any = { userId };
      if (dateFilter) where.date = dateFilter;

      const data = await prisma.analytics.findMany({
        where,
        orderBy: { date: 'asc' },
        take: 1000
      });

      const payload = serializeData(data);
      await cacheService.set(cacheKey, payload, 300);
      res.json(payload);
    } catch (error) {
      logger.error({ err: error }, '[AnalyticsController] charts error');
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  public async getEmail(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const cacheKey = `analytics:email:${userId}:${req.originalUrl}`;
      
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        res.json(cached);
        return;
      }

      const dateFilter = this.buildDateFilter(req);
      const where: any = { userId };
      if (dateFilter) where.date = dateFilter;

      const aggregate = await prisma.analytics.aggregate({
        where,
        _sum: {
          emailsReceived: true,
          emailsClassified: true,
          emailsSummarized: true,
          emailsReplied: true,
          timeSavedSeconds: true,
        },
        _avg: {
          averageReplyGenerationTime: true,
        }
      });

      const timeseries = await prisma.analytics.findMany({
        where,
        select: {
          date: true,
          emailsReceived: true,
          emailsReplied: true,
        },
        orderBy: { date: 'asc' },
        take: 1000
      });

      const payload = serializeData({ aggregate, timeseries });
      await cacheService.set(cacheKey, payload, 300);
      res.json(payload);
    } catch (error) {
      logger.error({ err: error }, '[AnalyticsController] getEmail error');
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  public async getAi(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const cacheKey = `analytics:ai:${userId}:${req.originalUrl}`;
      
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        res.json(cached);
        return;
      }

      const dateFilter = this.buildDateFilter(req);
      const where: any = { userId };
      if (dateFilter) where.date = dateFilter;

      const aggregate = await prisma.analytics.aggregate({
        where,
        _sum: {
          draftsGenerated: true,
          draftsApproved: true,
          draftsRejected: true,
          totalPromptTokens: true,
          totalCompletionTokens: true,
          estimatedCost: true,
        },
        _avg: {
          averageConfidence: true,
          averageLatency: true,
        }
      });

      const timeseries = await prisma.analytics.findMany({
        where,
        select: {
          date: true,
          draftsGenerated: true,
          draftsApproved: true,
          estimatedCost: true,
        },
        orderBy: { date: 'asc' },
        take: 1000
      });

      const payload = serializeData({ aggregate, timeseries });
      await cacheService.set(cacheKey, payload, 300);
      res.json(payload);
    } catch (error) {
      logger.error({ err: error }, '[AnalyticsController] getAi error');
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  public async getKnowledge(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const cacheKey = `analytics:knowledge:${userId}:${req.originalUrl}`;
      
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        res.json(cached);
        return;
      }

      const dateFilter = this.buildDateFilter(req);
      const where: any = { userId };
      if (dateFilter) where.date = dateFilter;

      const aggregate = await prisma.analytics.aggregate({
        where,
        _sum: {
          documentsUploaded: true,
          documentsEmbedded: true,
          knowledgeRetrievalCount: true,
          processingFailures: true,
        }
      });

      const actualStorage = await prisma.knowledgeBaseDocument.aggregate({
        where: { userId, deletedAt: null },
        _sum: { fileSize: true }
      });
      const activeDocsCount = await prisma.knowledgeBaseDocument.count({
        where: { userId, deletedAt: null }
      });
      const activeEmbeddedCount = await prisma.knowledgeBaseDocument.count({
        where: { userId, deletedAt: null, processingStatus: 'COMPLETED' }
      });

      (aggregate as any)._max = { storageUsedBytes: actualStorage._sum.fileSize || 0 };
      (aggregate as any)._sum.documentsUploaded = activeDocsCount;
      (aggregate as any)._sum.documentsEmbedded = activeEmbeddedCount;

      const timeseries = await prisma.analytics.findMany({
        where,
        select: {
          date: true,
          documentsUploaded: true,
          knowledgeRetrievalCount: true,
        },
        orderBy: { date: 'asc' },
        take: 1000
      });

      const payload = serializeData({ aggregate, timeseries });
      await cacheService.set(cacheKey, payload, 300);
      res.json(payload);
    } catch (error) {
      logger.error({ err: error }, '[AnalyticsController] getKnowledge error');
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  public async getContacts(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const cacheKey = `analytics:contacts:${userId}:${req.originalUrl}`;
      
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        res.json(cached);
        return;
      }

      const dateFilter = this.buildDateFilter(req);
      const where: any = { userId };
      if (dateFilter) where.date = dateFilter;

      const aggregate = await prisma.analytics.aggregate({
        where,
        _sum: {
          contactsCreated: true,
          organizationsCreated: true,
        }
      });

      const totalContacts = await prisma.contact.count({ where: { userId } });
      const totalOrganizations = await prisma.organization.count({ where: { userId } });

      (aggregate as any)._sum.totalContacts = totalContacts;
      (aggregate as any)._sum.totalOrganizations = totalOrganizations;

      const timeseries = await prisma.analytics.findMany({
        where,
        select: {
          date: true,
          contactsCreated: true,
          organizationsCreated: true,
        },
        orderBy: { date: 'asc' },
        take: 1000
      });

      const payload = serializeData({ aggregate, timeseries });
      await cacheService.set(cacheKey, payload, 300);
      res.json(payload);
    } catch (error) {
      logger.error({ err: error }, '[AnalyticsController] getContacts error');
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
  public async getActivity(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const cursor = req.query.cursor as string | undefined;
      const take = 100;

      const dateFilter = this.buildDateFilter(req);
      const where: any = { userId };
      if (dateFilter) where.createdAt = dateFilter;

      const logs = await prisma.activityLog.findMany({
        where,
        take,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { createdAt: 'desc' },
      });

      const nextCursor = logs.length === take ? logs[logs.length - 1].id : null;

      res.json({
        data: logs,
        nextCursor
      });
    } catch (error) {
      logger.error({ err: error }, '[AnalyticsController] activity error');
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  public async exportData(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const dateFilter = this.buildDateFilter(req);

      const where: any = { userId };
      if (dateFilter) where.date = dateFilter;

      const data = await prisma.analytics.findMany({
        where,
        orderBy: { date: 'asc' },
        take: 1000
      });

      const aggregate = await prisma.analytics.aggregate({
        where,
        _sum: {
          emailsReceived: true,
          emailsClassified: true,
          emailsSummarized: true,
          emailsReplied: true,
          draftsGenerated: true,
          draftsApproved: true,
          draftsRejected: true,
          totalPromptTokens: true,
          totalCompletionTokens: true,
          estimatedCost: true,
          timeSavedSeconds: true,
          knowledgeRetrievalCount: true,
          documentsUploaded: true,
          documentsEmbedded: true,
          processingFailures: true,
          contactsCreated: true,
          organizationsCreated: true,
        },
        _avg: {
          averageConfidence: true,
          averageLatency: true,
        }
      });

      const actualStorage = await prisma.knowledgeBaseDocument.aggregate({
        where: { userId, deletedAt: null },
        _sum: { fileSize: true }
      });
      const activeDocsCount = await prisma.knowledgeBaseDocument.count({
        where: { userId, deletedAt: null }
      });
      const storageUsedBytes = actualStorage._sum.fileSize || 0;

      if (data.length === 0) {
        res.status(404).json({ error: 'No data to export for this period.' });
        return;
      }

      const csvLines: string[] = [];
      const generatedAt = new Date().toLocaleString();
      const dateRangeStr = req.query.startDate && req.query.endDate
        ? `${req.query.startDate} to ${req.query.endDate}`
        : 'All Time';

      const avgConf = (Number(aggregate._avg.averageConfidence || 0) * 100).toFixed(1);

      csvLines.push(`Report,MailBot Executive Data Export`);
      csvLines.push(`Generated At,${generatedAt}`);
      csvLines.push(`Period,${dateRangeStr}`);
      csvLines.push(``);

      csvLines.push(`--- KEY PERFORMANCE INDICATORS ---`);
      csvLines.push(`Metric,Value`);
      csvLines.push(`Emails Synced,${aggregate._sum.emailsReceived || 0}`);
      csvLines.push(`Emails Classified,${aggregate._sum.emailsClassified || 0}`);
      csvLines.push(`Drafts Generated,${aggregate._sum.draftsGenerated || 0}`);
      csvLines.push(`Drafts Approved,${aggregate._sum.draftsApproved || 0}`);
      csvLines.push(`Time Saved (Seconds),${aggregate._sum.timeSavedSeconds || 0}`);
      csvLines.push(`Total AI Cost (USD),${Number(aggregate._sum.estimatedCost || 0).toFixed(4)}`);
      csvLines.push(`Documents Uploaded (Active),${activeDocsCount}`);
      csvLines.push(`Storage Used (Bytes),${storageUsedBytes}`);
      csvLines.push(`Contacts Created,${aggregate._sum.contactsCreated || 0}`);
      csvLines.push(`Average AI Confidence,${avgConf}%`);
      csvLines.push(``);

      csvLines.push(`--- EMAIL VOLUME TRENDS ---`);
      csvLines.push(`Date,Emails Received,Emails Classified,Emails Replied`);
      data.forEach(row => {
        csvLines.push(`${row.date.toISOString().split('T')[0]},${row.emailsReceived},${row.emailsClassified},${row.emailsReplied}`);
      });
      csvLines.push(``);

      csvLines.push(`--- AI AUTOMATION ---`);
      csvLines.push(`Date,Drafts Generated,Drafts Approved,Estimated Cost,Tokens Used`);
      data.forEach(row => {
        csvLines.push(`${row.date.toISOString().split('T')[0]},${row.draftsGenerated},${row.draftsApproved},${Number(row.estimatedCost || 0).toFixed(4)},${(row.totalPromptTokens || 0) + (row.totalCompletionTokens || 0)}`);
      });
      csvLines.push(``);

      csvLines.push(`--- KNOWLEDGE & CONTACTS ---`);
      csvLines.push(`Date,Documents Uploaded,Retrievals,Contacts Created,Orgs Created`);
      data.forEach(row => {
        csvLines.push(`${row.date.toISOString().split('T')[0]},${row.documentsUploaded},${row.knowledgeRetrievalCount},${row.contactsCreated},${row.organizationsCreated}`);
      });
      csvLines.push(``);

      const csvContent = csvLines.join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="MailBot_Executive_Briefing_${dateRangeStr.replace(/[^a-zA-Z0-9]/g, '_')}.csv"`);
      res.send(csvContent);
    } catch (error) {
      logger.error({ err: error }, '[AnalyticsController] export error');
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  public async exportJson(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const dateFilter = this.buildDateFilter(req);

      const where: any = { userId };
      if (dateFilter) where.date = dateFilter;

      const data = await prisma.analytics.findMany({
        where,
        orderBy: { date: 'asc' },
        take: 1000
      });

      const aggregate = await prisma.analytics.aggregate({
        where,
        _sum: {
          emailsReceived: true,
          emailsClassified: true,
          emailsSummarized: true,
          emailsReplied: true,
          draftsGenerated: true,
          draftsApproved: true,
          draftsRejected: true,
          totalPromptTokens: true,
          totalCompletionTokens: true,
          estimatedCost: true,
          timeSavedSeconds: true,
          knowledgeRetrievalCount: true,
          documentsUploaded: true,
          documentsEmbedded: true,
          processingFailures: true,
          contactsCreated: true,
          organizationsCreated: true,
        },
        _avg: {
          averageConfidence: true,
          averageLatency: true,
        }
      });

      const actualStorage = await prisma.knowledgeBaseDocument.aggregate({
        where: { userId, deletedAt: null },
        _sum: { fileSize: true }
      });
      const activeDocsCount = await prisma.knowledgeBaseDocument.count({
        where: { userId, deletedAt: null }
      });
      const storageUsedBytes = actualStorage._sum.fileSize || 0;

      const activityWhere: any = { userId };
      if (dateFilter) activityWhere.createdAt = dateFilter;
      const activities = await prisma.activityLog.findMany({
        where: activityWhere,
        orderBy: { createdAt: 'desc' },
        take: 1000
      });

      res.json({
        kpis: {
          ...aggregate._sum,
          documentsUploaded: activeDocsCount,
          storageUsedBytes,
          averageConfidence: (Number(aggregate._avg.averageConfidence || 0) * 100).toFixed(1),
          averageLatency: (Number(aggregate._avg.averageLatency || 0)).toFixed(0)
        },
        breakdown: data,
        activities: activities
      });
    } catch (error) {
      logger.error({ err: error }, '[AnalyticsController] exportJson error');
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}
