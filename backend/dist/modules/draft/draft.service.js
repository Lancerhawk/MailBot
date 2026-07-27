"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DraftService = void 0;
const draft_db_service_1 = require("./draft.db.service");
const groq_service_1 = require("../ai/groq.service");
const gmail_db_service_1 = require("../gmail/services/gmail.db.service");
const knowledge_db_service_1 = require("../knowledge/knowledge.db.service");
const retrieval_service_1 = require("../knowledge/services/retrieval.service");
const contact_db_service_1 = require("../contact/contact.db.service");
const html_to_text_1 = require("html-to-text");
const logger_1 = require("../../config/logger");
const socket_1 = require("../../socket");
const draftDbService = new draft_db_service_1.DraftDbService();
const groqService = new groq_service_1.GroqService();
const gmailDbService = new gmail_db_service_1.GmailDbService();
const knowledgeDbService = new knowledge_db_service_1.KnowledgeDbService();
const retrievalService = new retrieval_service_1.RetrievalService();
const contactDbService = new contact_db_service_1.ContactDbService();
const analytics_event_service_1 = require("../analytics/services/analytics-event.service");
const pricing_config_1 = require("../analytics/services/pricing.config");
const client_1 = require("@prisma/client");
const cache_service_1 = require("../../lib/cache.service");
const user_queue_1 = require("../../utils/user-queue");
const draftUserQueue = new user_queue_1.UserSerialQueue();
class DraftService {
    async generateDraft(userId, emailId, isRegeneration = false) {
        if (await this.isGenerating(emailId)) {
            throw new Error('CONFLICT: Draft generation already in progress for this email');
        }
        const locked = await cache_service_1.cacheService.acquireLock(`draft:lock:${emailId}`, 120);
        if (!locked) {
            throw new Error('CONFLICT: Draft generation already in progress for this email');
        }
        return draftUserQueue.enqueue(userId, () => this.processDraft(userId, emailId, isRegeneration));
    }
    async processDraft(userId, emailId, isRegeneration) {
        await cache_service_1.cacheService.set(`draft:active:${emailId}`, 'GENERATING', 120);
        try {
            const email = await gmailDbService.getEmailByIdWithConnection(userId, emailId);
            if (!email) {
                throw new Error('Email not found');
            }
            const thread = await gmailDbService.getThread(userId, email.emailThreadId);
            if (!thread || thread.emails.length === 0) {
                throw new Error('Thread not found or empty');
            }
            (0, socket_1.emitToUser)(userId, 'draft:started', { emailId, threadId: thread.id });
            const MAX_CHARS = 8000;
            let currentChars = 0;
            const contextBlocks = [];
            const allRecipients = new Set();
            const sortedEmails = thread.emails.sort((a, b) => new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime());
            for (let i = sortedEmails.length - 1; i >= 0; i--) {
                const msg = sortedEmails[i];
                msg.participants.forEach((p) => {
                    if (p.emailAddress) {
                        allRecipients.add(`${p.displayName ? p.displayName + ' ' : ''}<${p.emailAddress}>`);
                    }
                });
                const dateStr = new Date(msg.receivedAt).toUTCString();
                const from = msg.participants.find((p) => p.role === 'SENDER');
                const to = msg.participants.filter((p) => p.role === 'TO').map((p) => p.emailAddress).join(', ');
                const cc = msg.participants.filter((p) => p.role === 'CC').map((p) => p.emailAddress).join(', ');
                const rawBody = msg.plainBody || (msg.htmlBody ? (0, html_to_text_1.convert)(msg.htmlBody, { wordwrap: false }) : 'No content');
                const header = `--- Message from ${from?.emailAddress} on ${dateStr} ---\nTo: ${to}\nCc: ${cc}\nSubject: ${msg.subject || thread.subject}\n`;
                const block = `${header}\n${rawBody}\n`;
                let blockToAdd = block;
                if (i === sortedEmails.length - 1 && blockToAdd.length > MAX_CHARS) {
                    blockToAdd = blockToAdd.substring(0, MAX_CHARS) + '\n... [TRUNCATED DUE TO LENGTH]';
                }
                if (i === sortedEmails.length - 1) {
                    contextBlocks.unshift(blockToAdd);
                    currentChars += blockToAdd.length;
                }
                else {
                    if (currentChars + blockToAdd.length <= MAX_CHARS) {
                        contextBlocks.unshift(blockToAdd);
                        currentChars += blockToAdd.length;
                    }
                    else {
                        break;
                    }
                }
            }
            const allRecipientsList = Array.from(allRecipients).join(', ');
            const userEmail = email.connection?.emailAddress || '';
            const senderEmail = email.participants.find((p) => p.role === 'SENDER')?.emailAddress;
            let contactContextString = '';
            if (senderEmail) {
                try {
                    const fetchedContactContext = await contactDbService.getContactContextByEmail(userId, senderEmail);
                    if (fetchedContactContext) {
                        contactContextString = "\n\n" + fetchedContactContext;
                    }
                }
                catch (error) {
                    logger_1.logger.error({ err: error }, 'Failed to fetch contact context for draft');
                }
            }
            let contextText = `You are writing a reply on behalf of: ${userEmail}\nYou must write as ${userEmail}, NOT as the person who sent the email.\n\nThread Context (All participants: ${allRecipientsList}):\n\n` + contextBlocks.join('\n');
            contextText += contactContextString;
            let knowledgeContext = '';
            try {
                const hasDocuments = await knowledgeDbService.hasActiveDocuments(userId);
                if (hasDocuments) {
                    const retrievalResult = await retrievalService.retrieveForDraft(userId, contextText);
                    if (retrievalResult) {
                        knowledgeContext = retrievalResult.formattedContext;
                    }
                }
            }
            catch (err) {
                logger_1.logger.warn({ err, emailId }, 'Knowledge retrieval failed, continuing without knowledge');
            }
            if (knowledgeContext) {
                contextText += '\n\n' + knowledgeContext;
            }
            const startGroq = Date.now();
            const groqResult = await groqService.generateDraftReply(userId, contextText, isRegeneration);
            const generationLatencyMs = Date.now() - startGroq;
            if (isRegeneration) {
                await draftDbService.markPreviousDraftsNonFinal(emailId, userId);
            }
            const draft = await draftDbService.createDraft({
                emailId,
                userId,
                generatedText: groqResult.replyText,
                provider: 'GROQ',
                modelName: 'llama-3.1-8b-instant',
                temperature: 0.3,
                promptTokens: groqResult.promptTokens,
                completionTokens: groqResult.completionTokens,
                totalTokens: groqResult.totalTokens,
                generationLatencyMs,
                confidence: groqResult.confidence,
                isFinal: true
            });
            const estCost = pricing_config_1.PricingConfig.calculateCost(client_1.AiProvider.GROQ, 'llama-3.1-8b-instant', groqResult.promptTokens || 0, groqResult.completionTokens || 0);
            analytics_event_service_1.AnalyticsEventService.recordEvent(userId, analytics_event_service_1.AnalyticsEventType.DRAFT_GENERATED, {
                latency: generationLatencyMs,
                promptTokens: groqResult.promptTokens,
                completionTokens: groqResult.completionTokens,
                estimatedCost: estCost,
                confidence: groqResult.confidence
            });
            const eventName = isRegeneration ? 'draft:regenerated' : 'draft:generated';
            (0, socket_1.emitToUser)(userId, eventName, {
                emailId,
                threadId: thread.id,
                draft: {
                    id: draft.id,
                    generatedText: draft.generatedText,
                    confidence: draft.confidence,
                    createdAt: draft.createdAt,
                    editedText: draft.editedText
                }
            });
        }
        catch (err) {
            const error = err;
            logger_1.logger.error({ error, emailId, userId }, 'Draft generation failed');
            (0, socket_1.emitToUser)(userId, 'draft:failed', { emailId, error: error.message });
            throw error;
        }
        finally {
            await cache_service_1.cacheService.delete(`draft:active:${emailId}`);
            await cache_service_1.cacheService.releaseLock(`draft:lock:${emailId}`);
        }
    }
    async isGenerating(emailId) {
        const status = await cache_service_1.cacheService.get(`draft:active:${emailId}`);
        return status === 'GENERATING';
    }
}
exports.DraftService = DraftService;
