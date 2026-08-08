"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsController = void 0;
const prisma_1 = require("../../lib/prisma");
const logger_1 = require("../../config/logger");
function serializeData(obj) {
    return JSON.parse(JSON.stringify(obj, (key, value) => typeof value === 'bigint' ? value.toString() : value));
}
class AnalyticsController {
    buildDateFilter(req) {
        const { startDate, endDate } = req.query;
        const filter = {};
        if (startDate) {
            filter.gte = new Date(startDate);
        }
        if (endDate) {
            const end = new Date(endDate);
            end.setUTCHours(23, 59, 59, 999);
            filter.lte = end;
        }
        return Object.keys(filter).length > 0 ? filter : undefined;
    }
    async getOverview(req, res) {
        try {
            const userId = req.user.id;
            const dateFilter = this.buildDateFilter(req);
            const where = { userId };
            if (dateFilter)
                where.date = dateFilter;
            const aggregate = await prisma_1.prisma.analytics.aggregate({
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
                },
                _max: {
                    storageUsedBytes: true,
                }
            });
            res.json(serializeData(aggregate));
        }
        catch (error) {
            logger_1.logger.error({ err: error }, '[AnalyticsController] overview error');
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
    async getCharts(req, res) {
        try {
            const userId = req.user.id;
            const dateFilter = this.buildDateFilter(req);
            const where = { userId };
            if (dateFilter)
                where.date = dateFilter;
            const data = await prisma_1.prisma.analytics.findMany({
                where,
                orderBy: { date: 'asc' }
            });
            res.json(serializeData(data));
        }
        catch (error) {
            logger_1.logger.error({ err: error }, '[AnalyticsController] charts error');
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
    async getEmail(req, res) { res.json({ message: 'Email insights' }); }
    async getAi(req, res) { res.json({ message: 'AI insights' }); }
    async getKnowledge(req, res) { res.json({ message: 'Knowledge insights' }); }
    async getContacts(req, res) { res.json({ message: 'Contact insights' }); }
    async getActivity(req, res) {
        try {
            const userId = req.user.id;
            const cursor = req.query.cursor;
            const take = 100;
            const dateFilter = this.buildDateFilter(req);
            const where = { userId };
            if (dateFilter)
                where.createdAt = dateFilter;
            const logs = await prisma_1.prisma.activityLog.findMany({
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
        }
        catch (error) {
            logger_1.logger.error({ err: error }, '[AnalyticsController] activity error');
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
    async exportData(req, res) {
        try {
            const userId = req.user.id;
            const dateFilter = this.buildDateFilter(req);
            const where = { userId };
            if (dateFilter)
                where.date = dateFilter;
            const data = await prisma_1.prisma.analytics.findMany({
                where,
                orderBy: { date: 'asc' },
                take: 1000
            });
            const aggregate = await prisma_1.prisma.analytics.aggregate({
                where,
                _sum: {
                    emailsReceived: true,
                    emailsClassified: true,
                    draftsGenerated: true,
                    draftsApproved: true,
                    documentsUploaded: true,
                },
                _avg: {
                    averageConfidence: true,
                }
            });
            if (data.length === 0) {
                res.status(404).json({ error: 'No data to export for this period.' });
                return;
            }
            const csvLines = [];
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
            csvLines.push(`Total Emails Received,${aggregate._sum.emailsReceived || 0}`);
            csvLines.push(`Total Emails Classified,${aggregate._sum.emailsClassified || 0}`);
            csvLines.push(`Drafts Generated,${aggregate._sum.draftsGenerated || 0}`);
            csvLines.push(`Drafts Approved,${aggregate._sum.draftsApproved || 0}`);
            csvLines.push(`Documents Uploaded,${aggregate._sum.documentsUploaded || 0}`);
            csvLines.push(`Average AI Confidence,${avgConf}%`);
            csvLines.push(``);
            csvLines.push(`--- EMAIL VOLUME TRENDS ---`);
            csvLines.push(`Date,Emails Received`);
            data.forEach(row => {
                csvLines.push(`${row.date.toISOString().split('T')[0]},${row.emailsReceived}`);
            });
            csvLines.push(``);
            csvLines.push(`--- DRAFT AUTOMATION EFFICIENCY ---`);
            csvLines.push(`Date,Drafts Generated,Drafts Approved`);
            data.forEach(row => {
                csvLines.push(`${row.date.toISOString().split('T')[0]},${row.draftsGenerated},${row.draftsApproved}`);
            });
            csvLines.push(``);
            csvLines.push(`--- AI CONFIDENCE MATRIX ---`);
            csvLines.push(`Date,Average AI Confidence`);
            data.forEach(row => {
                csvLines.push(`${row.date.toISOString().split('T')[0]},${(Number(row.averageConfidence) * 100).toFixed(1)}%`);
            });
            csvLines.push(``);
            csvLines.push(`--- KNOWLEDGE BASE SCALING ---`);
            csvLines.push(`Date,Documents Uploaded`);
            data.forEach(row => {
                csvLines.push(`${row.date.toISOString().split('T')[0]},${row.documentsUploaded}`);
            });
            csvLines.push(``);
            const csvContent = csvLines.join('\n');
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="MailBot_Executive_Briefing_${dateRangeStr.replace(/[^a-zA-Z0-9]/g, '_')}.csv"`);
            res.send(csvContent);
        }
        catch (error) {
            logger_1.logger.error({ err: error }, '[AnalyticsController] export error');
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
    async exportJson(req, res) {
        try {
            const userId = req.user.id;
            const dateFilter = this.buildDateFilter(req);
            const where = { userId };
            if (dateFilter)
                where.date = dateFilter;
            const data = await prisma_1.prisma.analytics.findMany({
                where,
                orderBy: { date: 'asc' },
                take: 1000
            });
            const aggregate = await prisma_1.prisma.analytics.aggregate({
                where,
                _sum: {
                    emailsReceived: true,
                    emailsClassified: true,
                    draftsGenerated: true,
                    draftsApproved: true,
                    documentsUploaded: true,
                },
                _avg: {
                    averageConfidence: true,
                }
            });
            const activityWhere = { userId };
            if (dateFilter)
                activityWhere.createdAt = dateFilter;
            const activities = await prisma_1.prisma.activityLog.findMany({
                where: activityWhere,
                orderBy: { createdAt: 'desc' },
                take: 1000
            });
            res.json({
                kpis: {
                    emailsReceived: aggregate._sum.emailsReceived || 0,
                    emailsClassified: aggregate._sum.emailsClassified || 0,
                    draftsGenerated: aggregate._sum.draftsGenerated || 0,
                    draftsApproved: aggregate._sum.draftsApproved || 0,
                    documentsUploaded: aggregate._sum.documentsUploaded || 0,
                    averageConfidence: (Number(aggregate._avg.averageConfidence || 0) * 100).toFixed(1)
                },
                breakdown: data,
                activities: activities
            });
        }
        catch (error) {
            logger_1.logger.error({ err: error }, '[AnalyticsController] exportJson error');
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
}
exports.AnalyticsController = AnalyticsController;
