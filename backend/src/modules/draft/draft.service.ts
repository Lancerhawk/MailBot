import { DraftDbService } from './draft.db.service';
import { GroqService } from '../ai/groq.service';
import { GmailDbService } from '../gmail/services/gmail.db.service';
import { KnowledgeDbService } from '../knowledge/knowledge.db.service';
import { RetrievalService } from '../knowledge/services/retrieval.service';
import { convert } from 'html-to-text';
import { logger } from '../../config/logger';
import { emitToUser } from '../../socket';

const draftDbService = new DraftDbService();
const groqService = new GroqService();
const gmailDbService = new GmailDbService();
const knowledgeDbService = new KnowledgeDbService();
const retrievalService = new RetrievalService();

const userProcessingQueue = new Map<string, Promise<void>>();
const activeGenerations = new Set<string>();

export class DraftService {
  async generateDraft(userId: string, emailId: string, isRegeneration = false) {
    if (activeGenerations.has(emailId)) {
      throw new Error('CONFLICT: Draft generation already in progress for this email');
    }

    const previousPromise = userProcessingQueue.get(userId) || Promise.resolve();
    const nextPromise = previousPromise
      .then(() => this.processDraft(userId, emailId, isRegeneration))
      .catch((error) => {
        logger.error({ error, userId, emailId }, 'Error in user draft processing queue');
      });

    userProcessingQueue.set(userId, nextPromise);

    nextPromise.finally(() => {
      if (userProcessingQueue.get(userId) === nextPromise) {
        userProcessingQueue.delete(userId);
      }
    });

    return nextPromise;
  }

  private async processDraft(userId: string, emailId: string, isRegeneration: boolean) {
    activeGenerations.add(emailId);
    try {

    } catch (e) {

    }

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

      // console.time(`Draft-PromptBuild-${emailId}`);
      const MAX_CHARS = 8000;
      let currentChars = 0;
      let contextBlocks: string[] = [];
      let allRecipients = new Set<string>();

      const sortedEmails = thread.emails.sort((a: any, b: any) =>
        new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime()
      );

      for (let i = sortedEmails.length - 1; i >= 0; i--) {
        const msg = sortedEmails[i];

        msg.participants.forEach((p: any) => {
          if (p.emailAddress) {
            allRecipients.add(`${p.displayName ? p.displayName + ' ' : ''}<${p.emailAddress}>`);
          }
        });

        const dateStr = new Date(msg.receivedAt).toUTCString();
        const from = msg.participants.find((p: any) => p.role === 'SENDER');
        const to = msg.participants.filter((p: any) => p.role === 'TO').map((p: any) => p.emailAddress).join(', ');
        const cc = msg.participants.filter((p: any) => p.role === 'CC').map((p: any) => p.emailAddress).join(', ');

        const rawBody = msg.plainBody || (msg.htmlBody ? convert(msg.htmlBody, { wordwrap: false }) : 'No content');
        const header = `--- Message from ${from?.emailAddress} on ${dateStr} ---\nTo: ${to}\nCc: ${cc}\nSubject: ${msg.subject || thread.subject}\n`;
        const block = `${header}\n${rawBody}\n`;

        if (i === sortedEmails.length - 1) {
          contextBlocks.unshift(block);
          currentChars += block.length;
        } else {
          if (currentChars + block.length <= MAX_CHARS) {
            contextBlocks.unshift(block);
            currentChars += block.length;
          } else {
            break;
          }
        }
      }

      const allRecipientsList = Array.from(allRecipients).join(', ');

      const userEmail = email.connection?.emailAddress || '';

      let contextText = `You are writing a reply on behalf of: ${userEmail}\nYou must write as ${userEmail}, NOT as the person who sent the email.\n\nThread Context (All participants: ${allRecipientsList}):\n\n` + contextBlocks.join('\n');
      // console.timeEnd(`Draft-PromptBuild-${emailId}`);

      // --- Knowledge Retrieval (Phase 8) ---
      let knowledgeContext = '';
      try {
        const hasDocuments = await knowledgeDbService.hasActiveDocuments(userId);
        if (hasDocuments) {
          // console.time(`Draft-KnowledgeRetrieval-${emailId}`);
          const retrievalResult = await retrievalService.retrieveForDraft(userId, contextText);
          if (retrievalResult) {
            knowledgeContext = retrievalResult.formattedContext;
          }
          // console.timeEnd(`Draft-KnowledgeRetrieval-${emailId}`);
        } else {
          // console.log(`\n[INFO] [RAG] User has no documents in Knowledge Base. Search bypassed.`);
        }
      } catch (err) {
        // Knowledge retrieval failure must NEVER block draft generation
        // console.log(`\n[ERROR] [RAG] Retrieval encountered an error. Proceeding without knowledge context.`);
        logger.warn({ err, emailId }, 'Knowledge retrieval failed, continuing without knowledge');
      }

      if (knowledgeContext) {
        // console.log(`\n[INFO] [DRAFT] Injecting retrieved knowledge context into generation prompt.`);
        contextText += '\n\n' + knowledgeContext;
      }

      // console.log(`\n[INFO] [AI] Initiating generation via Llama 3 (Prompt Size: ${contextText.length} characters)...`);
      // console.time(`Draft-GroqLatency-${emailId}`);
      const startGroq = Date.now();
      const groqResult = await groqService.generateDraftReply(contextText);
      const generationLatencyMs = Date.now() - startGroq;
      // console.timeEnd(`Draft-GroqLatency-${emailId}`);

      // console.log(`\n[SUCCESS] [AI] Draft generation completed in ${generationLatencyMs}ms.`);
      // console.log(`--------------------------------------------------`);
      // console.log(`\x1b[36m${groqResult.replyText}\x1b[0m`);
      // console.log(`--------------------------------------------------\n`);

      // console.time(`Draft-Save-${emailId}`);

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
      // console.timeEnd(`Draft-Save-${emailId}`);

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

    } catch (error: any) {
      logger.error({ error, emailId, userId }, 'Draft generation failed');
      emitToUser(userId, 'draft:failed', { emailId, error: error.message });
      throw error;
    } finally {
      activeGenerations.delete(emailId);
    }
  }

  isGenerating(emailId: string) {
    return activeGenerations.has(emailId);
  }
}
