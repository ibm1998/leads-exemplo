import { logger } from "../utils/logger";
import {
  errorHandler,
  ErrorSeverity,
  ErrorCategory,
  EscalationDetails,
} from "../utils/error-handler";
import { config } from "../config/environment";

/**
 * Alert configuration
 */
export interface AlertConfig {
  enabled: boolean;
  channels: AlertChannel[];
  thresholds: {
    errorRate: number; // errors per minute
    criticalErrors: number; // critical errors per hour
    circuitBreakerTrips: number; // circuit breaker trips per hour
  };
  cooldownPeriod: number; // minutes between similar alerts
}

/**
 * Alert channels for notifications
 */
export enum AlertChannel {
  EMAIL = "email",
  SLACK = "slack",
  WEBHOOK = "webhook",
  LOG = "log",
}

/**
 * Alert message
 */
export interface AlertMessage {
  id: string;
  severity: "info" | "warning" | "error" | "critical";
  title: string;
  message: string;
  timestamp: Date;
  metadata?: Record<string, any>;
  channels: AlertChannel[];
}

/**
 * System health metrics
 */
export interface SystemHealthMetrics {
  timestamp: Date;
  errorRate: number; // errors per minute
  criticalErrorCount: number;
  circuitBreakerTrips: number;
  activeCircuitBreakers: number;
  systemStatus: "healthy" | "degraded" | "critical";
  componentHealth: Record<string, ComponentHealth>;
}

/**
 * Component health status
 */
export interface ComponentHealth {
  status: "healthy" | "degraded" | "critical" | "offline";
  errorRate: number;
  lastError?: Date;
  circuitBreakerState?: "closed" | "open" | "half-open";
  responseTime?: number;
}

/**
 * Error monitoring and alerting service
 */
export class ErrorMonitoringService {
  private alertConfig: AlertConfig;
  private recentAlerts: Map<string, Date> = new Map();
  private errorHistory: Array<{
    timestamp: Date;
    severity: ErrorSeverity;
    category: ErrorCategory;
  }> = [];
  private componentMetrics: Map<string, ComponentHealth> = new Map();
  private alertCallbacks: Map<
    AlertChannel,
    (alert: AlertMessage) => Promise<void>
  > = new Map();

  constructor(alertConfig?: Partial<AlertConfig>) {
    this.alertConfig = {
      enabled: true,
      channels: [AlertChannel.LOG],
      thresholds: {
        errorRate: 10, // 10 errors per minute
        criticalErrors: 5, // 5 critical errors per hour
        circuitBreakerTrips: 3, // 3 circuit breaker trips per hour
      },
      cooldownPeriod: 15, // 15 minutes
      ...alertConfig,
    };

    this.initializeMonitoring();
  }

  /**
   * Initialize monitoring and register with error handler
   */
  private initializeMonitoring(): void {
    // Register escalation callback with error handler
    errorHandler.registerEscalationCallback(
      async (details: EscalationDetails) => {
        await this.handleEscalation(details);
      }
    );

    // Start periodic health checks
    this.startHealthChecks();

    // Clean up old data periodically
    this.startDataCleanup();

    logger.info("Error monitoring service initialized", {
      alertConfig: this.alertConfig,
    });
  }

  /**
   * Handle error escalation from error handler
   */
  private async handleEscalation(details: EscalationDetails): Promise<void> {
    // Record the escalation
    this.recordError(details.severity, details.category);

    // Update component health
    this.updateComponentHealth(details.context.component, {
      status: this.getHealthStatusFromSeverity(details.severity),
      errorRate: this.calculateComponentErrorRate(details.context.component),
      lastError: new Date(),
    });

    // Create alert for escalation
    const alert: AlertMessage = {
      id: `escalation_${details.errorId}`,
      severity: this.mapSeverityToAlertLevel(details.severity),
      title: `Error Escalation: ${details.category}`,
      message: this.formatEscalationMessage(details),
      timestamp: new Date(),
      metadata: {
        errorId: details.errorId,
        component: details.context.component,
        operation: details.context.operation,
        recoveryAttempts: details.recoveryAttempts.length,
        suggestedActions: details.suggestedActions,
      },
      channels: this.alertConfig.channels,
    };

    await this.sendAlert(alert);
  }

