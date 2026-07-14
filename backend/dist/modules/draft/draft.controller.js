"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DraftController = void 0;
const draft_service_1 = require("./draft.service");
const draft_db_service_1 = require("./draft.db.service");
const ApiError_1 = require("../../utils/ApiError");
const draftService = new draft_service_1.DraftService();
const draftDbService = new draft_db_service_1.DraftDbService();
class DraftController {
    async getLatestDraft(req, res, next) {
        try {
            const { emailId } = req.params;
            const userId = req.user?.id;
            if (!userId)
                throw new ApiError_1.ApiError(401, 'Unauthorized');
            const draft = await draftDbService.getLatestFinalDraft(emailId, userId);
            if (!draft) {
                return res.status(200).json({ status: 'success', data: null });
            }
            res.status(200).json({ status: 'success', data: draft });
        }
        catch (error) {
            next(error);
        }
    }
    async regenerateDraft(req, res, next) {
        try {
            const { emailId } = req.params;
            const userId = req.user?.id;
            if (!userId)
                throw new ApiError_1.ApiError(401, 'Unauthorized');
            if (draftService.isGenerating(emailId)) {
                throw new ApiError_1.ApiError(409, 'Draft generation already in progress for this email');
            }
            await draftService.generateDraft(userId, emailId, true);
            res.status(200).json({ status: 'success', message: 'Draft regenerated successfully' });
        }
        catch (error) {
            next(error);
        }
    }
    async updateDraft(req, res, next) {
        try {
            const { draftId } = req.params;
            const { editedText } = req.body;
            const userId = req.user?.id;
            if (!userId)
                throw new ApiError_1.ApiError(401, 'Unauthorized');
            if (typeof editedText !== 'string') {
                throw new ApiError_1.ApiError(400, 'editedText is required and must be a string');
            }
            await draftDbService.updateDraftEditedText(draftId, userId, editedText);
            res.status(200).json({ status: 'success', message: 'Draft updated' });
        }
        catch (error) {
            next(error);
        }
    }
    async discardDraft(req, res, next) {
        try {
            const { draftId } = req.params;
            const userId = req.user?.id;
            if (!userId)
                throw new ApiError_1.ApiError(401, 'Unauthorized');
            await draftDbService.discardDraft(draftId, userId);
            res.status(200).json({ status: 'success', message: 'Draft discarded' });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.DraftController = DraftController;
