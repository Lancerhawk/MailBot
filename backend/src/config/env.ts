import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('5000'),
  DATABASE_URL: z.string().url(),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  API_URL: z.string().url().default('http://localhost:5000'),
  GOOGLE_CLIENT_ID: z.string().min(1, 'Google Client ID is required'),
  GOOGLE_CLIENT_SECRET: z.string().min(1, 'Google Client Secret is required'),
  SESSION_SECRET: z.string().min(32, 'Session secret must be at least 32 characters'),
  ENCRYPTION_KEY: z.string().length(64, 'Encryption key must be exactly 64 hex characters (32 bytes)'),
  GROQ_API_KEY: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().min(1, 'AWS Access Key ID is required'),
  AWS_SECRET_ACCESS_KEY: z.string().min(1, 'AWS Secret Access Key is required'),
  AWS_REGION: z.string().default('ap-south-1'),
  AWS_S3_BUCKET: z.string().min(1, 'AWS S3 Bucket is required'),
  OPENAI_API_KEY: z.string().optional(),
  GMAIL_WEBHOOK_AUDIENCE: z.string().optional(),
  GMAIL_WEBHOOK_SERVICE_ACCOUNT_EMAIL: z.string().optional(),
  GMAIL_WEBHOOK_SECRET: z.string().optional(),
  GMAIL_PUBSUB_TOPIC: z.string().optional(),
  GMAIL_WEBHOOK_REQUIRE_OIDC: z.string().default('true').transform((val) => val === 'true' || val === '1'),
  RATE_LIMIT_STORE: z.enum(['memory', 'redis']).default('memory'),
  REDIS_URL: z.string().default('redis://127.0.0.1:6379'),
  
  EMBEDDING_WORKERS: z.coerce.number().default(2),
  MAX_DOCUMENT_PAGES: z.coerce.number().default(500),
  MAX_DOCUMENT_SIZE_MB: z.coerce.number().default(50),
  MAX_CHUNKS_PER_DOCUMENT: z.coerce.number().default(2000),
  EMBEDDING_BATCH_SIZE: z.coerce.number().default(32),
  PROCESSING_JOB_TIMEOUT: z.coerce.number().default(600000), // 10 minutes
  MODEL_CACHE_DIRECTORY: z.string().default('.cache/models'),

  WORKER_MODE: z.enum(['local', 'remote']).default('local'),
  INTERNAL_WORKER_SECRET: z.string().default('internal-worker-secret-dev'),
  API_SERVER_URL: z.string().default('http://localhost:5000'),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Invalid environment variables:', _env.error.format());
  process.exit(1);
}

export const env = _env.data;
