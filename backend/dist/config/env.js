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
    GEMINI_API_KEY: zod_1.z.string().min(1, 'Gemini API Key is required'),
});
const _env = envSchema.safeParse(process.env);
if (!_env.success) {
    console.error('❌ Invalid environment variables:', _env.error.format());
    process.exit(1);
}
exports.env = _env.data;
