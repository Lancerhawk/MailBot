"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DraftDbService = void 0;
const prisma_1 = require("../../lib/prisma");
class DraftDbService {
    async getLatestFinalDraft(emailId, userId) {
        return prisma_1.prisma.aiDraftReply.findFirst({
            where: {
                emailId,
                userId,
                isFinal: true,
                deletedAt: null
            },
            orderBy: { createdAt: 'desc' }
        });
    }
    async markPreviousDraftsNonFinal(emailId, userId) {
        await prisma_1.prisma.aiDraftReply.updateMany({
            where: { emailId, userId, isFinal: true },
            data: { isFinal: false }
        });
    }
    async createDraft(data) {
        return prisma_1.prisma.aiDraftReply.create({
            data: {
                ...data,
                approvalStatus: 'PENDING',
            }
        });
    }
    async updateDraftEditedText(draftId, userId, editedText) {
        return prisma_1.prisma.aiDraftReply.updateMany({
            where: { id: draftId, userId },
            data: { editedText }
        });
    }
    async discardDraft(draftId, userId) {
        return prisma_1.prisma.aiDraftReply.updateMany({
            where: { id: draftId, userId },
            data: { deletedAt: new Date(), isFinal: false }
        });
    }
    async getDraftById(draftId, userId) {
        return prisma_1.prisma.aiDraftReply.findFirst({
            where: { id: draftId, userId },
            include: {
                email: {
                    select: { emailThreadId: true }
                }
            }
        });
    }
}
exports.DraftDbService = DraftDbService;
