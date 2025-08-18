dotenv.config();
import dotenv from 'dotenv';
dotenv.config();

export const config = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT ? Number(process.env.PORT) : 3000,
  DATABASE_HOST: process.env.DATABASE_HOST || 'localhost',
  DATABASE_PORT: process.env.DATABASE_PORT ? Number(process.env.DATABASE_PORT) : 5432,
  DATABASE_NAME: process.env.DATABASE_NAME || 'agentic_leads',
  DATABASE_USER: process.env.DATABASE_USER || 'postgres',
  DATABASE_PASS: process.env.DATABASE_PASS || '',
  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379,
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  MAX_RETRY_ATTEMPTS: process.env.MAX_RETRY_ATTEMPTS ? Number(process.env.MAX_RETRY_ATTEMPTS) : 3,
  RESPONSE_TIMEOUT_MS: process.env.RESPONSE_TIMEOUT_MS ? Number(process.env.RESPONSE_TIMEOUT_MS) : 60000,
};
