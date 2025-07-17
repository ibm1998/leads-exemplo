import { logger } from "./logger";
import { errorHandler, ErrorContext, ErrorSeverity } from "./error-handler";

/**
 * Degradation levels for system functionality
 */
export enum DegradationLevel {
  NONE = "none",
  MINIMAL = "minimal",
  MODERATE = "moderate",
  SEVERE = "severe",
  EMERGENCY = "emergency",
}

/**
 * Service capability definition
 */
export interface ServiceCapability {
  name: string;
  essential: boolean;
  degradationThreshold: number; // Error rate threshold for degradation
  fallbackFunction?: () => Promise<any>;
  dependencies: string[];
}

/**
 * Degradation rule configuration
 */
export interface DegradationRule {
  id: string;
  name: string;
  condition: (context: DegradationContext) => boolean;
  action: DegradationAction;
  priority: number;
  enabled: boolean;
}

/**
 * Degradation action to take when rule is triggered
 */
export interface DegradationAction {
  level: DegradationLevel;
  disabledCapabilities: string[];
  fallbackCapabilities: string[];
  message: string;
  duration?: number; // Auto-recovery time in milliseconds
}

/**
 * Context for degradation decisions
 */
export interface DegradationContext {
  errorRate: number;
  criticalErrors: number;
  failedServices: string[];
  circuitBreakerTrips: number;
  systemLoad: number;
  timestamp: Date;
}

/**
 * Service status tracking
 */
export interface ServiceStatus {
  name: string;
  status: "healthy" | "degraded" | "failed";
  errorRate: number;
  lastError?: Date;
  degradationLevel: DegradationLevel;
  disabledCapabilities: string[];
  fallbacksActive: string[];
}

/**
 * Graceful degradation manager
 */
export class GracefulDegradationService {
  private capabilities: Map<string, ServiceCapability> = new Map();
  private degradationRules: DegradationRule[] = [];
  private serviceStatuses: Map<string, ServiceStatus> = new Map();
  private currentDegradationLevel: DegradationLevel = DegradationLevel.NONE;
  private degradationHistory: Array<{
    timestamp: Date;
    level: DegradationLevel;
    reason: string;
    affectedServices: string[];
  }> = [];

  constructor() {
    this.initializeDefaultCapabilities();
    this.initializeDefaultRules();
    this.startMonitoring();
  }

  /**
   * Initialize default service capabilities
   */
  private initializeDefaultCapabilities(): void {
    const defaultCapabilities: ServiceCapability[] = [
      {
        name: "lead_ingestion",
        essential: true,
        degradationThreshold: 5, // 5 errors per minute
        dependencies: ["database", "crm_integration"],
      },
      {
        name: "lead_routing",
        essential: true,
        degradationThreshold: 3,
        dependencies: ["ai_head_agent"],
      },
      {
        name: "voice_calling",
        essential: false,
        degradationThreshold: 2,
        fallbackFunction: async () => {
          // Fallback to SMS/email instead of voice
          return {
            method: "sms",
            message: "Voice calling unavailable, using SMS",
          };
        },
        dependencies: ["voice_api", "telephony_service"],
      },
      {
        name: "real_time_analytics",
        essential: false,
        degradationThreshold: 1,
        fallbackFunction: async () => {
          // Fallback to cached/delayed analytics
          return { cached: true, message: "Using cached analytics data" };
        },
        dependencies: ["analytics_engine"],
      },
      {
        name: "appointment_booking",
        essential: true,
        degradationThreshold: 4,
        fallbackFunction: async () => {
          // Fallback to manual booking process
          return { manual: true, message: "Manual booking process activated" };
        },
        dependencies: ["calendar_integration"],
      },
      {
        name: "crm_sync",
        essential: true,
        degradationThreshold: 3,
        fallbackFunction: async () => {
          // Fallback to local storage with delayed sync
          return {
            delayed: true,
            message: "CRM sync delayed, using local storage",
          };
        },
        dependencies: ["gohighlevel_api"],
      },
      {
        name: "multi_channel_communication",
        essential: true,
        degradationThreshold: 2,
        fallbackFunction: async () => {
          // Fallback to single channel (email only)
          return {
            channel: "email",
            message: "Using email-only communication",
          };
        },
        dependencies: ["email_service", "sms_service", "whatsapp_service"],
      },
    ];

    defaultCapabilities.forEach((capability) => {
      this.capabilities.set(capability.name, capability);
      this.serviceStatuses.set(capability.name, {
        name: capability.name,
        status: "healthy",
        errorRate: 0,
        degradationLevel: DegradationLevel.NONE,
        disabledCapabilities: [],
        fallbacksActive: [],
      });
    });
  }

