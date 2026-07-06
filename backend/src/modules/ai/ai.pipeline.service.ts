import { PrismaClient, Email, ProcessingStatus } from '@prisma/client';
import { htmlToText } from 'html-to-text';
import { GroqService } from './groq.service';
import { logger } from '../../config/logger';
import { emitToUser } from '../../socket';

const prisma = new PrismaClient();
const groqService = new GroqService();

const userProcessingQueue: Record<string, Promise<void>> = {};

export class AiPipelineService {
  scheduleAnalysis(userId: string, emailId: string) {
    const run = async () => {
      try {
        await this.processEmail(userId, emailId);
      } catch (error) {
        logger.error({ error, emailId }, 'AI Pipeline uncaught exception during scheduleAnalysis');
      }
    };

    if (!userProcessingQueue[userId]) {
      userProcessingQueue[userId] = Promise.resolve();
    }

    userProcessingQueue[userId] = userProcessingQueue[userId].then(run).catch(() => {
    });
  }

  private async processEmail(userId: string, emailId: string) {
    const email = await prisma.email.findUnique({
      where: { id: emailId },
      include: { thread: true, labels: true }
    });

    if (!email) return;

    const isSent = email.labels?.some((l: any) => l.providerLabelId === 'SENT');

    if (
      email.isDeleted ||
      email.isDraft ||
      email.isSpam ||
      email.category === 'TRASH' ||
      isSent
    ) {
      logger.debug(`Skipping AI analysis for email ${emailId} - failed eligibility check.`);
      if (email.processingStatus === 'PENDING') {
        await prisma.email.update({
          where: { id: emailId },
          data: { processingStatus: ProcessingStatus.SKIPPED }
        });
      }
      return;
    }

    if (email.processingStatus !== 'PENDING') {
      logger.debug(`Skipping AI analysis for email ${emailId} - already processed (${email.processingStatus}).`);
      return;
    }

    const content = email.plainBody || email.htmlBody || email.snippet || '';
    if (!content || content.trim().length === 0) {
      logger.debug(`Skipping AI analysis for email ${emailId} - no readable content.`);
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

      const MAX_CONTEXT_LENGTH = 15000;
      let currentLength = 0;
      const contextMessages: string[] = [];

      for (let i = threadEmails.length - 1; i >= 0; i--) {
        const msg = threadEmails[i];

        const rawBody = msg.plainBody || msg.htmlBody || msg.snippet || '';
        const cleanText = htmlToText(rawBody, { wordwrap: 130 });

        const sender = msg.participants.find(p => p.role === 'SENDER')?.emailAddress || 'Unknown';
        const msgHeader = `--- Message from: ${sender} on ${msg.providerInternalDate.toISOString()} ---\nSubject: ${msg.subject || '(No Subject)'}`;
        const msgBlock = `${msgHeader}\n${cleanText}\n\n`;

        if (currentLength + msgBlock.length > MAX_CONTEXT_LENGTH && contextMessages.length > 0) {
          break;
        }

        currentLength += msgBlock.length;
        contextMessages.unshift(msgBlock);
      }

      const conversationContext = contextMessages.join('');

      const result = await groqService.analyzeConversation(conversationContext);

      await prisma.email.update({
        where: { id: emailId },
        data: {
          summary: result.summary,
          sentiment: result.sentiment,
          intent: result.intent,
          needsReply: result.needsReply,
          priority: result.priority,
          confidence: result.confidence,
          processingStatus: ProcessingStatus.COMPLETED
        }
      });

      logger.info(`AI analysis completed for email ${emailId}`);
      emitToUser(userId, 'analysis:completed', { emailId, threadId: email.emailThreadId, result });

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
