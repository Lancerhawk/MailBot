"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.regenerateLimiter = exports.refreshRateLimiter = exports.authLimiter = exports.apiLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
exports.apiLimiter = (0, express_rate_limit_1.default)({
    windowMs: 1 * 60 * 1000,
    limit: 300,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: 'Too many requests from this IP, please try again after 1 minute',
    keyGenerator: (req) => {
        if (!req.ip)
            return 'unknown';
        if (req.ip.includes('.') && req.ip.includes(':')) {
            return req.ip.split(':')[0];
        }
        return req.ip;
    },
    skip: (req) => req.path.includes('/status'),
});
exports.authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: 'Too many login attempts from this IP, please try again after 15 minutes',
    keyGenerator: (req) => {
        if (!req.ip)
            return 'unknown';
        if (req.ip.includes('.') && req.ip.includes(':')) {
            return req.ip.split(':')[0];
        }
        return req.ip;
    },
});
exports.refreshRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: 'Please wait 1 minute before refreshing again.',
    keyGenerator: (req) => {
        if (!req.ip)
            return 'unknown';
        if (req.ip.includes('.') && req.ip.includes(':')) {
            return req.ip.split(':')[0];
        }
        return req.ip;
    },
    skip: (req) => req.query.refresh !== 'true',
});
exports.regenerateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 5 * 60 * 1000,
    limit: 2,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: 'Rate limit exceeded for regeneration. Please wait 5 minutes.',
    keyGenerator: (req) => {
        if (!req.ip)
            return 'unknown';
        if (req.ip.includes('.') && req.ip.includes(':')) {
            return req.ip.split(':')[0];
        }
        return req.ip;
    },
});
