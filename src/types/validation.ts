import { z } from "zod";

/**
 * Custom validation error class for better error handling
 */
export class ValidationError extends Error {
  public readonly field: string;
  public readonly code: string;
  public readonly details: any;

  constructor(message: string, field: string, code: string, details?: any) {
    super(message);
    this.name = "ValidationError";
    this.field = field;
    this.code = code;
    this.details = details;
  }
}

/**
 * Result type for validation operations
 */
export type ValidationResult<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      error: ValidationError;
      issues: z.ZodIssue[];
    };

/**
 * Generic validation function that returns a ValidationResult
 */
export function validateData<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context?: string
): ValidationResult<T> {
  try {
    const result = schema.safeParse(data);

    if (result.success) {
      return {
        success: true,
        data: result.data,
      };
    } else {
      const firstIssue = result.error.issues[0];
      const field = firstIssue.path.join(".");
      const message = context
        ? `${context}: ${firstIssue.message}`
        : firstIssue.message;

      return {
        success: false,
        error: new ValidationError(message, field, firstIssue.code, firstIssue),
        issues: result.error.issues,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: new ValidationError(
        `Validation failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        "unknown",
        "internal_error",
        error
      ),
      issues: [],
    };
  }
}

/**
 * Validation function that throws on error (for cases where you want to fail fast)
 */
export function validateOrThrow<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context?: string
): T {
  const result = validateData(schema, data, context);

  if (!result.success) {
    throw result.error;
  }

  return result.data;
}

/**
 * Utility to check if a value is a valid UUID
 */
export const isValidUUID = (value: string): boolean => {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
};

/**
 * Utility to generate a UUID (simple implementation for testing)
 */
export const generateUUID = (): string => {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

/**
 * Utility to validate email format
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Utility to validate phone number format (basic validation)
 */
export const isValidPhone = (phone: string): boolean => {
  const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
  return phoneRegex.test(phone);
};

/**
 * Utility to sanitize string input
 */
export const sanitizeString = (input: string): string => {
  return input.trim().replace(/\s+/g, " ");
};

/**
 * Utility to validate timezone
 */
export const isValidTimezone = (timezone: string): boolean => {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
};
