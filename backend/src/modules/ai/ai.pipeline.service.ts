import { ProcessingStatus, Sentiment, Intent, Priority } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { htmlToText } from 'html-to-text';
import { GroqService } from './groq.service';
import { logger } from '../../config/logger';
import { emitToUser } from '../../socket';
import { DraftService } from '../draft/draft.service';
import { DraftDbService } from '../draft/draft.db.service';
import { ContactDbService } from '../contact/contact.db.service';
import { AnalyticsEventService, AnalyticsEventType } from '../analytics/services/analytics-event.service';
import { cacheService } from '../../lib/cache.service';

const groqService = new GroqService();
const contactDbService = new ContactDbService();

const userProcessingQueue: Record<string, Promise<void>> = {};

export class AiPipelineService {
  scheduleAnalysis(userId: string, emailId: string): Promise<void> {
    const run = async () => {
      const lockKey = `ai:lock:${userId}`;
      let acquired = await cacheService.acquireLock(lockKey, 120);
      let attempts = 0;
      while (!acquired && attempts < 5) {
        attempts++;
        await new Promise(r => setTimeout(r, 1000));
        acquired = await cacheService.acquireLock(lockKey, 120);
      }
      try {
        await this.processEmail(userId, emailId);
      } catch (err: unknown) {
        const error = err as Error;
        logger.error({ error: error.message || error, stack: error.stack, emailId }, 'AI Pipeline uncaught exception during scheduleAnalysis');
      } finally {
        if (acquired) {
          await cacheService.releaseLock(lockKey);
        }
      }
    };

    if (!userProcessingQueue[userId]) {
      userProcessingQueue[userId] = Promise.resolve();
    }

    const nextPromise = userProcessingQueue[userId].then(run);
    userProcessingQueue[userId] = nextPromise.catch(() => { });

    return nextPromise;
  }

  private async processEmail(userId: string, emailId: string) {
    const email = await prisma.email.findUnique({
      where: { id: emailId },
      include: { thread: true, labels: true, user: true, participants: true, connection: true }
    });

    if (!email) return;

    const isSentLabel = email.labels?.some((l: { providerLabelId: string }) => l.providerLabelId === 'SENT');
    const sender = email.participants?.find((p: { role: string; emailAddress: string }) => p.role === 'SENDER');
    const isSentByUser = sender && email.connection && sender.emailAddress.toLowerCase() === email.connection.emailAddress.toLowerCase();

    const isSent = isSentLabel || isSentByUser;

    const isOld = email.receivedAt.getTime() < email.user.createdAt.getTime();

    if (
      email.isDeleted ||
      email.isDraft ||
      email.isSpam ||
      email.category === 'TRASH' ||
      isSent ||
      isOld
    ) {
      if (email.processingStatus === 'PENDING') {
        await prisma.email.update({
          where: { id: emailId },
          data: { processingStatus: ProcessingStatus.SKIPPED }
        });
      }
      return;
    }

    if (email.processingStatus !== 'PENDING') {
      return;
    }

    const content = email.plainBody || email.htmlBody || email.snippet || '';
    if (!content || content.trim().length === 0) {
      await prisma.email.update({
        where: { id: emailId },
        data: { processingStatus: ProcessingStatus.SKIPPED }
      });
      return;
    }

    await prisma.email.update({
      where: { id: emailId },
      data: { processingStatus: ProcessingStatus.PROCESSING }
    });

    emitToUser(userId, 'analysis:started', { emailId, threadId: email.emailThreadId });

    try {
      const threadEmails = await prisma.email.findMany({
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
      const contextMessages: string[] = [];

      for (let i = threadEmails.length - 1; i >= 0; i--) {
        const msg = threadEmails[i];

        const rawBody = msg.plainBody || msg.htmlBody || msg.snippet || '';
        const cleanText = htmlToText(rawBody, { wordwrap: 130 });

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
      const senderEmail = currentMsg?.participants.find((p: any) => p.role === 'SENDER')?.emailAddress;

      if (senderEmail) {
        try {
          const contactContext = await contactDbService.getContactContextByEmail(userId, senderEmail);
          if (contactContext) {
            finalContext = conversationContext + "\n\n" + contactContext;
          }
        } catch (error) {
          logger.error({ err: error }, 'Failed to fetch contact context for analysis');
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

      await prisma.email.update({
        where: { id: emailId },
        data: {
          summary: result.summary,
          sentiment: sentiment as Sentiment,
          intent: intent as Intent,
          needsReply: needsReply,
          priority: priority as Priority,
          confidence: confidence,
          processingStatus: ProcessingStatus.COMPLETED
        }
      });

      AnalyticsEventService.recordEvent(userId, AnalyticsEventType.EMAIL_ANALYZED);
      if (result.summary) {
        AnalyticsEventService.recordEvent(userId, AnalyticsEventType.EMAIL_SUMMARIZED);
      }

      emitToUser(userId, 'analysis:completed', { emailId, threadId: email.emailThreadId, result: { ...result, sentiment, intent, priority, needsReply, confidence } });

      if (result.needsReply === false) {
        return;
      }

      const draftDbService = new DraftDbService();
      const existingDraft = await draftDbService.getLatestFinalDraft(emailId, userId);
      if (existingDraft) {
        return;
      }

      const draftService = new DraftService();
      await draftService.generateDraft(userId, emailId).catch(err => {
        logger.error({ err, emailId }, 'Automatic draft generation failed');
      });

      await prisma.email.update({
        where: { id: emailId },
        data: { replyStatus: 'DRAFTED' }
      });

    } catch (error) {
      logger.error({ error, emailId }, 'AI analysis failed and exhausted retries');

      await prisma.email.update({
        where: { id: emailId },
        data: { processingStatus: ProcessingStatus.FAILED }
      });

      emitToUser(userId, 'analysis:failed', { emailId, threadId: email.emailThreadId });
    }
  }
}
