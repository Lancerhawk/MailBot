import { prisma } from '../../../lib/prisma';
import { GmailClientService } from './gmail.client.service';
import { GmailDbService } from './gmail.db.service';
import { emitToUser } from '../../../socket';
import { ApiError } from '../../../utils/ApiError';

const gmailClientService = new GmailClientService();
const gmailDbService = new GmailDbService();

export class GmailActionsService {
  private async modifyLabels(userId: string, emailId: string, addLabelIds: string[], removeLabelIds: string[]) {
    const email = await gmailDbService.getEmailByIdWithConnection(userId, emailId);
    if (!email) throw new ApiError(404, 'Email not found');

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

  async markRead(userId: string, emailId: string) {
    const email = await this.modifyLabels(userId, emailId, [], ['UNREAD']);
    await prisma.email.update({ where: { id: emailId }, data: { isRead: true } });
    emitToUser(userId, 'email:read', { emailId, threadId: email.emailThreadId, field: 'isRead', value: true });
  }

  async markUnread(userId: string, emailId: string) {
    const email = await this.modifyLabels(userId, emailId, ['UNREAD'], []);
    await prisma.email.update({ where: { id: emailId }, data: { isRead: false } });
    emitToUser(userId, 'email:unread', { emailId, threadId: email.emailThreadId, field: 'isRead', value: false });
  }

  async star(userId: string, emailId: string) {
    const email = await this.modifyLabels(userId, emailId, ['STARRED'], []);
    await prisma.email.update({ where: { id: emailId }, data: { isStarred: true } });
    emitToUser(userId, 'email:starred', { emailId, threadId: email.emailThreadId, field: 'isStarred', value: true });
  }

  async unstar(userId: string, emailId: string) {
    const email = await this.modifyLabels(userId, emailId, [], ['STARRED']);
    await prisma.email.update({ where: { id: emailId }, data: { isStarred: false } });
    emitToUser(userId, 'email:unstarred', { emailId, threadId: email.emailThreadId, field: 'isStarred', value: false });
  }

  async archive(userId: string, emailId: string) {
    const email = await this.modifyLabels(userId, emailId, [], ['INBOX']);
    await prisma.email.update({ where: { id: emailId }, data: { isArchived: true } });
    emitToUser(userId, 'email:archived', { emailId, threadId: email.emailThreadId, field: 'isArchived', value: true });
  }

  async unarchive(userId: string, emailId: string) {
    const email = await this.modifyLabels(userId, emailId, ['INBOX'], []);
    await prisma.email.update({ where: { id: emailId }, data: { isArchived: false } });
    emitToUser(userId, 'email:unarchived', { emailId, threadId: email.emailThreadId, field: 'isArchived', value: false });
  }

  async markSpam(userId: string, emailId: string) {
    const email = await this.modifyLabels(userId, emailId, ['SPAM'], ['INBOX']);
    await prisma.email.update({ where: { id: emailId }, data: { isSpam: true } });
    emitToUser(userId, 'email:spam', { emailId, threadId: email.emailThreadId, field: 'isSpam', value: true });
  }

  async unmarkSpam(userId: string, emailId: string) {
    const email = await this.modifyLabels(userId, emailId, ['INBOX'], ['SPAM']);
    await prisma.email.update({ where: { id: emailId }, data: { isSpam: false } });
    emitToUser(userId, 'email:unspam', { emailId, threadId: email.emailThreadId, field: 'isSpam', value: false });
  }

  async deleteToTrash(userId: string, emailId: string) {
    const email = await gmailDbService.getEmailByIdWithConnection(userId, emailId);
    if (!email) throw new ApiError(404, 'Email not found');

    console.time(`Gmail-Action-Trash-${emailId}`);
    const gmail = await gmailClientService.getAuthenticatedClient(userId);

    await gmail.users.messages.trash({
      userId: 'me',
      id: email.providerMessageId
    });
    console.timeEnd(`Gmail-Action-Trash-${emailId}`);

    await prisma.email.update({ where: { id: emailId }, data: { isDeleted: true } });
    emitToUser(userId, 'email:deleted', { emailId, threadId: email.emailThreadId, field: 'isDeleted', value: true });
  }

  async restoreFromTrash(userId: string, emailId: string) {
    const email = await gmailDbService.getEmailByIdWithConnection(userId, emailId);
    if (!email) throw new ApiError(404, 'Email not found');

    console.time(`Gmail-Action-Untrash-${emailId}`);
    const gmail = await gmailClientService.getAuthenticatedClient(userId);

    await gmail.users.messages.untrash({
      userId: 'me',
      id: email.providerMessageId
    });
    console.timeEnd(`Gmail-Action-Untrash-${emailId}`);

    await prisma.email.update({ where: { id: emailId }, data: { isDeleted: false } });
    emitToUser(userId, 'email:restored', { emailId, threadId: email.emailThreadId, field: 'isDeleted', value: false });
  }

  async permanentlyDelete(userId: string, emailId: string) {
    const email = await gmailDbService.getEmailByIdWithConnection(userId, emailId);
    if (!email) throw new ApiError(404, 'Email not found');

    console.time(`Gmail-Action-Delete-${emailId}`);
    const gmail = await gmailClientService.getAuthenticatedClient(userId);

    await gmail.users.messages.delete({
      userId: 'me',
      id: email.providerMessageId
    });
    console.timeEnd(`Gmail-Action-Delete-${emailId}`);

    await prisma.email.delete({ where: { id: emailId } });
    emitToUser(userId, 'email:permanently_deleted', { emailId, threadId: email.emailThreadId });
  }

  private async getThreadWithConnection(userId: string, threadId: string) {
    const thread = await prisma.emailThread.findFirst({
      where: { id: threadId, userId },
      include: {
        connection: true,
        emails: { select: { id: true } }
      }
    });
    if (!thread) throw new ApiError(404, 'Thread not found');
    return thread;
  }

  private async modifyThreadLabels(userId: string, threadId: string, addLabelIds: string[], removeLabelIds: string[]) {
    const thread = await this.getThreadWithConnection(userId, threadId);

    const gmail = await gmailClientService.getAuthenticatedClient(userId);
    await gmail.users.threads.modify({
      userId: 'me',
      id: thread.providerThreadId,
      requestBody: { addLabelIds, removeLabelIds }
    });

    return thread;
  }

  async threadMarkRead(userId: string, threadId: string) {
    await this.modifyThreadLabels(userId, threadId, [], ['UNREAD']);
    await prisma.email.updateMany({ where: { emailThreadId: threadId, userId }, data: { isRead: true } });
    emitToUser(userId, 'thread:updated', { threadId, field: 'isRead', value: true });
  }

  async threadMarkUnread(userId: string, threadId: string) {
    await this.modifyThreadLabels(userId, threadId, ['UNREAD'], []);
    await prisma.email.updateMany({ where: { emailThreadId: threadId, userId }, data: { isRead: false } });
    emitToUser(userId, 'thread:updated', { threadId, field: 'isRead', value: false });
  }

  async threadStar(userId: string, threadId: string) {
    await this.modifyThreadLabels(userId, threadId, ['STARRED'], []);
    await prisma.email.updateMany({ where: { emailThreadId: threadId, userId }, data: { isStarred: true } });
    emitToUser(userId, 'thread:updated', { threadId, field: 'isStarred', value: true });
  }

  async threadUnstar(userId: string, threadId: string) {
    await this.modifyThreadLabels(userId, threadId, [], ['STARRED']);
    await prisma.email.updateMany({ where: { emailThreadId: threadId, userId }, data: { isStarred: false } });
    emitToUser(userId, 'thread:updated', { threadId, field: 'isStarred', value: false });
  }

  async threadArchive(userId: string, threadId: string) {
    await this.modifyThreadLabels(userId, threadId, [], ['INBOX']);
    await prisma.email.updateMany({ where: { emailThreadId: threadId, userId }, data: { isArchived: true } });
    emitToUser(userId, 'thread:updated', { threadId, field: 'isArchived', value: true });
  }

  async threadUnarchive(userId: string, threadId: string) {
    await this.modifyThreadLabels(userId, threadId, ['INBOX'], []);
    await prisma.email.updateMany({ where: { emailThreadId: threadId, userId }, data: { isArchived: false } });
    emitToUser(userId, 'thread:updated', { threadId, field: 'isArchived', value: false });
  }

  async threadMarkSpam(userId: string, threadId: string) {
    await this.modifyThreadLabels(userId, threadId, ['SPAM'], ['INBOX']);
    await prisma.email.updateMany({ where: { emailThreadId: threadId, userId }, data: { isSpam: true } });
    emitToUser(userId, 'thread:updated', { threadId, field: 'isSpam', value: true });
  }

  async threadUnmarkSpam(userId: string, threadId: string) {
    await this.modifyThreadLabels(userId, threadId, ['INBOX'], ['SPAM']);
    await prisma.email.updateMany({ where: { emailThreadId: threadId, userId }, data: { isSpam: false } });
    await prisma.email.updateMany({ where: { emailThreadId: threadId, userId, processingStatus: 'SKIPPED' }, data: { processingStatus: 'PENDING' } });
    emitToUser(userId, 'thread:updated', { threadId, field: 'isSpam', value: false });
  }

  async threadDeleteToTrash(userId: string, threadId: string) {
    const thread = await this.getThreadWithConnection(userId, threadId);

    const gmail = await gmailClientService.getAuthenticatedClient(userId);
    await gmail.users.threads.trash({ userId: 'me', id: thread.providerThreadId });

    await prisma.email.updateMany({ where: { emailThreadId: threadId, userId }, data: { isDeleted: true } });
    emitToUser(userId, 'thread:updated', { threadId, field: 'isDeleted', value: true });
  }

  async threadRestoreFromTrash(userId: string, threadId: string) {
    const thread = await this.getThreadWithConnection(userId, threadId);

    const gmail = await gmailClientService.getAuthenticatedClient(userId);
    await gmail.users.threads.untrash({ userId: 'me', id: thread.providerThreadId });

    await prisma.email.updateMany({ where: { emailThreadId: threadId, userId }, data: { isDeleted: false } });
    await prisma.email.updateMany({ where: { emailThreadId: threadId, userId, processingStatus: 'SKIPPED' }, data: { processingStatus: 'PENDING' } });
    emitToUser(userId, 'thread:updated', { threadId, field: 'isDeleted', value: false });
  }

  async threadPermanentlyDelete(userId: string, threadId: string) {
    const thread = await this.getThreadWithConnection(userId, threadId);

    const gmail = await gmailClientService.getAuthenticatedClient(userId);
    await gmail.users.threads.delete({ userId: 'me', id: thread.providerThreadId });

    await prisma.emailThread.delete({ where: { id: threadId } });
    emitToUser(userId, 'thread:permanently_deleted', { threadId });
  }
}
