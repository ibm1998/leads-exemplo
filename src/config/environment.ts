// src/config/environment.ts

import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z
  .object({
    FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional(),
    FIREBASE_DATABASE_URL: z.string().optional(),
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),

    API_PORT: z
      .string()
      .transform((val) => Number(val))
      .default("3000"),

    DATABASE_HOST: z
      .string()
      .default("localhost"),

    DATABASE_PORT: z
      .string()
      .transform((val) => Number(val))
      .default("5432"),

    DATABASE_NAME: z
      .string()
      .default("agentic_leads"),

    DATABASE_USER: z
      .string()
      .default("postgres"),

    DATABASE_PASSWORD: z
      .string()
      .default("y_VNCBbFVy!79EP"),

    REDIS_URL: z
      .string()
      .default("redis://localhost:6379"),

    OPENAI_API_KEY: z
      .string()
      .optional(),

    GOHIGHLEVEL_API_KEY: z
      .string()
      .optional(),

    TWILIO_ACCOUNT_SID: z
      .string()
      .optional(),

    TWILIO_AUTH_TOKEN: z
      .string()
      .optional(),

    LOG_LEVEL: z
      .enum(["error", "warn", "info", "debug"])
      .default("info"),

    MAX_RETRY_ATTEMPTS: z
      .string()
      .transform((val) => Number(val))
      .default("3"),

    RESPONSE_TIMEOUT_MS: z
      .string()
      .transform((val) => Number(val))
      .default("60000"),
  })
  .passthrough();

export const config = envSchema.parse(process.env);
export type Config = z.infer<typeof envSchema>;
