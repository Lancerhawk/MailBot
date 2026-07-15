"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DraftService = void 0;
const draft_db_service_1 = require("./draft.db.service");
const groq_service_1 = require("../ai/groq.service");
const gmail_db_service_1 = require("../gmail/services/gmail.db.service");
const knowledge_db_service_1 = require("../knowledge/knowledge.db.service");
const retrieval_service_1 = require("../knowledge/services/retrieval.service");
const html_to_text_1 = require("html-to-text");
const logger_1 = require("../../config/logger");
const socket_1 = require("../../socket");
const draftDbService = new draft_db_service_1.DraftDbService();
const groqService = new groq_service_1.GroqService();
const gmailDbService = new gmail_db_service_1.GmailDbService();
const knowledgeDbService = new knowledge_db_service_1.KnowledgeDbService();
const retrievalService = new retrieval_service_1.RetrievalService();
const userProcessingQueue = new Map();
const activeGenerations = new Set();
class DraftService {
    async generateDraft(userId, emailId, isRegeneration = false) {
        if (activeGenerations.has(emailId)) {
            throw new Error('CONFLICT: Draft generation already in progress for this email');
        }
        const previousPromise = userProcessingQueue.get(userId) || Promise.resolve();
        const nextPromise = previousPromise
            .then(() => this.processDraft(userId, emailId, isRegeneration))
            .catch((error) => {
            logger_1.logger.error({ error, userId, emailId }, 'Error in user draft processing queue');
        });
        userProcessingQueue.set(userId, nextPromise);
        nextPromise.finally(() => {
            if (userProcessingQueue.get(userId) === nextPromise) {
                userProcessingQueue.delete(userId);
            }
        });
        return nextPromise;
    }
    async processDraft(userId, emailId, isRegeneration) {
        activeGenerations.add(emailId);
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
                if (i === sortedEmails.length - 1) {
                    contextBlocks.unshift(block);
                    currentChars += block.length;
                }
                else {
                    if (currentChars + block.length <= MAX_CHARS) {
                        contextBlocks.unshift(block);
                        currentChars += block.length;
                    }
                    else {
                        break;
                    }
                }
            }
            const allRecipientsList = Array.from(allRecipients).join(', ');
            const userEmail = email.connection?.emailAddress || '';
            let contextText = `You are writing a reply on behalf of: ${userEmail}\nYou must write as ${userEmail}, NOT as the person who sent the email.\n\nThread Context (All participants: ${allRecipientsList}):\n\n` + contextBlocks.join('\n');
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
            const groqResult = await groqService.generateDraftReply(userId, contextText);
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
            activeGenerations.delete(emailId);
        }
    }
    isGenerating(emailId) {
        return activeGenerations.has(emailId);
    }
}
exports.DraftService = DraftService;
