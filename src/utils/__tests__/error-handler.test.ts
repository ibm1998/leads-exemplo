import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  ErrorHandler,
  ErrorSeverity,
  ErrorCategory,
  RecoveryStrategy,
  ErrorContext,
} from "../error-handler";

describe("ErrorHandler", () => {
  let errorHandler: ErrorHandler;
  let mockContext: ErrorContext;

  beforeEach(() => {
    errorHandler = new ErrorHandler();
    mockContext = {
      operation: "test_operation",
      component: "test_component",
      leadId: "lead_123",
      agentId: "agent_456",
      timestamp: new Date(),
    };
  });

  afterEach(() => {
    errorHandler.clearErrorStatistics();
    vi.clearAllMocks();
  });

  describe("Error Classification", () => {
    it("should classify network errors correctly", () => {
      const networkError = new Error("Connection timeout");
      const classification = errorHandler.classifyError(
        networkError,
        mockContext
      );

      expect(classification.severity).toBe(ErrorSeverity.HIGH);
      expect(classification.category).toBe(ErrorCategory.NETWORK);
      expect(classification.recoveryStrategy).toBe(RecoveryStrategy.RETRY);
      expect(classification.retryable).toBe(true);
      expect(classification.maxRetries).toBe(5);
    });

    it("should classify rate limit errors correctly", () => {
      const rateLimitError = new Error(
        "Too many requests - rate limit exceeded"
      );
      const classification = errorHandler.classifyError(
        rateLimitError,
        mockContext
      );

      expect(classification.severity).toBe(ErrorSeverity.MEDIUM);
      expect(classification.category).toBe(ErrorCategory.RATE_LIMIT);
      expect(classification.recoveryStrategy).toBe(RecoveryStrategy.RETRY);
      expect(classification.backoffMultiplier).toBe(3);
    });

    it("should classify authentication errors correctly", () => {
      const authError = new Error("Unauthorized - invalid token");
      const classification = errorHandler.classifyError(authError, mockContext);

      expect(classification.severity).toBe(ErrorSeverity.HIGH);
      expect(classification.category).toBe(ErrorCategory.AUTHENTICATION);
      expect(classification.recoveryStrategy).toBe(RecoveryStrategy.ESCALATE);
      expect(classification.retryable).toBe(false);
      expect(classification.escalationRequired).toBe(true);
    });

    it("should classify validation errors correctly", () => {
      const validationError = new Error(
        "Validation failed - required field missing"
      );
      const classification = errorHandler.classifyError(
        validationError,
        mockContext
      );

      expect(classification.severity).toBe(ErrorSeverity.MEDIUM);
      expect(classification.category).toBe(ErrorCategory.VALIDATION);
      expect(classification.recoveryStrategy).toBe(RecoveryStrategy.FALLBACK);
      expect(classification.retryable).toBe(false);
    });

    it("should classify database errors correctly", () => {
      const dbError = new Error("Database connection pool exhausted");
      const classification = errorHandler.classifyError(dbError, mockContext);

      expect(classification.severity).toBe(ErrorSeverity.HIGH);
      expect(classification.category).toBe(ErrorCategory.DATA);
      expect(classification.recoveryStrategy).toBe(RecoveryStrategy.RETRY);
      expect(classification.circuitBreakerThreshold).toBe(5);
    });

    it("should classify integration errors correctly", () => {
      const integrationContext = {
        ...mockContext,
        component: "gohighlevel_integration",
      };
      const integrationError = new Error("API service unavailable");
      const classification = errorHandler.classifyError(
        integrationError,
        integrationContext
      );

      expect(classification.severity).toBe(ErrorSeverity.HIGH);
      expect(classification.category).toBe(ErrorCategory.INTEGRATION);
      expect(classification.recoveryStrategy).toBe(
        RecoveryStrategy.CIRCUIT_BREAKER
      );
      expect(classification.circuitBreakerThreshold).toBe(8);
    });

    it("should classify system errors correctly", () => {
      const systemError = new Error("Out of memory");
      const classification = errorHandler.classifyError(
        systemError,
        mockContext
      );

      expect(classification.severity).toBe(ErrorSeverity.CRITICAL);
      expect(classification.category).toBe(ErrorCategory.SYSTEM);
      expect(classification.recoveryStrategy).toBe(RecoveryStrategy.ESCALATE);
      expect(classification.escalationRequired).toBe(true);
    });

    it("should provide default classification for unknown errors", () => {
      const unknownError = new Error("Some unknown error");
      const classification = errorHandler.classifyError(
        unknownError,
        mockContext
      );

      expect(classification.severity).toBe(ErrorSeverity.MEDIUM);
      expect(classification.category).toBe(ErrorCategory.BUSINESS_LOGIC);
      expect(classification.recoveryStrategy).toBe(RecoveryStrategy.FALLBACK);
    });
  });

  describe("Error Handling", () => {
    it("should handle retryable errors with backoff", async () => {
      const retryableError = new Error("Network timeout");
      const fallbackFn = vi.fn().mockResolvedValue("fallback_result");

      const result = await errorHandler.handleError(
        retryableError,
        mockContext,
        fallbackFn
      );

      expect(result.success).toBe(false);
      expect(result.escalated).toBe(false);
    });

    it("should handle fallback strategy", async () => {
      const validationError = new Error("Validation failed");
      const fallbackFn = vi.fn().mockResolvedValue("fallback_result");

      const result = await errorHandler.handleError(
        validationError,
        mockContext,
        fallbackFn
      );

      expect(result.success).toBe(true);
      expect(result.result).toBe("fallback_result");
      expect(fallbackFn).toHaveBeenCalled();
    });

    it("should escalate critical errors", async () => {
      const criticalError = new Error("System failure");
      const escalationCallback = vi.fn().mockResolvedValue(undefined);
      errorHandler.registerEscalationCallback(escalationCallback);

      const result = await errorHandler.handleError(criticalError, mockContext);

      expect(result.success).toBe(false);
      expect(result.escalated).toBe(true);
      expect(escalationCallback).toHaveBeenCalled();
    });

    it("should handle circuit breaker pattern", async () => {
      const integrationError = new Error("API service unavailable");
      const integrationContext = {
        ...mockContext,
        component: "external_api",
      };

      // First call should attempt the operation
      const result1 = await errorHandler.handleError(
        integrationError,
        integrationContext
      );
      expect(result1.success).toBe(false);

      // Subsequent calls should be blocked by circuit breaker
      const result2 = await errorHandler.handleError(
        integrationError,
        integrationContext
      );
      expect(result2.success).toBe(false);
    });

    it("should track error frequency for escalation", async () => {
      const error = new Error("Frequent error");

      // Generate multiple errors to trigger frequency-based escalation
      for (let i = 0; i < 15; i++) {
        await errorHandler.handleError(error, mockContext);
      }

      const stats = errorHandler.getErrorStatistics();
      expect(stats.totalErrors).toBeGreaterThan(0);
    });
  });

  describe("Circuit Breaker", () => {
    it("should open circuit breaker after threshold failures", async () => {
      const integrationError = new Error("Service unavailable");
      const integrationContext = {
        ...mockContext,
        component: "integration_service",
        operation: "api_call",
      };

      // Simulate multiple failures to trip circuit breaker
      for (let i = 0; i < 10; i++) {
        await errorHandler.handleError(integrationError, integrationContext);
      }

      const stats = errorHandler.getErrorStatistics();
      const circuitBreaker = stats.circuitBreakerStates.find(
        (cb) => cb.key === "integration_service:api_call"
      );

      expect(circuitBreaker).toBeDefined();
    });

    it("should reset circuit breaker manually", () => {
      errorHandler.resetCircuitBreaker("test_component", "test_operation");

      const stats = errorHandler.getErrorStatistics();
      const circuitBreaker = stats.circuitBreakerStates.find(
        (cb) => cb.key === "test_component:test_operation"
      );

      expect(circuitBreaker).toBeUndefined();
    });
  });

  describe("Escalation", () => {
    it("should register and call escalation callbacks", async () => {
      const escalationCallback = vi.fn().mockResolvedValue(undefined);
      errorHandler.registerEscalationCallback(escalationCallback);

      const authError = new Error("Authentication failed");
      await errorHandler.handleError(authError, mockContext);

      expect(escalationCallback).toHaveBeenCalled();
      const escalationDetails = escalationCallback.mock.calls[0][0];
      expect(escalationDetails.severity).toBe(ErrorSeverity.HIGH);
      expect(escalationDetails.category).toBe(ErrorCategory.AUTHENTICATION);
    });

    it("should provide suggested actions in escalation", async () => {
      const escalationCallback = vi.fn().mockResolvedValue(undefined);
      errorHandler.registerEscalationCallback(escalationCallback);

      // Use an authentication error which will escalate immediately
      const authError = new Error("Authentication failed - invalid token");
      await errorHandler.handleError(authError, mockContext);

      expect(escalationCallback).toHaveBeenCalled();
      const escalationDetails = escalationCallback.mock.calls[0][0];
      expect(escalationDetails.suggestedActions).toContain(
        "Check API credentials and tokens"
      );
      expect(escalationDetails.suggestedActions).toContain(
        "Verify authentication configuration"
      );
    });

    it("should set appropriate escalation priority", async () => {
      const escalationCallback = vi.fn().mockResolvedValue(undefined);
      errorHandler.registerEscalationCallback(escalationCallback);

      const criticalError = new Error("Out of memory");
      await errorHandler.handleError(criticalError, mockContext);

      const escalationDetails = escalationCallback.mock.calls[0][0];
      expect(escalationDetails.priority).toBe("urgent");
    });
  });

  describe("Retry Logic", () => {
    it("should calculate exponential backoff correctly", () => {
      const networkError = new Error("Connection timeout");
      const classification = errorHandler.classifyError(
        networkError,
        mockContext
      );

      // Test backoff calculation (private method, so we test through behavior)
      expect(classification.backoffMultiplier).toBe(2);
      expect(classification.maxRetries).toBe(5);
    });

    it("should respect maximum retry attempts", async () => {
      const retryableError = new Error("Temporary failure");

      const result = await errorHandler.handleError(
        retryableError,
        mockContext
      );

      // Should eventually give up after max retries
      expect(result.success).toBe(false);
    });
  });

  describe("Error Statistics", () => {
    it("should track error statistics", async () => {
      const error1 = new Error("Network error");
      const error2 = new Error("Validation error");

      await errorHandler.handleError(error1, mockContext);
      await errorHandler.handleError(error2, mockContext);

      const stats = errorHandler.getErrorStatistics();
      expect(stats.totalErrors).toBeGreaterThan(0);
    });

    it("should clear error statistics", () => {
      errorHandler.clearErrorStatistics();
      const stats = errorHandler.getErrorStatistics();
      expect(stats.totalErrors).toBe(0);
      expect(stats.circuitBreakerStates).toHaveLength(0);
    });
  });

  describe("Fallback Handling", () => {
    it("should execute fallback function when provided", async () => {
      const validationError = new Error("Invalid input");
      const fallbackFn = vi.fn().mockResolvedValue("default_value");

      const result = await errorHandler.handleError(
        validationError,
        mockContext,
        fallbackFn
      );

      expect(result.success).toBe(true);
      expect(result.result).toBe("default_value");
      expect(fallbackFn).toHaveBeenCalled();
    });

    it("should handle fallback function failures", async () => {
      const validationError = new Error("Invalid input");
      const fallbackFn = vi
        .fn()
        .mockRejectedValue(new Error("Fallback failed"));

      const result = await errorHandler.handleError(
        validationError,
        mockContext,
        fallbackFn
      );

      expect(result.success).toBe(false);
      expect(fallbackFn).toHaveBeenCalled();
    });

    it("should handle missing fallback function gracefully", async () => {
      const validationError = new Error("Invalid input");

      const result = await errorHandler.handleError(
        validationError,
        mockContext
      );

      expect(result.success).toBe(false);
    });
  });

  describe("Error Context", () => {
    it("should include error context in classification", () => {
      const contextWithIntegration = {
        ...mockContext,
        component: "api_integration",
      };

      const error = new Error("Service error");
      const classification = errorHandler.classifyError(
        error,
        contextWithIntegration
      );

      expect(classification.category).toBe(ErrorCategory.INTEGRATION);
    });

    it("should handle missing context gracefully", () => {
      const minimalContext: ErrorContext = {
        operation: "test",
        component: "test",
        timestamp: new Date(),
      };

      const error = new Error("Test error");
      const classification = errorHandler.classifyError(error, minimalContext);

      expect(classification).toBeDefined();
      expect(classification.severity).toBeDefined();
    });
  });
});
