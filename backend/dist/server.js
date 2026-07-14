"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const env_1 = require("./config/env");
const logger_1 = require("./config/logger");
const prisma_1 = require("./lib/prisma");
const socket_1 = require("./socket");
let server;
const startServer = async () => {
    BigInt.prototype.toJSON = function () {
        return this.toString();
    };
    try {
        await prisma_1.prisma.$connect();
        logger_1.logger.info('Connected to PostgreSQL Database via Prisma');
        server = app_1.default.listen(env_1.env.PORT, () => {
            logger_1.logger.info(`Server is running on port ${env_1.env.PORT} in ${env_1.env.NODE_ENV} mode`);
        });
        (0, socket_1.initSocket)(server);
        const WatchRenewalService = require('./modules/gmail/services/watch-renewal.service').WatchRenewalService;
        const renewalService = new WatchRenewalService();
        renewalService.runRenewalJob().catch((e) => logger_1.logger.error({ err: e }, 'Failed initial watch renewal'));
        setInterval(() => {
            renewalService.runRenewalJob().catch((e) => logger_1.logger.error({ err: e }, 'Failed scheduled watch renewal'));
        }, 24 * 60 * 60 * 1000);
    }
    catch (error) {
        logger_1.logger.fatal({ error }, 'Failed to start server');
        process.exit(1);
    }
};
startServer();
const unexpectedErrorHandler = (error) => {
    logger_1.logger.error({ error }, 'Uncaught Exception or Unhandled Rejection');
    if (server) {
        server.close(() => {
            logger_1.logger.info('Server closed');
            process.exit(1);
        });
    }
    else {
        process.exit(1);
    }
};
process.on('uncaughtException', unexpectedErrorHandler);
process.on('unhandledRejection', unexpectedErrorHandler);
process.on('SIGTERM', () => {
    logger_1.logger.info('SIGTERM received');
    if (server) {
        server.close(() => {
            logger_1.logger.info('Server closed gracefully');
            prisma_1.prisma.$disconnect().then(() => {
                logger_1.logger.info('Prisma disconnected gracefully');
                process.exit(0);
            });
        });
    }
});
process.on('SIGINT', () => {
    logger_1.logger.info('SIGINT received');
    if (server) {
        server.close(() => {
            logger_1.logger.info('Server closed gracefully');
            prisma_1.prisma.$disconnect().then(() => {
                logger_1.logger.info('Prisma disconnected gracefully');
                process.exit(0);
            });
        });
    }
});
