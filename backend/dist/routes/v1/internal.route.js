"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const env_1 = require("../../config/env");
const logger_1 = require("../../config/logger");
const socket_1 = require("../../socket");
const router = (0, express_1.Router)();
router.post('/jobs/callback', (req, res) => {
    const secret = req.headers['x-internal-secret'];
    if (!secret || secret !== env_1.env.INTERNAL_WORKER_SECRET) {
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
