import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  ValidationError,
  validateData,
  validateOrThrow,
  isValidUUID,
  generateUUID,
  isValidEmail,
  isValidPhone,
  sanitizeString,
  isValidTimezone,
} from "../validation";

describe("ValidationError", () => {
  it("should create validation error with correct properties", () => {
    const error = new ValidationError(
      "Test message",
      "testField",
      "invalid_type"
    );

    expect(error.message).toBe("Test message");
    expect(error.field).toBe("testField");
    expect(error.code).toBe("invalid_type");
    expect(error.name).toBe("ValidationError");
  });

  it("should include details when provided", () => {
    const details = { extra: "info" };
    const error = new ValidationError("Test", "field", "code", details);

    expect(error.details).toEqual(details);
  });
});

describe("validateData", () => {
  const testSchema = z.object({
    name: z.string().min(1),
    age: z.number().min(0),
  });

  it("should return success result for valid data", () => {
    const result = validateData(testSchema, { name: "John", age: 25 });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ name: "John", age: 25 });
    }
  });

  it("should return error result for invalid data", () => {
    const result = validateData(testSchema, { name: "", age: -1 });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ValidationError);
      expect(result.issues).toHaveLength(2);
    }
  });

  it("should include context in error message", () => {
    const result = validateData(testSchema, { name: "" }, "Test context");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain("Test context");
    }
  });

  it("should handle schema parsing errors", () => {
    const invalidSchema = z.object({
      test: z.string().refine(() => {
        throw new Error("Schema error");
      }),
    });

    const result = validateData(invalidSchema, { test: "value" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("internal_error");
    }
  });
});

describe("validateOrThrow", () => {
  const testSchema = z.object({
    name: z.string().min(1),
  });

  it("should return data for valid input", () => {
    const result = validateOrThrow(testSchema, { name: "John" });
    expect(result).toEqual({ name: "John" });
  });

  it("should throw ValidationError for invalid input", () => {
    expect(() => {
      validateOrThrow(testSchema, { name: "" });
    }).toThrow(ValidationError);
  });
});

describe("isValidUUID", () => {
  it("should return true for valid UUIDs", () => {
    expect(isValidUUID("123e4567-e89b-12d3-a456-426614174000")).toBe(true);
    expect(isValidUUID("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
  });

  it("should return false for invalid UUIDs", () => {
    expect(isValidUUID("not-a-uuid")).toBe(false);
    expect(isValidUUID("123e4567-e89b-12d3-a456")).toBe(false);
    expect(isValidUUID("")).toBe(false);
  });
});

describe("generateUUID", () => {
  it("should generate valid UUID format", () => {
    const uuid = generateUUID();
    expect(isValidUUID(uuid)).toBe(true);
  });

  it("should generate unique UUIDs", () => {
    const uuid1 = generateUUID();
    const uuid2 = generateUUID();
    expect(uuid1).not.toBe(uuid2);
  });
});

describe("isValidEmail", () => {
  it("should return true for valid emails", () => {
    expect(isValidEmail("test@example.com")).toBe(true);
    expect(isValidEmail("user.name@domain.co.uk")).toBe(true);
    expect(isValidEmail("test+tag@example.org")).toBe(true);
  });

  it("should return false for invalid emails", () => {
    expect(isValidEmail("invalid-email")).toBe(false);
    expect(isValidEmail("@example.com")).toBe(false);
    expect(isValidEmail("test@")).toBe(false);
    expect(isValidEmail("")).toBe(false);
  });
});

describe("isValidPhone", () => {
  it("should return true for valid phone numbers", () => {
    expect(isValidPhone("+1234567890")).toBe(true);
    expect(isValidPhone("123-456-7890")).toBe(true);
    expect(isValidPhone("(123) 456-7890")).toBe(true);
    expect(isValidPhone("1234567890")).toBe(true);
  });

  it("should return false for invalid phone numbers", () => {
    expect(isValidPhone("123")).toBe(false);
    expect(isValidPhone("abc")).toBe(false);
    expect(isValidPhone("")).toBe(false);
  });
});

describe("sanitizeString", () => {
  it("should trim whitespace", () => {
    expect(sanitizeString("  hello  ")).toBe("hello");
  });

  it("should replace multiple spaces with single space", () => {
    expect(sanitizeString("hello    world")).toBe("hello world");
  });

  it("should handle mixed whitespace", () => {
    expect(sanitizeString("  hello   world  ")).toBe("hello world");
  });
});

describe("isValidTimezone", () => {
  it("should return true for valid timezones", () => {
    expect(isValidTimezone("UTC")).toBe(true);
    expect(isValidTimezone("America/New_York")).toBe(true);
    expect(isValidTimezone("Europe/London")).toBe(true);
  });

  it("should return false for invalid timezones", () => {
    expect(isValidTimezone("Invalid/Timezone")).toBe(false);
    expect(isValidTimezone("")).toBe(false);
  });
});