  /**
   * Initialize default degradation rules
   */
  private initializeDefaultRules(): void {
    this.degradationRules = [
      {
        id: "critical_system_failure",
        name: "Critical System Failure",
        condition: (context) => context.criticalErrors >= 3,
        action: {
          level: DegradationLevel.EMERGENCY,
          disabledCapabilities: ["real_time_analytics", "voice_calling"],
          fallbackCapabilities: ["crm_sync", "appointment_booking"],
          message:
            "Critical system failure detected - emergency mode activated",
        },
        priority: 1,
        enabled: true,
      },
      {
        id: "high_error_rate",
        name: "High Error Rate",
        condition: (context) => context.errorRate >= 10,
        action: {
          level: DegradationLevel.SEVERE,
          disabledCapabilities: ["real_time_analytics"],
          fallbackCapabilities: [
            "voice_calling",
            "multi_channel_communication",
          ],
          message: "High error rate detected - reducing system load",
        },
        priority: 2,
        enabled: true,
      },
      {
        id: "multiple_circuit_breakers",
        name: "Multiple Circuit Breakers Open",
        condition: (context) => context.circuitBreakerTrips >= 3,
        action: {
          level: DegradationLevel.MODERATE,
          disabledCapabilities: [],
          fallbackCapabilities: ["voice_calling", "crm_sync"],
          message: "Multiple services failing - activating fallbacks",
        },
        priority: 3,
        enabled: true,
      },
      {
        id: "integration_failures",
        name: "External Integration Failures",
        condition: (context) => context.failedServices.length >= 2,
        action: {
          level: DegradationLevel.MINIMAL,
          disabledCapabilities: [],
          fallbackCapabilities: ["crm_sync", "multi_channel_communication"],
          message: "External service issues - using fallback methods",
        },
        priority: 4,
        enabled: true,
      },
    ];
  }

  /**
   * Evaluate current system state and apply degradation if necessary
   */
  async evaluateDegradation(context: DegradationContext): Promise<void> {
    try {
      // Find applicable degradation rules
      const applicableRules = this.degradationRules
        .filter((rule) => rule.enabled && rule.condition(context))
        .sort((a, b) => a.priority - b.priority);

      if (applicableRules.length === 0) {
        // No degradation needed - try to recover
        await this.attemptRecovery();
        return;
      }

      // Apply the highest priority rule
      const rule = applicableRules[0];
      await this.applyDegradation(rule.action, rule.name, context);
    } catch (error) {
      logger.error("Error during degradation evaluation", {
        error: error instanceof Error ? error.message : error,
        context,
      });
    }
  }

  /**
   * Apply degradation action
   */
  private async applyDegradation(
    action: DegradationAction,
    reason: string,
    context: DegradationContext
  ): Promise<void> {
    const previousLevel = this.currentDegradationLevel;
    this.currentDegradationLevel = action.level;

    logger.warn("Applying system degradation", {
      level: action.level,
      reason,
      disabledCapabilities: action.disabledCapabilities,
      fallbackCapabilities: action.fallbackCapabilities,
      previousLevel,
    });

    // Disable specified capabilities
    for (const capabilityName of action.disabledCapabilities) {
      await this.disableCapability(capabilityName);
    }

    // Activate fallbacks for specified capabilities
    for (const capabilityName of action.fallbackCapabilities) {
      await this.activateFallback(capabilityName);
    }

    // Record degradation event
    this.degradationHistory.push({
      timestamp: new Date(),
      level: action.level,
      reason,
      affectedServices: [
        ...action.disabledCapabilities,
        ...action.fallbackCapabilities,
      ],
    });

    // Set auto-recovery timer if specified
    if (action.duration) {
      setTimeout(() => {
        this.attemptRecovery();
      }, action.duration);
    }

    // Notify monitoring system
    this.notifyDegradationChange(action.level, reason);
  }

  /**
   * Disable a service capability
   */
  private async disableCapability(capabilityName: string): Promise<void> {
    const status = this.serviceStatuses.get(capabilityName);
    if (!status) {
      logger.warn("Attempted to disable unknown capability", {
        capabilityName,
      });
      return;
    }

    status.status = "degraded";
    status.degradationLevel = this.currentDegradationLevel;
    status.disabledCapabilities.push(capabilityName);

    logger.info("Capability disabled", {
      capability: capabilityName,
      degradationLevel: this.currentDegradationLevel,
    });
  }

