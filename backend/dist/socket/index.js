"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitToUser = exports.getIO = exports.initSocket = void 0;
const socket_io_1 = require("socket.io");
const env_1 = require("../config/env");
const logger_1 = require("../config/logger");
const app_1 = require("../app");
const wrap = (middleware) => (socket, next) => middleware(socket.request, {}, next);
let io;
const initSocket = (server) => {
    io = new socket_io_1.Server(server, {
        cors: {
            origin: env_1.env.FRONTEND_URL,
            methods: ['GET', 'POST'],
            credentials: true,
        },
    });
    io.use(wrap(app_1.sessionMiddleware));
    io.use((socket, next) => {
        const session = socket.request.session;
        if (session && session.userId) {
            next();
        }
        else {
            logger_1.logger.warn(`Socket connection rejected: No valid session found (${socket.id})`);
            next(new Error('Unauthorized: No active session'));
        }
    });
    io.on('connection', (socket) => {
        const session = socket.request.session;
        const authenticatedUserId = session.userId;
        logger_1.logger.info(`Socket connected: ${socket.id} (user: ${authenticatedUserId})`);
        socket.join(authenticatedUserId);
        logger_1.logger.info(`Socket ${socket.id} automatically joined room for authenticated user ${authenticatedUserId}`);
        socket.on('authenticate', (claimedUserId) => {
            if (claimedUserId && claimedUserId !== authenticatedUserId) {
                logger_1.logger.warn(`[SECURITY WARNING] Socket ${socket.id} (user ${authenticatedUserId}) attempted to join unauthorized room '${claimedUserId}'. Ignoring claim and enforcing real session ID.`);
            }
            socket.join(authenticatedUserId);
            logger_1.logger.info(`Socket ${socket.id} verified room membership for user ${authenticatedUserId}`);
        });
        socket.on('disconnect', () => {
            logger_1.logger.info(`Socket disconnected: ${socket.id} (user: ${authenticatedUserId})`);
        });
    });
    return io;
};
exports.initSocket = initSocket;
const getIO = () => {
    if (!io) {
        throw new Error('Socket.io not initialized!');
    }
    return io;
};
exports.getIO = getIO;
const emitToUser = (userId, event, data) => {
    if (!io) {
        if (env_1.env.WORKER_MODE === 'remote') {
            fetch(`${env_1.env.API_SERVER_URL}/api/v1/internal/jobs/callback`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-internal-secret': env_1.env.INTERNAL_WORKER_SECRET,
                },
                body: JSON.stringify({ userId, event, data }),
            }).catch((err) => {
                logger_1.logger.error({ err }, `[Worker Callback Failed] Could not notify API server of event ${event} for user ${userId}`);
            });
            return;
        }
        logger_1.logger.warn(`Failed to emit ${event} to ${userId}: Socket.io not initialized`);
        return;
    }
    io.to(userId).emit(event, data);
};
exports.emitToUser = emitToUser;
