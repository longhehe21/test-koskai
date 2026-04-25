import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(16).default('dev-secret-change-in-production'),
  SERVER_PORT: z.coerce.number().int().positive().default(3000),
  SYSTEM_SECRET: z.string().min(1, 'SYSTEM_SECRET is required for HMAC hashing'),
  K_MASTER: z.string().min(1, 'K_MASTER is required for KMS'),
  MINIO_ENDPOINT: z.string().default('localhost'),
  MINIO_PORT: z.coerce.number().int().positive().default(9000),
  MINIO_ACCESS_KEY: z.string().default(''),
  MINIO_SECRET_KEY: z.string().default(''),
  MINIO_BUCKET: z.string().default('kiosk-files'),
  MINIO_USE_SSL: z.string().default('false'),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
