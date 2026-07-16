"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContactService = void 0;
const contact_db_service_1 = require("./contact.db.service");
const client_1 = require("@prisma/client");
const ApiError_1 = require("../../utils/ApiError");
const socket_1 = require("../../socket");
const dbService = new contact_db_service_1.ContactDbService();
class ContactService {
    async listContacts(userId, query) {
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
    async getContact(userId, contactId) {
        const contact = await dbService.getContactById(userId, contactId);
        if (!contact) {
            throw new ApiError_1.ApiError(404, "Contact not found");
        }
        const intelligence = await dbService.getContactIntelligence(userId, contactId);
        return { ...contact, intelligence };
    }
    async updateContact(userId, contactId, data) {
        const existing = await dbService.getContactById(userId, contactId);
        if (!existing) {
            throw new ApiError_1.ApiError(404, "Contact not found");
        }
        const allowed = {};
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
            const validRelationships = Object.values(client_1.ContactRelationship);
            if (!validRelationships.includes(allowed.relationship)) {
                throw new ApiError_1.ApiError(400, `Invalid relationship: ${allowed.relationship}`);
            }
        }
        const updated = await dbService.updateContact(userId, contactId, allowed);
        if (allowed.favorite !== undefined) {
            (0, socket_1.emitToUser)(userId, "contact.favorite", { contactId, favorite: allowed.favorite });
        }
        if (allowed.pinned !== undefined) {
            (0, socket_1.emitToUser)(userId, "contact.pinned", { contactId, pinned: allowed.pinned });
        }
        (0, socket_1.emitToUser)(userId, "contact.updated", { contactId, data: updated });
        return updated;
    }
    async deleteContact(userId, contactId) {
        const existing = await dbService.getContactById(userId, contactId);
        if (!existing) {
            throw new ApiError_1.ApiError(404, "Contact not found");
        }
        await dbService.softDeleteContact(userId, contactId);
        (0, socket_1.emitToUser)(userId, "contact.deleted", { contactId });
    }
    async archiveContact(userId, contactId) {
        const existing = await dbService.getContactById(userId, contactId);
        if (!existing) {
            throw new ApiError_1.ApiError(404, "Contact not found");
        }
        await dbService.softDeleteContact(userId, contactId);
        (0, socket_1.emitToUser)(userId, "contact.deleted", { contactId });
    }
    async restoreContact(userId, contactId) {
        await dbService.restoreContact(userId, contactId);
        (0, socket_1.emitToUser)(userId, "contact.updated", { contactId });
    }
    async mergeContacts(userId, primaryId, secondaryId) {
        if (primaryId === secondaryId) {
            throw new ApiError_1.ApiError(400, "Cannot merge a contact with itself");
        }
        const merged = await dbService.mergeContacts(userId, primaryId, secondaryId);
        (0, socket_1.emitToUser)(userId, "contact.merged", { primaryId, secondaryId, contact: merged });
        return merged;
    }
    async getStats(userId) {
        return dbService.getStats(userId);
    }
    async getRecentContacts(userId, limit) {
        return dbService.getRecentContacts(userId, limit);
    }
    async getTopContacts(userId, limit) {
        return dbService.getTopContacts(userId, limit);
    }
    async getFavorites(userId) {
        return dbService.getFavorites(userId);
    }
    async getPinnedContacts(userId) {
        return dbService.getPinnedContacts(userId);
    }
    async getContactEmails(userId, contactId, page, limit) {
        const existing = await dbService.getContactById(userId, contactId);
        if (!existing) {
            throw new ApiError_1.ApiError(404, "Contact not found");
        }
        return dbService.getContactEmails(userId, contactId, page, limit);
    }
    async getContactTimeline(userId, contactId, page, limit) {
        const existing = await dbService.getContactById(userId, contactId);
        if (!existing) {
            throw new ApiError_1.ApiError(404, "Contact not found");
        }
        return dbService.getContactTimeline(userId, contactId, page, limit);
    }
    async listOrganizations(userId, search, page, limit) {
        return dbService.listOrganizations(userId, search, page, limit);
    }
    async getOrganization(userId, orgId) {
        const org = await dbService.getOrganizationById(userId, orgId);
        if (!org) {
            throw new ApiError_1.ApiError(404, "Organization not found");
        }
        return org;
    }
}
exports.ContactService = ContactService;
