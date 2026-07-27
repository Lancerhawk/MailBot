import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { sessionMiddleware } from '../app';

const wrap = (middleware: any) => (socket: Socket, next: any) =>
  middleware(socket.request, {}, next);

let io: SocketIOServer;

export const initSocket = (server: HttpServer) => {
  io = new SocketIOServer(server, {
    cors: {
      origin: env.FRONTEND_URL,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.use(wrap(sessionMiddleware));

  io.use((socket: Socket, next) => {
    const session = (socket.request as any).session;
    if (session && session.userId) {
      next();
    } else {
      logger.warn(`Socket connection rejected: No valid session found (${socket.id})`);
      next(new Error('Unauthorized: No active session'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const session = (socket.request as any).session;
    const authenticatedUserId = session.userId;

    logger.info(`Socket connected: ${socket.id} (user: ${authenticatedUserId})`);

    socket.join(authenticatedUserId);
    logger.info(`Socket ${socket.id} automatically joined room for authenticated user ${authenticatedUserId}`);

    socket.on('authenticate', (claimedUserId: string) => {
      if (claimedUserId && claimedUserId !== authenticatedUserId) {
        logger.warn(
          `[SECURITY WARNING] Socket ${socket.id} (user ${authenticatedUserId}) attempted to join unauthorized room '${claimedUserId}'. Ignoring claim and enforcing real session ID.`
        );
      }
      socket.join(authenticatedUserId);
      logger.info(`Socket ${socket.id} verified room membership for user ${authenticatedUserId}`);
    });

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id} (user: ${authenticatedUserId})`);
    });
  });

  return io;
};

export const getIO = (): SocketIOServer => {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
};

export const emitToUser = (userId: string, event: string, data: any) => {
  if (!io) {
    if (env.WORKER_MODE === 'remote') {
      fetch(`${env.API_SERVER_URL}/api/v1/internal/jobs/callback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': env.INTERNAL_WORKER_SECRET,
        },
        body: JSON.stringify({ userId, event, data }),
      }).catch((err: any) => {
        logger.error({ err }, `[Worker Callback Failed] Could not notify API server of event ${event} for user ${userId}`);
      });
      return;
    }
    logger.warn(`Failed to emit ${event} to ${userId}: Socket.io not initialized`);
    return;
  }
  io.to(userId).emit(event, data);
};
