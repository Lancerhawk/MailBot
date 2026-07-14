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
  GEMINI_API_KEY: z.string().min(1, 'Gemini API Key is required'),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Invalid environment variables:', _env.error.format());
  process.exit(1);
}

export const env = _env.data;
