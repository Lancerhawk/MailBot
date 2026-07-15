"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logout = exports.getCurrentUser = exports.googleCallback = exports.googleAuth = void 0;
const catchAsync_1 = require("../utils/catchAsync");
const auth_service_1 = require("../services/auth.service");
const env_1 = require("../config/env");
const ApiError_1 = require("../utils/ApiError");
const watch_renewal_service_1 = require("../modules/gmail/services/watch-renewal.service");
exports.googleAuth = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const state = auth_service_1.AuthService.generateState();
    req.session.oauthState = state;
    await new Promise((resolve, reject) => {
        req.session.save((err) => {
            if (err) {
                console.error("Session save error:", err);
                return reject(new ApiError_1.ApiError(500, 'Failed to save session state'));
            }
            resolve();
        });
    });
    const url = auth_service_1.AuthService.generateAuthUrl(state);
    res.redirect(url);
});
exports.googleCallback = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const { code, state, error } = req.query;
    if (error) {
        return res.redirect(`${env_1.env.FRONTEND_URL}/?error=oauth_denied`);
    }
    if (!code || typeof code !== 'string') {
        return res.redirect(`${env_1.env.FRONTEND_URL}/?error=missing_code`);
    }
    if (!state || state !== req.session.oauthState) {
        return res.redirect(`${env_1.env.FRONTEND_URL}/?error=invalid_state`);
    }
    req.session.oauthState = undefined;
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.get('user-agent');
    try {
        const user = await auth_service_1.AuthService.handleGoogleCallback(code, ipAddress, userAgent);
        req.session.userId = user.id;
        await new Promise((resolve, reject) => {
            req.session.save((err) => {
                if (err) {
                    console.error("Session save error in callback:", err);
                    return reject(new ApiError_1.ApiError(500, 'Failed to save authenticated session'));
                }
                resolve();
            });
        });
        const watchService = new watch_renewal_service_1.WatchRenewalService();
        watchService.registerWatch(user.id).catch((err) => console.error("Watch registration error:", err));
        res.redirect(`${env_1.env.FRONTEND_URL}/auth/callback?success=true`);
    }
    catch (err) {
        console.error('Callback handling error:', err);
        res.redirect(`${env_1.env.FRONTEND_URL}/?error=auth_failed`);
    }
});
const prisma_1 = require("../lib/prisma");
exports.getCurrentUser = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const userWithConnections = await prisma_1.prisma.user.findUnique({
        where: { id: req.user.id },
        include: { connections: true }
    });
    const connection = userWithConnections?.connections[0];
    const hasGmailAccess = connection ? connection.scope.includes('gmail.modify') : false;
    res.status(200).json({
        status: 'success',
        data: {
            user: {
                ...req.user,
                hasGmailAccess,
            },
        }
    });
});
exports.logout = (0, catchAsync_1.catchAsync)(async (req, res) => {
    if (req.session.userId) {
        const ipAddress = req.ip || req.socket.remoteAddress;
        const userAgent = req.get('user-agent');
        await auth_service_1.AuthService.logLogout(req.session.userId, ipAddress, userAgent);
    }
    await new Promise((resolve, reject) => {
        req.session.destroy((err) => {
            if (err) {
                console.error("Session destroy error:", err);
                return reject(new ApiError_1.ApiError(500, 'Failed to destroy session'));
            }
            resolve();
        });
    });
    res.clearCookie('connect.sid');
    res.status(200).json({ status: 'success', message: 'Logged out successfully' });
});
