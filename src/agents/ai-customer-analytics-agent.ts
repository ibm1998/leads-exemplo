import {
  AgentPerformance,
  AgentPerformanceModel,
  CreateAgentPerformance,
  ScriptMetrics,
  PerformanceMetrics,
  DateRange,
} from "../types/agent-performance";
import { Interaction, InteractionModel } from "../types/interaction";
import { Lead, LeadModel } from "../types/lead";
import { DatabaseManager } from "../database/manager";

/**
 * Analytics insight types
 */
export interface AnalyticsInsight {
  id: string;
  type: "performance" | "script" | "trend" | "optimization";
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  actionable: boolean;
  recommendations: string[];
  data: Record<string, any>;
  generatedAt: Date;
}

/**
 * Performance trend data
 */
export interface PerformanceTrend {
  metric: string;
  period: DateRange;
  dataPoints: Array<{
    date: Date;
    value: number;
  }>;
  trend: "increasing" | "decreasing" | "stable";
  changePercent: number;
  significance: "high" | "medium" | "low";
}

/**
 * Script optimization recommendation
 */
export interface ScriptOptimization {
  scriptId: string;
  scriptName: string;
  currentPerformance: ScriptMetrics;
  recommendations: Array<{
    type: "timing" | "content" | "approach" | "targeting";
    description: string;
    expectedImpact: number; // percentage improvement
    priority: "high" | "medium" | "low";
  }>;
  estimatedImpact: {
    conversionRateImprovement: number;
    responseTimeImprovement: number;
    satisfactionImprovement: number;
  };
}

/**
 * Lead source effectiveness analysis
 */
export interface LeadSourceAnalysis {
  source: string;
  totalLeads: number;
  conversionRate: number;
  averageQualificationScore: number;
  averageResponseTime: number;
  costPerLead?: number;
  costPerConversion?: number;
  qualityScore: number; // 0-1
  recommendations: string[];
}

/**
 * Real-time dashboard data
 */
export interface AnalyticsDashboard {
  overview: {
    totalInteractions: number;
    overallConversionRate: number;
    averageResponseTime: number;
    customerSatisfactionScore: number;
    activeLeads: number;
    convertedLeads: number;
  };
  agentPerformance: AgentPerformance[];
  scriptPerformance: ScriptMetrics[];
  leadSourceAnalysis: LeadSourceAnalysis[];
  recentInsights: AnalyticsInsight[];
  performanceTrends: PerformanceTrend[];
  lastUpdated: Date;
}

/**
 * AI Customer Analytics Agent
 *
 * Implements requirement 10: Continuous Optimization Loop and System Self-Improvement
 *
 * Responsibilities:
 * - Collect and analyze performance data (10.1)
 * - Identify best-performing scripts and approaches (10.2)
 * - Generate actionable intelligence reports (10.3)
 * - Provide optimization recommendations (10.4)
 * - Measure and validate improvement impact (10.5)
 */
export class AICustomerAnalyticsAgent {
  private dbManager: DatabaseManager;
  private insights: Map<string, AnalyticsInsight> = new Map();
  private performanceBaselines: Map<string, PerformanceMetrics> = new Map();
  private lastAnalysisTime: Date = new Date();

  constructor(dbManager: DatabaseManager) {
    this.dbManager = dbManager;
  }

