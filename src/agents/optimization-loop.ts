import { AIHeadAgent, PerformanceFeedback, RoutingRule } from './ai-head-agent';
import {
  AICustomerAnalyticsAgent,
  AnalyticsInsight,
  ScriptOptimization,
} from './ai-customer-analytics-agent';
import {
  AgentPerformance,
  PerformanceMetrics,
  ScriptMetrics,
  DateRange,
} from '../types/agent-performance';

/**
 * Optimization feedback data structure
 */
export interface OptimizationFeedback {
  id: string;
  type: 'routing' | 'script' | 'timing' | 'general';
  agentId: string;
  insights: AnalyticsInsight[];
  recommendations: OptimizationRecommendation[];
  performanceData: AgentPerformance;
  timestamp: Date;
}

/**
 * Optimization recommendation structure
 */
export interface OptimizationRecommendation {
  id: string;
  type:
    | 'routing_rule'
    | 'script_update'
    | 'timing_adjustment'
    | 'threshold_change';
  priority: 'high' | 'medium' | 'low';
  description: string;
  expectedImpact: number; // percentage improvement expected
  implementation: OptimizationImplementation;
  validationCriteria: ValidationCriteria;
}

/**
 * Implementation details for optimization
 */
export interface OptimizationImplementation {
  action: string;
  parameters: Record<string, any>;
  rollbackPlan: string;
  testingPeriod: number; // days
}

/**
 * Validation criteria for measuring optimization impact
 */
export interface ValidationCriteria {
  metrics: string[]; // metrics to track
  minimumImprovement: number; // percentage
  testPeriod: number; // days
  significanceThreshold: number; // statistical significance
}

/**
 * Optimization result tracking
 */
export interface OptimizationResult {
  recommendationId: string;
  implemented: boolean;
  implementedAt?: Date;
  baselineMetrics: PerformanceMetrics;
  currentMetrics?: PerformanceMetrics;
  improvement?: {
    conversionRate: number;
    responseTime: number;
    satisfaction: number;
    overall: number;
  };
  validated: boolean;
  validatedAt?: Date;
  rollbackRequired: boolean;
}

/**
 * Continuous Optimization Loop
 *
 * Implements the feedback mechanism between Analytics Agent and AI Head Agent
 * for continuous system improvement based on performance data.
 */
export class ContinuousOptimizationLoop {
  private aiHeadAgent: AIHeadAgent;
  private analyticsAgent: AICustomerAnalyticsAgent;
  private optimizationHistory: Map<string, OptimizationResult> = new Map();
  private activeOptimizations: Map<string, OptimizationRecommendation> =
    new Map();
  private feedbackQueue: OptimizationFeedback[] = [];
  private isRunning: boolean = false;
  private optimizationInterval: number = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  constructor(
    aiHeadAgent: AIHeadAgent,
    analyticsAgent: AICustomerAnalyticsAgent
  ) {
    this.aiHeadAgent = aiHeadAgent;
    this.analyticsAgent = analyticsAgent;
  }

  /**
   * Start the continuous optimization loop
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('Optimization loop is already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting continuous optimization loop');

    // Run initial optimization cycle
    await this.runOptimizationCycle();

    // Schedule periodic optimization cycles
    setInterval(async () => {
      if (this.isRunning) {
        await this.runOptimizationCycle();
      }
    }, this.optimizationInterval);
  }

  /**
   * Stop the continuous optimization loop
   */
  stop(): void {
    this.isRunning = false;
    console.log('Stopping continuous optimization loop');
  }

  /**
   * Run a complete optimization cycle
   */
  async runOptimizationCycle(): Promise<void> {
    try {
      console.log('Running optimization cycle...');

      // Step 1: Collect performance data and insights
      const feedback = await this.collectOptimizationFeedback();

      // Step 2: Generate optimization recommendations
      const recommendations = await this.generateOptimizationRecommendations(
        feedback
      );

      // Step 3: Implement approved optimizations
      await this.implementOptimizations(recommendations);

      // Step 4: Validate previous optimizations
      await this.validateOptimizations();

      // Step 5: Process feedback queue
      await this.processFeedbackQueue();

      console.log('Optimization cycle completed successfully');
    } catch (error) {
      console.error('Error in optimization cycle:', error);
    }
  }

