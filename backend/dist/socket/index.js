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
        logger_1.logger.warn(`Failed to emit ${event} to ${userId}: Socket.io not initialized`);
        return;
    }
    // logger.info(`Emitting socket event '${event}' to user ${userId}`);
    io.to(userId).emit(event, data);
};
exports.emitToUser = emitToUser;