  /**
   * Record error for monitoring and analysis
   */
  recordError(severity: ErrorSeverity, category: ErrorCategory): void {
    this.errorHistory.push({
      timestamp: new Date(),
      severity,
      category,
    });

    // Check if we need to send threshold alerts
    this.checkThresholds();
  }

  /**
   * Update component health status
   */
  updateComponentHealth(
    component: string,
    health: Partial<ComponentHealth>
  ): void {
    const currentHealth = this.componentMetrics.get(component) || {
      status: "healthy",
      errorRate: 0,
    };

    this.componentMetrics.set(component, {
      ...currentHealth,
      ...health,
    });
  }

  /**
   * Get current system health metrics
   */
  getSystemHealthMetrics(): SystemHealthMetrics {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60000);
    const oneHourAgo = new Date(now.getTime() - 3600000);

    // Calculate error rate (errors per minute)
    const recentErrors = this.errorHistory.filter(
      (error) => error.timestamp >= oneMinuteAgo
    );
    const errorRate = recentErrors.length;

    // Count critical errors in the last hour
    const criticalErrors = this.errorHistory.filter(
      (error) =>
        error.timestamp >= oneHourAgo &&
        error.severity === ErrorSeverity.CRITICAL
    );
    const criticalErrorCount = criticalErrors.length;

    // Get circuit breaker information
    const errorStats = errorHandler.getErrorStatistics();
    const activeCircuitBreakers = errorStats.circuitBreakerStates.filter(
      (cb) => cb.state === "open"
    ).length;

    // Calculate circuit breaker trips in the last hour
    const recentTrips = errorStats.circuitBreakerStates.filter(
      (cb) => cb.lastFailureTime >= oneHourAgo && cb.state === "open"
    ).length;

    // Determine overall system status
    const systemStatus = this.calculateSystemStatus(
      errorRate,
      criticalErrorCount,
      activeCircuitBreakers
    );

    // Convert component metrics to health status
    const componentHealth: Record<string, ComponentHealth> = {};
    this.componentMetrics.forEach((health, component) => {
      componentHealth[component] = { ...health };
    });