  /**
   * Collect optimization feedback from Analytics Agent
   * Requirement 10.1: Collect data on agent performance, conversion rates, call quality scores
   */
  private async collectOptimizationFeedback(): Promise<OptimizationFeedback[]> {
    const feedback: OptimizationFeedback[] = [];
    const last7Days: DateRange = {
      start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      end: new Date(),
    };

    try {
      // Get intelligence report from analytics agent
      const insights = await this.analyticsAgent.generateIntelligenceReport();

      // Get performance data for all agents
      const agentIds = [
        'inbound',
        'outbound',
        'virtual-sales',
        'retention',
        'feedback-collector',
      ];

      for (const agentId of agentIds) {
        try {
          const performanceData =
            await this.analyticsAgent.collectPerformanceData(
              agentId,
              last7Days
            );

          const agentFeedback: OptimizationFeedback = {
            id: `feedback_${agentId}_${Date.now()}`,
            type: 'general',
            agentId,
            insights: insights.filter(
              (insight) =>
                insight.actionable &&
                (insight.impact === 'high' || insight.impact === 'medium')
            ),
            recommendations: [],
            performanceData,
            timestamp: new Date(),
          };

          feedback.push(agentFeedback);
        } catch (error) {
          console.warn(
            `Failed to collect performance data for agent ${agentId}:`,
            error
          );
        }
      }

      return feedback;
    } catch (error) {
      console.error('Error collecting optimization feedback:', error);
      return [];
    }
  }

