"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const ApiError_1 = require("../utils/ApiError");
const env_1 = require("../config/env");
const logger_1 = require("../config/logger");
const errorHandler = (err, req, res, _next) => {
    if (res.headersSent) {
        return _next(err);
    }
    let error = err;
    if (!(error instanceof ApiError_1.ApiError)) {
        let statusCode = error.statusCode || 500;
        let message = error.message || 'Internal Server Error';
        if (error instanceof zod_1.ZodError) {
            statusCode = 400;
            message = 'Validation Error';
        }
        else if (error instanceof client_1.Prisma.PrismaClientKnownRequestError) {
            statusCode = 400;
            message = 'Database request error';
        }
        error = new ApiError_1.ApiError(statusCode, message, false, err.stack);
    }
    const response = {
        success: false,
        message: error.message,
        ...(env_1.env.NODE_ENV === 'development' && error.statusCode >= 500 && { stack: error.stack }),
        ...(err instanceof zod_1.ZodError && { errors: err.errors }),
    };
    if (error.statusCode >= 500) {
        logger_1.logger.error({ err: error, path: req.path, method: req.method }, 'Unhandled Server Error');
    }
    res.status(error.statusCode).json(response);
};
exports.errorHandler = errorHandler;
