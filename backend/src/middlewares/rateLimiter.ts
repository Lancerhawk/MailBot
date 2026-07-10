import rateLimit from 'express-rate-limit';

export const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again after 1 minute',
  keyGenerator: (req) => {
    if (!req.ip) return 'unknown';
    if (req.ip.includes('.') && req.ip.includes(':')) {
      return req.ip.split(':')[0];
    }
    return req.ip;
  },
  skip: (req) => req.path.includes('/status'),
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: 'Too many login attempts from this IP, please try again after 15 minutes',
  keyGenerator: (req) => {
    if (!req.ip) return 'unknown';
    if (req.ip.includes('.') && req.ip.includes(':')) {
      return req.ip.split(':')[0];
    }
    return req.ip;
  },
});

export const refreshRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: 'Please wait 1 minute before refreshing again.',
  keyGenerator: (req) => {
    if (!req.ip) return 'unknown';
    if (req.ip.includes('.') && req.ip.includes(':')) {
      return req.ip.split(':')[0];
    }
    return req.ip;
  },
  skip: (req) => req.query.refresh !== 'true',
});