  /**
   * Collect data on agent performance, conversion rates, call quality scores, and lead source effectiveness
   * Requirement 10.1
   */
  async collectPerformanceData(
    agentId: string,
    period: DateRange
  ): Promise<AgentPerformance> {
    try {
      // Get all interactions for the agent in the specified period
      const interactions = await this.getAgentInteractions(agentId, period);

      // Calculate performance metrics
      const metrics = this.calculatePerformanceMetrics(interactions);

      // Get script performance data
      const scriptPerformance = await this.calculateScriptPerformance(
        agentId,
        interactions
      );

      // Generate optimization suggestions
      const optimizationSuggestions = this.generateOptimizationSuggestions(
        metrics,
        scriptPerformance
      );

      // Create agent performance record
      const performanceData: CreateAgentPerformance = {
        agentId,
        period,
        metrics,
        scriptPerformance,
        optimizationSuggestions,
      };

      const agentPerformance = AgentPerformanceModel.create(performanceData);

      // Store in database
      await this.storeAgentPerformance(agentPerformance.data);

      return agentPerformance.data;
    } catch (error) {
      console.error(
        `Error collecting performance data for agent ${agentId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Identify best-performing scripts, optimal timing sequences, and most effective conversational approaches
   * Requirement 10.2
   */
  async analyzeScriptPerformance(): Promise<ScriptOptimization[]> {
    try {
      const allScriptMetrics = await this.getAllScriptMetrics();
      const optimizations: ScriptOptimization[] = [];

      for (const script of allScriptMetrics) {
        const optimization = await this.generateScriptOptimization(script);
        optimizations.push(optimization);
      }

      // Sort by potential impact
      optimizations.sort((a, b) => {
        const aImpact = a.estimatedImpact.conversionRateImprovement;
        const bImpact = b.estimatedImpact.conversionRateImprovement;
        return bImpact - aImpact;
      });

      return optimizations;
    } catch (error) {
      console.error("Error analyzing script performance:", error);
      throw error;
    }
  }

  /**
   * Generate actionable intelligence reports for the AI Head Agent
   * Requirement 10.3
   */
  async generateIntelligenceReport(): Promise<AnalyticsInsight[]> {
    try {
      const insights: AnalyticsInsight[] = [];

      // Performance insights
      const performanceInsights = await this.generatePerformanceInsights();
      insights.push(...performanceInsights);

      // Script optimization insights
      const scriptInsights = await this.generateScriptInsights();
      insights.push(...scriptInsights);

      // Trend analysis insights
      const trendInsights = await this.generateTrendInsights();
      insights.push(...trendInsights);

      // Lead source effectiveness insights
      const sourceInsights = await this.generateLeadSourceInsights();
      insights.push(...sourceInsights);

      // Store insights
      for (const insight of insights) {
        this.insights.set(insight.id, insight);
      }

      return insights;
    } catch (error) {
      console.error("Error generating intelligence report:", error);
      throw error;
    }
  }

  /**
   * Analyze performance trends and generate optimization recommendations
   * Requirement 10.4
   */
  async analyzePerformanceTrends(
    period: DateRange
  ): Promise<PerformanceTrend[]> {
    try {
      const trends: PerformanceTrend[] = [];

      // Analyze conversion rate trends
      const conversionTrend = await this.analyzeMetricTrend(
        "conversionRate",
        period
      );
      trends.push(conversionTrend);

      // Analyze response time trends
      const responseTimeTrend = await this.analyzeMetricTrend(
        "averageResponseTime",
        period
      );
      trends.push(responseTimeTrend);

      // Analyze customer satisfaction trends
      const satisfactionTrend = await this.analyzeMetricTrend(
        "customerSatisfactionScore",
        period
      );
      trends.push(satisfactionTrend);

      // Analyze appointment booking rate trends
      const bookingTrend = await this.analyzeMetricTrend(
        "appointmentBookingRate",
        period
      );
      trends.push(bookingTrend);

      return trends;
    } catch (error) {
      console.error("Error analyzing performance trends:", error);
      throw error;
    }
  }

  /**
   * Measure and validate impact against previous performance baselines
   * Requirement 10.5
   */
  async measureOptimizationImpact(
    agentId: string,
    optimizationId: string,
    period: DateRange
  ): Promise<{
    baseline: PerformanceMetrics;
    current: PerformanceMetrics;
    improvement: {
      conversionRate: number;
      responseTime: number;
      satisfaction: number;
      overall: number;
    };
    validated: boolean;
  }> {
    try {
      // Get baseline performance
      const baselineKey = `${agentId}_baseline`;
      const baseline = this.performanceBaselines.get(baselineKey);

      if (!baseline) {
        throw new Error(`No baseline found for agent ${agentId}`);
      }

      // Get current performance
      const currentPerformance = await this.collectPerformanceData(
        agentId,
        period
      );
      const current = currentPerformance.metrics;

      // Calculate improvements
      const improvement = {
        conversionRate:
          ((current.conversionRate - baseline.conversionRate) /
            baseline.conversionRate) *
          100,
        responseTime:
          ((baseline.averageResponseTime - current.averageResponseTime) /
            baseline.averageResponseTime) *
          100,
        satisfaction:
          ((current.customerSatisfactionScore -
            baseline.customerSatisfactionScore) /
            baseline.customerSatisfactionScore) *
          100,
        overall: 0,
      };

      // Calculate overall improvement score
      improvement.overall =
        improvement.conversionRate * 0.4 +
        improvement.responseTime * 0.3 +
        improvement.satisfaction * 0.3;

      // Validate improvement (consider significant if > 5% overall improvement)
      const validated = improvement.overall > 5;

      // Update baseline if improvement is validated
      if (validated) {
        this.performanceBaselines.set(baselineKey, current);
      }

      return {
        baseline,
        current,
        improvement,
        validated,
      };
    } catch (error) {
      console.error("Error measuring optimization impact:", error);
      throw error;
    }
  }

  /**
   * Get real-time analytics dashboard data
   */
  async getDashboardData(): Promise<AnalyticsDashboard> {
    try {
      const now = new Date();
      const last30Days: DateRange = {
        start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        end: now,
      };

      // Get overview metrics
      const overview = await this.calculateOverviewMetrics(last30Days);

      // Get agent performance data
      const agentPerformance = await this.getAllAgentPerformance(last30Days);

      // Get script performance data
      const scriptPerformance = await this.getAllScriptMetrics();

      // Get lead source analysis
      const leadSourceAnalysis = await this.analyzeLeadSources(last30Days);

      // Get recent insights
      const recentInsights = Array.from(this.insights.values())
        .sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime())
        .slice(0, 10);

      // Get performance trends
      const performanceTrends = await this.analyzePerformanceTrends(last30Days);

      return {
        overview,
        agentPerformance,
        scriptPerformance,
        leadSourceAnalysis,
        recentInsights,
        performanceTrends,
        lastUpdated: now,
      };
    } catch (error) {
      console.error("Error getting dashboard data:", error);
      throw error;
    }
  }

  /**
   * Set performance baseline for an agent
   */
  async setPerformanceBaseline(
    agentId: string,
    period: DateRange
  ): Promise<void> {
    try {
      const performance = await this.collectPerformanceData(agentId, period);
      const baselineKey = `${agentId}_baseline`;
      this.performanceBaselines.set(baselineKey, performance.metrics);
    } catch (error) {
      console.error(`Error setting baseline for agent ${agentId}:`, error);
      throw error;
    }
  }

  // Private helper methods

  private async getAgentInteractions(
    agentId: string,
    period: DateRange
  ): Promise<Interaction[]> {
    // This would typically query the database
    // For now, return empty array as placeholder
    return [];
  }

  private calculatePerformanceMetrics(
    interactions: Interaction[]
  ): PerformanceMetrics {
    if (interactions.length === 0) {
      return {
        totalInteractions: 0,
        conversionRate: 0,
        averageResponseTime: 0,
        appointmentBookingRate: 0,
        customerSatisfactionScore: 0,
      };
    }

    const successful = interactions.filter(
      (i) => i.outcome.status === "successful"
    );
    const withAppointments = interactions.filter(
      (i) => i.outcome.appointmentBooked
    );
    const withSentiment = interactions.filter((i) => i.sentiment);

    const totalResponseTime = interactions
      .filter((i) => i.duration)
      .reduce((sum, i) => sum + (i.duration || 0), 0);

    const avgSentiment =
      withSentiment.length > 0
        ? withSentiment.reduce((sum, i) => sum + (i.sentiment?.score || 0), 0) /
          withSentiment.length
        : 0;

    return {
      totalInteractions: interactions.length,
      conversionRate: successful.length / interactions.length,
      averageResponseTime: totalResponseTime / interactions.length,
      appointmentBookingRate: withAppointments.length / interactions.length,
      customerSatisfactionScore: (avgSentiment + 1) * 2.5, // Convert -1 to 1 scale to 0 to 5
    };
  }

  private async calculateScriptPerformance(
    agentId: string,
    interactions: Interaction[]
  ): Promise<ScriptMetrics[]> {
    // Group interactions by script (would need script tracking in interactions)
    // For now, return placeholder data
    return [
      {
        scriptId: "default-qualification",
        scriptName: "Default Qualification Script",
        usageCount: interactions.length,
        successRate: 0.75,
        averageResponseTime: 45000,
        conversionRate: 0.65,
      },
    ];
  }

  private generateOptimizationSuggestions(
    metrics: PerformanceMetrics,
    scriptPerformance: ScriptMetrics[]
  ): string[] {
    const suggestions: string[] = [];

    if (metrics.conversionRate < 0.6) {
      suggestions.push(
        "Consider improving qualification questions to better identify high-intent leads"
      );
    }

    if (metrics.averageResponseTime > 60000) {
      suggestions.push(
        "Response time exceeds SLA - optimize routing and agent availability"
      );
    }

    if (metrics.customerSatisfactionScore < 4.0) {
      suggestions.push(
        "Customer satisfaction below target - review conversation scripts and agent training"
      );
    }

    if (metrics.appointmentBookingRate < 0.3) {
      suggestions.push(
        "Low appointment booking rate - enhance closing techniques and availability options"
      );
    }

    return suggestions;
  }

  private async getAllScriptMetrics(): Promise<ScriptMetrics[]> {
    // This would query the database for all script metrics
    // Placeholder implementation with sample data
    return [
      {
        scriptId: "default-qualification",
        scriptName: "Default Qualification Script",
        usageCount: 150,
        successRate: 0.75,
        averageResponseTime: 45000,
        conversionRate: 0.65,
      },
      {
        scriptId: "appointment-booking",
        scriptName: "Appointment Booking Script",
        usageCount: 89,
        successRate: 0.82,
        averageResponseTime: 38000,
        conversionRate: 0.71,
      },
      {
        scriptId: "follow-up-sequence",
        scriptName: "Follow-up Sequence Script",
        usageCount: 203,
        successRate: 0.68,
        averageResponseTime: 52000,
        conversionRate: 0.58,
      },
    ];
  }

  private async generateScriptOptimization(
    script: ScriptMetrics
  ): Promise<ScriptOptimization> {
    const recommendations = [];

    if (script.conversionRate < 0.7) {
      recommendations.push({
        type: "content" as const,
        description: "Revise opening questions to better qualify leads",
        expectedImpact: 15,
        priority: "high" as const,
      });
    }

    if (script.averageResponseTime > 60000) {
      recommendations.push({
        type: "timing" as const,
        description: "Optimize script flow to reduce interaction time",
        expectedImpact: 20,
        priority: "medium" as const,
      });
    }

    if (script.successRate < 0.8) {
      recommendations.push({
        type: "approach" as const,
        description: "Improve objection handling techniques",
        expectedImpact: 12,
        priority: "medium" as const,
      });
    }

    // Always provide at least one recommendation for continuous improvement
    if (recommendations.length === 0) {
      recommendations.push({
        type: "content" as const,
        description: "Fine-tune script based on recent interaction patterns",
        expectedImpact: 8,
        priority: "low" as const,
      });
    }

    return {
      scriptId: script.scriptId,
      scriptName: script.scriptName,
      currentPerformance: script,
      recommendations,
      estimatedImpact: {
        conversionRateImprovement: Math.max(
          15,
          recommendations.reduce((sum, rec) => sum + rec.expectedImpact, 0) / 2
        ),
        responseTimeImprovement: 20,
        satisfactionImprovement: 10,
      },
    };
  }

  private async generatePerformanceInsights(): Promise<AnalyticsInsight[]> {
    return [
      {
        id: `insight_${Date.now()}_performance`,
        type: "performance",
        title: "Conversion Rate Improvement Opportunity",
        description:
          "Agent performance analysis shows potential for 15% conversion rate improvement",
        impact: "high",
        actionable: true,
        recommendations: [
          "Implement advanced qualification scripts",
          "Provide additional agent training on objection handling",
        ],
        data: { currentRate: 0.65, targetRate: 0.75 },
        generatedAt: new Date(),
      },
    ];
  }

  private async generateScriptInsights(): Promise<AnalyticsInsight[]> {
    return [
      {
        id: `insight_${Date.now()}_script`,
        type: "script",
        title: "Script Optimization Identified",
        description:
          "Default qualification script shows room for improvement in closing rate",
        impact: "medium",
        actionable: true,
        recommendations: [
          "Add urgency-building questions",
          "Improve appointment booking flow",
        ],
        data: { scriptId: "default-qualification", currentClosingRate: 0.45 },
        generatedAt: new Date(),
      },
    ];
  }

  private async generateTrendInsights(): Promise<AnalyticsInsight[]> {
    return [
      {
        id: `insight_${Date.now()}_trend`,
        type: "trend",
        title: "Response Time Trending Upward",
        description:
          "Average response time has increased 12% over the last 7 days",
        impact: "medium",
        actionable: true,
        recommendations: [
          "Review agent workload distribution",
          "Consider adding additional agents during peak hours",
        ],
        data: { trend: "increasing", changePercent: 12 },
        generatedAt: new Date(),
      },
    ];
  }

  private async generateLeadSourceInsights(): Promise<AnalyticsInsight[]> {
    return [
      {
        id: `insight_${Date.now()}_source`,
        type: "optimization",
        title: "Lead Source Performance Variance",
        description:
          "Meta ads leads show 25% higher conversion rate than website leads",
        impact: "high",
        actionable: true,
        recommendations: [
          "Increase Meta ads budget allocation",
          "Optimize website lead capture forms",
        ],
        data: { metaConversion: 0.78, websiteConversion: 0.58 },
        generatedAt: new Date(),
      },
    ];
  }

  private async analyzeMetricTrend(
    metric: string,
    period: DateRange
  ): Promise<PerformanceTrend> {
    // This would analyze historical data to identify trends
    // Placeholder implementation
    return {
      metric,
      period,
      dataPoints: [
        { date: new Date(), value: 0.65 },
        { date: new Date(Date.now() - 86400000), value: 0.62 },
        { date: new Date(Date.now() - 2 * 86400000), value: 0.68 },
      ],
      trend: "increasing",
      changePercent: 4.8,
      significance: "medium",
    };
  }

  private async calculateOverviewMetrics(
    period: DateRange
  ): Promise<AnalyticsDashboard["overview"]> {
    // This would calculate actual metrics from the database
    // Placeholder implementation
    return {
      totalInteractions: 1250,
      overallConversionRate: 0.68,
      averageResponseTime: 42000,
      customerSatisfactionScore: 4.2,
      activeLeads: 89,
      convertedLeads: 156,
    };
  }

  private async getAllAgentPerformance(
    period: DateRange
  ): Promise<AgentPerformance[]> {
    // This would query the database for all agent performance data
    // Placeholder implementation
    return [];
  }

  private async analyzeLeadSources(
    period: DateRange
  ): Promise<LeadSourceAnalysis[]> {
    // This would analyze lead source effectiveness
    // Placeholder implementation
    return [
      {
        source: "meta_ads",
        totalLeads: 245,
        conversionRate: 0.78,
        averageQualificationScore: 0.72,
        averageResponseTime: 38000,
        qualityScore: 0.85,
        recommendations: ["Increase budget allocation", "Expand targeting"],
      },
      {
        source: "website",
        totalLeads: 189,
        conversionRate: 0.58,
        averageQualificationScore: 0.61,
        averageResponseTime: 45000,
        qualityScore: 0.65,
        recommendations: [
          "Optimize lead capture forms",
          "Improve qualification questions",
        ],
      },
    ];
  }

  private async storeAgentPerformance(
    performance: AgentPerformance
  ): Promise<void> {
    // This would store the performance data in the database
    // Placeholder implementation
    console.log(`Storing performance data for agent ${performance.agentId}`);
  }
}
