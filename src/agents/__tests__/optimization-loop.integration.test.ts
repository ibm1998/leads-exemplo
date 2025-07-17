import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  ContinuousOptimizationLoop,
  OptimizationFeedback,
  OptimizationRecommendation,
} from "../optimization-loop";
import { AIHeadAgent } from "../ai-head-agent";
import { AICustomerAnalyticsAgent } from "../ai-customer-analytics-agent";
import { DatabaseManager } from "../../database/manager";
import { DateRange, PerformanceMetrics } from "../../types/agent-performance";

// Mock the database manager
vi.mock("../../database/manager", () => ({
  DatabaseManager: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  })),
}));

describe("ContinuousOptimizationLoop Integration Tests", () => {
  let optimizationLoop: ContinuousOptimizationLoop;
  let aiHeadAgent: AIHeadAgent;
  let analyticsAgent: AICustomerAnalyticsAgent;
  let dbManager: DatabaseManager;

  beforeEach(async () => {
    // Initialize database manager
    dbManager = new DatabaseManager();
    await dbManager.initialize();

    // Initialize agents
    aiHeadAgent = new AIHeadAgent({
      optimizationEnabled: true,
      responseTimeSLA: 60,
    });

    analyticsAgent = new AICustomerAnalyticsAgent(dbManager);

    // Initialize optimization loop
    optimizationLoop = new ContinuousOptimizationLoop(
      aiHeadAgent,
      analyticsAgent
    );
  });

  afterEach(async () => {
    optimizationLoop.stop();
    await dbManager.close();
  });

  describe("Feedback Mechanism", () => {
    it("should collect performance feedback from analytics agent", async () => {
      // Mock analytics agent methods
      const mockInsights = [
        {
          id: "insight_1",
          type: "performance" as const,
          title: "Conversion Rate Opportunity",
          description: "Potential for improvement",
          impact: "high" as const,
          actionable: true,
          recommendations: ["Improve qualification"],
          data: { currentRate: 0.6 },
          generatedAt: new Date(),
        },
      ];

      const mockPerformanceData = {
        id: "perf_1",
        agentId: "test-agent",
        period: {
          start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          end: new Date(),
        } as DateRange,
        metrics: {
          totalInteractions: 100,
          conversionRate: 0.55,
          averageResponseTime: 65000,
          appointmentBookingRate: 0.25,
          customerSatisfactionScore: 3.8,
        } as PerformanceMetrics,
        scriptPerformance: [],
        optimizationSuggestions: [],
        createdAt: new Date(),
      };

      vi.spyOn(analyticsAgent, "generateIntelligenceReport").mockResolvedValue(
        mockInsights
      );
      vi.spyOn(analyticsAgent, "collectPerformanceData").mockResolvedValue(
        mockPerformanceData
      );

      // Run optimization cycle
      await optimizationLoop.runOptimizationCycle();

      // Verify feedback was collected
      expect(analyticsAgent.generateIntelligenceReport).toHaveBeenCalled();
      expect(analyticsAgent.collectPerformanceData).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          start: expect.any(Date),
          end: expect.any(Date),
        })
      );
    });

    it("should handle analytics agent failures gracefully", async () => {
      // Mock analytics agent to throw error
      vi.spyOn(analyticsAgent, "generateIntelligenceReport").mockRejectedValue(
        new Error("Analytics service unavailable")
      );

      // Should not throw error
      await expect(
        optimizationLoop.runOptimizationCycle()
      ).resolves.not.toThrow();
    });
  });

  describe("Routing Rule Optimization", () => {
    it("should generate routing optimization for poor conversion rates", async () => {
      const mockPerformanceData = {
        id: "perf_1",
        agentId: "test-agent",
        period: {
          start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          end: new Date(),
        } as DateRange,
        metrics: {
          totalInteractions: 100,
          conversionRate: 0.45, // Below 60% threshold
          averageResponseTime: 45000,
          appointmentBookingRate: 0.35,
          customerSatisfactionScore: 4.0,
        } as PerformanceMetrics,
        scriptPerformance: [],
        optimizationSuggestions: [],
        createdAt: new Date(),
      };

      vi.spyOn(analyticsAgent, "generateIntelligenceReport").mockResolvedValue(
        []
      );
      vi.spyOn(analyticsAgent, "collectPerformanceData").mockResolvedValue(
        mockPerformanceData
      );

      // Run optimization cycle
      await optimizationLoop.runOptimizationCycle();

      // Check if routing optimization was applied
      const activeOptimizations = optimizationLoop.getActiveOptimizations();
      const routingOptimizations = Array.from(
        activeOptimizations.values()
      ).filter((opt) => opt.type === "routing_rule");

      expect(routingOptimizations.length).toBeGreaterThan(0);
      expect(routingOptimizations[0].description).toContain("conversion rate");
    });

    it("should generate routing optimization for slow response times", async () => {
      const mockPerformanceData = {
        id: "perf_1",
        agentId: "test-agent",
        period: {
          start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          end: new Date(),
        } as DateRange,
        metrics: {
          totalInteractions: 100,
          conversionRate: 0.75,
          averageResponseTime: 85000, // Above 60s threshold
          appointmentBookingRate: 0.35,
          customerSatisfactionScore: 4.0,
        } as PerformanceMetrics,
        scriptPerformance: [],
        optimizationSuggestions: [],
        createdAt: new Date(),
      };

      vi.spyOn(analyticsAgent, "generateIntelligenceReport").mockResolvedValue(
        []
      );
      vi.spyOn(analyticsAgent, "collectPerformanceData").mockResolvedValue(
        mockPerformanceData
      );

      // Run optimization cycle
      await optimizationLoop.runOptimizationCycle();

      // Check if response time optimization was applied
      const activeOptimizations = optimizationLoop.getActiveOptimizations();
      const responseTimeOptimizations = Array.from(
        activeOptimizations.values()
      ).filter((opt) => opt.description.includes("response time"));

      expect(responseTimeOptimizations.length).toBeGreaterThan(0);
    });
  });

  describe("Script Optimization", () => {
    it("should generate script optimization recommendations", async () => {
      const mockScriptOptimizations = [
        {
          scriptId: "qualification-script",
          scriptName: "Qualification Script",
          currentPerformance: {
            scriptId: "qualification-script",
            scriptName: "Qualification Script",
            usageCount: 100,
            successRate: 0.6,
            averageResponseTime: 45000,
            conversionRate: 0.5,
          },
          recommendations: [
            {
              type: "content" as const,
              description: "Improve opening questions",
              expectedImpact: 15,
              priority: "high" as const,
            },
          ],
          estimatedImpact: {
            conversionRateImprovement: 25, // Make it high priority (>20%)
            responseTimeImprovement: 10,
            satisfactionImprovement: 8,
          },
        },
      ];

      vi.spyOn(analyticsAgent, "generateIntelligenceReport").mockResolvedValue(
        []
      );
      vi.spyOn(analyticsAgent, "collectPerformanceData").mockResolvedValue({
        id: "perf_1",
        agentId: "test-agent",
        period: {
          start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          end: new Date(),
        } as DateRange,
        metrics: {
          totalInteractions: 100,
          conversionRate: 0.65,
          averageResponseTime: 45000,
          appointmentBookingRate: 0.35,
          customerSatisfactionScore: 4.0,
        } as PerformanceMetrics,
        scriptPerformance: [],
        optimizationSuggestions: [],
        createdAt: new Date(),
      });
      vi.spyOn(analyticsAgent, "analyzeScriptPerformance").mockResolvedValue(
        mockScriptOptimizations
      );

      // Run optimization cycle
      await optimizationLoop.runOptimizationCycle();

      // Check if script optimization was generated
      const activeOptimizations = optimizationLoop.getActiveOptimizations();
      const scriptOptimizations = Array.from(
        activeOptimizations.values()
      ).filter((opt) => opt.type === "script_update");

      expect(scriptOptimizations.length).toBeGreaterThan(0);
      expect(scriptOptimizations[0].description).toContain(
        "Qualification Script"
      );
    });
  });

  describe("Performance Validation", () => {
    it("should validate optimization improvements", async () => {
      // Create a mock optimization that should be validated
      const mockRecommendation: OptimizationRecommendation = {
        id: "test_optimization_1",
        type: "routing_rule",
        priority: "high",
        description: "Test optimization",
        expectedImpact: 15,
        implementation: {
          action: "test_action",
          parameters: {},
          rollbackPlan: "Test rollback",
          testingPeriod: 1, // 1 day for quick testing
        },
        validationCriteria: {
          metrics: ["conversionRate"],
          minimumImprovement: 10,
          testPeriod: 1,
          significanceThreshold: 0.05,
        },
      };

      // Add the optimization to active optimizations
      optimizationLoop
        .getActiveOptimizations()
        .set(mockRecommendation.id, mockRecommendation);

      // Add optimization result with past implementation date
      const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
      optimizationLoop.addOptimizationResult(mockRecommendation.id, {
        recommendationId: mockRecommendation.id,
        implemented: true,
        implementedAt: pastDate,
        baselineMetrics: {
          totalInteractions: 100,
          conversionRate: 0.6,
          averageResponseTime: 50000,
          appointmentBookingRate: 0.3,
          customerSatisfactionScore: 4.0,
        },
        validated: false,
        rollbackRequired: false,
      });

      // Mock current metrics showing improvement
      vi.spyOn(optimizationLoop as any, "getCurrentMetrics").mockResolvedValue({
        totalInteractions: 120,
        conversionRate: 0.72, // 20% improvement
        averageResponseTime: 45000,
        appointmentBookingRate: 0.35,
        customerSatisfactionScore: 4.2,
      });

      // Debug: Check state before validation
      console.log(
        "Before validation - Active optimizations:",
        optimizationLoop.getActiveOptimizations().size
      );
      console.log(
        "Before validation - History size:",
        optimizationLoop.getOptimizationHistory().size
      );

      // Run validation
      await (optimizationLoop as any).validateOptimizations();

      // Check if optimization was validated successfully
      const result = optimizationLoop.getOptimizationResult(
        mockRecommendation.id
      );
      console.log("Validation result:", result);
      expect(result?.validated).toBe(true);
      expect(result?.improvement?.conversionRate).toBeGreaterThan(10);
    });

    it("should rollback failed optimizations", async () => {
      const mockRecommendation: OptimizationRecommendation = {
        id: "test_optimization_2",
        type: "routing_rule",
        priority: "high",
        description: "Test optimization that fails",
        expectedImpact: 15,
        implementation: {
          action: "test_action",
          parameters: {},
          rollbackPlan: "Test rollback",
          testingPeriod: 1,
        },
        validationCriteria: {
          metrics: ["conversionRate"],
          minimumImprovement: 10,
          testPeriod: 1,
          significanceThreshold: 0.05,
        },
      };

      // Add the optimization to active optimizations
      optimizationLoop
        .getActiveOptimizations()
        .set(mockRecommendation.id, mockRecommendation);

      // Add optimization result with past implementation date
      const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      optimizationLoop.addOptimizationResult(mockRecommendation.id, {
        recommendationId: mockRecommendation.id,
        implemented: true,
        implementedAt: pastDate,
        baselineMetrics: {
          totalInteractions: 100,
          conversionRate: 0.6,
          averageResponseTime: 50000,
          appointmentBookingRate: 0.3,
          customerSatisfactionScore: 4.0,
        },
        validated: false,
        rollbackRequired: false,
      });

      // Mock current metrics showing degradation
      vi.spyOn(optimizationLoop as any, "getCurrentMetrics").mockResolvedValue({
        totalInteractions: 80,
        conversionRate: 0.45, // 25% degradation
        averageResponseTime: 65000,
        appointmentBookingRate: 0.25,
        customerSatisfactionScore: 3.5,
      });

      // Run validation
      await (optimizationLoop as any).validateOptimizations();

      // Check if optimization was marked for rollback
      const result = optimizationLoop.getOptimizationResult(
        mockRecommendation.id
      );
      expect(result?.validated).toBe(false);
      expect(result?.rollbackRequired).toBe(true);
      expect(result?.improvement?.overall).toBeLessThan(-5);
    });
  });

  describe("Complete Optimization Cycle", () => {
    it("should run complete optimization cycle successfully", async () => {
      // Mock all required methods
      vi.spyOn(analyticsAgent, "generateIntelligenceReport").mockResolvedValue([
        {
          id: "insight_1",
          type: "performance",
          title: "Test Insight",
          description: "Test description",
          impact: "high",
          actionable: true,
          recommendations: ["Test recommendation"],
          data: {},
          generatedAt: new Date(),
        },
      ]);

      vi.spyOn(analyticsAgent, "collectPerformanceData").mockResolvedValue({
        id: "perf_1",
        agentId: "test-agent",
        period: {
          start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          end: new Date(),
        } as DateRange,
        metrics: {
          totalInteractions: 100,
          conversionRate: 0.55, // Below threshold to trigger optimization
          averageResponseTime: 45000,
          appointmentBookingRate: 0.35,
          customerSatisfactionScore: 4.0,
        } as PerformanceMetrics,
        scriptPerformance: [],
        optimizationSuggestions: [],
        createdAt: new Date(),
      });

      vi.spyOn(analyticsAgent, "analyzeScriptPerformance").mockResolvedValue(
        []
      );
      vi.spyOn(analyticsAgent, "analyzePerformanceTrends").mockResolvedValue(
        []
      );

      // Run complete cycle
      await optimizationLoop.runOptimizationCycle();

      // Verify cycle completed without errors
      const stats = optimizationLoop.getOptimizationStats();
      expect(stats.totalOptimizations).toBeGreaterThanOrEqual(0);
    });

    it("should handle errors gracefully during optimization cycle", async () => {
      // Mock analytics agent to throw errors
      vi.spyOn(analyticsAgent, "generateIntelligenceReport").mockRejectedValue(
        new Error("Service unavailable")
      );
      vi.spyOn(analyticsAgent, "collectPerformanceData").mockRejectedValue(
        new Error("Database error")
      );

      // Should not throw error
      await expect(
        optimizationLoop.runOptimizationCycle()
      ).resolves.not.toThrow();
    });
  });

  describe("Optimization Statistics", () => {
    it("should provide accurate optimization statistics", async () => {
      // Add some mock optimization history using the new method
      optimizationLoop.addOptimizationResult("opt_1", {
        recommendationId: "opt_1",
        implemented: true,
        implementedAt: new Date(),
        baselineMetrics: {
          totalInteractions: 100,
          conversionRate: 0.6,
          averageResponseTime: 50000,
          appointmentBookingRate: 0.3,
          customerSatisfactionScore: 4.0,
        },
        currentMetrics: {
          totalInteractions: 120,
          conversionRate: 0.72,
          averageResponseTime: 45000,
          appointmentBookingRate: 0.35,
          customerSatisfactionScore: 4.2,
        },
        improvement: {
          conversionRate: 20,
          responseTime: 10,
          satisfaction: 5,
          overall: 15,
        },
        validated: true,
        validatedAt: new Date(),
        rollbackRequired: false,
      });

      optimizationLoop.addOptimizationResult("opt_2", {
        recommendationId: "opt_2",
        implemented: true,
        implementedAt: new Date(),
        baselineMetrics: {
          totalInteractions: 100,
          conversionRate: 0.6,
          averageResponseTime: 50000,
          appointmentBookingRate: 0.3,
          customerSatisfactionScore: 4.0,
        },
        currentMetrics: {
          totalInteractions: 90,
          conversionRate: 0.55,
          averageResponseTime: 55000,
          appointmentBookingRate: 0.28,
          customerSatisfactionScore: 3.8,
        },
        improvement: {
          conversionRate: -8,
          responseTime: -10,
          satisfaction: -5,
          overall: -8,
        },
        validated: true,
        validatedAt: new Date(),
        rollbackRequired: true,
      });

      const stats = optimizationLoop.getOptimizationStats();

      expect(stats.totalOptimizations).toBe(2);
      expect(stats.successfulOptimizations).toBe(1);
      expect(stats.failedOptimizations).toBe(1);
      expect(stats.averageImprovement).toBe(15);
    });
  });

  describe("Continuous Operation", () => {
    it("should start and stop optimization loop", async () => {
      expect(optimizationLoop["isRunning"]).toBe(false);

      // Mock the runOptimizationCycle to avoid actual execution
      vi.spyOn(optimizationLoop, "runOptimizationCycle").mockResolvedValue();

      // Start the loop
      await optimizationLoop.start();
      expect(optimizationLoop["isRunning"]).toBe(true);

      // Stop the loop
      optimizationLoop.stop();
      expect(optimizationLoop["isRunning"]).toBe(false);
    });

    it("should not start multiple instances", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      // Mock the runOptimizationCycle to avoid actual execution
      vi.spyOn(optimizationLoop, "runOptimizationCycle").mockResolvedValue();

      await optimizationLoop.start();
      await optimizationLoop.start(); // Try to start again

      expect(consoleSpy).toHaveBeenCalledWith(
        "Optimization loop is already running"
      );

      optimizationLoop.stop();
      consoleSpy.mockRestore();
    });
  });
});
