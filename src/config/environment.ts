import dotenv from "dotenv";
import { z } from "zod";

// Load environment variables
dotenv.config();

// Environment schema validation
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.string().transform(Number).default("3000"),

  // Database configuration
  DATABASE_URL: z.string().default("postgresql://localhost:5432/agentic_leads"),
  DATABASE_HOST: z.string().default("localhost"),
  DATABASE_PORT: z.string().transform(Number).default("5432"),
  DATABASE_NAME: z.string().default("agentic_leads"),
  DATABASE_USER: z.string().default("postgres"),
  DATABASE_PASSWORD: z.string().default(""),

  // Redis configuration
  REDIS_URL: z.string().default("redis://localhost:6379"),
  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.string().transform(Number).default("6379"),

  // API Keys (optional for now)
  OPENAI_API_KEY: z.string().optional(),
  GOHIGHLEVEL_API_KEY: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),

  // System configuration
  LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info"),
  MAX_RETRY_ATTEMPTS: z.string().transform(Number).default("3"),
  RESPONSE_TIMEOUT_MS: z.string().transform(Number).default("60000"),
});

// Validate and export configuration
export const config = envSchema.parse(process.env);

// Type for configuration
export type Config = z.infer<typeof envSchema>;
