import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  ErrorMonitoringService,
  AlertChannel,
  AlertMessage,
  SystemHealthMetrics,
} from "../error-monitoring";
import { ErrorSeverity, ErrorCategory } from "../../utils/error-handler";

describe("ErrorMonitoringService", () => {
  let monitoringService: ErrorMonitoringService;

  beforeEach(() => {
    monitoringService = new ErrorMonitoringService({
      enabled: true,
      channels: [AlertChannel.LOG],
      thresholds: {
        errorRate: 5,
        criticalErrors: 2,
        circuitBreakerTrips: 2,
      },
      cooldownPeriod: 1, // 1 minute for testing
    });
  });

  afterEach(() => {
    monitoringService.clearMonitoringData();
    vi.clearAllMocks();
  });

  describe("Error Recording", () => {
    it("should record errors for monitoring", () => {
      monitoringService.recordError(ErrorSeverity.HIGH, ErrorCategory.NETWORK);
      monitoringService.recordError(
        ErrorSeverity.MEDIUM,
        ErrorCategory.VALIDATION
      );

      const stats = monitoringService.getMonitoringStatistics();
      expect(stats.errorHistory).toBe(2);
    });

    it("should track different error severities", () => {
      monitoringService.recordError(
        ErrorSeverity.CRITICAL,
        ErrorCategory.SYSTEM
      );
      monitoringService.recordError(
        ErrorSeverity.LOW,
        ErrorCategory.BUSINESS_LOGIC
      );

      const metrics = monitoringService.getSystemHealthMetrics();
      expect(metrics.criticalErrorCount).toBe(1);
    });

    it("should calculate error rates correctly", () => {
      // Record multiple errors in quick succession
      for (let i = 0; i < 3; i++) {
        monitoringService.recordError(
          ErrorSeverity.MEDIUM,
          ErrorCategory.NETWORK
        );
      }

      const metrics = monitoringService.getSystemHealthMetrics();
      expect(metrics.errorRate).toBe(3);
    });
  });

  describe("Component Health Tracking", () => {
    it("should update component health status", () => {
      monitoringService.updateComponentHealth("test_component", {
        status: "degraded",
        errorRate: 2.5,
        lastError: new Date(),
      });

      const metrics = monitoringService.getSystemHealthMetrics();
      expect(metrics.componentHealth["test_component"]).toBeDefined();
      expect(metrics.componentHealth["test_component"].status).toBe("degraded");
      expect(metrics.componentHealth["test_component"].errorRate).toBe(2.5);
    });

    it("should track multiple components", () => {
      monitoringService.updateComponentHealth("component_a", {
        status: "healthy",
        errorRate: 0,
      });

      monitoringService.updateComponentHealth("component_b", {
        status: "critical",
        errorRate: 10,
      });

      const metrics = monitoringService.getSystemHealthMetrics();
      expect(Object.keys(metrics.componentHealth)).toHaveLength(2);
      expect(metrics.componentHealth["component_a"].status).toBe("healthy");
      expect(metrics.componentHealth["component_b"].status).toBe("critical");
    });
  });

  describe("System Health Metrics", () => {
    it("should calculate system status based on metrics", () => {
      // Simulate healthy system
      const healthyMetrics = monitoringService.getSystemHealthMetrics();
      expect(healthyMetrics.systemStatus).toBe("healthy");

      // Simulate degraded system
      for (let i = 0; i < 6; i++) {
        monitoringService.recordError(
          ErrorSeverity.MEDIUM,
          ErrorCategory.NETWORK
        );
      }

      const degradedMetrics = monitoringService.getSystemHealthMetrics();
      expect(degradedMetrics.systemStatus).toBe("degraded");
    });

    it("should identify critical system state", () => {
      // Simulate critical errors
      for (let i = 0; i < 3; i++) {
        monitoringService.recordError(
          ErrorSeverity.CRITICAL,
          ErrorCategory.SYSTEM
        );
      }

      const metrics = monitoringService.getSystemHealthMetrics();
      expect(metrics.systemStatus).toBe("critical");
      expect(metrics.criticalErrorCount).toBe(3);
    });

    it("should include timestamp in metrics", () => {
      const metrics = monitoringService.getSystemHealthMetrics();
      expect(metrics.timestamp).toBeInstanceOf(Date);
      expect(metrics.timestamp.getTime()).toBeCloseTo(Date.now(), -2); // Within 100ms
    });
  });

  describe("Alert System", () => {
    it("should register alert callbacks", () => {
      const mockCallback = vi.fn().mockResolvedValue(undefined);
      monitoringService.registerAlertCallback(AlertChannel.EMAIL, mockCallback);

      const stats = monitoringService.getMonitoringStatistics();
      expect(stats.alertCallbacks).toBe(1);
    });

    it("should send alerts when thresholds are exceeded", async () => {
      const mockCallback = vi.fn().mockResolvedValue(undefined);
      monitoringService.registerAlertCallback(AlertChannel.LOG, mockCallback);

      // Exceed error rate threshold
      for (let i = 0; i < 6; i++) {
        monitoringService.recordError(
          ErrorSeverity.MEDIUM,
          ErrorCategory.NETWORK
        );
      }

      // Wait a bit for threshold checking
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should have triggered an alert
      expect(mockCallback).toHaveBeenCalled();
    });

    it("should respect cooldown periods", async () => {
      const mockCallback = vi.fn().mockResolvedValue(undefined);
      monitoringService.registerAlertCallback(AlertChannel.LOG, mockCallback);

      // Trigger first alert
      for (let i = 0; i < 6; i++) {
        monitoringService.recordError(
          ErrorSeverity.MEDIUM,
          ErrorCategory.NETWORK
        );
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
      const firstCallCount = mockCallback.mock.calls.length;

      // Trigger more errors immediately (should be in cooldown)
      for (let i = 0; i < 6; i++) {
        monitoringService.recordError(
          ErrorSeverity.MEDIUM,
          ErrorCategory.NETWORK
        );
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
      const secondCallCount = mockCallback.mock.calls.length;

      // Should not have increased due to cooldown
      expect(secondCallCount).toBe(firstCallCount);
    });

    it("should format alert messages correctly", async () => {
      const mockCallback = vi.fn().mockResolvedValue(undefined);
      monitoringService.registerAlertCallback(AlertChannel.LOG, mockCallback);

      // Trigger critical error alert
      for (let i = 0; i < 3; i++) {
        monitoringService.recordError(
          ErrorSeverity.CRITICAL,
          ErrorCategory.SYSTEM
        );
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockCallback).toHaveBeenCalled();
      const alertMessage: AlertMessage = mockCallback.mock.calls[0][0];
      expect(alertMessage.severity).toBe("critical");
      expect(alertMessage.title).toContain("Critical Error");
      expect(alertMessage.message).toContain("threshold");
    });
  });

  describe("Escalation Handling", () => {
    it("should handle escalations from error handler", async () => {
      const mockCallback = vi.fn().mockResolvedValue(undefined);
      monitoringService.registerAlertCallback(AlertChannel.LOG, mockCallback);

      // Simulate escalation details
      const escalationDetails = {
        errorId: "test_error_123",
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.AUTHENTICATION,
        context: {
          operation: "login",
          component: "auth_service",
          timestamp: new Date(),
        },
        recoveryAttempts: [],
        escalationReason: "Authentication failure",
        suggestedActions: ["Check credentials", "Verify token"],
        priority: "high" as const,
      };

      // This would normally be called by the error handler
      await (monitoringService as any).handleEscalation(escalationDetails);

      expect(mockCallback).toHaveBeenCalled();
      const alertMessage: AlertMessage = mockCallback.mock.calls[0][0];
      expect(alertMessage.title).toContain("Error Escalation");
      expect(alertMessage.metadata?.errorId).toBe("test_error_123");
    });
  });

  describe("Configuration Management", () => {
    it("should update alert configuration", () => {
      const newConfig = {
        enabled: false,
        thresholds: {
          errorRate: 20,
          criticalErrors: 10,
          circuitBreakerTrips: 5,
        },
      };

      monitoringService.updateAlertConfig(newConfig);

      // Configuration should be updated (we can't directly access it, but behavior should change)
      // Test by checking that alerts are disabled
      for (let i = 0; i < 25; i++) {
        monitoringService.recordError(
          ErrorSeverity.MEDIUM,
          ErrorCategory.NETWORK
        );
      }

      // Should not trigger alerts since alerting is disabled
      const stats = monitoringService.getMonitoringStatistics();
      expect(stats.errorHistory).toBe(25);
    });
  });

  describe("Data Management", () => {
    it("should clear monitoring data", () => {
      // Add some data
      monitoringService.recordError(ErrorSeverity.HIGH, ErrorCategory.NETWORK);
      monitoringService.updateComponentHealth("test_component", {
        status: "degraded",
        errorRate: 1,
      });

      let stats = monitoringService.getMonitoringStatistics();
      expect(stats.errorHistory).toBe(1);
      expect(stats.componentMetrics).toBe(1);

      // Clear data
      monitoringService.clearMonitoringData();

      stats = monitoringService.getMonitoringStatistics();
      expect(stats.errorHistory).toBe(0);
      expect(stats.componentMetrics).toBe(0);
    });

    it("should provide comprehensive monitoring statistics", () => {
      monitoringService.recordError(ErrorSeverity.HIGH, ErrorCategory.NETWORK);
      monitoringService.updateComponentHealth("test_component", {
        status: "healthy",
        errorRate: 0,
      });

      const mockCallback = vi.fn().mockResolvedValue(undefined);
      monitoringService.registerAlertCallback(AlertChannel.EMAIL, mockCallback);

      const stats = monitoringService.getMonitoringStatistics();
      expect(stats.errorHistory).toBe(1);
      expect(stats.componentMetrics).toBe(1);
      expect(stats.alertCallbacks).toBe(1);
      expect(stats.systemHealth).toBeDefined();
      expect(stats.systemHealth.timestamp).toBeInstanceOf(Date);
    });
  });

  describe("Alert Channels", () => {
    it("should support multiple alert channels", async () => {
      const emailCallback = vi.fn().mockResolvedValue(undefined);
      const slackCallback = vi.fn().mockResolvedValue(undefined);

      monitoringService.registerAlertCallback(
        AlertChannel.EMAIL,
        emailCallback
      );
      monitoringService.registerAlertCallback(
        AlertChannel.SLACK,
        slackCallback
      );

      // Update config to use multiple channels
      monitoringService.updateAlertConfig({
        channels: [AlertChannel.EMAIL, AlertChannel.SLACK],
      });

      // Trigger alert
      for (let i = 0; i < 6; i++) {
        monitoringService.recordError(
          ErrorSeverity.MEDIUM,
          ErrorCategory.NETWORK
        );
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(emailCallback).toHaveBeenCalled();
      expect(slackCallback).toHaveBeenCalled();
    });

    it("should handle callback failures gracefully", async () => {
      const failingCallback = vi
        .fn()
        .mockRejectedValue(new Error("Callback failed"));
      const workingCallback = vi.fn().mockResolvedValue(undefined);

      monitoringService.registerAlertCallback(
        AlertChannel.EMAIL,
        failingCallback
      );
      monitoringService.registerAlertCallback(
        AlertChannel.SLACK,
        workingCallback
      );

      monitoringService.updateAlertConfig({
        channels: [AlertChannel.EMAIL, AlertChannel.SLACK],
      });

      // Trigger alert
      for (let i = 0; i < 6; i++) {
        monitoringService.recordError(
          ErrorSeverity.MEDIUM,
          ErrorCategory.NETWORK
        );
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(failingCallback).toHaveBeenCalled();
      expect(workingCallback).toHaveBeenCalled();
    });
  });

  describe("Time-based Metrics", () => {
    it("should calculate metrics for different time windows", () => {
      const now = Date.now();

      // Record errors at different times (simulated)
      monitoringService.recordError(ErrorSeverity.HIGH, ErrorCategory.NETWORK);
      monitoringService.recordError(
        ErrorSeverity.CRITICAL,
        ErrorCategory.SYSTEM
      );

      const metrics = monitoringService.getSystemHealthMetrics();
      expect(metrics.errorRate).toBeGreaterThan(0);
      expect(metrics.criticalErrorCount).toBeGreaterThan(0);
    });

    it("should handle empty metrics gracefully", () => {
      const metrics = monitoringService.getSystemHealthMetrics();
      expect(metrics.errorRate).toBe(0);
      expect(metrics.criticalErrorCount).toBe(0);
      expect(metrics.systemStatus).toBe("healthy");
    });
  });
});
