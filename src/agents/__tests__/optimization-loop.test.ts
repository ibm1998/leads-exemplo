import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  ContinuousOptimizationLoop,
  OptimizationFeedback,
  OptimizationRecommendation,
  OptimizationResult,
} from "../optimization-loop";
import { AIHeadAgent } from "../ai-head-agent";
import { AICustomerAnalyticsAgent } from "../ai-customer-analytics-agent";
import { DatabaseManager } from "../../database/manager";
import { DateRange, PerformanceMetrics } from "../../types/agent-performance";

// Mock the database manager
vi.mock("../../database/manager");

describe("ContinuousOptimizationLoop Unit Tests", () => {
  let optimizationLoop: ContinuousOptimizationLoop;
  let mockAIHeadAgent: AIHeadAgent;
  let mockAnalyticsAgent: AICustomerAnalyticsAgent;
  let mockDbManager: DatabaseManager;

  beforeEach(() => {
    mockDbManager = new DatabaseManager();
    mockAIHeadAgent = new AIHeadAgent();
    mockAnalyticsAgent = new AICustomerAnalyticsAgent(mockDbManager);
    optimizationLoop = new ContinuousOptimizationLoop(
      mockAIHeadAgent,
      mockAnalyticsAgent
    );
  });

  describe("Constructor", () => {
    it("should initialize with provided agents", () => {
      expect(optimizationLoop).toBeInstanceOf(ContinuousOptimizationLoop);
      expect(optimizationLoop["aiHeadAgent"]).toBe(mockAIHeadAgent);
      expect(optimizationLoop["analyticsAgent"]).toBe(mockAnalyticsAgent);
    });

    it("should initialize with empty optimization history", () => {
      const history = optimizationLoop.getOptimizationHistory();
      expect(history.size).toBe(0);
    });

    it("should initialize with empty active optimizations", () => {
      const active = optimizationLoop.getActiveOptimizations();
      expect(active.size).toBe(0);
    });
  });

  describe("Feedback Processing", () => {
    it("should add feedback to queue", () => {
      const feedback: OptimizationFeedback = {
        id: "test_feedback_1",
        type: "routing",
        agentId: "test-agent",
        insights: [],
        recommendations: [],
        performanceData: {
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
        },
        timestamp: new Date(),
      };

      optimizationLoop.addFeedback(feedback);
      expect(optimizationLoop["feedbackQueue"]).toContain(feedback);
    });
  });

  describe("Optimization Recommendation Generation", () => {
    it("should generate routing optimization for poor conversion rate", async () => {
      const feedback: OptimizationFeedback = {
        id: "test_feedback_1",
        type: "routing",
        agentId: "test-agent",
        insights: [],
        recommendations: [],
        performanceData: {
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
        },
        timestamp: new Date(),
      };

      const recommendations = await (
        optimizationLoop as any
      ).generateOptimizationRecommendations([feedback]);

      expect(recommendations.length).toBeGreaterThan(0);
      const routingRec = recommendations.find((r) => r.type === "routing_rule");
      expect(routingRec).toBeDefined();
      expect(routingRec?.description).toContain("conversion rate");
      expect(routingRec?.priority).toBe("high");
    });

    it("should generate routing optimization for slow response time", async () => {
      const feedback: OptimizationFeedback = {
        id: "test_feedback_1",
        type: "routing",
        agentId: "test-agent",
        insights: [],
        recommendations: [],
        performanceData: {
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
        },
        timestamp: new Date(),
      };

      const recommendations = await (
        optimizationLoop as any
      ).generateOptimizationRecommendations([feedback]);

      expect(recommendations.length).toBeGreaterThan(0);
      const responseTimeRec = recommendations.find((r) =>
        r.description.includes("response time")
      );
      expect(responseTimeRec).toBeDefined();
      expect(responseTimeRec?.priority).toBe("high");
    });

    it("should sort recommendations by priority and impact", async () => {
      const feedback: OptimizationFeedback = {
        id: "test_feedback_1",
        type: "routing",
        agentId: "test-agent",
        insights: [],
        recommendations: [],
        performanceData: {
          id: "perf_1",
          agentId: "test-agent",
          period: {
            start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            end: new Date(),
          } as DateRange,
          metrics: {
            totalInteractions: 100,
            conversionRate: 0.45, // Triggers high-priority optimization
            averageResponseTime: 85000, // Triggers another high-priority optimization
            appointmentBookingRate: 0.35,
            customerSatisfactionScore: 4.0,
          } as PerformanceMetrics,
          scriptPerformance: [],
          optimizationSuggestions: [],
          createdAt: new Date(),
        },
        timestamp: new Date(),
      };

      const recommendations = await (
        optimizationLoop as any
      ).generateOptimizationRecommendations([feedback]);

      expect(recommendations.length).toBeGreaterThanOrEqual(2);

      // Check that high priority items come first
      const highPriorityCount = recommendations.filter(
        (r) => r.priority === "high"
      ).length;
      expect(highPriorityCount).toBeGreaterThan(0);

      // Check that recommendations are sorted by priority
      for (let i = 0; i < recommendations.length - 1; i++) {
        const current = recommendations[i];
        const next = recommendations[i + 1];

        const priorityWeight = { high: 3, medium: 2, low: 1 };
        const currentWeight = priorityWeight[current.priority];
        const nextWeight = priorityWeight[next.priority];

        expect(currentWeight).toBeGreaterThanOrEqual(nextWeight);
      }
    });
  });

  describe("Script Optimization", () => {
    it("should generate script optimization recommendations", async () => {
      const mockScriptOptimizations = [
        {
          scriptId: "test-script",
          scriptName: "Test Script",
          currentPerformance: {
            scriptId: "test-script",
            scriptName: "Test Script",
            usageCount: 100,
            successRate: 0.6,
            averageResponseTime: 45000,
            conversionRate: 0.5,
          },
          recommendations: [
            {
              type: "content" as const,
              description: "Improve opening",
              expectedImpact: 15,
              priority: "high" as const,
            },
          ],
          estimatedImpact: {
            conversionRateImprovement: 15,
            responseTimeImprovement: 10,
            satisfactionImprovement: 8,
          },
        },
      ];

      vi.spyOn(
        mockAnalyticsAgent,
        "analyzeScriptPerformance"
      ).mockResolvedValue(mockScriptOptimizations);

      const feedback: OptimizationFeedback = {
        id: "test_feedback_1",
        type: "script",
        agentId: "test-agent",
        insights: [],
        recommendations: [],
        performanceData: {
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
        },
        timestamp: new Date(),
      };

      const recommendations = await (
        optimizationLoop as any
      ).generateScriptOptimizations(feedback);

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0].type).toBe("script_update");
      expect(recommendations[0].description).toContain("Test Script");
      expect(recommendations[0].expectedImpact).toBe(15);
    });

    it("should not generate script optimization for low impact", async () => {
      const mockScriptOptimizations = [
        {
          scriptId: "test-script",
          scriptName: "Test Script",
          currentPerformance: {
            scriptId: "test-script",
            scriptName: "Test Script",
            usageCount: 100,
            successRate: 0.8,
            averageResponseTime: 35000,
            conversionRate: 0.75,
          },
          recommendations: [],
          estimatedImpact: {
            conversionRateImprovement: 5, // Below 10% threshold
            responseTimeImprovement: 3,
            satisfactionImprovement: 2,
          },
        },
      ];

      vi.spyOn(
        mockAnalyticsAgent,
        "analyzeScriptPerformance"
      ).mockResolvedValue(mockScriptOptimizations);

      const feedback: OptimizationFeedback = {
        id: "test_feedback_1",
        type: "script",
        agentId: "test-agent",
        insights: [],
        recommendations: [],
        performanceData: {
          id: "perf_1",
          agentId: "test-agent",
          period: {
            start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            end: new Date(),
          } as DateRange,
          metrics: {
            totalInteractions: 100,
            conversionRate: 0.75,
            averageResponseTime: 35000,
            appointmentBookingRate: 0.45,
            customerSatisfactionScore: 4.5,
          } as PerformanceMetrics,
          scriptPerformance: [],
          optimizationSuggestions: [],
          createdAt: new Date(),
        },
        timestamp: new Date(),
      };

      const recommendations = await (
        optimizationLoop as any
      ).generateScriptOptimizations(feedback);

      expect(recommendations.length).toBe(0);
    });
  });

  describe("Timing Optimization", () => {
    it("should generate timing optimization for declining trends", async () => {
      const mockTrends = [
        {
          metric: "conversionRate",
          period: {
            start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            end: new Date(),
          } as DateRange,
          dataPoints: [
            { date: new Date(), value: 0.6 },
            { date: new Date(Date.now() - 86400000), value: 0.65 },
            { date: new Date(Date.now() - 2 * 86400000), value: 0.7 },
          ],
          trend: "decreasing" as const,
          changePercent: -15,
          significance: "high" as const,
        },
      ];

      vi.spyOn(
        mockAnalyticsAgent,
        "analyzePerformanceTrends"
      ).mockResolvedValue(mockTrends);

      const feedback: OptimizationFeedback = {
        id: "test_feedback_1",
        type: "timing",
        agentId: "test-agent",
        insights: [],
        recommendations: [],
        performanceData: {
          id: "perf_1",
          agentId: "test-agent",
          period: {
            start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            end: new Date(),
          } as DateRange,
          metrics: {
            totalInteractions: 100,
            conversionRate: 0.6,
            averageResponseTime: 45000,
            appointmentBookingRate: 0.35,
            customerSatisfactionScore: 4.0,
          } as PerformanceMetrics,
          scriptPerformance: [],
          optimizationSuggestions: [],
          createdAt: new Date(),
        },
        timestamp: new Date(),
      };

      const recommendations = await (
        optimizationLoop as any
      ).generateTimingOptimizations(feedback);

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0].type).toBe("timing_adjustment");
      expect(recommendations[0].description).toContain("conversionRate");
      expect(recommendations[0].description).toContain("15% decline");
    });
  });

  describe("Optimization Implementation", () => {
    it("should implement routing optimization", async () => {
      const recommendation: OptimizationRecommendation = {
        id: "test_routing_opt",
        type: "routing_rule",
        priority: "high",
        description: "Test routing optimization",
        expectedImpact: 15,
        implementation: {
          action: "adjust_routing_thresholds",
          parameters: {
            agentId: "test-agent",
            urgencyThreshold: 7,
            intentThreshold: 0.5,
          },
          rollbackPlan: "Revert thresholds",
          testingPeriod: 7,
        },
        validationCriteria: {
          metrics: ["conversionRate"],
          minimumImprovement: 10,
          testPeriod: 14,
          significanceThreshold: 0.05,
        },
      };

      const updateConfigSpy = vi.spyOn(mockAIHeadAgent, "updateConfig");

      await (optimizationLoop as any).implementSingleOptimization(
        recommendation
      );

      expect(updateConfigSpy).toHaveBeenCalledWith({
        urgencyThresholds: {
          high: 7,
          medium: 5,
        },
        intentThresholds: {
          high: 0.7,
          medium: 0.5,
        },
      });

      // Check that optimization was recorded
      const history = optimizationLoop.getOptimizationHistory();
      expect(history.has(recommendation.id)).toBe(true);
    });

    it("should implement priority routing rule", async () => {
      const recommendation: OptimizationRecommendation = {
        id: "test_priority_opt",
        type: "routing_rule",
        priority: "high",
        description: "Test priority optimization",
        expectedImpact: 20,
        implementation: {
          action: "prioritize_fast_agents",
          parameters: {
            agentId: "test-agent",
            responseTimeSLA: 45000,
            priorityBoost: true,
          },
          rollbackPlan: "Remove priority boost",
          testingPeriod: 5,
        },
        validationCriteria: {
          metrics: ["averageResponseTime"],
          minimumImprovement: 15,
          testPeriod: 10,
          significanceThreshold: 0.05,
        },
      };

      const addRoutingRuleSpy = vi.spyOn(mockAIHeadAgent, "addRoutingRule");

      await (optimizationLoop as any).implementSingleOptimization(
        recommendation
      );

      expect(addRoutingRuleSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Fast Response Priority",
          priority: 0,
          enabled: true,
        })
      );
    });
  });

  describe("Optimization Validation", () => {
    it("should calculate improvement correctly", async () => {
      const baseline: PerformanceMetrics = {
        totalInteractions: 100,
        conversionRate: 0.6,
        averageResponseTime: 50000,
        appointmentBookingRate: 0.3,
        customerSatisfactionScore: 4.0,
      };

      const current: PerformanceMetrics = {
        totalInteractions: 120,
        conversionRate: 0.72, // 20% improvement
        averageResponseTime: 40000, // 20% improvement
        appointmentBookingRate: 0.36, // 20% improvement
        customerSatisfactionScore: 4.4, // 10% improvement
      };

      const recommendation: OptimizationRecommendation = {
        id: "test_validation",
        type: "routing_rule",
        priority: "high",
        description: "Test validation",
        expectedImpact: 15,
        implementation: {
          action: "test",
          parameters: {},
          rollbackPlan: "test",
          testingPeriod: 7,
        },
        validationCriteria: {
          metrics: ["conversionRate"],
          minimumImprovement: 10,
          testPeriod: 14,
          significanceThreshold: 0.05,
        },
      };

      const result: OptimizationResult = {
        recommendationId: "test_validation",
        implemented: true,
        implementedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
        baselineMetrics: baseline,
        validated: false,
        rollbackRequired: false,
      };

      vi.spyOn(optimizationLoop as any, "getCurrentMetrics").mockResolvedValue(
        current
      );

      const validationResult = await (
        optimizationLoop as any
      ).validateSingleOptimization("test_validation", result, recommendation);

      expect(validationResult.improvement.conversionRate).toBeCloseTo(20, 1);
      expect(validationResult.improvement.responseTime).toBeCloseTo(20, 1);
      expect(validationResult.improvement.satisfaction).toBeCloseTo(10, 1);
      expect(validationResult.validated).toBe(true);
    });

    it("should mark optimization for rollback on poor performance", async () => {
      const baseline: PerformanceMetrics = {
        totalInteractions: 100,
        conversionRate: 0.6,
        averageResponseTime: 50000,
        appointmentBookingRate: 0.3,
        customerSatisfactionScore: 4.0,
      };

      const current: PerformanceMetrics = {
        totalInteractions: 80,
        conversionRate: 0.45, // 25% degradation
        averageResponseTime: 65000, // 30% degradation
        appointmentBookingRate: 0.22, // 27% degradation
        customerSatisfactionScore: 3.5, // 12.5% degradation
      };

      const recommendation: OptimizationRecommendation = {
        id: "test_rollback",
        type: "routing_rule",
        priority: "high",
        description: "Test rollback",
        expectedImpact: 15,
        implementation: {
          action: "test",
          parameters: {},
          rollbackPlan: "test",
          testingPeriod: 7,
        },
        validationCriteria: {
          metrics: ["conversionRate"],
          minimumImprovement: 10,
          testPeriod: 14,
          significanceThreshold: 0.05,
        },
      };

      const result: OptimizationResult = {
        recommendationId: "test_rollback",
        implemented: true,
        implementedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        baselineMetrics: baseline,
        validated: false,
        rollbackRequired: false,
      };

      vi.spyOn(optimizationLoop as any, "getCurrentMetrics").mockResolvedValue(
        current
      );

      const validationResult = await (
        optimizationLoop as any
      ).validateSingleOptimization("test_rollback", result, recommendation);

      expect(validationResult.improvement.overall).toBeLessThan(-5);
      expect(validationResult.validated).toBe(false);
    });
  });

  describe("Optimization Statistics", () => {
    it("should calculate statistics correctly", () => {
      // Create a fresh optimization loop for this test to avoid interference
      const freshOptimizationLoop = new ContinuousOptimizationLoop(
        mockAIHeadAgent,
        mockAnalyticsAgent
      );

      // Add mock optimization results using the new method
      freshOptimizationLoop.addOptimizationResult("opt_1", {
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
        improvement: {
          conversionRate: 15,
          responseTime: 10,
          satisfaction: 5,
          overall: 12,
        },
        validated: true,
        validatedAt: new Date(),
        rollbackRequired: false,
      });

      freshOptimizationLoop.addOptimizationResult("opt_2", {
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
        improvement: {
          conversionRate: -5,
          responseTime: -8,
          satisfaction: -3,
          overall: -6,
        },
        validated: true,
        validatedAt: new Date(),
        rollbackRequired: true,
      });

      freshOptimizationLoop.addOptimizationResult("opt_3", {
        recommendationId: "opt_3",
        implemented: true,
        implementedAt: new Date(),
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

      const stats = freshOptimizationLoop.getOptimizationStats();

      expect(stats.totalOptimizations).toBe(3);
      expect(stats.successfulOptimizations).toBe(1);
      expect(stats.failedOptimizations).toBe(1);
      expect(stats.averageImprovement).toBe(12);
      expect(stats.activeOptimizations).toBe(0);
    });

    it("should handle empty optimization history", () => {
      const stats = optimizationLoop.getOptimizationStats();

      expect(stats.totalOptimizations).toBe(0);
      expect(stats.successfulOptimizations).toBe(0);
      expect(stats.failedOptimizations).toBe(0);
      expect(stats.averageImprovement).toBe(0);
      expect(stats.activeOptimizations).toBe(0);
    });
  });

  describe("Error Handling", () => {
    it("should handle analytics agent errors gracefully", async () => {
      vi.spyOn(
        mockAnalyticsAgent,
        "generateIntelligenceReport"
      ).mockRejectedValue(new Error("Analytics service down"));

      const feedback = await (
        optimizationLoop as any
      ).collectOptimizationFeedback();
      expect(feedback).toEqual([]);
    });

    it("should handle script analysis errors gracefully", async () => {
      vi.spyOn(
        mockAnalyticsAgent,
        "analyzeScriptPerformance"
      ).mockRejectedValue(new Error("Script analysis failed"));

      const feedback: OptimizationFeedback = {
        id: "test_feedback_1",
        type: "script",
        agentId: "test-agent",
        insights: [],
        recommendations: [],
        performanceData: {
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
        },
        timestamp: new Date(),
      };

      const recommendations = await (
        optimizationLoop as any
      ).generateScriptOptimizations(feedback);
      expect(recommendations).toEqual([]);
    });

    it("should handle trend analysis errors gracefully", async () => {
      vi.spyOn(
        mockAnalyticsAgent,
        "analyzePerformanceTrends"
      ).mockRejectedValue(new Error("Trend analysis failed"));

      const feedback: OptimizationFeedback = {
        id: "test_feedback_1",
        type: "timing",
        agentId: "test-agent",
        insights: [],
        recommendations: [],
        performanceData: {
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
        },
        timestamp: new Date(),
      };

      const recommendations = await (
        optimizationLoop as any
      ).generateTimingOptimizations(feedback);
      expect(recommendations).toEqual([]);
    });
  });
});
