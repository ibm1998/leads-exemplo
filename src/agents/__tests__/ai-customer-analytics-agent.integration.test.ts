import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { AICustomerAnalyticsAgent } from "../ai-customer-analytics-agent";
import { DatabaseManager } from "../../database/manager";
import {
  AgentPerformance,
  AgentPerformanceModel,
} from "../../types/agent-performance";
import { InteractionModel } from "../../types/interaction";
import { LeadModel } from "../../types/lead";

describe("AICustomerAnalyticsAgent Integration Tests", () => {
  let analyticsAgent: AICustomerAnalyticsAgent;
  let dbManager: DatabaseManager;

  beforeEach(async () => {
    // Initialize database manager with test configuration
    dbManager = new DatabaseManager();
    analyticsAgent = new AICustomerAnalyticsAgent(dbManager);
  });

  afterEach(async () => {
    // Cleanup
    if (dbManager) {
      await dbManager.close();
    }
  });

  describe("End-to-End Analytics Workflow", () => {
    it("should complete full analytics cycle from data collection to optimization", async () => {
      const agentId = "integration-test-agent";
      const period = {
        start: new Date("2024-01-01"),
        end: new Date("2024-01-31"),
      };

      // Step 1: Set baseline performance
      await analyticsAgent.setPerformanceBaseline(agentId, {
        start: new Date("2023-12-01"),
        end: new Date("2023-12-31"),
      });

      // Step 2: Collect current performance data
      const performance = await analyticsAgent.collectPerformanceData(
        agentId,
        period
      );

      expect(performance).toBeDefined();
      expect(performance.agentId).toBe(agentId);

      // Step 3: Analyze script performance
      const scriptOptimizations =
        await analyticsAgent.analyzeScriptPerformance();
      expect(scriptOptimizations.length).toBeGreaterThan(0);

      // Step 4: Generate intelligence report
      const insights = await analyticsAgent.generateIntelligenceReport();
      expect(insights.length).toBeGreaterThan(0);

      // Step 5: Analyze performance trends
      const trends = await analyticsAgent.analyzePerformanceTrends(period);
      expect(trends.length).toBeGreaterThan(0);

      // Step 6: Measure optimization impact
      const impact = await analyticsAgent.measureOptimizationImpact(
        agentId,
        "test-optimization",
        period
      );

      expect(impact.baseline).toBeDefined();
      expect(impact.current).toBeDefined();
      expect(impact.improvement).toBeDefined();

      // Step 7: Get dashboard data
      const dashboardData = await analyticsAgent.getDashboardData();
      expect(dashboardData.overview).toBeDefined();
      expect(dashboardData.agentPerformance).toBeDefined();
      expect(dashboardData.scriptPerformance).toBeDefined();
      expect(dashboardData.recentInsights).toBeDefined();
    });

    it("should handle multiple agents performance analysis", async () => {
      const agents = ["agent-1", "agent-2", "agent-3"];
      const period = {
        start: new Date("2024-01-01"),
        end: new Date("2024-01-31"),
      };

      const performanceResults: AgentPerformance[] = [];

      // Collect performance data for multiple agents
      for (const agentId of agents) {
        const performance = await analyticsAgent.collectPerformanceData(
          agentId,
          period
        );
        performanceResults.push(performance);
      }

      expect(performanceResults.length).toBe(3);

      // Verify each agent has unique performance data
      const agentIds = performanceResults.map((p) => p.agentId);
      expect(new Set(agentIds).size).toBe(3);

      // Generate comparative insights
      const insights = await analyticsAgent.generateIntelligenceReport();
      expect(insights.length).toBeGreaterThan(0);

      // Verify insights include comparative analysis
      const hasComparativeInsight = insights.some(
        (insight) =>
          insight.description.includes("performance") ||
          insight.description.includes("comparison")
      );
      expect(hasComparativeInsight).toBe(true);
    });

    it("should provide real-time dashboard updates", async () => {
      // Get initial dashboard data
      const initialData = await analyticsAgent.getDashboardData();
      const initialTimestamp = initialData.lastUpdated;

      // Simulate some time passing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Get updated dashboard data
      const updatedData = await analyticsAgent.getDashboardData();
      const updatedTimestamp = updatedData.lastUpdated;

      // Verify data structure consistency
      expect(updatedData.overview).toBeDefined();
      expect(updatedData.agentPerformance).toBeInstanceOf(Array);
      expect(updatedData.scriptPerformance).toBeInstanceOf(Array);
      expect(updatedData.leadSourceAnalysis).toBeInstanceOf(Array);
      expect(updatedData.recentInsights).toBeInstanceOf(Array);
      expect(updatedData.performanceTrends).toBeInstanceOf(Array);

      // Verify timestamp is updated
      expect(updatedTimestamp.getTime()).toBeGreaterThanOrEqual(
        initialTimestamp.getTime()
      );
    });
  });

  describe("Performance Optimization Loop", () => {
    it("should identify and validate performance improvements", async () => {
      const agentId = "optimization-test-agent";
      const baselinePeriod = {
        start: new Date("2023-12-01"),
        end: new Date("2023-12-31"),
      };
      const currentPeriod = {
        start: new Date("2024-01-01"),
        end: new Date("2024-01-31"),
      };

      // Set baseline
      await analyticsAgent.setPerformanceBaseline(agentId, baselinePeriod);

      // Collect current performance
      const currentPerformance = await analyticsAgent.collectPerformanceData(
        agentId,
        currentPeriod
      );

      // Generate optimization recommendations
      const scriptOptimizations =
        await analyticsAgent.analyzeScriptPerformance();
      expect(scriptOptimizations.length).toBeGreaterThan(0);

      // Verify recommendations are actionable
      scriptOptimizations.forEach((optimization) => {
        expect(optimization.recommendations.length).toBeGreaterThan(0);
        expect(optimization.estimatedImpact).toBeDefined();

        optimization.recommendations.forEach((rec) => {
          expect(rec.type).toMatch(/timing|content|approach|targeting/);
          expect(rec.expectedImpact).toBeGreaterThan(0);
          expect(rec.priority).toMatch(/high|medium|low/);
        });
      });

      // Measure impact
      const impact = await analyticsAgent.measureOptimizationImpact(
        agentId,
        "test-optimization",
        currentPeriod
      );

      expect(impact.improvement).toBeDefined();
      expect(typeof impact.validated).toBe("boolean");
    });

    it("should generate insights across different time periods", async () => {
      const periods = [
        {
          start: new Date("2024-01-01"),
          end: new Date("2024-01-07"),
        },
        {
          start: new Date("2024-01-08"),
          end: new Date("2024-01-14"),
        },
        {
          start: new Date("2024-01-15"),
          end: new Date("2024-01-21"),
        },
      ];

      const trendAnalyses: Array<Array<any>> = [];

      for (const period of periods) {
        const trends = await analyticsAgent.analyzePerformanceTrends(period);
        trendAnalyses.push(trends);
      }

      expect(trendAnalyses.length).toBe(3);

      // Verify each period has trend data
      trendAnalyses.forEach((trends) => {
        expect(trends.length).toBeGreaterThan(0);
        trends.forEach((trend) => {
          expect(trend.dataPoints.length).toBeGreaterThan(0);
          expect(trend.trend).toMatch(/increasing|decreasing|stable/);
        });
      });
    });
  });

  describe("Lead Source Analytics Integration", () => {
    it("should analyze lead source effectiveness and provide recommendations", async () => {
      const dashboardData = await analyticsAgent.getDashboardData();
      const leadSourceAnalysis = dashboardData.leadSourceAnalysis;

      expect(leadSourceAnalysis.length).toBeGreaterThan(0);

      leadSourceAnalysis.forEach((source) => {
        expect(source.source).toBeDefined();
        expect(typeof source.totalLeads).toBe("number");
        expect(typeof source.conversionRate).toBe("number");
        expect(typeof source.averageQualificationScore).toBe("number");
        expect(typeof source.averageResponseTime).toBe("number");
        expect(typeof source.qualityScore).toBe("number");
        expect(source.recommendations).toBeInstanceOf(Array);

        // Verify quality score is calculated correctly
        expect(source.qualityScore).toBeGreaterThanOrEqual(0);
        expect(source.qualityScore).toBeLessThanOrEqual(1);

        // Verify recommendations are provided for lower performing sources
        if (source.qualityScore < 0.7) {
          expect(source.recommendations.length).toBeGreaterThan(0);
        }
      });
    });

    it("should identify best and worst performing lead sources", async () => {
      const dashboardData = await analyticsAgent.getDashboardData();
      const leadSources = dashboardData.leadSourceAnalysis;

      if (leadSources.length > 1) {
        // Sort by quality score
        const sortedSources = [...leadSources].sort(
          (a, b) => b.qualityScore - a.qualityScore
        );

        const bestSource = sortedSources[0];
        const worstSource = sortedSources[sortedSources.length - 1];

        expect(bestSource.qualityScore).toBeGreaterThanOrEqual(
          worstSource.qualityScore
        );

        // Best source should have fewer or more targeted recommendations
        // Worst source should have more improvement recommendations
        expect(worstSource.recommendations.length).toBeGreaterThanOrEqual(
          bestSource.recommendations.length
        );
      }
    });
  });

  describe("Error Recovery and Resilience", () => {
    it("should handle partial data gracefully", async () => {
      const agentId = "partial-data-agent";
      const period = {
        start: new Date("2024-01-01"),
        end: new Date("2024-01-31"),
      };

      // This should not throw even with limited data
      const performance = await analyticsAgent.collectPerformanceData(
        agentId,
        period
      );

      expect(performance).toBeDefined();
      expect(performance.metrics).toBeDefined();

      // Should provide default values for missing data
      expect(performance.metrics.totalInteractions).toBeGreaterThanOrEqual(0);
      expect(performance.metrics.conversionRate).toBeGreaterThanOrEqual(0);
      expect(performance.metrics.conversionRate).toBeLessThanOrEqual(1);
    });

    it("should continue operation when some components fail", async () => {
      // Even if script analysis fails, other operations should continue
      try {
        const insights = await analyticsAgent.generateIntelligenceReport();
        expect(insights).toBeInstanceOf(Array);
      } catch (error) {
        // Should not reach here in normal operation
        expect(error).toBeUndefined();
      }

      // Dashboard should still work
      const dashboardData = await analyticsAgent.getDashboardData();
      expect(dashboardData).toBeDefined();
      expect(dashboardData.overview).toBeDefined();
    });
  });

  describe("Performance Validation", () => {
    it("should validate metrics are within acceptable ranges", async () => {
      const dashboardData = await analyticsAgent.getDashboardData();
      const overview = dashboardData.overview;

      // Validate overview metrics
      expect(overview.overallConversionRate).toBeGreaterThanOrEqual(0);
      expect(overview.overallConversionRate).toBeLessThanOrEqual(1);
      expect(overview.averageResponseTime).toBeGreaterThan(0);
      expect(overview.customerSatisfactionScore).toBeGreaterThanOrEqual(0);
      expect(overview.customerSatisfactionScore).toBeLessThanOrEqual(5);
      expect(overview.totalInteractions).toBeGreaterThanOrEqual(0);
      expect(overview.activeLeads).toBeGreaterThanOrEqual(0);
      expect(overview.convertedLeads).toBeGreaterThanOrEqual(0);

      // Validate agent performance metrics
      dashboardData.agentPerformance.forEach((performance) => {
        expect(performance.metrics.conversionRate).toBeGreaterThanOrEqual(0);
        expect(performance.metrics.conversionRate).toBeLessThanOrEqual(1);
        expect(
          performance.metrics.appointmentBookingRate
        ).toBeGreaterThanOrEqual(0);
        expect(performance.metrics.appointmentBookingRate).toBeLessThanOrEqual(
          1
        );
        expect(
          performance.metrics.customerSatisfactionScore
        ).toBeGreaterThanOrEqual(0);
        expect(
          performance.metrics.customerSatisfactionScore
        ).toBeLessThanOrEqual(5);
      });

      // Validate script performance metrics
      dashboardData.scriptPerformance.forEach((script) => {
        expect(script.conversionRate).toBeGreaterThanOrEqual(0);
        expect(script.conversionRate).toBeLessThanOrEqual(1);
        expect(script.successRate).toBeGreaterThanOrEqual(0);
        expect(script.successRate).toBeLessThanOrEqual(1);
        expect(script.usageCount).toBeGreaterThanOrEqual(0);
        expect(script.averageResponseTime).toBeGreaterThan(0);
      });
    });

    it("should ensure insights are actionable and relevant", async () => {
      const insights = await analyticsAgent.generateIntelligenceReport();

      insights.forEach((insight) => {
        // All insights should be actionable
        expect(insight.actionable).toBe(true);

        // Should have meaningful recommendations
        expect(insight.recommendations.length).toBeGreaterThan(0);
        insight.recommendations.forEach((rec) => {
          expect(rec.length).toBeGreaterThan(10); // Meaningful recommendation text
        });

        // Should have relevant data
        expect(Object.keys(insight.data).length).toBeGreaterThan(0);

        // Should have appropriate impact level
        expect(insight.impact).toMatch(/high|medium|low/);

        // Should have recent timestamp
        const ageInMinutes =
          (Date.now() - insight.generatedAt.getTime()) / (1000 * 60);
        expect(ageInMinutes).toBeLessThan(60); // Generated within last hour
      });
    });
  });
});
