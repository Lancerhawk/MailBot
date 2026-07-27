"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DraftDbService = void 0;
const prisma_1 = require("../../lib/prisma");
const ApiError_1 = require("../../utils/ApiError");
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
        const result = await prisma_1.prisma.aiDraftReply.updateMany({
            where: { id: draftId, userId },
            data: { editedText }
        });
        if (result.count === 0) {
            throw new ApiError_1.ApiError(404, 'Draft not found');
        }
        return result;
    }
    async discardDraft(draftId, userId) {
        const result = await prisma_1.prisma.aiDraftReply.updateMany({
            where: { id: draftId, userId },
            data: { deletedAt: new Date(), isFinal: false }
        });
        if (result.count === 0) {
            throw new ApiError_1.ApiError(404, 'Draft not found');
        }
        return result;
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
