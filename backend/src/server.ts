import app from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { prisma } from './lib/prisma';
import { Server } from 'http';

let server: Server;

const startServer = async () => {
  (BigInt.prototype as any).toJSON = function () {
    return this.toString();
  };

  try {
    await prisma.$connect();
    logger.info('Connected to PostgreSQL Database via Prisma');

    server = app.listen(env.PORT, () => {
      logger.info(`Server is running on port ${env.PORT} in ${env.NODE_ENV} mode`);
    });
  } catch (error) {
    logger.fatal({ error }, 'Failed to start server');
    process.exit(1);
  }
};

startServer();

const unexpectedErrorHandler = (error: Error) => {
  logger.error({ error }, 'Uncaught Exception or Unhandled Rejection');
  if (server) {
    server.close(() => {
      logger.info('Server closed');
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
};

process.on('uncaughtException', unexpectedErrorHandler);
process.on('unhandledRejection', unexpectedErrorHandler);

process.on('SIGTERM', () => {
  logger.info('SIGTERM received');
  if (server) {
    server.close(() => {
      logger.info('Server closed gracefully');
      prisma.$disconnect().then(() => {
        logger.info('Prisma disconnected gracefully');
        process.exit(0);
      });
    });
  }
});

process.on('SIGINT', () => {
  logger.info('SIGINT received');
  if (server) {
    server.close(() => {
      logger.info('Server closed gracefully');
      prisma.$disconnect().then(() => {
        logger.info('Prisma disconnected gracefully');
        process.exit(0);
      });
    });
  }
});
