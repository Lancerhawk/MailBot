"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiPipelineService = void 0;
const client_1 = require("@prisma/client");
const prisma_1 = require("../../lib/prisma");
const html_to_text_1 = require("html-to-text");
const groq_service_1 = require("./groq.service");
const logger_1 = require("../../config/logger");
const socket_1 = require("../../socket");
const draft_service_1 = require("../draft/draft.service");
const draft_db_service_1 = require("../draft/draft.db.service");
const contact_db_service_1 = require("../contact/contact.db.service");
const analytics_event_service_1 = require("../analytics/services/analytics-event.service");
const cache_service_1 = require("../../lib/cache.service");
const user_queue_1 = require("../../utils/user-queue");
const groqService = new groq_service_1.GroqService();
const contactDbService = new contact_db_service_1.ContactDbService();
const aiPipelineQueue = new user_queue_1.UserSerialQueue();
class AiPipelineService {
    scheduleAnalysis(userId, emailId) {
        const run = async () => {
            const lockKey = `ai:lock:${userId}`;
            let acquired = await cache_service_1.cacheService.acquireLock(lockKey, 120);
            let attempts = 0;
            while (!acquired && attempts < 5) {
                attempts++;
                await new Promise(r => setTimeout(r, 1000));
                acquired = await cache_service_1.cacheService.acquireLock(lockKey, 120);
            }
            try {
                await this.processEmail(userId, emailId);
            }
            catch (err) {
                const error = err;
                logger_1.logger.error({ error: error.message || error, stack: error.stack, emailId }, 'AI Pipeline uncaught exception during scheduleAnalysis');
            }
            finally {
                if (acquired) {
                    await cache_service_1.cacheService.releaseLock(lockKey);
                }
            }
        };
        return aiPipelineQueue.enqueue(userId, run);
    }
    async processEmail(userId, emailId) {
        const email = await prisma_1.prisma.email.findUnique({
            where: { id: emailId },
            include: { thread: true, labels: true, user: true, participants: true, connection: true }
        });
        if (!email)
            return;
        const isSentLabel = email.labels?.some((l) => l.providerLabelId === 'SENT');
        const sender = email.participants?.find((p) => p.role === 'SENDER');
        const isSentByUser = sender && email.connection && sender.emailAddress.toLowerCase() === email.connection.emailAddress.toLowerCase();
        const isSent = isSentLabel || isSentByUser;
        const isOld = email.receivedAt.getTime() < email.user.createdAt.getTime();
        if (email.isDeleted ||
            email.isDraft ||
            email.isSpam ||
            email.category === 'TRASH' ||
            isSent ||
            isOld) {
            if (email.processingStatus === 'PENDING') {
                await prisma_1.prisma.email.update({
                    where: { id: emailId },
                    data: { processingStatus: client_1.ProcessingStatus.SKIPPED }
                });
            }
            return;
        }
        if (email.processingStatus !== 'PENDING') {
            return;
        }
        const content = email.plainBody || email.htmlBody || email.snippet || '';
        if (!content || content.trim().length === 0) {
            await prisma_1.prisma.email.update({
                where: { id: emailId },
                data: { processingStatus: client_1.ProcessingStatus.SKIPPED }
            });
            return;
        }
        await prisma_1.prisma.email.update({
            where: { id: emailId },
            data: { processingStatus: client_1.ProcessingStatus.PROCESSING }
        });
        (0, socket_1.emitToUser)(userId, 'analysis:started', { emailId, threadId: email.emailThreadId });
        try {
            const threadEmails = await prisma_1.prisma.email.findMany({
                where: { emailThreadId: email.emailThreadId },
                orderBy: { providerInternalDate: 'asc' },
                select: {
                    id: true,
                    subject: true,
                    plainBody: true,
                    htmlBody: true,
                    snippet: true,
                    participants: true,
                    providerInternalDate: true,
                }
            });
            const MAX_CONTEXT_LENGTH = 8000;
            let currentLength = 0;
            const contextMessages = [];
            for (let i = threadEmails.length - 1; i >= 0; i--) {
                const msg = threadEmails[i];
                const rawBody = msg.plainBody || msg.htmlBody || msg.snippet || '';
                const cleanText = (0, html_to_text_1.htmlToText)(rawBody, { wordwrap: 130 });
                const sender = msg.participants.find(p => p.role === 'SENDER')?.emailAddress || 'Unknown';
                const msgHeader = `--- Message from: ${sender} on ${msg.providerInternalDate.toISOString()} ---\nSubject: ${msg.subject || '(No Subject)'}`;
                const msgBlock = `${msgHeader}\n${cleanText}\n\n`;
                let blockToAdd = msgBlock;
                if (contextMessages.length === 0 && blockToAdd.length > MAX_CONTEXT_LENGTH) {
                    blockToAdd = blockToAdd.substring(0, MAX_CONTEXT_LENGTH) + '\n... [TRUNCATED DUE TO LENGTH]';
                }
                if (currentLength + blockToAdd.length > MAX_CONTEXT_LENGTH && contextMessages.length > 0) {
                    break;
                }
                currentLength += blockToAdd.length;
                contextMessages.unshift(blockToAdd);
            }
            const conversationContext = contextMessages.join('');
            let finalContext = conversationContext;
            const currentMsg = threadEmails.find(e => e.id === emailId);
            const senderEmail = currentMsg?.participants.find((p) => p.role === 'SENDER')?.emailAddress;
            if (senderEmail) {
                try {
                    const contactContext = await contactDbService.getContactContextByEmail(userId, senderEmail);
                    if (contactContext) {
                        finalContext = conversationContext + "\n\n" + contactContext;
                    }
                }
                catch (error) {
                    logger_1.logger.error({ err: error }, 'Failed to fetch contact context for analysis');
                }
            }
            const result = await groqService.analyzeConversation(userId, finalContext);
            const validSentiments = ['POSITIVE', 'NEUTRAL', 'NEGATIVE', 'MIXED'];
            const validIntents = ['INQUIRY', 'SUPPORT', 'MEETING', 'FEEDBACK', 'SPAM', 'OTHER'];
            const validPriorities = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
            const sentiment = validSentiments.includes(result.sentiment?.toUpperCase()) ? result.sentiment.toUpperCase() : 'NEUTRAL';
            const intent = validIntents.includes(result.intent?.toUpperCase()) ? result.intent.toUpperCase() : 'OTHER';
            const priority = validPriorities.includes(result.priority?.toUpperCase()) ? result.priority.toUpperCase() : 'NORMAL';
            const needsReply = Boolean(result.needsReply);
            const confidence = Number(result.confidence) || 0.5;
            await prisma_1.prisma.email.update({
                where: { id: emailId },
                data: {
                    summary: result.summary,
                    sentiment: sentiment,
                    intent: intent,
                    needsReply: needsReply,
                    priority: priority,
                    confidence: confidence,
                    processingStatus: client_1.ProcessingStatus.COMPLETED
                }
            });
            analytics_event_service_1.AnalyticsEventService.recordEvent(userId, analytics_event_service_1.AnalyticsEventType.EMAIL_ANALYZED);
            if (result.summary) {
                analytics_event_service_1.AnalyticsEventService.recordEvent(userId, analytics_event_service_1.AnalyticsEventType.EMAIL_SUMMARIZED);
            }
            (0, socket_1.emitToUser)(userId, 'analysis:completed', { emailId, threadId: email.emailThreadId, result: { ...result, sentiment, intent, priority, needsReply, confidence } });
            if (result.needsReply === false) {
                return;
            }
            const draftDbService = new draft_db_service_1.DraftDbService();
            const existingDraft = await draftDbService.getLatestFinalDraft(emailId, userId);
            if (existingDraft) {
                return;
            }
            const draftService = new draft_service_1.DraftService();
            await draftService.generateDraft(userId, emailId).catch(err => {
                logger_1.logger.error({ err, emailId }, 'Automatic draft generation failed');
            });
            await prisma_1.prisma.email.update({
                where: { id: emailId },
                data: { replyStatus: 'DRAFTED' }
            });
        }
        catch (error) {
            logger_1.logger.error({ error, emailId }, 'AI analysis failed and exhausted retries');
            await prisma_1.prisma.email.update({
                where: { id: emailId },
                data: { processingStatus: client_1.ProcessingStatus.FAILED }
            });
            (0, socket_1.emitToUser)(userId, 'analysis:failed', { emailId, threadId: email.emailThreadId });
        }
    }
}
exports.AiPipelineService = AiPipelineService;
