"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.GmailSendService = void 0;
const prisma_1 = require("../../../lib/prisma");
const gmail_client_service_1 = require("./gmail.client.service");
const gmail_db_service_1 = require("./gmail.db.service");
const draft_db_service_1 = require("../../draft/draft.db.service");
const gmail_sync_service_1 = require("./gmail.sync.service");
const socket_1 = require("../../../socket");
const logger_1 = require("../../../config/logger");
const ApiError_1 = require("../../../utils/ApiError");
const gmailClientService = new gmail_client_service_1.GmailClientService();
const gmailDbService = new gmail_db_service_1.GmailDbService();
const draftDbService = new draft_db_service_1.DraftDbService();
const syncService = new gmail_sync_service_1.GmailSyncService();
const activeSends = new Set();
class GmailSendService {
    validateComposePayload(to, subject, body) {
        if (!to || to.length === 0)
            throw new ApiError_1.ApiError(400, 'At least one recipient is required in To field');
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        for (const email of to) {
            const match = email.match(/<([^>]+)>/);
            const emailToTest = match ? match[1] : email;
            if (!emailRegex.test(emailToTest.trim()))
                throw new ApiError_1.ApiError(400, `Invalid email format: ${email}`);
        }
        if (!body || body.trim().length === 0)
            throw new ApiError_1.ApiError(400, 'Email body cannot be empty');
        if (subject && subject.length > 998)
            throw new ApiError_1.ApiError(400, 'Subject is too long');
    }
    buildMimeMessage(params) {
        const boundary = `----=_Part_${Date.now()}`;
        let message = `To: ${params.to.join(', ')}\r\n`;
        if (params.cc && params.cc.length > 0)
            message += `Cc: ${params.cc.join(', ')}\r\n`;
        if (params.bcc && params.bcc.length > 0)
            message += `Bcc: ${params.bcc.join(', ')}\r\n`;
        message += `Subject: ${params.subject}\r\n`;
        if (params.inReplyTo)
            message += `In-Reply-To: ${params.inReplyTo}\r\n`;
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
    async sendEmail(params) {
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
    async sendReply(userId, emailId, editedText) {
        console.time(`Send-TotalPipeline-${emailId}`);
        const draft = await draftDbService.getLatestFinalDraft(emailId, userId);
        if (!draft && !editedText) {
            throw new ApiError_1.ApiError(404, 'No valid draft found for this email and no text provided');
        }
        if (draft && draft.approvalStatus === 'APPROVED') {
            throw new ApiError_1.ApiError(409, 'This draft has already been sent successfully.');
        }
        const sendLockId = draft ? draft.id : `manual-${emailId}`;
        if (activeSends.has(sendLockId)) {
            throw new ApiError_1.ApiError(409, 'Reply is already being sent');
        }
        activeSends.add(sendLockId);
        try {
            const email = await gmailDbService.getEmailByIdWithConnection(userId, emailId);
            if (!email)
                throw new ApiError_1.ApiError(404, 'Original email not found');
            if (email.isSpam) {
                try {
                    const gmailActionsService = (await Promise.resolve().then(() => __importStar(require('./gmail.actions.service')))).GmailActionsService;
                    const actionsService = new gmailActionsService();
                    await actionsService.threadUnmarkSpam(userId, email.emailThreadId);
                }
                catch (e) {
                    logger_1.logger.warn(`Failed to unmark spam before replying: ${e}`);
                }
            }
            if (draft && editedText !== undefined && editedText !== draft.editedText) {
                await prisma_1.prisma.aiDraftReply.update({
                    where: { id: draft.id },
                    data: { editedText }
                });
                draft.editedText = editedText;
            }
            const bodyText = editedText ?? (draft ? (draft.editedText ?? draft.generatedText) : '');
            let from = email.participants.find(p => p.role === 'SENDER');
            if (!from)
                throw new ApiError_1.ApiError(400, 'Original sender not found');
            const isSentEmail = email.labels.some((l) => l.providerLabelId === 'SENT');
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
            let sentMessageId;
            try {
                const result = await this.sendEmail({
                    type: 'reply',
                    userId,
                    connectionId: email.accountConnectionId,
                    to: [replyToEmail],
                    subject: replySubject,
                    body: bodyText,
                    inReplyTo: email.internetMessageId || undefined,
                    references: email.referencesHeader ? [email.referencesHeader, email.internetMessageId].filter(Boolean) : (email.internetMessageId ? [email.internetMessageId] : undefined),
                    providerThreadId: email.thread?.providerThreadId
                });
                sentMessageId = result.id;
            }
            catch (sendError) {
                activeSends.delete(sendLockId);
                if (draft) {
                    await prisma_1.prisma.sentReply.create({
                        data: {
                            draftId: draft.id,
                            originalEmailId: email.id,
                            deliveryStatus: 'FAILED',
                            failureReason: sendError.message,
                            providerMessageId: 'failed'
                        }
                    });
                }
                (0, socket_1.emitToUser)(userId, 'email:send_failed', { emailId, error: sendError.message });
                throw new ApiError_1.ApiError(500, `Failed to send email: ${sendError.message}`);
            }
            console.timeEnd(`Gmail-Send-${emailId}`);
            activeSends.delete(sendLockId);
            const txns = [
                prisma_1.prisma.email.update({
                    where: { id: email.id },
                    data: { replyStatus: 'SENT' }
                })
            ];
            if (draft) {
                txns.push(prisma_1.prisma.aiDraftReply.update({
                    where: { id: draft.id },
                    data: { approvalStatus: 'APPROVED', deletedAt: new Date() }
                }), prisma_1.prisma.sentReply.create({
                    data: {
                        draftId: draft.id,
                        originalEmailId: email.id,
                        deliveryStatus: 'DELIVERED',
                        providerMessageId: sentMessageId,
                        sentAt: new Date()
                    }
                }));
            }
            txns.push(prisma_1.prisma.aiDraftReply.updateMany({
                where: {
                    emailId: email.id,
                    deletedAt: null,
                    ...(draft ? { id: { not: draft.id } } : {})
                },
                data: { deletedAt: new Date() }
            }));
            await prisma_1.prisma.$transaction(txns);
            (0, socket_1.emitToUser)(userId, 'email:sent', {
                emailId,
                messageId: sentMessageId,
                threadId: email.emailThreadId
            });
        }
        finally {
            activeSends.delete(sendLockId);
            console.timeEnd(`Send-TotalPipeline-${emailId}`);
        }
    }
    async sendCompose(userId, payload) {
        this.validateComposePayload(payload.to, payload.subject, payload.body);
        const connection = await gmailClientService.getConnection(userId);
        if (!connection)
            throw new ApiError_1.ApiError(400, 'No active Gmail connection found');
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
        (0, socket_1.emitToUser)(userId, 'email:sent', {});
        return result;
    }
}
exports.GmailSendService = GmailSendService;
