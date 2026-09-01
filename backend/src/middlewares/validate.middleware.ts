import { Request, Response, NextFunction } from 'express';
import { AnyZodObject } from 'zod';
import { catchAsync } from '../utils/catchAsync';

export const validate = (schema: AnyZodObject) =>
  catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const parsed = await schema.parseAsync({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (parsed.body !== undefined) {
      req.body = parsed.body;
    }
    if (parsed.query !== undefined) {
      req.query = parsed.query;
    }
    if (parsed.params !== undefined) {
      req.params = parsed.params;
    }

    return next();
  });
