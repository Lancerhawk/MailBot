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
    const isHealthy = isDbConnected;
    const statusCode = isHealthy ? 200 : 503;
    const statusMessage = isHealthy ? 'Health check passed' : 'Service Degraded: Database disconnected';
    const healthData = {
        status: isHealthy ? 'ok' : 'degraded',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        database: isDbConnected ? 'connected' : 'disconnected',
    };
    res.status(statusCode).json(new ApiResponse_1.ApiResponse(healthData, statusMessage));
}));
exports.default = router;
