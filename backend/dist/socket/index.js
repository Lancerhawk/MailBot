"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitToUser = exports.getIO = exports.initSocket = void 0;
const socket_io_1 = require("socket.io");
const env_1 = require("../config/env");
const logger_1 = require("../config/logger");
let io;
const initSocket = (server) => {
    io = new socket_io_1.Server(server, {
        cors: {
            origin: env_1.env.FRONTEND_URL,
            methods: ['GET', 'POST'],
            credentials: true,
        },
    });
    io.on('connection', (socket) => {
        logger_1.logger.info(`Socket connected: ${socket.id}`);
        socket.on('authenticate', (userId) => {
            socket.join(userId);
            logger_1.logger.info(`Socket ${socket.id} joined room for user ${userId}`);
        });
        socket.on('disconnect', () => {
            logger_1.logger.info(`Socket disconnected: ${socket.id}`);
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
