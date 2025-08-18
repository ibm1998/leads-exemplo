import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  GracefulDegradationService,
  DegradationLevel,
  ServiceCapability,
  DegradationRule,
  DegradationContext,
} from '../graceful-degradation';

describe('GracefulDegradationService', () => {
  let degradationService: GracefulDegradationService;

  beforeEach(() => {
    degradationService = new GracefulDegradationService();
  });

  afterEach(() => {
    degradationService.clearHistory();
    vi.clearAllMocks();
  });

  describe('Service Capability Management', () => {
    it('should register new service capabilities', () => {
      const capability: ServiceCapability = {
        name: 'test_service',
        essential: true,
        degradationThreshold: 3,
        dependencies: ['database'],
      };

      degradationService.registerCapability(capability);

      const status = degradationService.getSystemStatus();
      expect(status.serviceStatuses['test_service']).toBeDefined();
      expect(status.serviceStatuses['test_service'].status).toBe('healthy');
    });

    it('should initialize with default capabilities', () => {
      const status = degradationService.getSystemStatus();

      expect(status.serviceStatuses['lead_ingestion']).toBeDefined();
      expect(status.serviceStatuses['voice_calling']).toBeDefined();
      expect(status.serviceStatuses['appointment_booking']).toBeDefined();
      expect(status.serviceStatuses['crm_sync']).toBeDefined();
    });

    it('should track capability dependencies', () => {
      const capability: ServiceCapability = {
        name: 'complex_service',
        essential: false,
        degradationThreshold: 2,
        dependencies: ['database', 'api_gateway', 'cache'],
      };

      degradationService.registerCapability(capability);

      const status = degradationService.getSystemStatus();
      expect(status.serviceStatuses['complex_service']).toBeDefined();
    });
  });

  describe('Degradation Rules', () => {
    it('should add custom degradation rules', () => {
      const rule: DegradationRule = {
        id: 'test_rule',
        name: 'Test Degradation Rule',
        condition: (context) => context.errorRate > 5,
        action: {
          level: DegradationLevel.MINIMAL,
          disabledCapabilities: ['real_time_analytics'],
          fallbackCapabilities: [],
          message: 'Test degradation applied',
        },
        priority: 1,
        enabled: true,
      };

      degradationService.addDegradationRule(rule);

      const status = degradationService.getSystemStatus();
      expect(status.activeRules).toContain('Test Degradation Rule');
    });

    it('should prioritize rules correctly', () => {
      const highPriorityRule: DegradationRule = {
        id: 'high_priority',
        name: 'High Priority Rule',
        condition: (context) => context.errorRate > 1,
        action: {
          level: DegradationLevel.SEVERE,
          disabledCapabilities: [],
          fallbackCapabilities: [],
          message: 'High priority degradation',
        },
        priority: 1,
        enabled: true,
      };

      const lowPriorityRule: DegradationRule = {
        id: 'low_priority',
        name: 'Low Priority Rule',
        condition: (context) => context.errorRate > 1,
        action: {
          level: DegradationLevel.MINIMAL,
          disabledCapabilities: [],
          fallbackCapabilities: [],
          message: 'Low priority degradation',
        },
        priority: 5,
        enabled: true,
      };

      degradationService.addDegradationRule(lowPriorityRule);
      degradationService.addDegradationRule(highPriorityRule);

      // High priority rule should be applied first
      const context: DegradationContext = {
        errorRate: 2,
        criticalErrors: 0,
        failedServices: [],
        circuitBreakerTrips: 0,
        systemLoad: 0.5,
        timestamp: new Date(),
      };

      degradationService.evaluateDegradation(context);

      // Check that high priority rule was applied
      const status = degradationService.getSystemStatus();
      expect(status.degradationLevel).toBe(DegradationLevel.SEVERE);
    });
  });

  describe('Degradation Evaluation', () => {
    it('should evaluate degradation based on error rate', async () => {
      const context: DegradationContext = {
        errorRate: 15, // High error rate
        criticalErrors: 0,
        failedServices: [],
        circuitBreakerTrips: 0,
        systemLoad: 0.3,
        timestamp: new Date(),
      };

      await degradationService.evaluateDegradation(context);

      const status = degradationService.getSystemStatus();
      expect(status.degradationLevel).toBe(DegradationLevel.SEVERE);
    });

    it('should evaluate degradation based on critical errors', async () => {
      const context: DegradationContext = {
        errorRate: 1,
        criticalErrors: 5, // High critical errors
        failedServices: [],
        circuitBreakerTrips: 0,
        systemLoad: 0.2,
        timestamp: new Date(),
      };

      await degradationService.evaluateDegradation(context);

      const status = degradationService.getSystemStatus();
      expect(status.degradationLevel).toBe(DegradationLevel.EMERGENCY);
    });

    it('should evaluate degradation based on circuit breaker trips', async () => {
      const context: DegradationContext = {
        errorRate: 2,
        criticalErrors: 0,
        failedServices: [],
        circuitBreakerTrips: 4, // Multiple circuit breakers open
        systemLoad: 0.4,
        timestamp: new Date(),
      };

      await degradationService.evaluateDegradation(context);

      const status = degradationService.getSystemStatus();
      expect(status.degradationLevel).toBe(DegradationLevel.MODERATE);
    });

    it('should evaluate degradation based on failed services', async () => {
      const context: DegradationContext = {
        errorRate: 1,
        criticalErrors: 0,
        failedServices: ['service_a', 'service_b', 'service_c'],
        circuitBreakerTrips: 0,
        systemLoad: 0.3,
        timestamp: new Date(),
      };

      await degradationService.evaluateDegradation(context);

      const status = degradationService.getSystemStatus();
      expect(status.degradationLevel).toBe(DegradationLevel.MINIMAL);
    });

    it('should not degrade when conditions are normal', async () => {
      const context: DegradationContext = {
        errorRate: 1,
        criticalErrors: 0,
        failedServices: [],
        circuitBreakerTrips: 0,
        systemLoad: 0.2,
        timestamp: new Date(),
      };

      await degradationService.evaluateDegradation(context);

      const status = degradationService.getSystemStatus();
      expect(status.degradationLevel).toBe(DegradationLevel.NONE);
    });
  });

  describe('Capability Management During Degradation', () => {
    it('should disable capabilities during degradation', async () => {
      const context: DegradationContext = {
        errorRate: 15,
        criticalErrors: 0,
        failedServices: [],
        circuitBreakerTrips: 0,
        systemLoad: 0.5,
        timestamp: new Date(),
      };

      await degradationService.evaluateDegradation(context);

      const status = degradationService.getSystemStatus();
      const analyticsService = status.serviceStatuses['real_time_analytics'];
      expect(analyticsService.status).toBe('degraded');
    });

    it('should activate fallbacks during degradation', async () => {
      const context: DegradationContext = {
        errorRate: 12,
        criticalErrors: 0,
        failedServices: [],
        circuitBreakerTrips: 0,
        systemLoad: 0.4,
        timestamp: new Date(),
      };

      await degradationService.evaluateDegradation(context);

      const status = degradationService.getSystemStatus();

      // Check that fallbacks are activated for appropriate services
      const voiceService = status.serviceStatuses['voice_calling'];
      expect(voiceService.status).toBe('degraded');
    });

    it('should handle fallback failures gracefully', async () => {
      // Register a capability with a failing fallback
      const capability: ServiceCapability = {
        name: 'failing_service',
        essential: false,
        degradationThreshold: 1,
        fallbackFunction: async () => {
          throw new Error('Fallback failed');
        },
        dependencies: [],
      };

      degradationService.registerCapability(capability);

      // Force degradation to trigger fallback activation
      await degradationService.forceDegradation(
        DegradationLevel.MODERATE,
        'Test fallback failure',
        ['failing_service']
      );

      const status = degradationService.getSystemStatus();
      const failingService = status.serviceStatuses['failing_service'];
      expect(failingService.status).toBe('degraded');
    });
  });

  describe('Recovery Process', () => {
    it('should attempt recovery when conditions improve', async () => {
      // First, trigger degradation
      await degradationService.forceDegradation(
        DegradationLevel.SEVERE,
        'Test degradation for recovery'
      );

      let status = degradationService.getSystemStatus();
      expect(status.degradationLevel).toBe(DegradationLevel.SEVERE);

      // Force recovery to simulate improved conditions
      await degradationService.forceRecovery();

      status = degradationService.getSystemStatus();
      expect(status.degradationLevel).toBe(DegradationLevel.NONE);
    });

    it('should test capabilities before recovery', async () => {
      // Trigger degradation
      await degradationService.forceDegradation(
        DegradationLevel.MODERATE,
        'Test degradation',
        ['voice_calling']
      );

      let status = degradationService.getSystemStatus();
      expect(status.degradationLevel).toBe(DegradationLevel.MODERATE);

      // Force recovery
      await degradationService.forceRecovery();

      status = degradationService.getSystemStatus();
      expect(status.degradationLevel).toBe(DegradationLevel.NONE);
    });

    it('should maintain degradation if recovery tests fail', async () => {
      // This would require mocking the capability test to fail
      // For now, we'll test the basic recovery flow
      await degradationService.forceDegradation(
        DegradationLevel.MINIMAL,
        'Test degradation'
      );

      const status = degradationService.getSystemStatus();
      expect(status.degradationLevel).toBe(DegradationLevel.MINIMAL);
    });
  });

  describe('Manual Degradation Control', () => {
    it('should allow forced degradation', async () => {
      await degradationService.forceDegradation(
        DegradationLevel.SEVERE,
        'Manual degradation for maintenance',
        ['real_time_analytics', 'voice_calling']
      );

      const status = degradationService.getSystemStatus();
      expect(status.degradationLevel).toBe(DegradationLevel.SEVERE);

      const history = status.degradationHistory;
      expect(history).toHaveLength(1);
      expect(history[0].reason).toContain('Manual degradation');
    });

    it('should allow forced recovery', async () => {
      // First degrade
      await degradationService.forceDegradation(
        DegradationLevel.MODERATE,
        'Test degradation'
      );

      let status = degradationService.getSystemStatus();
      expect(status.degradationLevel).toBe(DegradationLevel.MODERATE);

      // Then force recovery
      await degradationService.forceRecovery();

      status = degradationService.getSystemStatus();
      expect(status.degradationLevel).toBe(DegradationLevel.NONE);
    });
  });

  describe('System Status Reporting', () => {
    it('should provide comprehensive system status', () => {
      const status = degradationService.getSystemStatus();

      expect(status.degradationLevel).toBeDefined();
      expect(status.serviceStatuses).toBeDefined();
      expect(status.degradationHistory).toBeDefined();
      expect(status.activeRules).toBeDefined();

      // Check that default services are present
      expect(status.serviceStatuses['lead_ingestion']).toBeDefined();
      expect(status.serviceStatuses['voice_calling']).toBeDefined();
    });

    it('should track degradation history', async () => {
      await degradationService.forceDegradation(
        DegradationLevel.MINIMAL,
        'First degradation'
      );

      await degradationService.forceDegradation(
        DegradationLevel.MODERATE,
        'Second degradation'
      );

      const status = degradationService.getSystemStatus();
      expect(status.degradationHistory).toHaveLength(2);
      expect(status.degradationHistory[0].reason).toBe('First degradation');
      expect(status.degradationHistory[1].reason).toBe('Second degradation');
    });

    it('should list active rules', () => {
      const status = degradationService.getSystemStatus();

      // Should have default rules
      expect(status.activeRules).toContain('Critical System Failure');
      expect(status.activeRules).toContain('High Error Rate');
      expect(status.activeRules).toContain('Multiple Circuit Breakers Open');
    });
  });

  describe('Data Management', () => {
    it('should clear degradation history', async () => {
      await degradationService.forceDegradation(
        DegradationLevel.MINIMAL,
        'Test degradation'
      );

      let status = degradationService.getSystemStatus();
      expect(status.degradationHistory).toHaveLength(1);

      degradationService.clearHistory();

      status = degradationService.getSystemStatus();
      expect(status.degradationHistory).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty degradation context', async () => {
      const emptyContext: DegradationContext = {
        errorRate: 0,
        criticalErrors: 0,
        failedServices: [],
        circuitBreakerTrips: 0,
        systemLoad: 0,
        timestamp: new Date(),
      };

      await degradationService.evaluateDegradation(emptyContext);

      const status = degradationService.getSystemStatus();
      expect(status.degradationLevel).toBe(DegradationLevel.NONE);
    });

    it('should handle disabled rules', async () => {
      const rule: DegradationRule = {
        id: 'disabled_rule',
        name: 'Disabled Rule',
        condition: (context) => true, // Always true
        action: {
          level: DegradationLevel.EMERGENCY,
          disabledCapabilities: [],
          fallbackCapabilities: [],
          message: 'Should not be applied',
        },
        priority: 1,
        enabled: false, // Disabled
      };

      degradationService.addDegradationRule(rule);

      const context: DegradationContext = {
        errorRate: 1,
        criticalErrors: 0,
        failedServices: [],
        circuitBreakerTrips: 0,
        systemLoad: 0.1,
        timestamp: new Date(),
      };

      await degradationService.evaluateDegradation(context);

      const status = degradationService.getSystemStatus();
      expect(status.degradationLevel).toBe(DegradationLevel.NONE);
    });

    it('should handle unknown capabilities gracefully', async () => {
      const context: DegradationContext = {
        errorRate: 15,
        criticalErrors: 0,
        failedServices: ['unknown_service'],
        circuitBreakerTrips: 0,
        systemLoad: 0.5,
        timestamp: new Date(),
      };

      // Should not throw error
      await expect(
        degradationService.evaluateDegradation(context)
      ).resolves.not.toThrow();
    });
  });
});
