import express, { Express, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import pgSession from 'connect-pg-simple';
import pg from 'pg';
import morgan from 'morgan';

import { env } from './config/env';
import { apiLimiter } from './middlewares/rateLimiter';
import { errorHandler } from './middlewares/error.middleware';
import { ApiError } from './utils/ApiError';
import routes from './routes/v1';

const app: Express = express();
const PgStore = pgSession(session);
const pgPool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
});

app.set('trust proxy', 1);

if (env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('dev'));
}

app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
export const sessionMiddleware = session({
  store: new PgStore({
    pool: pgPool,
    tableName: 'session',
  }),
  secret: env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000,
    secure: env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
  },
});

app.use(sessionMiddleware);
app.use(compression());
app.use(cors({ 
  origin: env.FRONTEND_URL, 
  credentials: true,
  exposedHeaders: ['RateLimit-Reset', 'RateLimit-Limit', 'RateLimit-Remaining', 'Retry-After']
}));
app.use(apiLimiter);
app.use('/api/v1', routes);

app.use((req: Request, res: Response, next: NextFunction) => {
  next(new ApiError(404, 'Not Found'));
});

app.use(errorHandler);

export default app;
