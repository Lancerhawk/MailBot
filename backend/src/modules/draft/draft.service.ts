import { DraftDbService } from './draft.db.service';
import { GroqService } from '../ai/groq.service';
import { GmailDbService } from '../gmail/services/gmail.db.service';
import { KnowledgeDbService } from '../knowledge/knowledge.db.service';
import { RetrievalService } from '../knowledge/services/retrieval.service';
import { ContactDbService } from '../contact/contact.db.service';
import { convert } from 'html-to-text';
import { logger } from '../../config/logger';
import { emitToUser } from '../../socket';

const draftDbService = new DraftDbService();
const groqService = new GroqService();
const gmailDbService = new GmailDbService();
const knowledgeDbService = new KnowledgeDbService();
const retrievalService = new RetrievalService();
const contactDbService = new ContactDbService();
import { AnalyticsEventService, AnalyticsEventType } from '../analytics/services/analytics-event.service';
import { PricingConfig } from '../analytics/services/pricing.config';
import { AiProvider } from '@prisma/client';
import { cacheService } from '../../lib/cache.service';
import { UserSerialQueue } from '../../utils/user-queue';

const draftUserQueue = new UserSerialQueue('draft', cacheService);

export class DraftService {
  async generateDraft(userId: string, emailId: string, isRegeneration = false) {
    if (await this.isGenerating(emailId)) {
      throw new Error('CONFLICT: Draft generation already in progress for this email');
    }

    const locked = await cacheService.acquireLock(`draft:lock:${emailId}`, 120);
    if (!locked) {
      throw new Error('CONFLICT: Draft generation already in progress for this email');
    }

    return draftUserQueue.enqueue(userId, () => this.processDraft(userId, emailId, isRegeneration));
  }

  private async processDraft(userId: string, emailId: string, isRegeneration: boolean) {
    await cacheService.set(`draft:active:${emailId}`, 'GENERATING', 120);
    try {
      const email = await gmailDbService.getEmailByIdWithConnection(userId, emailId);
      if (!email) {
        throw new Error('Email not found');
      }

      const thread = await gmailDbService.getThread(userId, email.emailThreadId);
      if (!thread || thread.emails.length === 0) {
        throw new Error('Thread not found or empty');
      }

      emitToUser(userId, 'draft:started', { emailId, threadId: thread.id });

      const MAX_CHARS = 8000;
      let currentChars = 0;
      const contextBlocks: string[] = [];
      const allRecipients = new Set<string>();

      const sortedEmails = thread.emails.sort((a: { receivedAt: Date | string | number }, b: { receivedAt: Date | string | number }) =>
        new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime()
      );

      for (let i = sortedEmails.length - 1; i >= 0; i--) {
        const msg = sortedEmails[i];

        msg.participants.forEach((p: { emailAddress?: string | null, displayName?: string | null }) => {
          if (p.emailAddress) {
            allRecipients.add(`${p.displayName ? p.displayName + ' ' : ''}<${p.emailAddress}>`);
          }
        });

        const dateStr = new Date(msg.receivedAt).toUTCString();
        const from = msg.participants.find((p: { role: string }) => p.role === 'SENDER');
        const to = msg.participants.filter((p: { role: string }) => p.role === 'TO').map((p: { emailAddress?: string | null }) => p.emailAddress).join(', ');
        const cc = msg.participants.filter((p: { role: string }) => p.role === 'CC').map((p: { emailAddress?: string | null }) => p.emailAddress).join(', ');

        const rawBody = msg.plainBody || (msg.htmlBody ? convert(msg.htmlBody, { wordwrap: false }) : 'No content');
        const header = `--- Message from ${from?.emailAddress} on ${dateStr} ---\nTo: ${to}\nCc: ${cc}\nSubject: ${msg.subject || thread.subject}\n`;
        const block = `${header}\n${rawBody}\n`;

        let blockToAdd = block;
        if (i === sortedEmails.length - 1 && blockToAdd.length > MAX_CHARS) {
          blockToAdd = blockToAdd.substring(0, MAX_CHARS) + '\n... [TRUNCATED DUE TO LENGTH]';
        }

        if (i === sortedEmails.length - 1) {
          contextBlocks.unshift(blockToAdd);
          currentChars += blockToAdd.length;
        } else {
          if (currentChars + blockToAdd.length <= MAX_CHARS) {
            contextBlocks.unshift(blockToAdd);
            currentChars += blockToAdd.length;
          } else {
            break;
          }
        }
      }

      const allRecipientsList = Array.from(allRecipients).join(', ');

      const userEmail = email.connection?.emailAddress || '';

      const senderEmail = email.participants.find((p: any) => p.role === 'SENDER')?.emailAddress;
      let contactContextString = '';
      if (senderEmail) {
        try {
          const fetchedContactContext = await contactDbService.getContactContextByEmail(userId, senderEmail);
          if (fetchedContactContext) {
            contactContextString = "\n\n" + fetchedContactContext;
          }
        } catch (error) {
          logger.error({ err: error }, 'Failed to fetch contact context for draft');
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
      } catch (err) {
        logger.warn({ err, emailId }, 'Knowledge retrieval failed, continuing without knowledge');
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

      const estCost = PricingConfig.calculateCost(AiProvider.GROQ, 'llama-3.1-8b-instant', groqResult.promptTokens || 0, groqResult.completionTokens || 0);

      AnalyticsEventService.recordEvent(userId, AnalyticsEventType.DRAFT_GENERATED, {
        latency: generationLatencyMs,
        promptTokens: groqResult.promptTokens,
        completionTokens: groqResult.completionTokens,
        estimatedCost: estCost,
        confidence: groqResult.confidence
      });

      const eventName = isRegeneration ? 'draft:regenerated' : 'draft:generated';
      emitToUser(userId, eventName, {
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

    } catch (err: unknown) {
      const error = err as Error;
      logger.error({ error, emailId, userId }, 'Draft generation failed');
      emitToUser(userId, 'draft:failed', { emailId, error: error.message });
      throw error;
    } finally {
      await cacheService.delete(`draft:active:${emailId}`);
      await cacheService.releaseLock(`draft:lock:${emailId}`);
    }
  }

  async isGenerating(emailId: string): Promise<boolean> {
    const status = await cacheService.get<string>(`draft:active:${emailId}`);
    return status === 'GENERATING';
  }
}
