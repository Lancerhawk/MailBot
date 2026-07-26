"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.csrfProtection = exports.requireAuth = void 0;
const ApiError_1 = require("../utils/ApiError");
const prisma_1 = require("../lib/prisma");
const env_1 = require("../config/env");
const validateCsrfOrigin = (req) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        return { valid: true };
    }
    const origin = req.get('origin');
    const referer = req.get('referer');
    if (!origin && !referer) {
        return {
            valid: false,
            reason: 'CSRF Protection: Origin or Referer header is required for state-changing requests',
        };
    }
    try {
        const headerValue = (origin || referer);
        const requestOrigin = headerValue.startsWith('http')
            ? new URL(headerValue).origin
            : headerValue.replace(/\/$/, '');
        const allowedFrontend = env_1.env.FRONTEND_URL.replace(/\/$/, '');
        const allowedApi = env_1.env.API_URL.replace(/\/$/, '');
        if (env_1.env.NODE_ENV !== 'production') {
            if (requestOrigin.includes('localhost') || requestOrigin.includes('127.0.0.1')) {
                return { valid: true };
            }
        }
        if (requestOrigin === allowedFrontend || requestOrigin === allowedApi) {
            return { valid: true };
        }
        return {
            valid: false,
            reason: `CSRF Protection: Origin '${requestOrigin}' does not match allowed frontend origin`,
        };
    }
    catch {
        return { valid: false, reason: 'CSRF Protection: Malformed Origin or Referer header' };
    }
};
const requireAuth = async (req, res, next) => {
    try {
        const csrfResult = validateCsrfOrigin(req);
        if (!csrfResult.valid) {
            throw new ApiError_1.ApiError(403, csrfResult.reason || 'CSRF token missing or incorrect');
        }
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
    const csrfResult = validateCsrfOrigin(req);
    if (!csrfResult.valid) {
        return next(new ApiError_1.ApiError(403, csrfResult.reason || 'CSRF token missing or incorrect'));
    }
    next();
};
exports.csrfProtection = csrfProtection;
