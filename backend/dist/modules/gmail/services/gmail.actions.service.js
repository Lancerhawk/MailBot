"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GmailActionsService = void 0;
const prisma_1 = require("../../../lib/prisma");
const gmail_client_service_1 = require("./gmail.client.service");
const gmail_db_service_1 = require("./gmail.db.service");
const socket_1 = require("../../../socket");
const ApiError_1 = require("../../../utils/ApiError");
const gmailClientService = new gmail_client_service_1.GmailClientService();
const gmailDbService = new gmail_db_service_1.GmailDbService();
class GmailActionsService {
    async modifyLabels(userId, emailId, addLabelIds, removeLabelIds) {
        const email = await gmailDbService.getEmailByIdWithConnection(userId, emailId);
        if (!email)
            throw new ApiError_1.ApiError(404, 'Email not found');
        console.time(`Gmail-Action-Modify-${emailId}`);
        const gmail = await gmailClientService.getAuthenticatedClient(userId);
        await gmail.users.messages.modify({
            userId: 'me',
            id: email.providerMessageId,
            requestBody: {
                addLabelIds,
                removeLabelIds
            }
        });
        console.timeEnd(`Gmail-Action-Modify-${emailId}`);
        return email;
    }
    async markRead(userId, emailId) {
        const email = await this.modifyLabels(userId, emailId, [], ['UNREAD']);
        await prisma_1.prisma.email.update({ where: { id: emailId }, data: { isRead: true } });
        (0, socket_1.emitToUser)(userId, 'email:read', { emailId, threadId: email.emailThreadId, field: 'isRead', value: true });
    }
    async markUnread(userId, emailId) {
        const email = await this.modifyLabels(userId, emailId, ['UNREAD'], []);
        await prisma_1.prisma.email.update({ where: { id: emailId }, data: { isRead: false } });
        (0, socket_1.emitToUser)(userId, 'email:unread', { emailId, threadId: email.emailThreadId, field: 'isRead', value: false });
    }
    async star(userId, emailId) {
        const email = await this.modifyLabels(userId, emailId, ['STARRED'], []);
        await prisma_1.prisma.email.update({ where: { id: emailId }, data: { isStarred: true } });
        (0, socket_1.emitToUser)(userId, 'email:starred', { emailId, threadId: email.emailThreadId, field: 'isStarred', value: true });
    }
    async unstar(userId, emailId) {
        const email = await this.modifyLabels(userId, emailId, [], ['STARRED']);
        await prisma_1.prisma.email.update({ where: { id: emailId }, data: { isStarred: false } });
        (0, socket_1.emitToUser)(userId, 'email:unstarred', { emailId, threadId: email.emailThreadId, field: 'isStarred', value: false });
    }
    async archive(userId, emailId) {
        const email = await this.modifyLabels(userId, emailId, [], ['INBOX']);
        await prisma_1.prisma.email.update({ where: { id: emailId }, data: { isArchived: true } });
        (0, socket_1.emitToUser)(userId, 'email:archived', { emailId, threadId: email.emailThreadId, field: 'isArchived', value: true });
    }
    async unarchive(userId, emailId) {
        const email = await this.modifyLabels(userId, emailId, ['INBOX'], []);
        await prisma_1.prisma.email.update({ where: { id: emailId }, data: { isArchived: false } });
        (0, socket_1.emitToUser)(userId, 'email:unarchived', { emailId, threadId: email.emailThreadId, field: 'isArchived', value: false });
    }
    async markSpam(userId, emailId) {
        const email = await this.modifyLabels(userId, emailId, ['SPAM'], ['INBOX']);
        await prisma_1.prisma.email.update({ where: { id: emailId }, data: { isSpam: true } });
        (0, socket_1.emitToUser)(userId, 'email:spam', { emailId, threadId: email.emailThreadId, field: 'isSpam', value: true });
    }
    async unmarkSpam(userId, emailId) {
        const email = await this.modifyLabels(userId, emailId, ['INBOX'], ['SPAM']);
        await prisma_1.prisma.email.update({ where: { id: emailId }, data: { isSpam: false } });
        (0, socket_1.emitToUser)(userId, 'email:unspam', { emailId, threadId: email.emailThreadId, field: 'isSpam', value: false });
    }
    async deleteToTrash(userId, emailId) {
        const email = await gmailDbService.getEmailByIdWithConnection(userId, emailId);
        if (!email)
            throw new ApiError_1.ApiError(404, 'Email not found');
        console.time(`Gmail-Action-Trash-${emailId}`);
        const gmail = await gmailClientService.getAuthenticatedClient(userId);
        await gmail.users.messages.trash({
            userId: 'me',
            id: email.providerMessageId
        });
        console.timeEnd(`Gmail-Action-Trash-${emailId}`);
        await prisma_1.prisma.email.update({ where: { id: emailId }, data: { isDeleted: true } });
        (0, socket_1.emitToUser)(userId, 'email:deleted', { emailId, threadId: email.emailThreadId, field: 'isDeleted', value: true });
    }
    async restoreFromTrash(userId, emailId) {
        const email = await gmailDbService.getEmailByIdWithConnection(userId, emailId);
        if (!email)
            throw new ApiError_1.ApiError(404, 'Email not found');
        console.time(`Gmail-Action-Untrash-${emailId}`);
        const gmail = await gmailClientService.getAuthenticatedClient(userId);
        await gmail.users.messages.untrash({
            userId: 'me',
            id: email.providerMessageId
        });
        console.timeEnd(`Gmail-Action-Untrash-${emailId}`);
        await prisma_1.prisma.email.update({ where: { id: emailId }, data: { isDeleted: false } });
        (0, socket_1.emitToUser)(userId, 'email:restored', { emailId, threadId: email.emailThreadId, field: 'isDeleted', value: false });
    }
    async permanentlyDelete(userId, emailId) {
        const email = await gmailDbService.getEmailByIdWithConnection(userId, emailId);
        if (!email)
            throw new ApiError_1.ApiError(404, 'Email not found');
        console.time(`Gmail-Action-Delete-${emailId}`);
        const gmail = await gmailClientService.getAuthenticatedClient(userId);
        await gmail.users.messages.delete({
            userId: 'me',
            id: email.providerMessageId
        });
        console.timeEnd(`Gmail-Action-Delete-${emailId}`);
        await prisma_1.prisma.email.delete({ where: { id: emailId } });
        (0, socket_1.emitToUser)(userId, 'email:permanently_deleted', { emailId, threadId: email.emailThreadId });
    }
    async getThreadWithConnection(userId, threadId) {
        const thread = await prisma_1.prisma.emailThread.findFirst({
            where: { id: threadId, userId },
            include: {
                connection: true,
                emails: { select: { id: true } }
            }
        });
        if (!thread)
            throw new ApiError_1.ApiError(404, 'Thread not found');
        return thread;
    }
    async modifyThreadLabels(userId, threadId, addLabelIds, removeLabelIds) {
        const thread = await this.getThreadWithConnection(userId, threadId);
        const gmail = await gmailClientService.getAuthenticatedClient(userId);
        await gmail.users.threads.modify({
            userId: 'me',
            id: thread.providerThreadId,
            requestBody: { addLabelIds, removeLabelIds }
        });
        return thread;
    }
    async threadMarkRead(userId, threadId) {
        const thread = await this.modifyThreadLabels(userId, threadId, [], ['UNREAD']);
        await prisma_1.prisma.email.updateMany({ where: { emailThreadId: threadId, userId }, data: { isRead: true } });
        (0, socket_1.emitToUser)(userId, 'thread:updated', { threadId, field: 'isRead', value: true });
    }
    async threadMarkUnread(userId, threadId) {
        const thread = await this.modifyThreadLabels(userId, threadId, ['UNREAD'], []);
        await prisma_1.prisma.email.updateMany({ where: { emailThreadId: threadId, userId }, data: { isRead: false } });
        (0, socket_1.emitToUser)(userId, 'thread:updated', { threadId, field: 'isRead', value: false });
    }
    async threadStar(userId, threadId) {
        const thread = await this.modifyThreadLabels(userId, threadId, ['STARRED'], []);
        await prisma_1.prisma.email.updateMany({ where: { emailThreadId: threadId, userId }, data: { isStarred: true } });
        (0, socket_1.emitToUser)(userId, 'thread:updated', { threadId, field: 'isStarred', value: true });
    }
    async threadUnstar(userId, threadId) {
        const thread = await this.modifyThreadLabels(userId, threadId, [], ['STARRED']);
        await prisma_1.prisma.email.updateMany({ where: { emailThreadId: threadId, userId }, data: { isStarred: false } });
        (0, socket_1.emitToUser)(userId, 'thread:updated', { threadId, field: 'isStarred', value: false });
    }
    async threadArchive(userId, threadId) {
        const thread = await this.modifyThreadLabels(userId, threadId, [], ['INBOX']);
        await prisma_1.prisma.email.updateMany({ where: { emailThreadId: threadId, userId }, data: { isArchived: true } });
        (0, socket_1.emitToUser)(userId, 'thread:updated', { threadId, field: 'isArchived', value: true });
    }
    async threadUnarchive(userId, threadId) {
        const thread = await this.modifyThreadLabels(userId, threadId, ['INBOX'], []);
        await prisma_1.prisma.email.updateMany({ where: { emailThreadId: threadId, userId }, data: { isArchived: false } });
        (0, socket_1.emitToUser)(userId, 'thread:updated', { threadId, field: 'isArchived', value: false });
    }
    async threadMarkSpam(userId, threadId) {
        const thread = await this.modifyThreadLabels(userId, threadId, ['SPAM'], ['INBOX']);
        await prisma_1.prisma.email.updateMany({ where: { emailThreadId: threadId, userId }, data: { isSpam: true } });
        (0, socket_1.emitToUser)(userId, 'thread:updated', { threadId, field: 'isSpam', value: true });
    }
    async threadUnmarkSpam(userId, threadId) {
        const thread = await this.modifyThreadLabels(userId, threadId, ['INBOX'], ['SPAM']);
        await prisma_1.prisma.email.updateMany({ where: { emailThreadId: threadId, userId }, data: { isSpam: false } });
        await prisma_1.prisma.email.updateMany({ where: { emailThreadId: threadId, userId, processingStatus: 'SKIPPED' }, data: { processingStatus: 'PENDING' } });
        (0, socket_1.emitToUser)(userId, 'thread:updated', { threadId, field: 'isSpam', value: false });
    }
    async threadDeleteToTrash(userId, threadId) {
        const thread = await this.getThreadWithConnection(userId, threadId);
        const gmail = await gmailClientService.getAuthenticatedClient(userId);
        await gmail.users.threads.trash({ userId: 'me', id: thread.providerThreadId });
        await prisma_1.prisma.email.updateMany({ where: { emailThreadId: threadId, userId }, data: { isDeleted: true } });
        (0, socket_1.emitToUser)(userId, 'thread:updated', { threadId, field: 'isDeleted', value: true });
    }
    async threadRestoreFromTrash(userId, threadId) {
        const thread = await this.getThreadWithConnection(userId, threadId);
        const gmail = await gmailClientService.getAuthenticatedClient(userId);
        await gmail.users.threads.untrash({ userId: 'me', id: thread.providerThreadId });
        await prisma_1.prisma.email.updateMany({ where: { emailThreadId: threadId, userId }, data: { isDeleted: false } });
        await prisma_1.prisma.email.updateMany({ where: { emailThreadId: threadId, userId, processingStatus: 'SKIPPED' }, data: { processingStatus: 'PENDING' } });
        (0, socket_1.emitToUser)(userId, 'thread:updated', { threadId, field: 'isDeleted', value: false });
    }
    async threadPermanentlyDelete(userId, threadId) {
        const thread = await this.getThreadWithConnection(userId, threadId);
        const gmail = await gmailClientService.getAuthenticatedClient(userId);
        await gmail.users.threads.delete({ userId: 'me', id: thread.providerThreadId });
        await prisma_1.prisma.emailThread.delete({ where: { id: threadId } });
        (0, socket_1.emitToUser)(userId, 'thread:permanently_deleted', { threadId });
    }
}
exports.GmailActionsService = GmailActionsService;