    return {
      timestamp: now,
      errorRate,
      criticalErrorCount,
      circuitBreakerTrips: recentTrips,
      activeCircuitBreakers,
      systemStatus,
      componentHealth,
    };
  }

  /**
   * Check error thresholds and send alerts if necessary
   */
  private checkThresholds(): void {
    if (!this.alertConfig.enabled) {
      return;
    }

    const metrics = this.getSystemHealthMetrics();

    // Check error rate threshold
    if (metrics.errorRate >= this.alertConfig.thresholds.errorRate) {
      this.sendThresholdAlert(
        "high_error_rate",
        "High Error Rate Detected",
        `Error rate: ${metrics.errorRate} errors/minute (threshold: ${this.alertConfig.thresholds.errorRate})`,
        "warning",
        {
          errorRate: metrics.errorRate,
          threshold: this.alertConfig.thresholds.errorRate,
        }
      );
    }

    // Check critical error threshold
    if (
      metrics.criticalErrorCount >= this.alertConfig.thresholds.criticalErrors
    ) {
      this.sendThresholdAlert(
        "high_critical_errors",
        "High Critical Error Count",
        `Critical errors: ${metrics.criticalErrorCount} in the last hour (threshold: ${this.alertConfig.thresholds.criticalErrors})`,
        "critical",
        {
          criticalErrors: metrics.criticalErrorCount,
          threshold: this.alertConfig.thresholds.criticalErrors,
        }
      );
    }

    // Check circuit breaker threshold
    if (
      metrics.circuitBreakerTrips >=
      this.alertConfig.thresholds.circuitBreakerTrips
    ) {
      this.sendThresholdAlert(
        "high_circuit_breaker_trips",
        "High Circuit Breaker Activity",
        `Circuit breaker trips: ${metrics.circuitBreakerTrips} in the last hour (threshold: ${this.alertConfig.thresholds.circuitBreakerTrips})`,
        "error",
        {
          circuitBreakerTrips: metrics.circuitBreakerTrips,
          threshold: this.alertConfig.thresholds.circuitBreakerTrips,
        }
      );
    }
  }

  /**
   * Send threshold-based alert with cooldown
   */
  private async sendThresholdAlert(
    alertType: string,
    title: string,
    message: string,
    severity: "info" | "warning" | "error" | "critical",
    metadata?: Record<string, any>
  ): Promise<void> {
    // Check cooldown period
    const lastAlert = this.recentAlerts.get(alertType);
    const now = new Date();
    const cooldownMs = this.alertConfig.cooldownPeriod * 60000;

    if (lastAlert && now.getTime() - lastAlert.getTime() < cooldownMs) {
      return; // Still in cooldown period
    }

    const alert: AlertMessage = {
      id: `threshold_${alertType}_${Date.now()}`,
      severity,
      title,
      message,
      timestamp: now,
      metadata,
      channels: this.alertConfig.channels,
    };

    await this.sendAlert(alert);
    this.recentAlerts.set(alertType, now);
  }

  /**
   * Send alert through configured channels
   */
  private async sendAlert(alert: AlertMessage): Promise<void> {
    logger.info("Sending alert", {
      alertId: alert.id,
      severity: alert.severity,
      title: alert.title,
      channels: alert.channels,
    });

    for (const channel of alert.channels) {
      try {
        const callback = this.alertCallbacks.get(channel);
        if (callback) {
          await callback(alert);
        } else {
          // Default to logging if no callback registered
          await this.logAlert(alert);
        }
      } catch (error) {
        logger.error("Failed to send alert through channel", {
          alertId: alert.id,
          channel,
          error: error instanceof Error ? error.message : error,
        });
      }
    }
  }

  /**
   * Default log alert handler
   */
  private async logAlert(alert: AlertMessage): Promise<void> {
    const logData = {
      alertId: alert.id,
      title: alert.title,
      message: alert.message,
      metadata: alert.metadata,
      timestamp: alert.timestamp,
    };

    switch (alert.severity) {
      case "critical":
        logger.error("CRITICAL ALERT", logData);
        break;
      case "error":
        logger.error("ERROR ALERT", logData);
        break;
      case "warning":
        logger.warn("WARNING ALERT", logData);
        break;
      case "info":
        logger.info("INFO ALERT", logData);
        break;
    }
  }

  /**
   * Register alert callback for a specific channel
   */
  registerAlertCallback(
    channel: AlertChannel,
    callback: (alert: AlertMessage) => Promise<void>
  ): void {
    this.alertCallbacks.set(channel, callback);
    logger.info("Alert callback registered", { channel });
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    const healthCheckInterval = 60000; // 1 minute

    setInterval(() => {
      try {
        const metrics = this.getSystemHealthMetrics();

        // Log health metrics periodically
        logger.info("System health check", {
          systemStatus: metrics.systemStatus,
          errorRate: metrics.errorRate,
          criticalErrors: metrics.criticalErrorCount,
          activeCircuitBreakers: metrics.activeCircuitBreakers,
        });

        // Update component health based on recent activity
        this.updateComponentHealthFromMetrics(metrics);
      } catch (error) {
        logger.error("Error during health check", {
          error: error instanceof Error ? error.message : error,
        });
      }
    }, healthCheckInterval);
  }

  /**
   * Start periodic data cleanup
   */
  private startDataCleanup(): void {
    const cleanupInterval = 3600000; // 1 hour
    const dataRetentionPeriod = 86400000; // 24 hours

    setInterval(() => {
      try {
        const cutoffTime = new Date(Date.now() - dataRetentionPeriod);

        // Clean up old error history
        this.errorHistory = this.errorHistory.filter(
          (error) => error.timestamp >= cutoffTime
        );

        // Clean up old alert records
        const alertCutoffTime = new Date(
          Date.now() - this.alertConfig.cooldownPeriod * 60000 * 2
        );
        for (const [alertType, timestamp] of this.recentAlerts.entries()) {
          if (timestamp < alertCutoffTime) {
            this.recentAlerts.delete(alertType);
          }
        }

        logger.debug("Completed periodic data cleanup", {
          errorHistorySize: this.errorHistory.length,
          recentAlertsSize: this.recentAlerts.size,
        });
      } catch (error) {
        logger.error("Error during data cleanup", {
          error: error instanceof Error ? error.message : error,
        });
      }
    }, cleanupInterval);
  }

  /**
   * Update component health based on metrics
   */
  private updateComponentHealthFromMetrics(metrics: SystemHealthMetrics): void {
    // Update component health based on error patterns
    for (const [component, health] of this.componentMetrics.entries()) {
      const componentErrors = this.errorHistory.filter(
        (error) => error.timestamp >= new Date(Date.now() - 300000) // Last 5 minutes
      );

      const errorRate = componentErrors.length / 5; // errors per minute

      let status: ComponentHealth["status"] = "healthy";
      if (errorRate >= 5) {
        status = "critical";
      } else if (errorRate >= 2) {
        status = "degraded";
      } else if (errorRate >= 1) {
        status = "degraded";
      }

      this.updateComponentHealth(component, {
        status,
        errorRate,
      });
    }
  }

  /**
   * Calculate system status based on metrics
   */
  private calculateSystemStatus(
    errorRate: number,
    criticalErrors: number,
    activeCircuitBreakers: number
  ): "healthy" | "degraded" | "critical" {
    if (
      criticalErrors >= this.alertConfig.thresholds.criticalErrors ||
      activeCircuitBreakers >= 5
    ) {
      return "critical";
    }

    if (
      errorRate >= this.alertConfig.thresholds.errorRate ||
      activeCircuitBreakers >= 2
    ) {
      return "degraded";
    }

    return "healthy";
  }

  /**
   * Calculate component error rate
   */
  private calculateComponentErrorRate(component: string): number {
    const fiveMinutesAgo = new Date(Date.now() - 300000);
    const componentErrors = this.errorHistory.filter(
      (error) => error.timestamp >= fiveMinutesAgo
    );
    return componentErrors.length / 5; // errors per minute
  }

  /**
   * Get health status from error severity
   */
  private getHealthStatusFromSeverity(
    severity: ErrorSeverity
  ): ComponentHealth["status"] {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
        return "critical";
      case ErrorSeverity.HIGH:
        return "degraded";
      case ErrorSeverity.MEDIUM:
        return "degraded";
      case ErrorSeverity.LOW:
        return "healthy";
      default:
        return "healthy";
    }
  }

  /**
   * Map error severity to alert level
   */
  private mapSeverityToAlertLevel(
    severity: ErrorSeverity
  ): "info" | "warning" | "error" | "critical" {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
        return "critical";
      case ErrorSeverity.HIGH:
        return "error";
      case ErrorSeverity.MEDIUM:
        return "warning";
      case ErrorSeverity.LOW:
        return "info";
      default:
        return "info";
    }
  }

  /**
   * Format escalation message
   */
  private formatEscalationMessage(details: EscalationDetails): string {
    const lines = [
      `Error escalated in ${details.context.component} component`,
      `Operation: ${details.context.operation}`,
      `Severity: ${details.severity}`,
      `Category: ${details.category}`,
      `Reason: ${details.escalationReason}`,
    ];

    if (details.context.leadId) {
      lines.push(`Lead ID: ${details.context.leadId}`);
    }

    if (details.recoveryAttempts.length > 0) {
      lines.push(`Recovery attempts: ${details.recoveryAttempts.length}`);
      const successfulAttempts = details.recoveryAttempts.filter(
        (a) => a.success
      ).length;
      lines.push(`Successful recoveries: ${successfulAttempts}`);
    }

    if (details.suggestedActions.length > 0) {
      lines.push("Suggested actions:");
      details.suggestedActions.forEach((action) => {
        lines.push(`  - ${action}`);
      });
    }

    return lines.join("\n");
  }

  /**
   * Update alert configuration
   */
  updateAlertConfig(updates: Partial<AlertConfig>): void {
    this.alertConfig = { ...this.alertConfig, ...updates };
    logger.info("Alert configuration updated", {
      alertConfig: this.alertConfig,
    });
  }

  /**
   * Get monitoring statistics
   */
  getMonitoringStatistics(): {
    errorHistory: number;
    recentAlerts: number;
    componentMetrics: number;
    alertCallbacks: number;
    systemHealth: SystemHealthMetrics;
  } {
    return {
      errorHistory: this.errorHistory.length,
      recentAlerts: this.recentAlerts.size,
      componentMetrics: this.componentMetrics.size,
      alertCallbacks: this.alertCallbacks.size,
      systemHealth: this.getSystemHealthMetrics(),
    };
  }

  /**
   * Clear monitoring data (useful for testing)
   */
  clearMonitoringData(): void {
    this.errorHistory = [];
    this.recentAlerts.clear();
    this.componentMetrics.clear();
    logger.info("Monitoring data cleared");
  }
}

// Export singleton instance
export const errorMonitoringService = new ErrorMonitoringService();
