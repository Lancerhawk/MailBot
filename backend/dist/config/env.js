"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const zod_1 = require("zod");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const envSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(['development', 'production', 'test']).default('development'),
    PORT: zod_1.z.string().default('5000'),
    DATABASE_URL: zod_1.z.string().url(),
    FRONTEND_URL: zod_1.z.string().url().default('http://localhost:3000'),
    API_URL: zod_1.z.string().url().default('http://localhost:5000'),
    GOOGLE_CLIENT_ID: zod_1.z.string().min(1, 'Google Client ID is required'),
    GOOGLE_CLIENT_SECRET: zod_1.z.string().min(1, 'Google Client Secret is required'),
    SESSION_SECRET: zod_1.z.string().min(32, 'Session secret must be at least 32 characters'),
    ENCRYPTION_KEY: zod_1.z.string().length(64, 'Encryption key must be exactly 64 hex characters (32 bytes)'),
    GROQ_API_KEY: zod_1.z.string().optional(),
    AWS_ACCESS_KEY_ID: zod_1.z.string().min(1, 'AWS Access Key ID is required'),
    AWS_SECRET_ACCESS_KEY: zod_1.z.string().min(1, 'AWS Secret Access Key is required'),
    AWS_REGION: zod_1.z.string().default('ap-south-1'),
    AWS_S3_BUCKET: zod_1.z.string().min(1, 'AWS S3 Bucket is required'),
    OPENAI_API_KEY: zod_1.z.string().optional(),
    GMAIL_WEBHOOK_AUDIENCE: zod_1.z.string().optional(),
    GMAIL_WEBHOOK_SERVICE_ACCOUNT_EMAIL: zod_1.z.string().optional(),
    GMAIL_WEBHOOK_SECRET: zod_1.z.string().optional(),
    GMAIL_PUBSUB_TOPIC: zod_1.z.string().optional(),
    GMAIL_WEBHOOK_REQUIRE_OIDC: zod_1.z.string().default('true').transform((val) => val === 'true' || val === '1'),
    RATE_LIMIT_STORE: zod_1.z.enum(['memory', 'redis']).default('memory'),
    REDIS_URL: zod_1.z.string().default('redis://127.0.0.1:6379'),
    EMBEDDING_WORKERS: zod_1.z.coerce.number().default(2),
    MAX_DOCUMENT_PAGES: zod_1.z.coerce.number().default(500),
    MAX_DOCUMENT_SIZE_MB: zod_1.z.coerce.number().default(50),
    MAX_CHUNKS_PER_DOCUMENT: zod_1.z.coerce.number().default(2000),
    EMBEDDING_BATCH_SIZE: zod_1.z.coerce.number().default(32),
    PROCESSING_JOB_TIMEOUT: zod_1.z.coerce.number().default(600000), // 10 minutes
    MODEL_CACHE_DIRECTORY: zod_1.z.string().default('.cache/models'),
    WORKER_MODE: zod_1.z.enum(['local', 'remote']).default('local'),
    INTERNAL_WORKER_SECRET: zod_1.z.string().default('internal-worker-secret-dev'),
    API_SERVER_URL: zod_1.z.string().default('http://localhost:5000'),
});
const _env = envSchema.safeParse(process.env);
if (!_env.success) {
    console.error('❌ Invalid environment variables:', _env.error.format());
    process.exit(1);
}
exports.env = _env.data;
