import { ContactDbService } from "./contact.db.service";
import { ContactRelationship } from "@prisma/client";
import { ApiError } from "../../utils/ApiError";
import { emitToUser } from "../../socket";

const dbService = new ContactDbService();

export class ContactService {

  async listContacts(userId: string, query: Record<string, string | undefined>) {
    const page = parseInt(query.page || "1") || 1;
    const limit = Math.min(parseInt(query.limit || "50") || 50, 100);

    return dbService.listContacts(userId, {
      page,
      limit,
      search: query.search,
      sort: query.sort,
      filter: query.filter,
      relationship: query.relationship,
      organizationId: query.organizationId,
    });
  }

  async getContact(userId: string, contactId: string) {
    const contact = await dbService.getContactById(userId, contactId);
    if (!contact) {
      throw new ApiError(404, "Contact not found");
    }

    const intelligence = await dbService.getContactIntelligence(userId, contactId);

    return { ...contact, intelligence };
  }

  async updateContact(userId: string, contactId: string, data: Record<string, unknown>) {
    const existing = await dbService.getContactById(userId, contactId);
    if (!existing) {
      throw new ApiError(404, "Contact not found");
    }

    const allowed: Record<string, unknown> = {};
    const editableFields = [
      "displayName", "customNotes", "preferredTone", "relationship",
      "favorite", "pinned", "phoneNumber", "jobTitle", "company",
      "linkedinUrl", "website", "twitterUrl", "labels",
    ];

    for (const key of editableFields) {
      if (data[key] !== undefined) {
        allowed[key] = data[key];
      }
    }

    if (allowed.relationship) {
      const validRelationships = Object.values(ContactRelationship);
      if (!validRelationships.includes(allowed.relationship as ContactRelationship)) {
        throw new ApiError(400, `Invalid relationship: ${allowed.relationship}`);
      }
    }

    const updated = await dbService.updateContact(userId, contactId, allowed as Parameters<typeof dbService.updateContact>[2]);

    if (allowed.favorite !== undefined) {
      emitToUser(userId, "contact.favorite", { contactId, favorite: allowed.favorite });
    }
    if (allowed.pinned !== undefined) {
      emitToUser(userId, "contact.pinned", { contactId, pinned: allowed.pinned });
    }
    emitToUser(userId, "contact.updated", { contactId, data: updated });

    return updated;
  }

  async deleteContact(userId: string, contactId: string) {
    const existing = await dbService.getContactById(userId, contactId);
    if (!existing) {
      throw new ApiError(404, "Contact not found");
    }

    await dbService.softDeleteContact(userId, contactId);
    emitToUser(userId, "contact.deleted", { contactId });
  }

  async archiveContact(userId: string, contactId: string) {
    const existing = await dbService.getContactById(userId, contactId);
    if (!existing) {
      throw new ApiError(404, "Contact not found");
    }

    await dbService.softDeleteContact(userId, contactId);
    emitToUser(userId, "contact.deleted", { contactId });
  }

  async restoreContact(userId: string, contactId: string) {
    await dbService.restoreContact(userId, contactId);
    emitToUser(userId, "contact.updated", { contactId });
  }

  async mergeContacts(userId: string, primaryId: string, secondaryId: string) {
    if (primaryId === secondaryId) {
      throw new ApiError(400, "Cannot merge a contact with itself");
    }

    const merged = await dbService.mergeContacts(userId, primaryId, secondaryId);
    emitToUser(userId, "contact.merged", { primaryId, secondaryId, contact: merged });

    return merged;
  }

  async getStats(userId: string) {
    return dbService.getStats(userId);
  }

  async getRecentContacts(userId: string, limit?: number) {
    return dbService.getRecentContacts(userId, limit);
  }

  async getTopContacts(userId: string, limit?: number) {
    return dbService.getTopContacts(userId, limit);
  }

  async getFavorites(userId: string) {
    return dbService.getFavorites(userId);
  }

  async getPinnedContacts(userId: string) {
    return dbService.getPinnedContacts(userId);
  }

  async getContactEmails(userId: string, contactId: string, page?: number, limit?: number) {
    const existing = await dbService.getContactById(userId, contactId);
    if (!existing) {
      throw new ApiError(404, "Contact not found");
    }
    return dbService.getContactEmails(userId, contactId, page, limit);
  }

  async getContactTimeline(userId: string, contactId: string, page?: number, limit?: number) {
    const existing = await dbService.getContactById(userId, contactId);
    if (!existing) {
      throw new ApiError(404, "Contact not found");
    }
    return dbService.getContactTimeline(userId, contactId, page, limit);
  }

  async listOrganizations(userId: string, search?: string, page?: number, limit?: number) {
    return dbService.listOrganizations(userId, search, page, limit);
  }

  async getOrganization(userId: string, orgId: string) {
    const org = await dbService.getOrganizationById(userId, orgId);
    if (!org) {
      throw new ApiError(404, "Organization not found");
    }
    return org;
  }
}
