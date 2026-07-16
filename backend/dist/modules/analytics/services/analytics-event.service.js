"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsEventService = exports.AnalyticsEventType = void 0;
const prisma_1 = require("../../../lib/prisma");
var AnalyticsEventType;
(function (AnalyticsEventType) {
    AnalyticsEventType["EMAIL_RECEIVED"] = "EMAIL_RECEIVED";
    AnalyticsEventType["EMAIL_ANALYZED"] = "EMAIL_ANALYZED";
    AnalyticsEventType["EMAIL_SUMMARIZED"] = "EMAIL_SUMMARIZED";
    AnalyticsEventType["EMAIL_REPLIED"] = "EMAIL_REPLIED";
    AnalyticsEventType["DRAFT_GENERATED"] = "DRAFT_GENERATED";
    AnalyticsEventType["DRAFT_APPROVED"] = "DRAFT_APPROVED";
    AnalyticsEventType["DRAFT_REJECTED"] = "DRAFT_REJECTED";
    AnalyticsEventType["DOCUMENT_UPLOADED"] = "DOCUMENT_UPLOADED";
    AnalyticsEventType["DOCUMENT_EMBEDDED"] = "DOCUMENT_EMBEDDED";
    AnalyticsEventType["KNOWLEDGE_RETRIEVAL"] = "KNOWLEDGE_RETRIEVAL";
    AnalyticsEventType["PROCESSING_FAILURE"] = "PROCESSING_FAILURE";
    AnalyticsEventType["CONTACT_CREATED"] = "CONTACT_CREATED";
    AnalyticsEventType["ORGANIZATION_CREATED"] = "ORGANIZATION_CREATED";
})(AnalyticsEventType || (exports.AnalyticsEventType = AnalyticsEventType = {}));
class AnalyticsEventService {
    static async recordEvent(userId, eventType, metrics, overrideDate) {
        try {
            (async () => {
                try {
                    const date = overrideDate || new Date();
                    const startOfDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
                    const updateData = {};
                    switch (eventType) {
                        case AnalyticsEventType.EMAIL_RECEIVED:
                            updateData.emailsReceived = { increment: 1 };
                            break;
                        case AnalyticsEventType.EMAIL_ANALYZED:
                            updateData.emailsClassified = { increment: 1 };
                            break;
                        case AnalyticsEventType.EMAIL_SUMMARIZED:
                            updateData.emailsSummarized = { increment: 1 };
                            break;
                        case AnalyticsEventType.EMAIL_REPLIED:
                            updateData.emailsReplied = { increment: 1 };
                            break;
                        case AnalyticsEventType.DRAFT_GENERATED:
                            updateData.draftsGenerated = { increment: 1 };
                            break;
                        case AnalyticsEventType.DRAFT_APPROVED:
                            updateData.draftsApproved = { increment: 1 };
                            break;
                        case AnalyticsEventType.DRAFT_REJECTED:
                            updateData.draftsRejected = { increment: 1 };
                            break;
                        case AnalyticsEventType.DOCUMENT_UPLOADED:
                            updateData.documentsUploaded = { increment: 1 };
                            break;
                        case AnalyticsEventType.DOCUMENT_EMBEDDED:
                            updateData.documentsEmbedded = { increment: 1 };
                            break;
                        case AnalyticsEventType.KNOWLEDGE_RETRIEVAL:
                            updateData.knowledgeRetrievalCount = { increment: 1 };
                            break;
                        case AnalyticsEventType.PROCESSING_FAILURE:
                            updateData.processingFailures = { increment: 1 };
                            break;
                        case AnalyticsEventType.CONTACT_CREATED:
                            updateData.contactsCreated = { increment: 1 };
                            break;
                        case AnalyticsEventType.ORGANIZATION_CREATED:
                            updateData.organizationsCreated = { increment: 1 };
                            break;
                    }
                    if (metrics) {
                        if (metrics.promptTokens)
                            updateData.totalPromptTokens = { increment: metrics.promptTokens };
                        if (metrics.completionTokens)
                            updateData.totalCompletionTokens = { increment: metrics.completionTokens };
                        if (metrics.estimatedCost)
                            updateData.estimatedCost = { increment: metrics.estimatedCost };
                        if (metrics.timeSavedSeconds)
                            updateData.timeSavedSeconds = { increment: metrics.timeSavedSeconds };
                        if (metrics.storageUsedBytes)
                            updateData.storageUsedBytes = { increment: metrics.storageUsedBytes };
                    }
                    await prisma_1.prisma.analytics.upsert({
                        where: {
                            userId_date: {
                                userId,
                                date: startOfDay,
                            }
                        },
                        create: {
                            userId,
                            date: startOfDay,
                            emailsReceived: eventType === AnalyticsEventType.EMAIL_RECEIVED ? 1 : 0,
                            emailsClassified: eventType === AnalyticsEventType.EMAIL_ANALYZED ? 1 : 0,
                            emailsSummarized: eventType === AnalyticsEventType.EMAIL_SUMMARIZED ? 1 : 0,
                            emailsReplied: eventType === AnalyticsEventType.EMAIL_REPLIED ? 1 : 0,
                            draftsGenerated: eventType === AnalyticsEventType.DRAFT_GENERATED ? 1 : 0,
                            draftsApproved: eventType === AnalyticsEventType.DRAFT_APPROVED ? 1 : 0,
                            draftsRejected: eventType === AnalyticsEventType.DRAFT_REJECTED ? 1 : 0,
                            documentsUploaded: eventType === AnalyticsEventType.DOCUMENT_UPLOADED ? 1 : 0,
                            documentsEmbedded: eventType === AnalyticsEventType.DOCUMENT_EMBEDDED ? 1 : 0,
                            knowledgeRetrievalCount: eventType === AnalyticsEventType.KNOWLEDGE_RETRIEVAL ? 1 : 0,
                            processingFailures: eventType === AnalyticsEventType.PROCESSING_FAILURE ? 1 : 0,
                            contactsCreated: eventType === AnalyticsEventType.CONTACT_CREATED ? 1 : 0,
                            organizationsCreated: eventType === AnalyticsEventType.ORGANIZATION_CREATED ? 1 : 0,
                            totalPromptTokens: metrics?.promptTokens || 0,
                            totalCompletionTokens: metrics?.completionTokens || 0,
                            estimatedCost: metrics?.estimatedCost || 0,
                            timeSavedSeconds: metrics?.timeSavedSeconds || 0,
                            storageUsedBytes: metrics?.storageUsedBytes || 0,
                            averageConfidence: metrics?.confidence || 0,
                            averageLatency: metrics?.latency || 0,
                            averageReplyGenerationTime: metrics?.replyGenerationTime || 0,
                        },
                        update: updateData
                    });
                    if (metrics && (metrics.confidence !== undefined || metrics.latency !== undefined || metrics.replyGenerationTime !== undefined)) {
                        await prisma_1.prisma.$executeRaw `
              UPDATE "Analytics"
              SET 
                "averageConfidence" = CASE WHEN "draftsGenerated" > 0 THEN (("averageConfidence" * ("draftsGenerated" - 1)) + ${metrics.confidence || 0}) / "draftsGenerated" ELSE "averageConfidence" END,
                "averageLatency" = CASE WHEN "draftsGenerated" > 0 THEN (("averageLatency" * ("draftsGenerated" - 1)) + ${metrics.latency || 0}) / "draftsGenerated" ELSE "averageLatency" END,
                "averageReplyGenerationTime" = CASE WHEN "draftsGenerated" > 0 THEN (("averageReplyGenerationTime" * ("draftsGenerated" - 1)) + ${metrics.replyGenerationTime || 0}) / "draftsGenerated" ELSE "averageReplyGenerationTime" END
              WHERE "userId" = ${userId} AND "date" = ${startOfDay}
            `;
                    }
                    let activityAction = null;
                    let entityType = undefined;
                    switch (eventType) {
                        case AnalyticsEventType.EMAIL_RECEIVED:
                            activityAction = 'EMAIL_RECEIVED';
                            entityType = 'Email';
                            break;
                        case AnalyticsEventType.EMAIL_ANALYZED:
                            activityAction = 'EMAIL_ANALYZED';
                            entityType = 'Email';
                            break;
                        case AnalyticsEventType.EMAIL_REPLIED:
                            activityAction = 'EMAIL_SENT';
                            entityType = 'Email';
                            break;
                        case AnalyticsEventType.DRAFT_APPROVED:
                            activityAction = 'DRAFT_APPROVED';
                            entityType = 'Draft';
                            break;
                        case AnalyticsEventType.DOCUMENT_EMBEDDED:
                            activityAction = 'DOCUMENT_EMBEDDED';
                            entityType = 'Document';
                            break;
                        case AnalyticsEventType.CONTACT_CREATED:
                            activityAction = 'CONTACT_CREATED';
                            entityType = 'Contact';
                            break;
                        case AnalyticsEventType.ORGANIZATION_CREATED:
                            activityAction = 'ORGANIZATION_CREATED';
                            entityType = 'Organization';
                            break;
                        case AnalyticsEventType.PROCESSING_FAILURE:
                            activityAction = 'SYSTEM_ERROR';
                            entityType = 'System';
                            break;
                    }
                    if (activityAction) {
                        await prisma_1.prisma.activityLog.create({
                            data: {
                                userId,
                                action: activityAction,
                                entityType,
                                createdAt: date
                            }
                        });
                    }
                }
                catch (innerError) {
                    console.error('[AnalyticsEventService] Failed to record event:', innerError);
                }
            })();
        }
        catch (error) {
            console.error('[AnalyticsEventService] Fire-and-forget initialization failed:', error);
        }
    }
}
exports.AnalyticsEventService = AnalyticsEventService;
