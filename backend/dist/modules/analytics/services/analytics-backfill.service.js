"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsBackfillService = void 0;
const prisma_1 = require("../../../lib/prisma");
class AnalyticsBackfillService {
    static async runBackfill(userId) {
        console.log(`[AnalyticsBackfill] Starting backfill for user: ${userId}`);
        const batchSize = 1000;
        const analyticsMap = new Map();
        const activityLogsToInsert = [];
        const getDayKey = (date) => {
            const d = new Date(date);
            return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
        };
        const initDay = (dayKey) => {
            if (!analyticsMap.has(dayKey)) {
                analyticsMap.set(dayKey, {
                    userId,
                    date: new Date(dayKey),
                    emailsReceived: 0,
                    emailsClassified: 0,
                    emailsSummarized: 0,
                    emailsReplied: 0,
                    draftsGenerated: 0,
                    draftsApproved: 0,
                    draftsRejected: 0,
                    knowledgeRetrievalCount: 0,
                    documentsUploaded: 0,
                    documentsEmbedded: 0,
                    processingFailures: 0,
                    storageUsedBytes: 0n,
                    contactsCreated: 0,
                    organizationsCreated: 0,
                    totalPromptTokens: 0,
                    totalCompletionTokens: 0,
                    estimatedCost: 0,
                    timeSavedSeconds: 0,
                    _confidenceSum: 0,
                    _latencySum: 0,
                    _generationTimeSum: 0,
                });
            }
            return analyticsMap.get(dayKey);
        };
        let lastId = undefined;
        while (true) {
            const emails = await prisma_1.prisma.email.findMany({
                where: { userId },
                take: batchSize,
                ...(lastId ? { skip: 1, cursor: { id: lastId } } : {}),
                orderBy: { id: 'asc' }
            });
            if (emails.length === 0)
                break;
            for (const email of emails) {
                const day = initDay(getDayKey(email.createdAt));
                day.emailsReceived++;
                activityLogsToInsert.push({ userId, action: 'EMAIL_RECEIVED', entityType: 'Email', createdAt: email.createdAt });
                if (email.processingStatus === 'COMPLETED' || email.processingStatus === 'FAILED') {
                    day.emailsClassified++;
                    if (email.processingStatus === 'COMPLETED') {
                        activityLogsToInsert.push({ userId, action: 'EMAIL_ANALYZED', entityType: 'Email', createdAt: email.createdAt });
                    }
                    else {
                        activityLogsToInsert.push({ userId, action: 'SYSTEM_ERROR', entityType: 'Email', createdAt: email.createdAt });
                    }
                }
                if (email.summary)
                    day.emailsSummarized++;
            }
            lastId = emails[emails.length - 1].id;
        }
        lastId = undefined;
        while (true) {
            const drafts = await prisma_1.prisma.aiDraftReply.findMany({
                where: { userId },
                take: batchSize,
                ...(lastId ? { skip: 1, cursor: { id: lastId } } : {}),
                orderBy: { id: 'asc' }
            });
            if (drafts.length === 0)
                break;
            for (const draft of drafts) {
                const day = initDay(getDayKey(draft.createdAt));
                day.draftsGenerated++;
                if (draft.approvalStatus === 'APPROVED') {
                    day.draftsApproved++;
                    activityLogsToInsert.push({ userId, action: 'DRAFT_APPROVED', entityType: 'Draft', createdAt: draft.createdAt });
                }
                if (draft.approvalStatus === 'REJECTED')
                    day.draftsRejected++;
                day.totalPromptTokens += draft.promptTokens || 0;
                day.totalCompletionTokens += draft.completionTokens || 0;
                day.estimatedCost += draft.cost?.toNumber() || 0;
                if (draft.approvalStatus === 'APPROVED') {
                    day.timeSavedSeconds += 300; // Assume 5 mins saved per approved draft
                }
                day._confidenceSum += draft.confidence || 0;
                day._latencySum += draft.generationLatencyMs || 0;
                day._generationTimeSum += draft.generationLatencyMs || 0;
            }
            lastId = drafts[drafts.length - 1].id;
        }
        lastId = undefined;
        while (true) {
            const replies = await prisma_1.prisma.sentReply.findMany({
                where: { originalEmail: { userId } },
                include: { originalEmail: true },
                take: batchSize,
                ...(lastId ? { skip: 1, cursor: { id: lastId } } : {}),
                orderBy: { id: 'asc' }
            });
            if (replies.length === 0)
                break;
            for (const reply of replies) {
                const day = initDay(getDayKey(reply.sentAt));
                day.emailsReplied++;
            }
            lastId = replies[replies.length - 1].id;
        }
        lastId = undefined;
        while (true) {
            const docs = await prisma_1.prisma.knowledgeBaseDocument.findMany({
                where: { userId },
                take: batchSize,
                ...(lastId ? { skip: 1, cursor: { id: lastId } } : {}),
                orderBy: { id: 'asc' }
            });
            if (docs.length === 0)
                break;
            for (const doc of docs) {
                const day = initDay(getDayKey(doc.createdAt));
                day.documentsUploaded++;
                if (doc.processingStatus === 'COMPLETED') {
                    day.documentsEmbedded++;
                    activityLogsToInsert.push({ userId, action: 'DOCUMENT_EMBEDDED', entityType: 'Document', createdAt: doc.createdAt });
                }
                if (doc.processingStatus === 'FAILED') {
                    day.processingFailures++;
                    activityLogsToInsert.push({ userId, action: 'SYSTEM_ERROR', entityType: 'Document', createdAt: doc.createdAt });
                }
                day.storageUsedBytes += BigInt(doc.fileSize || 0);
                day.knowledgeRetrievalCount += doc.retrievalCount || 0;
            }
            lastId = docs[docs.length - 1].id;
        }
        lastId = undefined;
        while (true) {
            const contacts = await prisma_1.prisma.contact.findMany({
                where: { userId },
                take: batchSize,
                ...(lastId ? { skip: 1, cursor: { id: lastId } } : {}),
                orderBy: { id: 'asc' }
            });
            if (contacts.length === 0)
                break;
            for (const contact of contacts) {
                const day = initDay(getDayKey(contact.createdAt));
                day.contactsCreated++;
                activityLogsToInsert.push({ userId, action: 'CONTACT_CREATED', entityType: 'Contact', createdAt: contact.createdAt });
            }
            lastId = contacts[contacts.length - 1].id;
        }
        lastId = undefined;
        while (true) {
            const orgs = await prisma_1.prisma.organization.findMany({
                where: { userId },
                take: batchSize,
                ...(lastId ? { skip: 1, cursor: { id: lastId } } : {}),
                orderBy: { id: 'asc' }
            });
            if (orgs.length === 0)
                break;
            for (const org of orgs) {
                const day = initDay(getDayKey(org.createdAt));
                day.organizationsCreated++;
                activityLogsToInsert.push({ userId, action: 'ORGANIZATION_CREATED', entityType: 'Organization', createdAt: org.createdAt });
            }
            lastId = orgs[orgs.length - 1].id;
        }
        console.log(`[AnalyticsBackfill] Committing ${analyticsMap.size} days of analytics...`);
        for (const data of analyticsMap.values()) {
            const avgConfidence = data.draftsGenerated > 0 ? data._confidenceSum / data.draftsGenerated : 0;
            const avgLatency = data.draftsGenerated > 0 ? data._latencySum / data.draftsGenerated : 0;
            const avgGenTime = data.draftsGenerated > 0 ? data._generationTimeSum / data.draftsGenerated : 0;
            await prisma_1.prisma.analytics.upsert({
                where: {
                    userId_date: {
                        userId,
                        date: data.date
                    }
                },
                create: {
                    userId,
                    date: data.date,
                    emailsReceived: data.emailsReceived,
                    emailsClassified: data.emailsClassified,
                    emailsSummarized: data.emailsSummarized,
                    emailsReplied: data.emailsReplied,
                    draftsGenerated: data.draftsGenerated,
                    draftsApproved: data.draftsApproved,
                    draftsRejected: data.draftsRejected,
                    knowledgeRetrievalCount: data.knowledgeRetrievalCount,
                    documentsUploaded: data.documentsUploaded,
                    documentsEmbedded: data.documentsEmbedded,
                    processingFailures: data.processingFailures,
                    storageUsedBytes: data.storageUsedBytes,
                    contactsCreated: data.contactsCreated,
                    organizationsCreated: data.organizationsCreated,
                    totalPromptTokens: data.totalPromptTokens,
                    totalCompletionTokens: data.totalCompletionTokens,
                    estimatedCost: data.estimatedCost,
                    timeSavedSeconds: data.timeSavedSeconds,
                    averageConfidence: avgConfidence,
                    averageLatency: avgLatency,
                    averageReplyGenerationTime: avgGenTime,
                },
                update: {
                    emailsReceived: data.emailsReceived,
                    emailsClassified: data.emailsClassified,
                    emailsSummarized: data.emailsSummarized,
                    emailsReplied: data.emailsReplied,
                    draftsGenerated: data.draftsGenerated,
                    draftsApproved: data.draftsApproved,
                    draftsRejected: data.draftsRejected,
                    knowledgeRetrievalCount: data.knowledgeRetrievalCount,
                    documentsUploaded: data.documentsUploaded,
                    documentsEmbedded: data.documentsEmbedded,
                    processingFailures: data.processingFailures,
                    storageUsedBytes: data.storageUsedBytes,
                    contactsCreated: data.contactsCreated,
                    organizationsCreated: data.organizationsCreated,
                    totalPromptTokens: data.totalPromptTokens,
                    totalCompletionTokens: data.totalCompletionTokens,
                    estimatedCost: data.estimatedCost,
                    timeSavedSeconds: data.timeSavedSeconds,
                    averageConfidence: avgConfidence,
                    averageLatency: avgLatency,
                    averageReplyGenerationTime: avgGenTime,
                }
            });
        }
        console.log(`[AnalyticsBackfill] Purging old activity logs (excluding LOGIN/SETTINGS)...`);
        await prisma_1.prisma.activityLog.deleteMany({
            where: {
                userId,
                action: { notIn: ['LOGIN', 'SETTINGS_CHANGE'] }
            }
        });
        console.log(`[AnalyticsBackfill] Inserting ${activityLogsToInsert.length} activity logs...`);
        const chunkSize = 5000;
        for (let i = 0; i < activityLogsToInsert.length; i += chunkSize) {
            await prisma_1.prisma.activityLog.createMany({
                data: activityLogsToInsert.slice(i, i + chunkSize)
            });
        }
        console.log(`[AnalyticsBackfill] Completed for user: ${userId}`);
    }
}
exports.AnalyticsBackfillService = AnalyticsBackfillService;
