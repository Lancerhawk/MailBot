import express, { Express, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';

import { env } from './config/env';
import { logger } from './config/logger';
import { apiLimiter } from './middlewares/rateLimiter';
import { errorHandler } from './middlewares/error.middleware';
import { ApiError } from './utils/ApiError';
import routes from './routes/v1';

const app: Express = express();

// Trust proxy if running behind a reverse proxy (e.g. Heroku, AWS ELB)
app.set('trust proxy', 1);

// HTTP request logger
app.use(pinoHttp({ logger }));

// Set security HTTP headers
app.use(helmet());

// Parse JSON request body
app.use(express.json());

// Parse urlencoded request body
app.use(express.urlencoded({ extended: true }));

// Parse cookies
app.use(cookieParser());

// Gzip compression
app.use(compression());

// CORS configuration
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));

// Rate limiter for all routes
app.use(apiLimiter);

// v1 API routes
app.use('/api/v1', routes);

// Handle unknown routes
app.use((req: Request, res: Response, next: NextFunction) => {
  next(new ApiError(404, 'Not Found'));
});

// Global error handler
app.use(errorHandler);

export default app;
