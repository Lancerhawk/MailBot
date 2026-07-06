import express, { Express, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import morgan from 'morgan';

import { env } from './config/env';
import { logger } from './config/logger';
import { apiLimiter } from './middlewares/rateLimiter';
import { errorHandler } from './middlewares/error.middleware';
import { ApiError } from './utils/ApiError';
import routes from './routes/v1';

const app: Express = express();

app.set('trust proxy', 1);

if (env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(pinoHttp({ logger }));
}

app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(compression());
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
app.use(apiLimiter);
app.use('/api/v1', routes);

app.use((req: Request, res: Response, next: NextFunction) => {
  next(new ApiError(404, 'Not Found'));
});

app.use(errorHandler);

export default app;
