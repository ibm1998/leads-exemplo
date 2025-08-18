import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { AICustomerAnalyticsAgent } from '../ai-customer-analytics-agent';
import { DatabaseManager } from '../../database/manager';
import { AgentPerformanceModel } from '../../types/agent-performance';
import { InteractionModel } from '../../types/interaction';

// Mock the database manager
vi.mock('../../database/manager');

describe('AICustomerAnalyticsAgent', () => {
  let analyticsAgent: AICustomerAnalyticsAgent;
  let mockDbManager: DatabaseManager;

  beforeEach(() => {
    mockDbManager = new DatabaseManager() as any;
    analyticsAgent = new AICustomerAnalyticsAgent(mockDbManager);
  });

  describe('Performance Data Collection (Requirement 10.1)', () => {
    it('should collect agent performance data for a given period', async () => {
      const agentId = 'test-agent-1';
      const period = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
      };

      const performance = await analyticsAgent.collectPerformanceData(
        agentId,
        period
      );

      expect(performance).toBeDefined();
      expect(performance.agentId).toBe(agentId);
      expect(performance.period).toEqual(period);
      expect(performance.metrics).toBeDefined();
      expect(performance.scriptPerformance).toBeDefined();
      expect(performance.optimizationSuggestions).toBeDefined();
    });

    it('should calculate performance metrics correctly', async () => {
      const agentId = 'test-agent-1';
      const period = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
      };

      const performance = await analyticsAgent.collectPerformanceData(
        agentId,
        period
      );

      expect(performance.metrics.totalInteractions).toBeGreaterThanOrEqual(0);
      expect(performance.metrics.conversionRate).toBeGreaterThanOrEqual(0);
      expect(performance.metrics.conversionRate).toBeLessThanOrEqual(1);
      expect(performance.metrics.averageResponseTime).toBeGreaterThanOrEqual(0);
      expect(performance.metrics.appointmentBookingRate).toBeGreaterThanOrEqual(
        0
      );
      expect(performance.metrics.appointmentBookingRate).toBeLessThanOrEqual(1);
      expect(
        performance.metrics.customerSatisfactionScore
      ).toBeGreaterThanOrEqual(0);
      expect(performance.metrics.customerSatisfactionScore).toBeLessThanOrEqual(
        5
      );
    });

    it('should generate optimization suggestions based on performance', async () => {
      const agentId = 'test-agent-1';
      const period = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
      };

      const performance = await analyticsAgent.collectPerformanceData(
        agentId,
        period
      );

      expect(performance.optimizationSuggestions).toBeInstanceOf(Array);
      expect(performance.optimizationSuggestions.length).toBeGreaterThan(0);
    });

    it('should handle errors gracefully when collecting performance data', async () => {
      const agentId = 'invalid-agent';
      const period = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
      };

      // Mock a database error
      vi.spyOn(analyticsAgent as any, 'getAgentInteractions').mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(
        analyticsAgent.collectPerformanceData(agentId, period)
      ).rejects.toThrow('Database connection failed');
    });
  });

  describe('Script Performance Analysis (Requirement 10.2)', () => {
    it('should analyze script performance and identify optimization opportunities', async () => {
      const optimizations = await analyticsAgent.analyzeScriptPerformance();

      expect(optimizations).toBeInstanceOf(Array);
      expect(optimizations.length).toBeGreaterThan(0);

      const optimization = optimizations[0];
      expect(optimization.scriptId).toBeDefined();
      expect(optimization.scriptName).toBeDefined();
      expect(optimization.currentPerformance).toBeDefined();
      expect(optimization.recommendations).toBeInstanceOf(Array);
      expect(optimization.estimatedImpact).toBeDefined();
    });

    it('should prioritize optimizations by potential impact', async () => {
      const optimizations = await analyticsAgent.analyzeScriptPerformance();

      // Should be sorted by impact (highest first)
      for (let i = 1; i < optimizations.length; i++) {
        const currentImpact =
          optimizations[i - 1].estimatedImpact.conversionRateImprovement;
        const nextImpact =
          optimizations[i].estimatedImpact.conversionRateImprovement;
        expect(currentImpact).toBeGreaterThanOrEqual(nextImpact);
      }
    });

    it('should provide specific recommendations for script improvements', async () => {
      const optimizations = await analyticsAgent.analyzeScriptPerformance();

      const optimization = optimizations[0];
      expect(optimization.recommendations.length).toBeGreaterThan(0);

      const recommendation = optimization.recommendations[0];
      expect(recommendation.type).toMatch(/timing|content|approach|targeting/);
      expect(recommendation.description).toBeDefined();
      expect(recommendation.expectedImpact).toBeGreaterThan(0);
      expect(recommendation.priority).toMatch(/high|medium|low/);
    });
  });

  describe('Intelligence Report Generation (Requirement 10.3)', () => {
    it('should generate actionable intelligence reports', async () => {
      const insights = await analyticsAgent.generateIntelligenceReport();

      expect(insights).toBeInstanceOf(Array);
      expect(insights.length).toBeGreaterThan(0);

      const insight = insights[0];
      expect(insight.id).toBeDefined();
      expect(insight.type).toMatch(/performance|script|trend|optimization/);
      expect(insight.title).toBeDefined();
      expect(insight.description).toBeDefined();
      expect(insight.impact).toMatch(/high|medium|low/);
      expect(insight.actionable).toBe(true);
      expect(insight.recommendations).toBeInstanceOf(Array);
      expect(insight.data).toBeDefined();
      expect(insight.generatedAt).toBeInstanceOf(Date);
    });

    it('should include different types of insights', async () => {
      const insights = await analyticsAgent.generateIntelligenceReport();

      const insightTypes = insights.map((insight) => insight.type);
      expect(insightTypes).toContain('performance');
      expect(insightTypes).toContain('script');
      expect(insightTypes).toContain('trend');
      expect(insightTypes).toContain('optimization');
    });

    it('should provide actionable recommendations for each insight', async () => {
      const insights = await analyticsAgent.generateIntelligenceReport();

      insights.forEach((insight) => {
        expect(insight.actionable).toBe(true);
        expect(insight.recommendations.length).toBeGreaterThan(0);
        insight.recommendations.forEach((recommendation) => {
          expect(typeof recommendation).toBe('string');
          expect(recommendation.length).toBeGreaterThan(0);
        });
      });
    });
  });

  describe('Performance Trend Analysis (Requirement 10.4)', () => {
    it('should analyze performance trends over time', async () => {
      const period = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
      };

      const trends = await analyticsAgent.analyzePerformanceTrends(period);

      expect(trends).toBeInstanceOf(Array);
      expect(trends.length).toBeGreaterThan(0);

      const trend = trends[0];
      expect(trend.metric).toBeDefined();
      expect(trend.period).toEqual(period);
      expect(trend.dataPoints).toBeInstanceOf(Array);
      expect(trend.trend).toMatch(/increasing|decreasing|stable/);
      expect(typeof trend.changePercent).toBe('number');
      expect(trend.significance).toMatch(/high|medium|low/);
    });

    it('should analyze multiple performance metrics', async () => {
      const period = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
      };

      const trends = await analyticsAgent.analyzePerformanceTrends(period);

      const metrics = trends.map((trend) => trend.metric);
      expect(metrics).toContain('conversionRate');
      expect(metrics).toContain('averageResponseTime');
      expect(metrics).toContain('customerSatisfactionScore');
      expect(metrics).toContain('appointmentBookingRate');
    });

    it('should provide data points for trend visualization', async () => {
      const period = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
      };

      const trends = await analyticsAgent.analyzePerformanceTrends(period);

      trends.forEach((trend) => {
        expect(trend.dataPoints.length).toBeGreaterThan(0);
        trend.dataPoints.forEach((point) => {
          expect(point.date).toBeInstanceOf(Date);
          expect(typeof point.value).toBe('number');
        });
      });
    });
  });

  describe('Optimization Impact Measurement (Requirement 10.5)', () => {
    it('should measure optimization impact against baseline', async () => {
      const agentId = 'test-agent-1';
      const optimizationId = 'opt-123';
      const period = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
      };

      // Set a baseline first
      await analyticsAgent.setPerformanceBaseline(agentId, {
        start: new Date('2023-12-01'),
        end: new Date('2023-12-31'),
      });

      const impact = await analyticsAgent.measureOptimizationImpact(
        agentId,
        optimizationId,
        period
      );

      expect(impact.baseline).toBeDefined();
      expect(impact.current).toBeDefined();
      expect(impact.improvement).toBeDefined();
      expect(typeof impact.improvement.conversionRate).toBe('number');
      expect(typeof impact.improvement.responseTime).toBe('number');
      expect(typeof impact.improvement.satisfaction).toBe('number');
      expect(typeof impact.improvement.overall).toBe('number');
      expect(typeof impact.validated).toBe('boolean');
    });

    it('should validate improvements above threshold', async () => {
      const agentId = 'test-agent-1';
      const optimizationId = 'opt-123';
      const period = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
      };

      // Set a baseline first
      await analyticsAgent.setPerformanceBaseline(agentId, {
        start: new Date('2023-12-01'),
        end: new Date('2023-12-31'),
      });

      const impact = await analyticsAgent.measureOptimizationImpact(
        agentId,
        optimizationId,
        period
      );

      // If overall improvement is > 5%, it should be validated
      if (impact.improvement.overall > 5) {
        expect(impact.validated).toBe(true);
      } else {
        expect(impact.validated).toBe(false);
      }
    });

    it('should throw error when no baseline exists', async () => {
      const agentId = 'agent-without-baseline';
      const optimizationId = 'opt-123';
      const period = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
      };

      await expect(
        analyticsAgent.measureOptimizationImpact(
          agentId,
          optimizationId,
          period
        )
      ).rejects.toThrow('No baseline found');
    });
  });

  describe('Real-time Dashboard', () => {
    it('should provide comprehensive dashboard data', async () => {
      const dashboardData = await analyticsAgent.getDashboardData();

      expect(dashboardData.overview).toBeDefined();
      expect(dashboardData.agentPerformance).toBeInstanceOf(Array);
      expect(dashboardData.scriptPerformance).toBeInstanceOf(Array);
      expect(dashboardData.leadSourceAnalysis).toBeInstanceOf(Array);
      expect(dashboardData.recentInsights).toBeInstanceOf(Array);
      expect(dashboardData.performanceTrends).toBeInstanceOf(Array);
      expect(dashboardData.lastUpdated).toBeInstanceOf(Date);
    });

    it('should include overview metrics', async () => {
      const dashboardData = await analyticsAgent.getDashboardData();

      const overview = dashboardData.overview;
      expect(typeof overview.totalInteractions).toBe('number');
      expect(typeof overview.overallConversionRate).toBe('number');
      expect(typeof overview.averageResponseTime).toBe('number');
      expect(typeof overview.customerSatisfactionScore).toBe('number');
      expect(typeof overview.activeLeads).toBe('number');
      expect(typeof overview.convertedLeads).toBe('number');
    });

    it('should include lead source analysis', async () => {
      const dashboardData = await analyticsAgent.getDashboardData();

      const leadSources = dashboardData.leadSourceAnalysis;
      expect(leadSources.length).toBeGreaterThan(0);

      const source = leadSources[0];
      expect(source.source).toBeDefined();
      expect(typeof source.totalLeads).toBe('number');
      expect(typeof source.conversionRate).toBe('number');
      expect(typeof source.averageQualificationScore).toBe('number');
      expect(typeof source.averageResponseTime).toBe('number');
      expect(typeof source.qualityScore).toBe('number');
      expect(source.recommendations).toBeInstanceOf(Array);
    });

    it('should limit recent insights to reasonable number', async () => {
      const dashboardData = await analyticsAgent.getDashboardData();

      expect(dashboardData.recentInsights.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Performance Baseline Management', () => {
    it('should set performance baseline for an agent', async () => {
      const agentId = 'test-agent-1';
      const period = {
        start: new Date('2023-12-01'),
        end: new Date('2023-12-31'),
      };

      await expect(
        analyticsAgent.setPerformanceBaseline(agentId, period)
      ).resolves.not.toThrow();
    });

    it('should handle errors when setting baseline', async () => {
      const agentId = 'invalid-agent';
      const period = {
        start: new Date('2023-12-01'),
        end: new Date('2023-12-31'),
      };

      // Mock an error in collectPerformanceData
      vi.spyOn(analyticsAgent, 'collectPerformanceData').mockRejectedValue(
        new Error('Failed to collect performance data')
      );

      await expect(
        analyticsAgent.setPerformanceBaseline(agentId, period)
      ).rejects.toThrow('Failed to collect performance data');
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Mock database error
      vi.spyOn(analyticsAgent as any, 'getAllScriptMetrics').mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(analyticsAgent.analyzeScriptPerformance()).rejects.toThrow(
        'Database connection failed'
      );
    });

    it('should handle missing data gracefully', async () => {
      const agentId = 'test-agent-1';
      const period = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
      };

      // Mock empty interactions
      vi.spyOn(analyticsAgent as any, 'getAgentInteractions').mockResolvedValue(
        []
      );

      const performance = await analyticsAgent.collectPerformanceData(
        agentId,
        period
      );

      expect(performance.metrics.totalInteractions).toBe(0);
      expect(performance.metrics.conversionRate).toBe(0);
    });
  });

  describe('Data Validation', () => {
    it('should validate performance metrics are within expected ranges', async () => {
      const agentId = 'test-agent-1';
      const period = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
      };

      const performance = await analyticsAgent.collectPerformanceData(
        agentId,
        period
      );

      // Conversion rate should be between 0 and 1
      expect(performance.metrics.conversionRate).toBeGreaterThanOrEqual(0);
      expect(performance.metrics.conversionRate).toBeLessThanOrEqual(1);

      // Appointment booking rate should be between 0 and 1
      expect(performance.metrics.appointmentBookingRate).toBeGreaterThanOrEqual(
        0
      );
      expect(performance.metrics.appointmentBookingRate).toBeLessThanOrEqual(1);

      // Customer satisfaction should be between 0 and 5
      expect(
        performance.metrics.customerSatisfactionScore
      ).toBeGreaterThanOrEqual(0);
      expect(performance.metrics.customerSatisfactionScore).toBeLessThanOrEqual(
        5
      );

      // Response time should be positive
      expect(performance.metrics.averageResponseTime).toBeGreaterThanOrEqual(0);
    });

    it('should validate insight data structure', async () => {
      const insights = await analyticsAgent.generateIntelligenceReport();

      insights.forEach((insight) => {
        expect(insight.id).toMatch(/^insight_\d+_/);
        expect(insight.type).toMatch(
          /^(performance|script|trend|optimization)$/
        );
        expect(insight.impact).toMatch(/^(high|medium|low)$/);
        expect(insight.actionable).toBe(true);
        expect(insight.generatedAt).toBeInstanceOf(Date);
      });
    });
  });
});
