import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError';
import { env } from '../config/env';
import { logger } from '../config/logger';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  let error = err;

  if (!(error instanceof ApiError)) {
    let statusCode = error.statusCode || 500;
    let message = error.message || 'Internal Server Error';

    if (error instanceof ZodError) {
      statusCode = 400;
      message = 'Validation Error';
    } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
      statusCode = 400;
      message = 'Database request error';
    }

    error = new ApiError(statusCode, message, false, err.stack);
  }

  const response = {
    success: false,
    message: error.message,
    ...(env.NODE_ENV === 'development' && error.statusCode >= 500 && { stack: error.stack }),
    ...(err instanceof ZodError && { errors: err.errors }),
  };

  if (env.NODE_ENV === 'development' && error.statusCode >= 500) {
    logger.error(error);
  }

  res.status(error.statusCode).json(response);
};