  /**
   * Activate fallback for a service capability
   */
  private async activateFallback(capabilityName: string): Promise<void> {
    const capability = this.capabilities.get(capabilityName);
    const status = this.serviceStatuses.get(capabilityName);

    if (!capability || !status) {
      logger.warn("Attempted to activate fallback for unknown capability", {
        capabilityName,
      });
      return;
    }

    if (capability.fallbackFunction) {
      try {
        const fallbackResult = await capability.fallbackFunction();
        status.fallbacksActive.push(capabilityName);
        status.status = "degraded";

        logger.info("Fallback activated", {
          capability: capabilityName,
          fallbackResult,
        });
      } catch (error) {
        logger.error("Failed to activate fallback", {
          capability: capabilityName,
          error: error instanceof Error ? error.message : error,
        });

        // If fallback fails, disable the capability
        await this.disableCapability(capabilityName);
      }
    } else {
      logger.warn("No fallback function available for capability", {
        capabilityName,
      });
    }
  }

  /**
   * Attempt to recover from degradation
   */
  private async attemptRecovery(): Promise<void> {
    if (this.currentDegradationLevel === DegradationLevel.NONE) {
      return; // Already at normal operation
    }

    logger.info("Attempting system recovery", {
      currentLevel: this.currentDegradationLevel,
    });

    // Check if conditions have improved
    const canRecover = await this.checkRecoveryConditions();

    if (canRecover) {
      await this.performRecovery();
    } else {
      logger.info("Recovery conditions not met, maintaining degradation", {
        currentLevel: this.currentDegradationLevel,
      });
    }
  }

  /**
   * Check if system can recover from current degradation
   */
  private async checkRecoveryConditions(): Promise<boolean> {
    // Get current error statistics
    const errorStats = errorHandler.getErrorStatistics();

    // Check if error rates have decreased
    const currentErrorRate = this.calculateCurrentErrorRate();
    const criticalErrors = this.countRecentCriticalErrors();
    const openCircuitBreakers = errorStats.circuitBreakerStates.filter(
      (cb) => cb.state === "open"
    ).length;

    // Recovery thresholds (more conservative than degradation thresholds)
    const recoveryThresholds = {
      errorRate: 2, // Much lower than degradation threshold
      criticalErrors: 0,
      circuitBreakers: 0,
    };

    return (
      currentErrorRate <= recoveryThresholds.errorRate &&
      criticalErrors <= recoveryThresholds.criticalErrors &&
      openCircuitBreakers <= recoveryThresholds.circuitBreakers
    );
  }

  /**
   * Perform system recovery
   */
  private async performRecovery(): Promise<void> {
    const previousLevel = this.currentDegradationLevel;

    // Gradually recover capabilities
    for (const [capabilityName, status] of this.serviceStatuses.entries()) {
      if (status.status === "degraded") {
        await this.recoverCapability(capabilityName);
      }
    }

    this.currentDegradationLevel = DegradationLevel.NONE;

    logger.info("System recovery completed", {
      previousLevel,
      currentLevel: this.currentDegradationLevel,
    });

    // Record recovery event
    this.degradationHistory.push({
      timestamp: new Date(),
      level: DegradationLevel.NONE,
      reason: "Automatic recovery - conditions improved",
      affectedServices: [],
    });

    this.notifyDegradationChange(DegradationLevel.NONE, "System recovered");
  }

  /**
   * Recover a specific capability
   */
  private async recoverCapability(capabilityName: string): Promise<void> {
    const status = this.serviceStatuses.get(capabilityName);
    if (!status) {
      return;
    }

    // Test the capability before fully recovering
    const testResult = await this.testCapability(capabilityName);

    if (testResult.success) {
      status.status = "healthy";
      status.degradationLevel = DegradationLevel.NONE;
      status.disabledCapabilities = [];
      status.fallbacksActive = [];

      logger.info("Capability recovered", {
        capability: capabilityName,
        testResult,
      });
    } else {
      logger.warn("Capability recovery failed test", {
        capability: capabilityName,
        testResult,
      });
    }
  }

