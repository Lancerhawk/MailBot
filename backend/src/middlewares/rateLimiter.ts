import rateLimit from 'express-rate-limit';

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again after 15 minutes',
  keyGenerator: (req) => {
    if (!req.ip) return 'unknown';
    if (req.ip.includes('.') && req.ip.includes(':')) {
      return req.ip.split(':')[0];
    }
    return req.ip;
  },
  skip: (req) => req.path.includes('/status'),
});
