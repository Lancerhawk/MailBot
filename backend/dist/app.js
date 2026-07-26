"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionMiddleware = void 0;
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const compression_1 = __importDefault(require("compression"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const express_session_1 = __importDefault(require("express-session"));
const connect_pg_simple_1 = __importDefault(require("connect-pg-simple"));
const pg_1 = __importDefault(require("pg"));
const morgan_1 = __importDefault(require("morgan"));
const env_1 = require("./config/env");
const rateLimiter_1 = require("./middlewares/rateLimiter");
const error_middleware_1 = require("./middlewares/error.middleware");
const ApiError_1 = require("./utils/ApiError");
const v1_1 = __importDefault(require("./routes/v1"));
const app = (0, express_1.default)();
const PgStore = (0, connect_pg_simple_1.default)(express_session_1.default);
const pgPool = new pg_1.default.Pool({
    connectionString: env_1.env.DATABASE_URL,
    max: 10,
});
app.set('trust proxy', 1);
if (env_1.env.NODE_ENV === 'development') {
    app.use((0, morgan_1.default)('dev'));
}
else {
    app.use((0, morgan_1.default)('dev'));
}
app.use((0, helmet_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use((0, cookie_parser_1.default)());
exports.sessionMiddleware = (0, express_session_1.default)({
    store: new PgStore({
        pool: pgPool,
        tableName: 'session',
    }),
    secret: env_1.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000,
        secure: env_1.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: env_1.env.NODE_ENV === 'production' ? 'none' : 'lax',
    },
});
app.use(exports.sessionMiddleware);
app.use((0, compression_1.default)());
app.use((0, cors_1.default)({
    origin: env_1.env.FRONTEND_URL,
    credentials: true,
    exposedHeaders: ['RateLimit-Reset', 'RateLimit-Limit', 'RateLimit-Remaining', 'Retry-After']
}));
app.use(rateLimiter_1.apiLimiter);
app.use('/api/v1', v1_1.default);
app.use((req, res, next) => {
    next(new ApiError_1.ApiError(404, 'Not Found'));
});
app.use(error_middleware_1.errorHandler);
exports.default = app;