  /**
   * Generate optimization recommendations based on feedback
   * Requirements 10.2, 10.3, 10.4: Identify best practices and generate actionable intelligence
   */
  private async generateOptimizationRecommendations(
    feedback: OptimizationFeedback[]
  ): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];

    for (const fb of feedback) {
      // Generate routing optimization recommendations
      const routingRecommendations = await this.generateRoutingOptimizations(
        fb
      );
      recommendations.push(...routingRecommendations);

      // Generate script optimization recommendations
      const scriptRecommendations = await this.generateScriptOptimizations(fb);
      recommendations.push(...scriptRecommendations);

      // Generate timing optimization recommendations
      const timingRecommendations = await this.generateTimingOptimizations(fb);
      recommendations.push(...timingRecommendations);
    }

    // Sort by priority and expected impact
    recommendations.sort((a, b) => {
      const priorityWeight = { high: 3, medium: 2, low: 1 };
      const aPriority = priorityWeight[a.priority];
      const bPriority = priorityWeight[b.priority];

      if (aPriority !== bPriority) {
        return bPriority - aPriority; // Higher priority first
      }

      return b.expectedImpact - a.expectedImpact; // Higher impact first
    });

    return recommendations;
  }

  /**
   * Generate routing rule optimization recommendations
   */
  private async generateRoutingOptimizations(
    feedback: OptimizationFeedback
  ): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];
    const metrics = feedback.performanceData.metrics;

    // Check conversion rate performance
    if (metrics.conversionRate < 0.6) {
      recommendations.push({
        id: `routing_conv_${feedback.agentId}_${Date.now()}`,
        type: 'routing_rule',
        priority: 'high',
        description: `Improve routing rules for ${feedback.agentId} - conversion rate below 60%`,
        expectedImpact: 15,
        implementation: {
          action: 'adjust_routing_thresholds',
          parameters: {
            agentId: feedback.agentId,
            urgencyThreshold: 7, // Lower threshold for faster routing
            intentThreshold: 0.5, // Lower threshold for broader capture
          },
          rollbackPlan: 'Revert to previous thresholds if performance degrades',
          testingPeriod: 7,
        },
        validationCriteria: {
          metrics: ['conversionRate', 'averageResponseTime'],
          minimumImprovement: 10,
          testPeriod: 14,
          significanceThreshold: 0.05,
        },
      });
    }

    // Check response time performance
    if (metrics.averageResponseTime > 60000) {
      // 60 seconds
      recommendations.push({
        id: `routing_time_${feedback.agentId}_${Date.now()}`,
        type: 'routing_rule',
        priority: 'high',
        description: `Optimize routing for faster response times - currently ${Math.round(
          metrics.averageResponseTime / 1000
        )}s`,
        expectedImpact: 20,
        implementation: {
          action: 'prioritize_fast_agents',
          parameters: {
            agentId: feedback.agentId,
            responseTimeSLA: 45000, // 45 seconds
            priorityBoost: true,
          },
          rollbackPlan: 'Remove priority boost if quality degrades',
          testingPeriod: 5,
        },
        validationCriteria: {
          metrics: ['averageResponseTime', 'customerSatisfactionScore'],
          minimumImprovement: 15,
          testPeriod: 10,
          significanceThreshold: 0.05,
        },
      });
    }

    return recommendations;
  }

  /**
   * Generate script optimization recommendations
   */
  private async generateScriptOptimizations(
    feedback: OptimizationFeedback
  ): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];

    try {
      // Get script performance analysis
      const scriptOptimizations =
        await this.analyticsAgent.analyzeScriptPerformance();

      for (const scriptOpt of scriptOptimizations) {
        if (scriptOpt.estimatedImpact.conversionRateImprovement > 10) {
          recommendations.push({
            id: `script_${scriptOpt.scriptId}_${Date.now()}`,
            type: 'script_update',
            priority:
              scriptOpt.estimatedImpact.conversionRateImprovement > 20
                ? 'high'
                : 'medium',
            description: `Optimize ${scriptOpt.scriptName} - potential ${scriptOpt.estimatedImpact.conversionRateImprovement}% improvement`,
            expectedImpact: scriptOpt.estimatedImpact.conversionRateImprovement,
            implementation: {
              action: 'update_script',
              parameters: {
                scriptId: scriptOpt.scriptId,
                recommendations: scriptOpt.recommendations,
                currentPerformance: scriptOpt.currentPerformance,
              },
              rollbackPlan:
                'Revert to previous script version if performance degrades',
              testingPeriod: 14,
            },
            validationCriteria: {
              metrics: ['conversionRate', 'customerSatisfactionScore'],
              minimumImprovement: 8,
              testPeriod: 21,
              significanceThreshold: 0.05,
            },
          });
        }
      }
    } catch (error) {
      console.warn('Error generating script optimizations:', error);
    }

    return recommendations;
  }

  /**
   * Generate timing optimization recommendations
   */
  private async generateTimingOptimizations(
    feedback: OptimizationFeedback
  ): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];
    const last30Days: DateRange = {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end: new Date(),
    };

    try {
      // Analyze performance trends
      const trends = await this.analyticsAgent.analyzePerformanceTrends(
        last30Days
      );

      for (const trend of trends) {
        if (trend.trend === 'decreasing' && trend.significance === 'high') {
          recommendations.push({
            id: `timing_${trend.metric}_${Date.now()}`,
            type: 'timing_adjustment',
            priority: 'medium',
            description: `Adjust timing for ${
              trend.metric
            } - showing ${Math.abs(trend.changePercent)}% decline`,
            expectedImpact: Math.abs(trend.changePercent) * 0.8, // Conservative estimate
            implementation: {
              action: 'adjust_timing_sequences',
              parameters: {
                metric: trend.metric,
                adjustment: trend.changePercent > -10 ? 'minor' : 'major',
                targetImprovement: Math.abs(trend.changePercent),
              },
              rollbackPlan: 'Revert timing adjustments if trend continues',
              testingPeriod: 10,
            },
            validationCriteria: {
              metrics: [trend.metric],
              minimumImprovement: 5,
              testPeriod: 14,
              significanceThreshold: 0.1,
            },
          });
        }
      }
    } catch (error) {
      console.warn('Error generating timing optimizations:', error);
    }

    return recommendations;
  }

  /**
   * Implement optimization recommendations
   */
  private async implementOptimizations(
    recommendations: OptimizationRecommendation[]
  ): Promise<void> {
    // Implement top 3 high-priority recommendations to avoid system instability
    const toImplement = recommendations
      .filter((rec) => rec.priority === 'high')
      .slice(0, 3);

    for (const recommendation of toImplement) {
      try {
        await this.implementSingleOptimization(recommendation);
        this.activeOptimizations.set(recommendation.id, recommendation);

        console.log(`Implemented optimization: ${recommendation.description}`);
      } catch (error) {
        console.error(
          `Failed to implement optimization ${recommendation.id}:`,
          error
        );
      }
    }
  }

  /**
   * Implement a single optimization recommendation
   */
  private async implementSingleOptimization(
    recommendation: OptimizationRecommendation
  ): Promise<void> {
    const { implementation } = recommendation;

    switch (recommendation.type) {
      case 'routing_rule':
        await this.implementRoutingOptimization(implementation);
        break;
      case 'script_update':
        await this.implementScriptOptimization(implementation);
        break;
      case 'timing_adjustment':
        await this.implementTimingOptimization(implementation);
        break;
      case 'threshold_change':
        await this.implementThresholdOptimization(implementation);
        break;
      default:
        console.warn(`Unknown optimization type: ${recommendation.type}`);
    }

    // Record the optimization result
    const result: OptimizationResult = {
      recommendationId: recommendation.id,
      implemented: true,
      implementedAt: new Date(),
      baselineMetrics: await this.getCurrentMetrics(),
      validated: false,
      rollbackRequired: false,
    };

    this.optimizationHistory.set(recommendation.id, result);
  }

  /**
   * Implement routing rule optimization
   */
  private async implementRoutingOptimization(
    implementation: OptimizationImplementation
  ): Promise<void> {
    const { action, parameters } = implementation;

    switch (action) {
      case 'adjust_routing_thresholds':
        this.aiHeadAgent.updateConfig({
          urgencyThresholds: {
            high: parameters.urgencyThreshold,
            medium: parameters.urgencyThreshold - 2,
          },
          intentThresholds: {
            high: parameters.intentThreshold + 0.2,
            medium: parameters.intentThreshold,
          },
        });
        break;

      case 'prioritize_fast_agents':
        // Update routing rules to prioritize faster response times
        const fastResponseRule: RoutingRule = {
          id: `fast_response_${Date.now()}`,
          name: 'Fast Response Priority',
          condition: (lead, analysis) => analysis.urgencyLevel >= 6,
          action: {
            targetAgent: 'inbound',
            priority: 'high',
            reasoning: ['Prioritized for fast response'],
            estimatedResponseTime: parameters.responseTimeSLA,
            suggestedActions: ['Immediate contact'],
          },
          priority: 0, // Highest priority
          enabled: true,
        };
        this.aiHeadAgent.addRoutingRule(fastResponseRule);
        break;
    }
  }

  /**
   * Implement script optimization
   */
  private async implementScriptOptimization(
    implementation: OptimizationImplementation
  ): Promise<void> {
    // This would integrate with script management system
    // For now, log the optimization
    console.log(
      `Script optimization implemented for ${implementation.parameters.scriptId}`
    );
    console.log('Recommendations:', implementation.parameters.recommendations);
  }

  /**
   * Implement timing optimization
   */
  private async implementTimingOptimization(
    implementation: OptimizationImplementation
  ): Promise<void> {
    // This would adjust timing sequences in the system
    // For now, log the optimization
    console.log(
      `Timing optimization implemented for ${implementation.parameters.metric}`
    );
    console.log('Adjustment type:', implementation.parameters.adjustment);
  }

  /**
   * Implement threshold optimization
   */
  private async implementThresholdOptimization(
    implementation: OptimizationImplementation
  ): Promise<void> {
    // This would adjust various system thresholds
    // For now, log the optimization
    console.log('Threshold optimization implemented');
  }

  /**
   * Validate implemented optimizations
   * Requirement 10.5: Measure and validate improvement impact
   */
  private async validateOptimizations(): Promise<void> {
    const now = new Date();

    for (const [id, result] of this.optimizationHistory.entries()) {
      if (!result.validated && result.implementedAt) {
        const daysSinceImplementation = Math.floor(
          (now.getTime() - result.implementedAt.getTime()) /
            (1000 * 60 * 60 * 24)
        );

        const recommendation = this.activeOptimizations.get(id);
        if (!recommendation) continue;

        // Check if enough time has passed for validation
        if (
          daysSinceImplementation >=
          recommendation.validationCriteria.testPeriod
        ) {
          try {
            const validationResult = await this.validateSingleOptimization(
              id,
              result,
              recommendation
            );

            // Update the result
            result.currentMetrics = validationResult.current;
            result.improvement = validationResult.improvement;
            result.validated = validationResult.validated;
            result.validatedAt = now;
            result.rollbackRequired =
              !validationResult.validated &&
              validationResult.improvement.overall < -5;

            // Handle rollback if needed
            if (result.rollbackRequired) {
              await this.rollbackOptimization(id, recommendation);
            }

            this.optimizationHistory.set(id, result);
            console.log(
              `Validated optimization ${id}: ${
                result.validated ? 'SUCCESS' : 'FAILED'
              }`
            );
          } catch (error) {
            console.error(`Error validating optimization ${id}:`, error);
          }
        }
      }
    }
  }

  /**
   * Validate a single optimization
   */
  private async validateSingleOptimization(
    optimizationId: string,
    result: OptimizationResult,
    recommendation: OptimizationRecommendation
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
    // Get current metrics
    const current = await this.getCurrentMetrics();
    const baseline = result.baselineMetrics;

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

    // Calculate overall improvement
    improvement.overall =
      improvement.conversionRate * 0.4 +
      improvement.responseTime * 0.3 +
      improvement.satisfaction * 0.3;

    // Validate against criteria
    const validated =
      improvement.overall >=
      recommendation.validationCriteria.minimumImprovement;

    return {
      baseline,
      current,
      improvement,
      validated,
    };
  }

  /**
   * Rollback an optimization that didn't meet validation criteria
   */
  private async rollbackOptimization(
    optimizationId: string,
    recommendation: OptimizationRecommendation
  ): Promise<void> {
    console.log(
      `Rolling back optimization ${optimizationId}: ${recommendation.implementation.rollbackPlan}`
    );

    // Implementation would depend on the optimization type
    // For now, just remove from active optimizations
    this.activeOptimizations.delete(optimizationId);
  }

  /**
   * Process feedback queue for manual review
   */
  private async processFeedbackQueue(): Promise<void> {
    // Process any queued feedback that requires manual attention
    const highImpactFeedback = this.feedbackQueue.filter((fb) =>
      fb.insights.some(
        (insight) => insight.impact === 'high' && !insight.actionable
      )
    );

    if (highImpactFeedback.length > 0) {
      console.log(
        `${highImpactFeedback.length} high-impact items require manual review`
      );
      // In a real system, this would notify administrators
    }

    // Clear processed feedback
    this.feedbackQueue = [];
  }

  /**
   * Get current system performance metrics
   */
  private async getCurrentMetrics(): Promise<PerformanceMetrics> {
    // This would aggregate metrics across all agents
    // For now, return sample metrics
    return {
      totalInteractions: 100,
      conversionRate: 0.65,
      averageResponseTime: 45000,
      appointmentBookingRate: 0.35,
      customerSatisfactionScore: 4.2,
    };
  }

  /**
   * Add feedback to the queue for processing
   */
  addFeedback(feedback: OptimizationFeedback): void {
    this.feedbackQueue.push(feedback);
  }

  /**
   * Get optimization history
   */
  getOptimizationHistory(): Map<string, OptimizationResult> {
    return new Map(this.optimizationHistory);
  }

  /**
   * Add optimization result for testing purposes
   */
  addOptimizationResult(id: string, result: OptimizationResult): void {
    this.optimizationHistory.set(id, result);
  }

  /**
   * Get optimization result by ID for testing purposes
   */
  getOptimizationResult(id: string): OptimizationResult | undefined {
    return this.optimizationHistory.get(id);
  }

  /**
   * Get active optimizations
   */
  getActiveOptimizations(): Map<string, OptimizationRecommendation> {
    return new Map(this.activeOptimizations);
  }

  /**
   * Get optimization statistics
   */
  getOptimizationStats(): {
    totalOptimizations: number;
    successfulOptimizations: number;
    failedOptimizations: number;
    averageImprovement: number;
    activeOptimizations: number;
  } {
    const results = Array.from(this.optimizationHistory.values());
    const validated = results.filter((r) => r.validated);
    const successful = validated.filter(
      (r) => r.improvement && r.improvement.overall > 0
    );
    const failed = validated.filter(
      (r) => r.improvement && r.improvement.overall <= 0
    );

    const averageImprovement =
      successful.length > 0
        ? successful.reduce(
            (sum, r) => sum + (r.improvement?.overall || 0),
            0
          ) / successful.length
        : 0;

    return {
      totalOptimizations: results.length,
      successfulOptimizations: successful.length,
      failedOptimizations: failed.length,
      averageImprovement,
      activeOptimizations: this.activeOptimizations.size,
    };
  }
}
