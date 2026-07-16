import { prisma } from "../../lib/prisma";
import { Prisma, ContactRelationship } from "@prisma/client";

interface ListContactsOptions {
  page: number;
  limit: number;
  search?: string;
  sort?: string;
  filter?: string;
  relationship?: string;
  organizationId?: string;
}

interface UpdateContactData {
  displayName?: string;
  customNotes?: string;
  preferredTone?: string;
  relationship?: ContactRelationship;
  favorite?: boolean;
  pinned?: boolean;
  phoneNumber?: string;
  jobTitle?: string;
  company?: string;
  linkedinUrl?: string;
  website?: string;
  twitterUrl?: string;
  labels?: string[];
  aiSummary?: string;
  lastSummaryGeneratedAt?: Date;
}

export class ContactDbService {

  async listContacts(userId: string, options: ListContactsOptions) {
    const { page, limit, search, sort, filter, relationship, organizationId } = options;
    const skip = (page - 1) * limit;

    const userConnections = await prisma.emailAccountConnection.findMany({
      where: { userId },
      select: { emailAddress: true }
    });
    const userEmails = userConnections.map(c => c.emailAddress);

    const where: Prisma.ContactWhereInput = {
      userId,
      deletedAt: null,
      emailAddress: { notIn: userEmails },
    };

    if (filter) {
      switch (filter) {
        case "favorites":
          where.favorite = true;
          break;
        case "pinned":
          where.pinned = true;
          break;
        case "archived":
          where.deletedAt = { not: null };
          delete (where as Record<string, unknown>).deletedAt;
          where.deletedAt = { not: null };
          break;
        case "hasNotes":
          where.customNotes = { not: null };
          break;
        case "hasPhone":
          where.phoneNumber = { not: null };
          break;
        case "hasCompany":
          where.company = { not: null };
          break;
        case "recent":
          where.lastInteraction = { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) };
          break;
        case "inactive":
          where.lastInteraction = { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) };
          break;
        case "highInteraction":
          where.interactionCount = { gte: 10 };
          break;
      }
    }

    if (relationship) {
      where.relationship = relationship as ContactRelationship;
    }

    if (organizationId) {
      where.organizationId = organizationId;
    }

    if (search) {
      where.OR = [
        { displayName: { contains: search, mode: "insensitive" } },
        { emailAddress: { contains: search, mode: "insensitive" } },
        { company: { contains: search, mode: "insensitive" } },
        { customNotes: { contains: search, mode: "insensitive" } },
        { jobTitle: { contains: search, mode: "insensitive" } },
        { phoneNumber: { contains: search, mode: "insensitive" } },
        { labels: { has: search } },
        { organization: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    let orderBy: Prisma.ContactOrderByWithRelationInput;
    switch (sort) {
      case "mostContacted":
        orderBy = { interactionCount: "desc" };
        break;
      case "recentlyContacted":
        orderBy = { lastInteraction: { sort: "desc", nulls: "last" } };
        break;
      case "recentlyAdded":
        orderBy = { createdAt: "desc" };
        break;
      case "alphabetical":
        orderBy = { displayName: { sort: "asc", nulls: "last" } };
        break;
      case "oldest":
        orderBy = { createdAt: "asc" };
        break;
      default:
        orderBy = { lastInteraction: { sort: "desc", nulls: "last" } };
        break;
    }

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        orderBy: [
          { pinned: "desc" },
          orderBy,
        ],
        skip,
        take: limit,
        include: {
          organization: {
            select: { id: true, name: true, domain: true },
          },
        },
      }),
      prisma.contact.count({ where }),
    ]);

    return {
      contacts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getContactById(userId: string, contactId: string) {
    return prisma.contact.findFirst({
      where: { id: contactId, userId, deletedAt: null },
      include: {
        organization: {
          select: { id: true, name: true, domain: true, companyWebsite: true, industry: true },
        },
        mergedFrom: true,
      },
    });
  }

  async updateContact(userId: string, contactId: string, data: UpdateContactData) {
    return prisma.contact.update({
      where: { id: contactId, userId },
      data,
      include: {
        organization: {
          select: { id: true, name: true, domain: true },
        },
      },
    });
  }

  async softDeleteContact(userId: string, contactId: string) {
    return prisma.contact.update({
      where: { id: contactId, userId },
      data: { deletedAt: new Date() },
    });
  }

  async restoreContact(userId: string, contactId: string) {
    return prisma.contact.update({
      where: { id: contactId, userId },
      data: { deletedAt: null },
    });
  }

  async mergeContacts(userId: string, primaryId: string, secondaryId: string) {
    const [primary, secondary] = await Promise.all([
      prisma.contact.findFirst({ where: { id: primaryId, userId, deletedAt: null } }),
      prisma.contact.findFirst({ where: { id: secondaryId, userId, deletedAt: null } }),
    ]);

    if (!primary || !secondary) {
      throw new Error("One or both contacts not found");
    }

    const mergedLabels = [...new Set([...(primary.labels || []), ...(secondary.labels || [])])];
    const mergedNotes = [primary.customNotes, secondary.customNotes].filter(Boolean).join("\n\n---\n\n");

    await prisma.$transaction(async (tx) => {
      await tx.contact.update({
        where: { id: primaryId },
        data: {
          displayName: primary.displayName || secondary.displayName,
          avatarUrl: primary.avatarUrl || secondary.avatarUrl,
          jobTitle: primary.jobTitle || secondary.jobTitle,
          phoneNumber: primary.phoneNumber || secondary.phoneNumber,
          company: primary.company || secondary.company,
          linkedinUrl: primary.linkedinUrl || secondary.linkedinUrl,
          website: primary.website || secondary.website,
          twitterUrl: primary.twitterUrl || secondary.twitterUrl,
          preferredTone: primary.preferredTone || secondary.preferredTone,
          relationship: primary.relationship || secondary.relationship,
          organizationId: primary.organizationId || secondary.organizationId,
          customNotes: mergedNotes || null,
          labels: mergedLabels,
          interactionCount: primary.interactionCount + secondary.interactionCount,
          lastInteraction: (primary.lastInteraction && secondary.lastInteraction)
            ? (primary.lastInteraction > secondary.lastInteraction ? primary.lastInteraction : secondary.lastInteraction)
            : primary.lastInteraction || secondary.lastInteraction,
          favorite: primary.favorite || secondary.favorite,
          pinned: primary.pinned || secondary.pinned,
          aiSummary: primary.aiSummary || secondary.aiSummary,
          createdAt: primary.createdAt < secondary.createdAt ? primary.createdAt : secondary.createdAt,
        },
      });

      await tx.emailParticipant.updateMany({
        where: { contactId: secondaryId },
        data: { contactId: primaryId },
      });

      await tx.contact.update({
        where: { id: secondaryId },
        data: { deletedAt: new Date(), mergedIntoId: primaryId },
      });
    });

    return prisma.contact.findFirst({
      where: { id: primaryId, userId },
      include: {
        organization: {
          select: { id: true, name: true, domain: true },
        },
      },
    });
  }

  async getStats(userId: string) {
    const [total, favorites, pinned, recentActive, withOrg] = await Promise.all([
      prisma.contact.count({ where: { userId, deletedAt: null } }),
      prisma.contact.count({ where: { userId, deletedAt: null, favorite: true } }),
      prisma.contact.count({ where: { userId, deletedAt: null, pinned: true } }),
      prisma.contact.count({
        where: {
          userId,
          deletedAt: null,
          lastInteraction: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
      prisma.contact.count({ where: { userId, deletedAt: null, organizationId: { not: null } } }),
    ]);

    return { total, favorites, pinned, recentActive, withOrg };
  }

  async getRecentContacts(userId: string, limit = 10) {
    return prisma.contact.findMany({
      where: { userId, deletedAt: null, lastInteraction: { not: null } },
      orderBy: { lastInteraction: "desc" },
      take: limit,
      include: {
        organization: {
          select: { id: true, name: true, domain: true },
        },
      },
    });
  }

  async getTopContacts(userId: string, limit = 10) {
    return prisma.contact.findMany({
      where: { userId, deletedAt: null },
      orderBy: { interactionCount: "desc" },
      take: limit,
      include: {
        organization: {
          select: { id: true, name: true, domain: true },
        },
      },
    });
  }

  async getFavorites(userId: string) {
    return prisma.contact.findMany({
      where: { userId, deletedAt: null, favorite: true },
      orderBy: { displayName: { sort: "asc", nulls: "last" } },
      include: {
        organization: {
          select: { id: true, name: true, domain: true },
        },
      },
    });
  }

  async getPinnedContacts(userId: string) {
    return prisma.contact.findMany({
      where: { userId, deletedAt: null, pinned: true },
      orderBy: { displayName: { sort: "asc", nulls: "last" } },
      include: {
        organization: {
          select: { id: true, name: true, domain: true },
        },
      },
    });
  }

  async getContactEmails(userId: string, contactId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [emails, total] = await Promise.all([
      prisma.email.findMany({
        where: {
          userId,
          deletedAt: null,
          participants: { some: { contactId } },
        },
        orderBy: { receivedAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          subject: true,
          snippet: true,
          receivedAt: true,
          isRead: true,
          isStarred: true,
          sentiment: true,
          priority: true,
          emailThreadId: true,
          participants: {
            select: {
              emailAddress: true,
              displayName: true,
              role: true,
            },
          },
          drafts: {
            select: {
              id: true,
              generatedText: true,
              approvalStatus: true,
              createdAt: true,
            },
            take: 1,
            orderBy: { createdAt: "desc" },
          },
        },
      }),
      prisma.email.count({
        where: {
          userId,
          deletedAt: null,
          participants: { some: { contactId } },
        },
      }),
    ]);

    return {
      emails,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getContactTimeline(userId: string, contactId: string, page = 1, limit = 30) {
    const skip = (page - 1) * limit;

    const emails = await prisma.email.findMany({
      where: {
        userId,
        deletedAt: null,
        participants: { some: { contactId } },
      },
      orderBy: { receivedAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        subject: true,
        snippet: true,
        receivedAt: true,
        isRead: true,
        sentiment: true,
        emailThreadId: true,
        participants: {
          select: {
            emailAddress: true,
            displayName: true,
            role: true,
          },
        },
        drafts: {
          select: {
            id: true,
            generatedText: true,
            approvalStatus: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    const timeline: Array<{
      type: string;
      date: Date;
      data: Record<string, unknown>;
    }> = [];

    for (const email of emails) {
      const senderParticipant = email.participants.find(p => p.role === "SENDER");
      const isIncoming = senderParticipant?.emailAddress !== undefined;

      timeline.push({
        type: isIncoming ? "email_received" : "email_sent",
        date: email.receivedAt,
        data: {
          emailId: email.id,
          threadId: email.emailThreadId,
          subject: email.subject,
          snippet: email.snippet,
          sentiment: email.sentiment,
          sender: senderParticipant,
        },
      });

      if (email.drafts.length > 0) {
        const draft = email.drafts[0];
        timeline.push({
          type: "draft_generated",
          date: draft.createdAt,
          data: {
            draftId: draft.id,
            emailId: email.id,
            approvalStatus: draft.approvalStatus,
          },
        });
      }
    }

    timeline.sort((a, b) => b.date.getTime() - a.date.getTime());

    const total = await prisma.email.count({
      where: {
        userId,
        deletedAt: null,
        participants: { some: { contactId } },
      },
    });

    return {
      timeline,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getContactIntelligence(userId: string, contactId: string) {
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, userId, deletedAt: null },
    });

    if (!contact) return null;

    const participantRecords = await prisma.emailParticipant.findMany({
      where: { contactId },
      select: {
        role: true,
        email: {
          select: {
            id: true,
            receivedAt: true,
            sentAt: true,
            emailThreadId: true,
          },
        },
      },
    });

    const totalEmails = participantRecords.length;
    const incomingCount = participantRecords.filter(p => p.role === "SENDER").length;
    const outgoingCount = totalEmails - incomingCount;

    const uniqueThreadIds = new Set(participantRecords.map(p => p.email.emailThreadId));
    const conversationCount = uniqueThreadIds.size;

    const dates = participantRecords.map(p => p.email.receivedAt).filter(Boolean).sort((a, b) => a.getTime() - b.getTime());
    const firstContacted = dates[0] || null;
    const lastContacted = dates[dates.length - 1] || null;

    const weekdayCounts: Record<number, number> = {};
    const monthCounts: Record<number, number> = {};
    for (const p of participantRecords) {
      const d = p.email.receivedAt;
      if (d) {
        const day = d.getDay();
        weekdayCounts[day] = (weekdayCounts[day] || 0) + 1;
        const month = d.getMonth();
        monthCounts[month] = (monthCounts[month] || 0) + 1;
      }
    }

    const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    const mostActiveWeekday = Object.entries(weekdayCounts).sort(([, a], [, b]) => b - a)[0];
    const mostActiveMonth = Object.entries(monthCounts).sort(([, a], [, b]) => b - a)[0];

    const recencyDays = lastContacted ? (Date.now() - lastContacted.getTime()) / (1000 * 60 * 60 * 24) : 999;
    const recencyScore = Math.max(0, 100 - recencyDays * 2);
    const frequencyScore = Math.min(100, totalEmails * 5);
    const interactionScore = Math.round((recencyScore * 0.6) + (frequencyScore * 0.4));

    const draftCount = await prisma.aiDraftReply.count({
      where: {
        userId,
        email: { participants: { some: { contactId } } },
      },
    });

    return {
      totalEmails,
      incomingCount,
      outgoingCount,
      conversationCount,
      firstContacted,
      lastContacted,
      interactionScore,
      draftCount,
      mostActiveWeekday: mostActiveWeekday ? weekdays[parseInt(mostActiveWeekday[0])] : null,
      mostActiveMonth: mostActiveMonth ? months[parseInt(mostActiveMonth[0])] : null,
      weekdayDistribution: weekdayCounts,
      monthDistribution: monthCounts,
    };
  }

  async listOrganizations(userId: string, search?: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where: Prisma.OrganizationWhereInput = { userId, deletedAt: null };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { domain: { contains: search, mode: "insensitive" } },
      ];
    }

    const [organizations, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        orderBy: { name: "asc" },
        skip,
        take: limit,
        include: {
          _count: { select: { contacts: true } },
        },
      }),
      prisma.organization.count({ where }),
    ]);

    return {
      organizations,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getOrganizationById(userId: string, orgId: string) {
    const org = await prisma.organization.findFirst({
      where: { id: orgId, userId, deletedAt: null },
      include: {
        contacts: {
          where: { deletedAt: null },
          orderBy: { interactionCount: "desc" },
          take: 50,
          select: {
            id: true,
            displayName: true,
            emailAddress: true,
            avatarUrl: true,
            jobTitle: true,
            interactionCount: true,
            lastInteraction: true,
            favorite: true,
            pinned: true,
          },
        },
        _count: { select: { contacts: true } },
      },
    });

    if (!org) return null;

    const emailCount = await prisma.email.count({
      where: {
        userId,
        deletedAt: null,
        participants: {
          some: {
            contact: { organizationId: orgId },
          },
        },
      },
    });

    const lastInteraction = await prisma.contact.findFirst({
      where: { organizationId: orgId, userId, deletedAt: null, lastInteraction: { not: null } },
      orderBy: { lastInteraction: "desc" },
      select: { lastInteraction: true },
    });

    return {
      ...org,
      emailCount,
      lastInteraction: lastInteraction?.lastInteraction || null,
    };
  }

  async getContactContextByEmail(userId: string, emailAddress: string): Promise<string | null> {
    let contact = await prisma.contact.findFirst({
      where: {
        userId,
        emailAddress,
        OR: [
          { deletedAt: null },
          { mergedIntoId: { not: null } }
        ]
      },
      include: {
        organization: { select: { name: true } },
      },
    });

    if (!contact) return null;

    if (contact.deletedAt && contact.mergedIntoId) {
      const primaryContact = await prisma.contact.findFirst({
        where: { id: contact.mergedIntoId, userId, deletedAt: null },
        include: {
          organization: { select: { name: true } },
        },
      });
      if (primaryContact) {
        contact = primaryContact;
      } else {
        return null;
      }
    }

    const parts: string[] = [];
    parts.push(`Display Name:\n${contact.displayName || emailAddress}`);

    if (contact.relationship) parts.push(`Relationship:\n${contact.relationship}`);
    if (contact.preferredTone) parts.push(`Preferred AI Tone:\n${contact.preferredTone}`);
    if (contact.aiSummary) parts.push(`AI Summary:\n${contact.aiSummary}`);
    if (contact.customNotes) parts.push(`Custom Notes:\n${contact.customNotes}`);
    if (contact.labels && contact.labels.length > 0) parts.push(`Labels:\n${contact.labels.join(', ')}`);

    const company = contact.company || contact.organization?.name;
    if (company) parts.push(`Company:\n${company}`);

    const socials = [];
    if (contact.linkedinUrl) socials.push(`LinkedIn: ${contact.linkedinUrl}`);
    if (contact.twitterUrl) socials.push(`Twitter: ${contact.twitterUrl}`);
    if (contact.website) socials.push(`Website: ${contact.website}`);
    if (socials.length > 0) parts.push(`Social Links:\n${socials.join('\n')}`);

    if (parts.length === 1) return null;

    let result = "--- Contact Context ---\n";
    result += parts[0];

    for (let i = 1; i < parts.length; i++) {
      const block = "\n\n" + parts[i];
      if (result.length + block.length <= 950) {
        result += block;
      } else {
        break;
      }
    }

    return result + "\n-----------------------\n";
  }
}
