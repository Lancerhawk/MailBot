"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../../lib/prisma");
const catchAsync_1 = require("../../utils/catchAsync");
const ApiResponse_1 = require("../../utils/ApiResponse");
const router = (0, express_1.Router)();
router.get('/', (0, catchAsync_1.catchAsync)(async (_req, res) => {
    let isDbConnected = false;
    try {
        await prisma_1.prisma.$queryRaw `SELECT 1`;
        isDbConnected = true;
    }
    catch (_error) {
        isDbConnected = false;
    }
    const healthData = {
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        database: isDbConnected ? 'connected' : 'disconnected',
    };
    res.status(200).json(new ApiResponse_1.ApiResponse(healthData, 'Health check passed'));
}));
exports.default = router;
