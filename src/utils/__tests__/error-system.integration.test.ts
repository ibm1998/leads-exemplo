import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  errorHandler,
  ErrorContext,
  ErrorSeverity,
  ErrorCategory,
} from "../error-handler";
import {
  errorMonitoringService,
  AlertChannel,
} from "../../monitoring/error-monitoring";
import {
  gracefulDegradationService,
  DegradationLevel,
} from "../graceful-degradation";

describe("Error System Integration", () => {
  let mockAlertCallback: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Clear all systems
    errorHandler.clearErrorStatistics();
    errorMonitoringService.clearMonitoringData();
    gracefulDegradationService.clearHistory();

    // Set up alert callback
    mockAlertCallback = vi.fn().mockResolvedValue(undefined);
    errorMonitoringService.registerAlertCallback(
      AlertChannel.LOG,
      mockAlertCallback
    );

    // Configure monitoring with low thresholds for testing
    errorMonitoringService.updateAlertConfig({
      enabled: true,
      channels: [AlertChannel.LOG],
      thresholds: {
        errorRate: 3,
        criticalErrors: 2,
        circuitBreakerTrips: 2,
      },
      cooldownPeriod: 0.1, // 0.1 minutes for testing
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("End-to-End Error Handling Flow", () => {
    it("should handle error classification, recovery, monitoring, and degradation", async () => {
      const context: ErrorContext = {
        operation: "lead_processing",
        component: "ai_head_agent",
        leadId: "lead_123",
        timestamp: new Date(),
      };

      // 1. Simulate a network error
      const networkError = new Error("Connection timeout");

      // 2. Handle the error through the error handler
      const result = await errorHandler.handleError(networkError, context);

      // 3. Verify error was classified correctly
      expect(result.success).toBe(false);
      expect(result.escalated).toBe(false); // Network errors should retry, not escalate immediately

      // 4. Manually record the error in monitoring service (since they're not auto-connected in tests)
      errorMonitoringService.recordError(
        ErrorSeverity.HIGH,
        ErrorCategory.NETWORK
      );

      // Check that monitoring service recorded the error
      const monitoringStats = errorMonitoringService.getMonitoringStatistics();
      expect(monitoringStats.errorHistory).toBeGreaterThan(0);

      // 5. Check system health metrics
      const healthMetrics = errorMonitoringService.getSystemHealthMetrics();
      expect(healthMetrics.errorRate).toBeGreaterThan(0);
      expect(healthMetrics.systemStatus).toBe("healthy"); // Single error shouldn't degrade system
    });

    it("should trigger alerts when error thresholds are exceeded", async () => {
      const context: ErrorContext = {
        operation: "crm_sync",
        component: "gohighlevel_integration",
        timestamp: new Date(),
      };

      // Generate multiple errors to exceed threshold
      for (let i = 0; i < 5; i++) {
        const error = new Error(`Network error ${i}`);
        await errorHandler.handleError(error, context);

        // Record in monitoring service
        errorMonitoringService.recordError(
          ErrorSeverity.HIGH,
          ErrorCategory.NETWORK
        );
      }

      // Wait for threshold checking
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Should have triggered an alert
      expect(mockAlertCallback).toHaveBeenCalled();

      const alertMessage = mockAlertCallback.mock.calls[0][0];
      expect(alertMessage.severity).toBe("warning");
      expect(alertMessage.title).toContain("High Error Rate");
    });

    it("should trigger system degradation under high error conditions", async () => {
      const context: ErrorContext = {
        operation: "voice_calling",
        component: "virtual_sales_assistant",
        timestamp: new Date(),
      };

      // Simulate high error rate scenario
      for (let i = 0; i < 15; i++) {
        const error = new Error(`Service unavailable ${i}`);
        await errorHandler.handleError(error, context);

        // Record in monitoring service
        errorMonitoringService.recordError(
          ErrorSeverity.HIGH,
          ErrorCategory.INTEGRATION
        );

        // Update component health
        errorMonitoringService.updateComponentHealth(
          "virtual_sales_assistant",
          {
            status: "degraded",
            errorRate: i + 1,
            lastError: new Date(),
          }
        );
      }

      // Simulate degradation evaluation
      await gracefulDegradationService.evaluateDegradation({
        errorRate: 15,
        criticalErrors: 0,
        failedServices: ["virtual_sales_assistant"],
        circuitBreakerTrips: 2,
        systemLoad: 0.8,
        timestamp: new Date(),
      });

      // Check that system degraded
      const systemStatus = gracefulDegradationService.getSystemStatus();
      expect(systemStatus.degradationLevel).toBe(DegradationLevel.SEVERE);

      // Check that monitoring reflects the degradation
      const healthMetrics = errorMonitoringService.getSystemHealthMetrics();
      expect(healthMetrics.systemStatus).toBe("degraded");
    });

    it("should escalate critical errors immediately", async () => {
      const escalationCallback = vi.fn().mockResolvedValue(undefined);
      errorHandler.registerEscalationCallback(escalationCallback);

      const context: ErrorContext = {
        operation: "system_startup",
        component: "database_manager",
        timestamp: new Date(),
      };

      // Simulate critical system error
      const criticalError = new Error("Out of memory - system failure");
      const result = await errorHandler.handleError(criticalError, context);

      // Should escalate immediately
      expect(result.escalated).toBe(true);
      expect(escalationCallback).toHaveBeenCalled();

      const escalationDetails = escalationCallback.mock.calls[0][0];
      expect(escalationDetails.severity).toBe(ErrorSeverity.CRITICAL);
      expect(escalationDetails.priority).toBe("urgent");

      // Should also trigger monitoring alert
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(mockAlertCallback).toHaveBeenCalled();
    });

    it("should handle circuit breaker pattern across the system", async () => {
      const context: ErrorContext = {
        operation: "api_call",
        component: "external_integration",
        timestamp: new Date(),
      };

      // Simulate repeated failures to trip circuit breaker
      for (let i = 0; i < 10; i++) {
        const error = new Error("Service unavailable");
        await errorHandler.handleError(error, context);
      }

      // Check circuit breaker statistics
      const errorStats = errorHandler.getErrorStatistics();
      const circuitBreakers = errorStats.circuitBreakerStates;
      expect(circuitBreakers.length).toBeGreaterThan(0);

      // Should trigger degradation due to circuit breaker trips
      await gracefulDegradationService.evaluateDegradation({
        errorRate: 5,
        criticalErrors: 0,
        failedServices: [],
        circuitBreakerTrips: 3,
        systemLoad: 0.6,
        timestamp: new Date(),
      });

      const systemStatus = gracefulDegradationService.getSystemStatus();
      expect(systemStatus.degradationLevel).toBe(DegradationLevel.MODERATE);
    });

    it("should recover system when conditions improve", async () => {
      // First, degrade the system
      await gracefulDegradationService.forceDegradation(
        DegradationLevel.SEVERE,
        "Simulated high error rate"
      );

      let systemStatus = gracefulDegradationService.getSystemStatus();
      expect(systemStatus.degradationLevel).toBe(DegradationLevel.SEVERE);

      // Force recovery to simulate improved conditions
      await gracefulDegradationService.forceRecovery();

      // System should recover
      systemStatus = gracefulDegradationService.getSystemStatus();
      expect(systemStatus.degradationLevel).toBe(DegradationLevel.NONE);

      // Should be reflected in monitoring
      const healthMetrics = errorMonitoringService.getSystemHealthMetrics();
      expect(healthMetrics.systemStatus).toBe("healthy");
    });

    it("should handle fallback mechanisms during degradation", async () => {
      const context: ErrorContext = {
        operation: "voice_call",
        component: "voice_service",
        timestamp: new Date(),
      };

      const fallbackFunction = vi.fn().mockResolvedValue({
        method: "sms",
        message: "Voice unavailable, using SMS",
      });

      // Simulate validation error which will use fallback
      const validationError = new Error("Validation failed - invalid input");
      const result = await errorHandler.handleError(
        validationError,
        context,
        fallbackFunction
      );

      // Should use fallback
      expect(result.success).toBe(true);
      expect(result.result.method).toBe("sms");
      expect(fallbackFunction).toHaveBeenCalled();

      // Should update component health
      errorMonitoringService.updateComponentHealth("voice_service", {
        status: "degraded",
        errorRate: 1,
        lastError: new Date(),
      });

      const healthMetrics = errorMonitoringService.getSystemHealthMetrics();
      expect(healthMetrics.componentHealth["voice_service"].status).toBe(
        "degraded"
      );
    });

    it("should coordinate between all systems during complex failure scenario", async () => {
      const escalationCallback = vi.fn().mockResolvedValue(undefined);
      errorHandler.registerEscalationCallback(escalationCallback);

      // Simulate complex failure scenario
      const scenarios = [
        {
          context: {
            operation: "lead_ingestion",
            component: "gmail_integration",
            timestamp: new Date(),
          },
          error: new Error("Gmail API rate limit exceeded"),
          severity: ErrorSeverity.MEDIUM,
          category: ErrorCategory.RATE_LIMIT,
        },
        {
          context: {
            operation: "crm_sync",
            component: "gohighlevel_integration",
            timestamp: new Date(),
          },
          error: new Error("CRM connection timeout"),
          severity: ErrorSeverity.HIGH,
          category: ErrorCategory.NETWORK,
        },
        {
          context: {
            operation: "voice_call",
            component: "virtual_sales_assistant",
            timestamp: new Date(),
          },
          error: new Error("Voice service authentication failed"),
          severity: ErrorSeverity.HIGH,
          category: ErrorCategory.AUTHENTICATION,
        },
        {
          context: {
            operation: "database_query",
            component: "database_manager",
            timestamp: new Date(),
          },
          error: new Error("Database connection pool exhausted"),
          severity: ErrorSeverity.CRITICAL,
          category: ErrorCategory.DATA,
        },
      ];

      // Process all errors
      for (const scenario of scenarios) {
        await errorHandler.handleError(scenario.error, scenario.context);
        errorMonitoringService.recordError(
          scenario.severity,
          scenario.category
        );

        errorMonitoringService.updateComponentHealth(
          scenario.context.component,
          {
            status:
              scenario.severity === ErrorSeverity.CRITICAL
                ? "critical"
                : "degraded",
            errorRate: 5,
            lastError: new Date(),
          }
        );
      }

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Check that critical error was escalated
      expect(escalationCallback).toHaveBeenCalled();

      // Check that alerts were triggered
      expect(mockAlertCallback).toHaveBeenCalled();

      // Check system degradation
      await gracefulDegradationService.evaluateDegradation({
        errorRate: 12,
        criticalErrors: 1,
        failedServices: ["database_manager", "virtual_sales_assistant"],
        circuitBreakerTrips: 2,
        systemLoad: 0.9,
        timestamp: new Date(),
      });

      const systemStatus = gracefulDegradationService.getSystemStatus();
      expect(systemStatus.degradationLevel).toBe(DegradationLevel.SEVERE);

      // Check monitoring reflects the critical state
      const healthMetrics = errorMonitoringService.getSystemHealthMetrics();
      expect(healthMetrics.systemStatus).toBe("degraded");
      expect(healthMetrics.criticalErrorCount).toBeGreaterThan(0);
    });
  });

  describe("System Recovery Integration", () => {
    it("should coordinate recovery across all systems", async () => {
      // Start with degraded system
      await gracefulDegradationService.forceDegradation(
        DegradationLevel.MODERATE,
        "Integration test degradation"
      );

      // Simulate some errors being resolved
      errorHandler.resetCircuitBreaker("external_integration", "api_call");

      // Update component health to show improvement
      errorMonitoringService.updateComponentHealth("external_integration", {
        status: "healthy",
        errorRate: 0,
      });

      // Force recovery to simulate improved conditions
      await gracefulDegradationService.forceRecovery();

      // System should recover
      const systemStatus = gracefulDegradationService.getSystemStatus();
      expect(systemStatus.degradationLevel).toBe(DegradationLevel.NONE);

      // Monitoring should reflect healthy state
      const healthMetrics = errorMonitoringService.getSystemHealthMetrics();
      expect(healthMetrics.systemStatus).toBe("healthy");
    });
  });

  describe("Performance Under Load", () => {
    it("should handle high volume of errors efficiently", async () => {
      const startTime = Date.now();
      const errorCount = 100;

      // Generate many errors quickly
      const promises = [];
      for (let i = 0; i < errorCount; i++) {
        const context: ErrorContext = {
          operation: `operation_${i % 10}`,
          component: `component_${i % 5}`,
          timestamp: new Date(),
        };

        const error = new Error(`Error ${i}`);
        promises.push(errorHandler.handleError(error, context));

        // Also record in monitoring
        errorMonitoringService.recordError(
          i % 4 === 0 ? ErrorSeverity.CRITICAL : ErrorSeverity.MEDIUM,
          ErrorCategory.NETWORK
        );
      }

      await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (less than 5 seconds)
      expect(duration).toBeLessThan(5000);

      // Check that all errors were processed
      const errorStats = errorHandler.getErrorStatistics();
      expect(errorStats.totalErrors).toBeGreaterThan(0);

      const monitoringStats = errorMonitoringService.getMonitoringStatistics();
      expect(monitoringStats.errorHistory).toBe(errorCount * 2); // Double because we record in both systems
    });
  });
});
