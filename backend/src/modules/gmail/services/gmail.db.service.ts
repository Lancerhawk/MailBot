import { PrismaClient, SyncStatus } from "@prisma/client";

const prisma = new PrismaClient();

export class GmailDbService {
  async getConnectionStatus(userId: string) {
    return prisma.emailAccountConnection.findFirst({
      where: { userId, provider: 'GMAIL' },
      select: {
        syncStatus: true,
        lastSuccessfulSyncAt: true,
        lastSyncError: true,
      }
    });
  }

  async updateSyncStatus(userId: string, status: SyncStatus, error?: string | null) {
    await prisma.emailAccountConnection.updateMany({
      where: { userId, provider: 'GMAIL' },
      data: {
        syncStatus: status,
        lastSyncError: error,
        ...(status === 'IDLE' && !error ? { lastSuccessfulSyncAt: new Date() } : {})
      }
    });
  }

  async updateLastHistoryId(userId: string, historyId: bigint | null) {
    await prisma.emailAccountConnection.updateMany({
      where: { userId, provider: 'GMAIL' },
      data: {
        lastHistoryId: historyId
      }
    });
  }

  async listThreads(userId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;

    const threads = await prisma.emailThread.findMany({
      where: { userId },
      orderBy: { lastMessageAt: 'desc' },
      take: limit,
      skip,
      select: {
        id: true,
        subject: true,
        lastMessageAt: true,
        messageCount: true,
        emails: {
          orderBy: { providerInternalDate: 'desc' },
          take: 1,
          select: {
            id: true,
            snippet: true,
            isRead: true,
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

    const total = await prisma.emailThread.count({ where: { userId } });
    const totalEmails = await prisma.email.count({ where: { userId } });

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

  async getThread(userId: string, threadId: string) {
    return prisma.emailThread.findFirst({
      where: { id: threadId, userId },
      include: {
        emails: {
          orderBy: { providerInternalDate: 'asc' },
          include: {
            participants: true,
            attachments: true,
            labels: true
          }
        }
      }
    });
  }

  async upsertThreadAndEmails(
    userId: string,
    connectionId: string,
    parsedEmails: any[]
  ) {
    if (parsedEmails.length === 0) return;

    const threadId = parsedEmails[0].providerThreadId;
    const latestEmail = parsedEmails.reduce((latest, current) =>
      current.internalDate > latest.internalDate ? current : latest
    );

    console.time(`Prisma-Tx-${threadId}`);
    await prisma.$transaction(async (tx) => {
      // 1. Upsert Thread
      const thread = await tx.emailThread.upsert({
        where: {
          accountConnectionId_providerThreadId: {
            accountConnectionId: connectionId,
            providerThreadId: threadId
          }
        },
        update: {
          lastMessageAt: latestEmail.internalDate,
          subject: latestEmail.subject,
          messageCount: parsedEmails.length
        },
        create: {
          userId,
          accountConnectionId: connectionId,
          providerThreadId: threadId,
          lastMessageAt: latestEmail.internalDate,
          subject: latestEmail.subject,
          messageCount: parsedEmails.length
        }
      });

      for (const parsed of parsedEmails) {
        const email = await tx.email.upsert({
          where: {
            accountConnectionId_providerMessageId: {
              accountConnectionId: connectionId,
              providerMessageId: parsed.providerMessageId
            }
          },
          update: {
            providerHistoryId: parsed.historyId ? BigInt(parsed.historyId) : null,
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
          }
        });

        const existingParticipants = await tx.emailParticipant.count({ where: { emailId: email.id } });

        if (existingParticipants === 0) {
          for (const p of parsed.participants) {
            let organizationId: string | null = null;
            const emailParts = p.email.split('@');
            if (emailParts.length === 2) {
              const domain = emailParts[1].toLowerCase();
              const personalDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'aol.com', 'me.com', 'mac.com', 'live.com', 'msn.com'];
              if (!personalDomains.includes(domain)) {
                const org = await tx.organization.upsert({
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

            let contactId: string | null = null;

            const contact = await tx.contact.findUnique({
              where: { userId_emailAddress: { userId, emailAddress: p.email } }
            });

            if (contact) {
              contactId = contact.id;
              await tx.contact.update({
                where: { id: contact.id },
                data: {
                  interactionCount: { increment: 1 },
                  lastInteraction: new Date(),
                  ...(organizationId && !contact.organizationId ? { organizationId } : {})
                }
              });
            } else {
              const newContact = await tx.contact.create({
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

            await tx.emailParticipant.create({
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

        await tx.emailLabel.deleteMany({ where: { emailId: email.id } });
        if (parsed.labels && parsed.labels.length > 0) {
          await tx.emailLabel.createMany({
            data: parsed.labels.map((label: string) => ({
              emailId: email.id,
              providerLabelId: label,
              name: label,
            }))
          });
        }

        const existingAttachments = await tx.attachment.count({ where: { emailId: email.id } });
        if (existingAttachments === 0 && parsed.attachments.length > 0) {
          await tx.attachment.createMany({
            data: parsed.attachments.map((att: any) => ({
              emailId: email.id,
              filename: att.filename,
              mimeType: att.mimeType,
              sizeBytes: att.size,
            }))
          });
        }
      }

      const actualMessageCount = await tx.email.count({ where: { emailThreadId: thread.id } });
      await tx.emailThread.update({
        where: { id: thread.id },
        data: { messageCount: actualMessageCount }
      });
    }, {
      maxWait: 15000,
      timeout: 45000
    });
    console.timeEnd(`Prisma-Tx-${threadId}`);
  }
}
