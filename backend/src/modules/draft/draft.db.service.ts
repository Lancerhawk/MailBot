import { AiProvider } from "@prisma/client";
import { prisma } from "../../lib/prisma";


export class DraftDbService {
  async getLatestFinalDraft(emailId: string, userId: string) {
    return prisma.aiDraftReply.findFirst({
      where: {
        emailId,
        userId,
        isFinal: true,
        deletedAt: null
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async markPreviousDraftsNonFinal(emailId: string, userId: string) {
    await prisma.aiDraftReply.updateMany({
      where: { emailId, userId, isFinal: true },
      data: { isFinal: false }
    });
  }

  async createDraft(data: {
    emailId: string;
    userId: string;
    generatedText: string;
    provider: AiProvider;
    modelName: string;
    temperature: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    generationLatencyMs: number;
    confidence: number;
    isFinal: boolean;
  }) {
    return prisma.aiDraftReply.create({
      data: {
        ...data,
        approvalStatus: 'PENDING',
      }
    });
  }

  async updateDraftEditedText(draftId: string, userId: string, editedText: string) {
    return prisma.aiDraftReply.updateMany({
      where: { id: draftId, userId },
      data: { editedText }
    });
  }

  async discardDraft(draftId: string, userId: string) {
    return prisma.aiDraftReply.updateMany({
      where: { id: draftId, userId },
      data: { deletedAt: new Date(), isFinal: false }
    });
  }

  async getDraftById(draftId: string, userId: string) {
    return prisma.aiDraftReply.findFirst({
      where: { id: draftId, userId },
      include: {
        email: {
          select: { emailThreadId: true }
        }
      }
    });
  }
}
