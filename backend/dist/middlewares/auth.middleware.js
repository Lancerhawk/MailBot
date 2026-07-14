"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.csrfProtection = exports.requireAuth = void 0;
const ApiError_1 = require("../utils/ApiError");
const prisma_1 = require("../lib/prisma");
const requireAuth = async (req, res, next) => {
    try {
        if (!req.session || !req.session.userId) {
            throw new ApiError_1.ApiError(401, 'Unauthorized: No active session');
        }
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: req.session.userId },
        });
        if (!user || user.deletedAt) {
            req.session.destroy(() => { });
            throw new ApiError_1.ApiError(401, 'Unauthorized: Invalid session');
        }
        req.user = user;
        next();
    }
    catch (error) {
        next(error);
    }
};
exports.requireAuth = requireAuth;
const csrfProtection = (req, res, next) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        const origin = req.get('origin');
        const referer = req.get('referer');
        if (!origin && !referer) {
            return next(new ApiError_1.ApiError(403, 'CSRF token missing or incorrect'));
        }
    }
    next();
};
exports.csrfProtection = csrfProtection;
