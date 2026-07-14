"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GmailDbService = void 0;
const client_1 = require("@prisma/client");
const prisma_1 = require("../../../lib/prisma");
class GmailDbService {
    async getConnectionStatus(userId) {
        return prisma_1.prisma.emailAccountConnection.findFirst({
            where: { userId, provider: 'GMAIL' },
            select: {
                syncStatus: true,
                lastSuccessfulSyncAt: true,
                lastSyncError: true,
            }
        });
    }
    async getConnectionByEmail(emailAddress) {
        return prisma_1.prisma.emailAccountConnection.findFirst({
            where: { emailAddress, provider: 'GMAIL' }
        });
    }
    async updateSyncStatus(userId, status, error) {
        await prisma_1.prisma.emailAccountConnection.updateMany({
            where: { userId, provider: 'GMAIL' },
            data: {
                syncStatus: status,
                lastSyncError: error,
                ...(status === 'IDLE' && !error ? { lastSuccessfulSyncAt: new Date() } : {})
            }
        });
    }
    async updateLastHistoryId(userId, historyId) {
        await prisma_1.prisma.emailAccountConnection.updateMany({
            where: { userId, provider: 'GMAIL' },
            data: {
                lastHistoryId: historyId
            }
        });
    }
    async listThreads(userId, page, limit, filter, search) {
        const skip = (page - 1) * limit;
        let emailCondition = { isDeleted: false, isDraft: false };
        if (filter) {
            switch (filter) {
                case 'spam':
                    emailCondition = { isSpam: true };
                    break;
                case 'trash':
                    emailCondition = { isDeleted: true };
                    break;
                case 'unread':
                    emailCondition = { isRead: false, isDeleted: false, isSpam: false, isDraft: false };
                    break;
                case 'starred':
                    emailCondition = { isStarred: true, isDeleted: false, isSpam: false, isDraft: false };
                    break;
                case 'needsReply':
                    emailCondition = { needsReply: true, replyStatus: 'PENDING', isDeleted: false, isSpam: false, isDraft: false };
                    break;
                case 'highPriority':
                    emailCondition = { priority: { in: ['HIGH', 'URGENT'] }, isDeleted: false, isSpam: false, isDraft: false };
                    break;
                case 'hasAttachments':
                    emailCondition = { hasAttachments: true, isDeleted: false, isSpam: false, isDraft: false };
                    break;
                case 'drafts':
                    emailCondition = { drafts: { some: { isFinal: true, approvalStatus: 'PENDING', deletedAt: null } }, isDeleted: false, isSpam: false, isDraft: false };
                    break;
                case 'all':
                default:
                    emailCondition = { isDeleted: false, isSpam: false, isDraft: false };
                    break;
            }
        }
        else {
            emailCondition = { isDeleted: false, isSpam: false, isDraft: false };
        }
        const whereClause = {
            userId,
            emails: { some: emailCondition }
        };
        if (search && search.trim() !== '') {
            whereClause.OR = [
                { subject: { contains: search, mode: 'insensitive' } },
                { emails: { some: { snippet: { contains: search, mode: 'insensitive' } } } },
                { emails: { some: { participants: { some: { OR: [{ displayName: { contains: search, mode: 'insensitive' } }, { emailAddress: { contains: search, mode: 'insensitive' } }] } } } } }
            ];
        }
        const threads = await prisma_1.prisma.emailThread.findMany({
            where: whereClause,
            orderBy: { lastMessageAt: 'desc' },
            take: limit,
            skip,
            select: {
                id: true,
                subject: true,
                lastMessageAt: true,
                messageCount: true,
                emails: {
                    where: emailCondition,
                    orderBy: { providerInternalDate: 'desc' },
                    take: 1,
                    select: {
                        id: true,
                        snippet: true,
                        isRead: true,
                        isStarred: true,
                        hasAttachments: true,
                        needsReply: true,
                        priority: true,
                        sentiment: true,
                        participants: {
                            where: { role: 'SENDER' },
                            select: {
                                emailAddress: true,
                                displayName: true,
                                role: true
                            }
                        }
                    }
                }
            }
        });
        const total = await prisma_1.prisma.emailThread.count({ where: whereClause });
        const totalEmails = await prisma_1.prisma.email.count({ where: { userId, isDeleted: false, isSpam: false } });
        return {
            threads,
            pagination: {
                page,
                limit,
                total,
                totalEmails,
                totalPages: Math.ceil(total / limit)
            }
        };
    }
    async getThread(userId, threadId) {
        return prisma_1.prisma.emailThread.findFirst({
            where: { id: threadId, userId },
            include: {
                emails: {
                    where: { isDraft: false },
                    orderBy: { providerInternalDate: 'asc' },
                    include: {
                        participants: true,
                        attachments: true,
                        labels: true,
                        drafts: {
                            where: { isFinal: true, deletedAt: null },
                            orderBy: { createdAt: 'desc' },
                            take: 1
                        }
                    }
                }
            }
        });
    }
    async getThreadByProviderId(userId, providerThreadId) {
        return prisma_1.prisma.emailThread.findFirst({
            where: { providerThreadId, userId },
            include: {
                emails: {
                    orderBy: { providerInternalDate: 'asc' },
                    include: {
                        participants: true,
                        attachments: true,
                        labels: true,
                        drafts: {
                            where: { isFinal: true, deletedAt: null },
                            orderBy: { createdAt: 'desc' },
                            take: 1
                        }
                    }
                }
            }
        });
    }
    async getEmailByIdWithConnection(userId, emailId) {
        return prisma_1.prisma.email.findFirst({
            where: { id: emailId, userId },
            include: {
                connection: true,
                thread: true,
                participants: true,
                labels: true
            }
        });
    }
    async markMessagesAsDeleted(userId, accountConnectionId, messageIds) {
        if (messageIds.length === 0)
            return;
        const emailsToUpdate = await prisma_1.prisma.email.findMany({
            where: { userId, accountConnectionId, providerMessageId: { in: messageIds } },
            select: { emailThreadId: true }
        });
        await prisma_1.prisma.email.updateMany({
            where: {
                userId,
                accountConnectionId,
                providerMessageId: { in: messageIds }
            },
            data: { isDeleted: true }
        });
        const threadIds = [...new Set(emailsToUpdate.map(e => e.emailThreadId))];
        for (const tid of threadIds) {
            const actualMessageCount = await prisma_1.prisma.email.count({
                where: { emailThreadId: tid, isDeleted: false }
            });
            await prisma_1.prisma.emailThread.update({
                where: { id: tid },
                data: { messageCount: actualMessageCount }
            });
        }
    }
    async upsertThreadAndEmails(userId, connectionId, parsedEmails) {
        if (parsedEmails.length === 0)
            return;
        const user = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            return;
        // Filter out emails received before the user registered AND any native Gmail drafts
        const filteredEmails = parsedEmails.filter(e => e.internalDate.getTime() >= user.createdAt.getTime() &&
            !e.labels.includes("DRAFT"));
        if (filteredEmails.length === 0)
            return;
        const threadId = filteredEmails[0].providerThreadId;
        const latestEmail = filteredEmails.reduce((latest, current) => current.internalDate > latest.internalDate ? current : latest);
        // console.time(`Prisma-Tx-${threadId}`);
        const createdEmails = [];
        // 1. Upsert Thread
        const thread = await prisma_1.prisma.emailThread.upsert({
            where: {
                accountConnectionId_providerThreadId: {
                    accountConnectionId: connectionId,
                    providerThreadId: threadId
                }
            },
            update: {
                lastMessageAt: latestEmail.internalDate,
                subject: latestEmail.subject,
                messageCount: filteredEmails.length
            },
            create: {
                userId,
                accountConnectionId: connectionId,
                providerThreadId: threadId,
                lastMessageAt: latestEmail.internalDate,
                subject: latestEmail.subject,
                messageCount: filteredEmails.length
            }
        });
        for (const parsed of filteredEmails) {
            const existingEmail = await prisma_1.prisma.email.findUnique({
                where: {
                    accountConnectionId_providerMessageId: {
                        accountConnectionId: connectionId,
                        providerMessageId: parsed.providerMessageId
                    }
                },
                select: { isSpam: true, isDeleted: true, processingStatus: true }
            });
            const newIsSpam = parsed.labels.includes("SPAM");
            const newIsDeleted = parsed.labels.includes("TRASH");
            // If email was restored from spam or trash, and was previously skipped by AI, reset to PENDING
            let processingStatusToUpdate = undefined;
            if (existingEmail && existingEmail.processingStatus === 'SKIPPED') {
                if ((existingEmail.isSpam && !newIsSpam) || (existingEmail.isDeleted && !newIsDeleted)) {
                    processingStatusToUpdate = client_1.ProcessingStatus.PENDING;
                }
            }
            const email = await prisma_1.prisma.email.upsert({
                where: {
                    accountConnectionId_providerMessageId: {
                        accountConnectionId: connectionId,
                        providerMessageId: parsed.providerMessageId
                    }
                },
                update: {
                    providerHistoryId: parsed.historyId ? BigInt(parsed.historyId) : null,
                    isRead: !parsed.labels.includes("UNREAD"),
                    isStarred: parsed.labels.includes("STARRED"),
                    isImportant: parsed.labels.includes("IMPORTANT"),
                    isSpam: newIsSpam,
                    isArchived: !parsed.labels.includes("INBOX"),
                    isDeleted: newIsDeleted,
                    isDraft: parsed.labels.includes("DRAFT"),
                    ...(processingStatusToUpdate && { processingStatus: processingStatusToUpdate }),
                },
                create: {
                    userId,
                    accountConnectionId: connectionId,
                    emailThreadId: thread.id,
                    providerMessageId: parsed.providerMessageId,
                    internetMessageId: parsed.headers.messageId,
                    inReplyTo: parsed.headers.inReplyTo,
                    referencesHeader: parsed.headers.references,
                    subject: parsed.subject,
                    plainBody: parsed.plainBody,
                    htmlBody: parsed.htmlBody,
                    snippet: parsed.snippet,
                    providerInternalDate: parsed.internalDate,
                    receivedAt: parsed.internalDate,
                    providerHistoryId: parsed.historyId ? BigInt(parsed.historyId) : null,
                    isRead: !parsed.labels.includes("UNREAD"),
                    isStarred: parsed.labels.includes("STARRED"),
                    isImportant: parsed.labels.includes("IMPORTANT"),
                    isSpam: parsed.labels.includes("SPAM"),
                    isArchived: !parsed.labels.includes("INBOX"),
                    isDraft: parsed.labels.includes("DRAFT"),
                }
            });
            createdEmails.push(email);
            const existingParticipants = await prisma_1.prisma.emailParticipant.count({ where: { emailId: email.id } });
            if (existingParticipants === 0) {
                for (const p of parsed.participants) {
                    let organizationId = null;
                    const emailParts = p.email.split('@');
                    if (emailParts.length === 2) {
                        const domain = emailParts[1].toLowerCase();
                        const personalDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'aol.com', 'me.com', 'mac.com', 'live.com', 'msn.com'];
                        if (!personalDomains.includes(domain)) {
                            const org = await prisma_1.prisma.organization.upsert({
                                where: { userId_domain: { userId, domain } },
                                update: {},
                                create: {
                                    userId,
                                    domain,
                                    name: domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1)
                                }
                            });
                            organizationId = org.id;
                        }
                    }
                    let contactId = null;
                    const contact = await prisma_1.prisma.contact.findUnique({
                        where: { userId_emailAddress: { userId, emailAddress: p.email } }
                    });
                    if (contact) {
                        contactId = contact.id;
                        await prisma_1.prisma.contact.update({
                            where: { id: contact.id },
                            data: {
                                interactionCount: { increment: 1 },
                                lastInteraction: new Date(),
                                ...(organizationId && !contact.organizationId ? { organizationId } : {})
                            }
                        });
                    }
                    else {
                        const newContact = await prisma_1.prisma.contact.create({
                            data: {
                                userId,
                                organizationId,
                                emailAddress: p.email,
                                displayName: p.name,
                                interactionCount: 1,
                                lastInteraction: new Date()
                            }
                        });
                        contactId = newContact.id;
                    }
                    await prisma_1.prisma.emailParticipant.create({
                        data: {
                            emailId: email.id,
                            contactId,
                            emailAddress: p.email,
                            displayName: p.name,
                            role: p.role
                        }
                    });
                }
            }
            await prisma_1.prisma.emailLabel.deleteMany({ where: { emailId: email.id } });
            if (parsed.labels && parsed.labels.length > 0) {
                await prisma_1.prisma.emailLabel.createMany({
                    data: parsed.labels.map((label) => ({
                        emailId: email.id,
                        providerLabelId: label,
                        name: label,
                    }))
                });
            }
            const existingAttachments = await prisma_1.prisma.attachment.count({ where: { emailId: email.id } });
            if (existingAttachments === 0 && parsed.attachments.length > 0) {
                await prisma_1.prisma.attachment.createMany({
                    data: parsed.attachments.map((att) => ({
                        emailId: email.id,
                        filename: att.filename,
                        mimeType: att.mimeType,
                        sizeBytes: att.size,
                    }))
                });
            }
        }
        const actualMessageCount = await prisma_1.prisma.email.count({
            where: { emailThreadId: thread.id, isDeleted: false, isDraft: false }
        });
        await prisma_1.prisma.emailThread.update({
            where: { id: thread.id },
            data: { messageCount: actualMessageCount }
        });
        // console.timeEnd(`Prisma-Tx-${threadId}`);
        return createdEmails;
    }
}
exports.GmailDbService = GmailDbService;
