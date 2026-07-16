import { prisma } from '../../../lib/prisma';
import { GmailClientService } from './gmail.client.service';
import { GmailDbService } from './gmail.db.service';
import { DraftDbService } from '../../draft/draft.db.service';
import { AnalyticsEventService, AnalyticsEventType } from '../../analytics/services/analytics-event.service';
import { emitToUser } from '../../../socket';
import { logger } from '../../../config/logger';
import { ApiError } from '../../../utils/ApiError';

const gmailClientService = new GmailClientService();
const gmailDbService = new GmailDbService();
const draftDbService = new DraftDbService();
const activeSends = new Set<string>();

interface SendEmailParams {
  type: 'reply' | 'compose';
  userId: string;
  connectionId: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  inReplyTo?: string;
  references?: string[];
  providerThreadId?: string;
}

export class GmailSendService {
  private validateComposePayload(to: string[], subject: string, body: string) {
    if (!to || to.length === 0) throw new ApiError(400, 'At least one recipient is required in To field');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const email of to) {
      const match = email.match(/<([^>]+)>/);
      const emailToTest = match ? match[1] : email;
      if (!emailRegex.test(emailToTest.trim())) throw new ApiError(400, `Invalid email format: ${email}`);
    }

    if (!body || body.trim().length === 0) throw new ApiError(400, 'Email body cannot be empty');
    if (subject && subject.length > 998) throw new ApiError(400, 'Subject is too long');
  }

  private buildMimeMessage(params: SendEmailParams): string {
    const boundary = `----=_Part_${Date.now()}`;

    let message = `To: ${params.to.join(', ')}\r\n`;
    if (params.cc && params.cc.length > 0) message += `Cc: ${params.cc.join(', ')}\r\n`;
    if (params.bcc && params.bcc.length > 0) message += `Bcc: ${params.bcc.join(', ')}\r\n`;

    message += `Subject: ${params.subject}\r\n`;

    if (params.inReplyTo) message += `In-Reply-To: ${params.inReplyTo}\r\n`;
    if (params.references && params.references.length > 0) {
      message += `References: ${params.references.join(' ')}\r\n`;
    }

    message += `MIME-Version: 1.0\r\n`;
    message += `Content-Type: multipart/alternative; boundary="${boundary}"\r\n\r\n`;

    message += `--${boundary}\r\n`;
    message += `Content-Type: text/plain; charset="UTF-8"\r\n\r\n`;
    message += `${params.body}\r\n\r\n`;


    message += `--${boundary}--`;

    return Buffer.from(message).toString('base64url');
  }

  private async sendEmail(params: SendEmailParams) {
    const gmail = await gmailClientService.getAuthenticatedClient(params.userId);
    const rawMessage = this.buildMimeMessage(params);

    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: rawMessage,
        ...(params.providerThreadId ? { threadId: params.providerThreadId } : {})
      }
    });

    return res.data;
  }

  async sendReply(userId: string, emailId: string, editedText?: string) {
    console.time(`Send-TotalPipeline-${emailId}`);

    const draft = await draftDbService.getLatestFinalDraft(emailId, userId);
    if (!draft && !editedText) {
      throw new ApiError(404, 'No valid draft found for this email and no text provided');
    }

    if (draft && draft.approvalStatus === 'APPROVED') {
      throw new ApiError(409, 'This draft has already been sent successfully.');
    }

    const sendLockId = draft ? draft.id : `manual-${emailId}`;
    if (activeSends.has(sendLockId)) {
      throw new ApiError(409, 'Reply is already being sent');
    }

    activeSends.add(sendLockId);

    try {
      const email = await gmailDbService.getEmailByIdWithConnection(userId, emailId);
      if (!email) throw new ApiError(404, 'Original email not found');

      if (email.isSpam) {
        try {
          const gmailActionsService = (await import('./gmail.actions.service')).GmailActionsService;
          const actionsService = new gmailActionsService();
          await actionsService.threadUnmarkSpam(userId, email.emailThreadId);
        } catch (e) {
          logger.warn(`Failed to unmark spam before replying: ${e}`);
        }
      }

      if (draft && editedText !== undefined && editedText !== draft.editedText) {
        await prisma.aiDraftReply.update({
          where: { id: draft.id },
          data: { editedText }
        });
        draft.editedText = editedText;
      }

      const bodyText = editedText ?? (draft ? (draft.editedText ?? draft.generatedText) : '');

      let from = email.participants.find(p => p.role === 'SENDER');
      if (!from) throw new ApiError(400, 'Original sender not found');

      const isSentEmail = email.labels.some((l: any) => l.providerLabelId === 'SENT');

      if (isSentEmail || from.emailAddress.toLowerCase() === email.connection.emailAddress.toLowerCase()) {
        const toParticipant = email.participants.find(p => p.role === 'TO');
        if (toParticipant) {
          from = toParticipant;
        }
      }

      const replyToEmail = `${from.displayName ? from.displayName + ' ' : ''}<${from.emailAddress}>`;

      let replySubject = email.subject || '';
      if (!replySubject.toLowerCase().startsWith('re:')) {
        replySubject = `Re: ${replySubject}`;
      }

      console.time(`Gmail-Send-${emailId}`);
      let sentMessageId: string;
      try {
        const result = await this.sendEmail({
          type: 'reply',
          userId,
          connectionId: email.accountConnectionId,
          to: [replyToEmail],
          subject: replySubject,
          body: bodyText,
          inReplyTo: email.internetMessageId || undefined,
          references: email.referencesHeader ? [email.referencesHeader, email.internetMessageId].filter(Boolean) as string[] : (email.internetMessageId ? [email.internetMessageId] : undefined),
          providerThreadId: email.thread?.providerThreadId
        });
        sentMessageId = result.id!;
      } catch (sendError: any) {
        activeSends.delete(sendLockId);
        if (draft) {
          await prisma.sentReply.create({
            data: {
              draftId: draft.id,
              originalEmailId: email.id,
              deliveryStatus: 'FAILED',
              failureReason: sendError.message,
              providerMessageId: 'failed'
            }
          });
        }
        emitToUser(userId, 'email:send_failed', { emailId, error: sendError.message });
        throw new ApiError(500, `Failed to send email: ${sendError.message}`);
      }
      console.timeEnd(`Gmail-Send-${emailId}`);

      activeSends.delete(sendLockId);

      const txns: any[] = [
        prisma.email.update({
          where: { id: email.id },
          data: { replyStatus: 'SENT' }
        })
      ];

      if (draft) {
        txns.push(
          prisma.aiDraftReply.update({
            where: { id: draft.id },
            data: { approvalStatus: 'APPROVED', deletedAt: new Date() }
          }),
          prisma.sentReply.create({
            data: {
              draftId: draft.id,
              originalEmailId: email.id,
              deliveryStatus: 'DELIVERED',
              providerMessageId: sentMessageId,
              sentAt: new Date()
            }
          })
        );
      }

      txns.push(
        prisma.aiDraftReply.updateMany({
          where: {
            emailId: email.id,
            deletedAt: null,
            ...(draft ? { id: { not: draft.id } } : {})
          },
          data: { deletedAt: new Date() }
        })
      );

      await prisma.$transaction(txns);

      AnalyticsEventService.recordEvent(userId, AnalyticsEventType.EMAIL_REPLIED);
      if (draft) {
        AnalyticsEventService.recordEvent(userId, AnalyticsEventType.DRAFT_APPROVED);
      }

      emitToUser(userId, 'email:sent', {
        emailId,
        messageId: sentMessageId,
        threadId: email.emailThreadId
      });

    } finally {
      activeSends.delete(sendLockId);
      console.timeEnd(`Send-TotalPipeline-${emailId}`);
    }
  }

  async sendCompose(userId: string, payload: { to: string[], cc?: string[], bcc?: string[], subject: string, body: string }) {
    this.validateComposePayload(payload.to, payload.subject, payload.body);

    const connection = await gmailClientService.getConnection(userId);
    if (!connection) throw new ApiError(400, 'No active Gmail connection found');

    const result = await this.sendEmail({
      type: 'compose',
      userId,
      connectionId: connection.id,
      to: payload.to,
      cc: payload.cc,
      bcc: payload.bcc,
      subject: payload.subject,
      body: payload.body,
    });

    emitToUser(userId, 'email:sent', {});

    return result;
  }
}
