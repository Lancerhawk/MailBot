"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
const env_1 = require("../../config/env");
const logger_1 = require("../../config/logger");
const socket_1 = require("../../socket");
const router = (0, express_1.Router)();
router.post('/jobs/callback', (req, res) => {
    const secretHeader = req.headers['x-internal-secret'];
    const secret = Array.isArray(secretHeader) ? secretHeader[0] : secretHeader;
    const isSecretValid = () => {
        if (!secret || typeof secret !== 'string')
            return false;
        const secretBuffer = Buffer.from(secret);
        const expectedBuffer = Buffer.from(env_1.env.INTERNAL_WORKER_SECRET);
        if (secretBuffer.length !== expectedBuffer.length)
            return false;
        return crypto_1.default.timingSafeEqual(secretBuffer, expectedBuffer);
    };
    if (!isSecretValid()) {
        logger_1.logger.warn('[SECURITY WARNING] Rejected unauthorized call to /api/v1/internal/jobs/callback');
        res.status(403).json({ error: 'Forbidden: Invalid internal worker secret' });
        return;
    }
    const { userId, event, data } = req.body;
    if (!userId || !event) {
        res.status(400).json({ error: 'Missing userId or event in callback payload' });
        return;
    }
    logger_1.logger.info({ userId, event }, '[Internal Callback] Received job completion event from remote worker');
    (0, socket_1.emitToUser)(userId, event, data);
    res.status(200).json({ success: true });
});
exports.default = router;
