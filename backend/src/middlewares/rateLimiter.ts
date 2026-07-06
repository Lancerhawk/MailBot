import rateLimit from 'express-rate-limit';

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again after 15 minutes',
  skip: (req) => req.path.includes('/status'),
});