  /**
   * Test a capability to see if it's working
   */
  private async testCapability(
    capabilityName: string
  ): Promise<{ success: boolean; message?: string }> {
    const capability = this.capabilities.get(capabilityName);
    if (!capability) {
      return { success: false, message: "Capability not found" };
    }

    try {
      // This would be implemented with actual health checks for each capability
      // For now, we'll simulate a basic test
      await this.simulateCapabilityTest(capabilityName);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Simulate capability test (placeholder for actual tests)
   */
  private async simulateCapabilityTest(capabilityName: string): Promise<void> {
    // Simulate test delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    // For simulation, assume tests pass most of the time
    if (Math.random() < 0.1) {
      throw new Error(`Simulated test failure for ${capabilityName}`);
    }
  }

  /**
   * Start monitoring for degradation conditions
   */
  private startMonitoring(): void {
    const monitoringInterval = 30000; // 30 seconds

    setInterval(async () => {
      try {
        const context = await this.gatherDegradationContext();
        await this.evaluateDegradation(context);
      } catch (error) {
        logger.error("Error during degradation monitoring", {
          error: error instanceof Error ? error.message : error,
        });
      }
    }, monitoringInterval);

    logger.info("Graceful degradation monitoring started");
  }

  /**
   * Gather context for degradation decisions
   */
  private async gatherDegradationContext(): Promise<DegradationContext> {
    const errorStats = errorHandler.getErrorStatistics();

    return {
      errorRate: this.calculateCurrentErrorRate(),
      criticalErrors: this.countRecentCriticalErrors(),
      failedServices: this.getFailedServices(),
      circuitBreakerTrips: errorStats.circuitBreakerStates.filter(
        (cb) => cb.state === "open"
      ).length,
      systemLoad: await this.getSystemLoad(),
      timestamp: new Date(),
    };
  }

  /**
   * Calculate current error rate
   */
  private calculateCurrentErrorRate(): number {
    // This would be implemented with actual error tracking
    // For now, return a simulated value
    return Math.floor(Math.random() * 5);
  }

  /**
   * Count recent critical errors
   */
  private countRecentCriticalErrors(): number {
    // This would be implemented with actual error tracking
    // For now, return a simulated value
    return Math.floor(Math.random() * 2);
  }

  /**
   * Get list of failed services
   */
  private getFailedServices(): string[] {
    return Array.from(this.serviceStatuses.entries())
      .filter(([_, status]) => status.status === "failed")
      .map(([name, _]) => name);
  }

  /**
   * Get system load metrics
   */
  private async getSystemLoad(): Promise<number> {
    // This would be implemented with actual system monitoring
    // For now, return a simulated value
    return Math.random();
  }

  /**
   * Notify about degradation changes
   */
  private notifyDegradationChange(
    level: DegradationLevel,
    reason: string
  ): void {
    // This would integrate with the monitoring service
    logger.info("Degradation level changed", {
      level,
      reason,
      timestamp: new Date(),
    });
  }

  /**
   * Register a new service capability
   */
  registerCapability(capability: ServiceCapability): void {
    this.capabilities.set(capability.name, capability);
    this.serviceStatuses.set(capability.name, {
      name: capability.name,
      status: "healthy",
      errorRate: 0,
      degradationLevel: DegradationLevel.NONE,
      disabledCapabilities: [],
      fallbacksActive: [],
    });

    logger.info("Service capability registered", {
      capability: capability.name,
      essential: capability.essential,
    });
  }

  /**
   * Add degradation rule
   */
  addDegradationRule(rule: DegradationRule): void {
    const existingIndex = this.degradationRules.findIndex(
      (r) => r.id === rule.id
    );
    if (existingIndex >= 0) {
      this.degradationRules[existingIndex] = rule;
    } else {
      this.degradationRules.push(rule);
    }

    // Sort rules by priority
    this.degradationRules.sort((a, b) => a.priority - b.priority);

    logger.info("Degradation rule added", {
      ruleId: rule.id,
      ruleName: rule.name,
    });
  }

  /**
   * Get current system status
   */
  getSystemStatus(): {
    degradationLevel: DegradationLevel;
    serviceStatuses: Record<string, ServiceStatus>;
    degradationHistory: Array<{
      timestamp: Date;
      level: DegradationLevel;
      reason: string;
      affectedServices: string[];
    }>;
    activeRules: string[];
  } {
    const activeRules = this.degradationRules
      .filter((rule) => rule.enabled)
      .map((rule) => rule.name);

    const serviceStatuses: Record<string, ServiceStatus> = {};
    this.serviceStatuses.forEach((status, name) => {
      serviceStatuses[name] = { ...status };
    });

    return {
      degradationLevel: this.currentDegradationLevel,
      serviceStatuses,
      degradationHistory: [...this.degradationHistory],
      activeRules,
    };
  }

  /**
   * Force degradation for testing or manual intervention
   */
  async forceDegradation(
    level: DegradationLevel,
    reason: string,
    capabilities?: string[]
  ): Promise<void> {
    const action: DegradationAction = {
      level,
      disabledCapabilities: capabilities || [],
      fallbackCapabilities: [],
      message: `Manual degradation: ${reason}`,
    };

    await this.applyDegradation(action, reason, {
      errorRate: 0,
      criticalErrors: 0,
      failedServices: [],
      circuitBreakerTrips: 0,
      systemLoad: 0,
      timestamp: new Date(),
    });
  }

  /**
   * Force recovery for testing or manual intervention
   */
  async forceRecovery(): Promise<void> {
    await this.performRecovery();
  }

  /**
   * Clear degradation history (useful for testing)
   */
  clearHistory(): void {
    this.degradationHistory = [];
    logger.info("Degradation history cleared");
  }
}

// Export singleton instance
export const gracefulDegradationService = new GracefulDegradationService();
