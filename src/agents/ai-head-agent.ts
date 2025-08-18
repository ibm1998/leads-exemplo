import { Lead, LeadType, LeadSource, LeadStatus } from '../types/lead';
import { Interaction } from '../types/interaction';
import {
  AgentPerformance,
  PerformanceMetrics,
} from '../types/agent-performance';

/**
 * Lead analysis result containing evaluation metrics
 */
export interface LeadAnalysisResult {
  leadId: string;
  leadType: LeadType;
  urgencyLevel: number;
  intentScore: number;
  sourceQuality: number;
  routingRecommendation: RoutingDecision;
  analysisTimestamp: Date;
  confidence: number;
}

/**
 * Routing decision with agent assignment and reasoning
 */
export interface RoutingDecision {
  targetAgent: 'inbound' | 'outbound';
  priority: 'high' | 'medium' | 'low';
  reasoning: string[];
  estimatedResponseTime: number; // in seconds
  suggestedActions: string[];
}

/**
 * Performance feedback for routing optimization
 */
export interface PerformanceFeedback {
  leadId: string;
  routingDecision: RoutingDecision;
  actualOutcome: {
    conversionSuccessful: boolean;
    responseTime: number;
    customerSatisfaction?: number;
    appointmentBooked: boolean;
  };
  timestamp: Date;
}

/**
 * Routing rule configuration
 */
export interface RoutingRule {
  id: string;
  name: string;
  condition: (lead: Lead, analysis: LeadAnalysisResult) => boolean;
  action: RoutingDecision;
  priority: number;
  enabled: boolean;
  successRate?: number;
}

/**
 * AI Head Agent configuration
 */
export interface AIHeadAgentConfig {
  responseTimeSLA: number; // in seconds
  urgencyThresholds: {
    high: number;
    medium: number;
  };
  intentThresholds: {
    high: number;
    medium: number;
  };
  sourceQualityWeights: Record<LeadSource, number>;
  routingRules: RoutingRule[];
  optimizationEnabled: boolean;
}

/**
 * Default configuration for AI Head Agent
 */
const DEFAULT_CONFIG: AIHeadAgentConfig = {
  responseTimeSLA: 60, // 60 seconds
  urgencyThresholds: {
    high: 8,
    medium: 5,
  },
  intentThresholds: {
    high: 0.7,
    medium: 0.4,
  },
  sourceQualityWeights: {
    gmail: 0.8,
    meta_ads: 0.9,
    website: 0.95,
    slack: 0.7,
    third_party: 0.6,
    referral: 0.85,
    other: 0.5,
  },
  routingRules: [],
  optimizationEnabled: true,
};

/**
 * AI Head Agent - Central dispatcher and operational manager
 *
 * Responsibilities:
 * - Analyze and route incoming leads
 * - Process performance feedback for system optimization
 * - Coordinate between inbound and outbound workflows
 * - Implement dynamic routing rule adjustments
 */
export class AIHeadAgent {
  private config: AIHeadAgentConfig;
  private performanceHistory: Map<string, PerformanceFeedback[]> = new Map();
  private routingHistory: Map<string, LeadAnalysisResult> = new Map();

  constructor(config: Partial<AIHeadAgentConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    if (!config.hasOwnProperty('routingRules') || !config.routingRules) {
      this.initializeDefaultRoutingRules();
    }
  }

  /**
   * Initialize default routing rules
   */
  private initializeDefaultRoutingRules(): void {
    const defaultRules: RoutingRule[] = [
      {
        id: 'hot-lead-immediate',
        name: 'Hot Lead Immediate Response',
        condition: (lead, analysis) =>
          analysis.leadType === 'hot' ||
          analysis.urgencyLevel >= this.config.urgencyThresholds.high,
        action: {
          targetAgent: 'inbound',
          priority: 'high',
          reasoning: [
            'Hot lead requires immediate attention',
            'High urgency level detected',
          ],
          estimatedResponseTime: 30,
          suggestedActions: [
            'Activate Virtual Sales Assistant',
            'Schedule immediate callback',
          ],
        },
        priority: 1,
        enabled: true,
      },
      {
        id: 'direct-inquiry-inbound',
        name: 'Direct Inquiry to Inbound',
        condition: (lead, analysis) =>
          lead.source === 'website' &&
          analysis.intentScore >= this.config.intentThresholds.high,
        action: {
          targetAgent: 'inbound',
          priority: 'high',
          reasoning: ['Direct website inquiry', 'High intent signals detected'],
          estimatedResponseTime: 45,
          suggestedActions: ['Qualification call', 'Appointment booking'],
        },
        priority: 2,
        enabled: true,
      },
      {
        id: 'warm-lead-nurture',
        name: 'Warm Lead Nurturing',
        condition: (lead, analysis) =>
          analysis.leadType === 'warm' &&
          analysis.intentScore >= this.config.intentThresholds.medium,
        action: {
          targetAgent: 'outbound',
          priority: 'medium',
          reasoning: ['Warm lead needs nurturing', 'Medium intent level'],
          estimatedResponseTime: 120,
          suggestedActions: ['Follow-up sequence', 'Educational content'],
        },
        priority: 3,
        enabled: true,
      },
      {
        id: 'cold-lead-outbound',
        name: 'Cold Lead Outbound Processing',
        condition: (lead, analysis) =>
          analysis.leadType === 'cold' ||
          analysis.intentScore < this.config.intentThresholds.medium,
        action: {
          targetAgent: 'outbound',
          priority: 'low',
          reasoning: [
            'Cold lead requires outbound approach',
            'Low intent signals',
          ],
          estimatedResponseTime: 300,
          suggestedActions: ['Cold outreach sequence', 'Lead warming campaign'],
        },
        priority: 4,
        enabled: true,
      },
    ];

    this.config.routingRules = [...defaultRules, ...this.config.routingRules];
  }

  /**
   * Analyze lead and determine routing decision
   */
  async analyzeLead(lead: Lead): Promise<LeadAnalysisResult> {
    const startTime = Date.now();

    try {
      // Validate lead data first
      if (!lead.id || lead.id.trim() === '') {
        throw new Error('Lead ID is required and cannot be empty');
      }

      // Evaluate lead type based on existing data and signals
      const evaluatedLeadType = this.evaluateLeadType(lead);

      // Calculate urgency level
      const urgencyLevel = this.calculateUrgencyLevel(lead);

      // Analyze intent signals
      const intentScore = this.analyzeIntentSignals(lead);

      // Evaluate source quality
      const sourceQuality = this.evaluateSourceQuality(lead.source);

      // Determine routing decision
      const routingRecommendation = this.determineRouting(lead, {
        leadType: evaluatedLeadType,
        urgencyLevel,
        intentScore,
        sourceQuality,
      });

      // Calculate confidence based on available data
      const confidence = this.calculateAnalysisConfidence(lead, {
        leadType: evaluatedLeadType,
        urgencyLevel,
        intentScore,
        sourceQuality,
      });

      const analysisResult: LeadAnalysisResult = {
        leadId: lead.id,
        leadType: evaluatedLeadType,
        urgencyLevel,
        intentScore,
        sourceQuality,
        routingRecommendation,
        analysisTimestamp: new Date(),
        confidence,
      };

      // Store analysis for future optimization
      this.routingHistory.set(lead.id, analysisResult);

      return analysisResult;
    } catch (error) {
      throw new Error(
        `Lead analysis failed for ${lead.id}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Evaluate lead type based on existing data and behavioral signals
   */
  private evaluateLeadType(lead: Lead): LeadType {
    // If lead type is already set and seems accurate, use it
    if (lead.leadType && this.isLeadTypeAccurate(lead)) {
      return lead.leadType;
    }

    let score = 0;
    const factors: string[] = [];

    // Source-based scoring
    const sourceScores: Record<LeadSource, number> = {
      website: 3, // Direct website inquiries are typically warmer
      gmail: 2, // Email leads can be warm
      meta_ads: 1, // Paid ads are often colder initially
      slack: 2, // Internal referrals are warmer
      third_party: 1, // Third-party leads vary
      referral: 3, // Referrals are typically warm
      other: 1, // Unknown sources are treated as cold
    };

    score += sourceScores[lead.source] || 1;
    factors.push(`Source: ${lead.source} (+${sourceScores[lead.source] || 1})`);

    // Intent signals scoring
    const intentSignalScore = lead.intentSignals.length * 0.5;
    score += intentSignalScore;
    if (intentSignalScore > 0) {
      factors.push(
        `Intent signals: ${lead.intentSignals.length} (+${intentSignalScore})`
      );
    }

    // Qualification score influence
    const qualificationBonus = lead.qualificationData.qualificationScore * 2;
    score += qualificationBonus;
    if (qualificationBonus > 0) {
      factors.push(
        `Qualification: ${lead.qualificationData.qualificationScore} (+${qualificationBonus})`
      );
    }

    // Contact completeness
    const hasEmail = !!lead.contactInfo.email;
    const hasPhone = !!lead.contactInfo.phone;
    if (hasEmail && hasPhone) {
      score += 1;
      factors.push('Complete contact info (+1)');
    }

    // Urgency level influence
    if (lead.urgencyLevel >= 8) {
      score += 2;
      factors.push(`High urgency: ${lead.urgencyLevel} (+2)`);
    } else if (lead.urgencyLevel >= 5) {
      score += 1;
      factors.push(`Medium urgency: ${lead.urgencyLevel} (+1)`);
    }

    // Determine lead type based on total score
    if (score >= 6) {
      return 'hot';
    } else if (score >= 3) {
      return 'warm';
    } else {
      return 'cold';
    }
  }

  /**
   * Check if the existing lead type seems accurate based on other factors
   */
  private isLeadTypeAccurate(lead: Lead): boolean {
    const urgencyLevel = lead.urgencyLevel;
    const intentSignals = lead.intentSignals.length;
    const qualificationScore = lead.qualificationData.qualificationScore;

    switch (lead.leadType) {
      case 'hot':
        return (
          urgencyLevel >= 7 || intentSignals >= 3 || qualificationScore >= 0.7
        );
      case 'warm':
        return (
          (urgencyLevel >= 4 && urgencyLevel < 8) ||
          (intentSignals >= 1 && intentSignals < 3) ||
          (qualificationScore >= 0.3 && qualificationScore < 0.7)
        );
      case 'cold':
        return (
          urgencyLevel < 5 && intentSignals < 2 && qualificationScore < 0.4
        );
      default:
        return false;
    }
  }

  /**
   * Calculate urgency level based on various factors
   */
  private calculateUrgencyLevel(lead: Lead): number {
    let urgency = lead.urgencyLevel;

    // Adjust based on source
    const sourceUrgencyModifiers: Record<LeadSource, number> = {
      website: 2, // Website forms often indicate immediate interest
      gmail: 0, // Email leads are neutral
      meta_ads: -1, // Paid ads might be less urgent
      slack: 1, // Internal referrals have some urgency
      third_party: 0, // Third-party leads are neutral
      referral: 1, // Referrals have some urgency
      other: 0, // Unknown sources are neutral
    };

    urgency += sourceUrgencyModifiers[lead.source] || 0;

    // Adjust based on intent signals
    const intentUrgencyBonus = Math.min(lead.intentSignals.length * 0.5, 2);
    urgency += intentUrgencyBonus;

    // Adjust based on qualification score
    if (lead.qualificationData.qualificationScore >= 0.8) {
      urgency += 2;
    } else if (lead.qualificationData.qualificationScore >= 0.5) {
      urgency += 1;
    }

    // Adjust based on lead age (newer leads might be more urgent)
    const leadAge = this.getLeadAgeInHours(lead);
    if (leadAge <= 1) {
      urgency += 1; // Very fresh leads get urgency boost
    } else if (leadAge >= 24) {
      urgency -= 1; // Older leads lose some urgency
    }

    // Ensure urgency stays within valid range
    return Math.max(1, Math.min(10, Math.round(urgency)));
  }

  /**
   * Analyze intent signals and calculate intent score
   */
  private analyzeIntentSignals(lead: Lead): number {
    if (lead.intentSignals.length === 0) {
      return 0.1; // Minimum intent score
    }

    // Define intent signal weights
    const intentWeights: Record<string, number> = {
      requested_callback: 0.9,
      asked_about_pricing: 0.8,
      requested_brochure: 0.7,
      visited_multiple_pages: 0.6,
      downloaded_content: 0.5,
      social_media_engagement: 0.4,
      email_opened: 0.3,
      form_submission: 0.8,
      phone_inquiry: 0.9,
      repeat_visitor: 0.6,
    };

    let totalScore = 0;
    let maxPossibleScore = 0;

    for (const signal of lead.intentSignals) {
      const weight = intentWeights[signal.toLowerCase()] || 0.2; // Default weight for unknown signals
      totalScore += weight;
      maxPossibleScore += 1; // Each signal could theoretically be worth 1.0
    }

    // Normalize score to 0-1 range, but cap at 0.95 to leave room for improvement
    const normalizedScore = Math.min(
      0.95,
      totalScore / Math.max(1, lead.intentSignals.length)
    );

    return Math.round(normalizedScore * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Evaluate source quality based on historical performance
   */
  private evaluateSourceQuality(source: LeadSource): number {
    return this.config.sourceQualityWeights[source] || 0.5;
  }

  /**
   * Determine routing decision based on analysis
   */
  private determineRouting(
    lead: Lead,
    analysis: Partial<LeadAnalysisResult>
  ): RoutingDecision {
    // Find the first matching routing rule
    for (const rule of this.config.routingRules
      .filter((r) => r.enabled)
      .sort((a, b) => a.priority - b.priority)) {
      if (rule.condition(lead, analysis as LeadAnalysisResult)) {
        // Apply any performance-based adjustments
        const adjustedAction = this.applyPerformanceAdjustments(
          rule.action,
          rule.id
        );
        return adjustedAction;
      }
    }

    // Fallback routing if no rules match
    return {
      targetAgent: 'outbound',
      priority: 'low',
      reasoning: [
        'No specific routing rule matched',
        'Using default outbound processing',
      ],
      estimatedResponseTime: 300,
      suggestedActions: ['Standard follow-up sequence'],
    };
  }

  /**
   * Apply performance-based adjustments to routing decisions
   */
  private applyPerformanceAdjustments(
    baseAction: RoutingDecision,
    ruleId: string
  ): RoutingDecision {
    if (!this.config.optimizationEnabled) {
      return baseAction;
    }

    // Get performance data for this routing rule
    const rule = this.config.routingRules.find((r) => r.id === ruleId);
    if (!rule || !rule.successRate) {
      return baseAction;
    }

    // Adjust estimated response time based on historical performance
    let adjustedResponseTime = baseAction.estimatedResponseTime;
    if (rule.successRate < 0.5) {
      // Poor performance - increase response time estimate
      adjustedResponseTime = Math.round(adjustedResponseTime * 1.2);
    } else if (rule.successRate > 0.8) {
      // Good performance - decrease response time estimate
      adjustedResponseTime = Math.round(adjustedResponseTime * 0.9);
    }

    return {
      ...baseAction,
      estimatedResponseTime: adjustedResponseTime,
      reasoning: [
        ...baseAction.reasoning,
        `Performance-adjusted (${Math.round(
          rule.successRate * 100
        )}% success rate)`,
      ],
    };
  }

  /**
   * Calculate confidence in the analysis based on available data quality
   */
  private calculateAnalysisConfidence(
    lead: Lead,
    analysis: Partial<LeadAnalysisResult>
  ): number {
    let confidence = 0.5; // Base confidence

    // Contact information completeness
    if (lead.contactInfo.email && lead.contactInfo.phone) {
      confidence += 0.15;
    } else if (lead.contactInfo.email || lead.contactInfo.phone) {
      confidence += 0.1;
    }

    // Intent signals availability
    if (lead.intentSignals.length >= 3) {
      confidence += 0.15;
    } else if (lead.intentSignals.length >= 1) {
      confidence += 0.1;
    }

    // Qualification data completeness
    if (lead.qualificationData.qualificationScore > 0) {
      confidence += 0.1;
    }

    // Source reliability
    const sourceQuality = analysis.sourceQuality || 0.5;
    confidence += sourceQuality * 0.1;

    // Lead age (fresher leads have more reliable urgency assessment)
    const leadAge = this.getLeadAgeInHours(lead);
    if (leadAge <= 2) {
      confidence += 0.05;
    }

    return Math.min(0.95, Math.max(0.1, confidence));
  }

  /**
   * Process performance feedback to optimize routing decisions
   */
  async processPerformanceFeedback(
    feedback: PerformanceFeedback
  ): Promise<void> {
    // Store feedback
    const leadFeedback = this.performanceHistory.get(feedback.leadId) || [];
    leadFeedback.push(feedback);
    this.performanceHistory.set(feedback.leadId, leadFeedback);

    if (this.config.optimizationEnabled) {
      await this.optimizeRoutingRules(feedback);
    }
  }

  /**
   * Optimize routing rules based on performance feedback
   */
  private async optimizeRoutingRules(
    feedback: PerformanceFeedback
  ): Promise<void> {
    // Find the routing rule that was used for this decision
    const routingDecision = feedback.routingDecision;
    const matchingRule = this.config.routingRules.find(
      (rule) =>
        rule.action.targetAgent === routingDecision.targetAgent &&
        rule.action.priority === routingDecision.priority
    );

    if (!matchingRule) {
      return;
    }

    // Update rule success rate
    const allFeedbackForRule = Array.from(this.performanceHistory.values())
      .flat()
      .filter(
        (f) =>
          f.routingDecision.targetAgent === routingDecision.targetAgent &&
          f.routingDecision.priority === routingDecision.priority
      );

    const successfulOutcomes = allFeedbackForRule.filter(
      (f) => f.actualOutcome.conversionSuccessful
    );
    matchingRule.successRate =
      successfulOutcomes.length / allFeedbackForRule.length;

    // Adjust rule priority based on performance
    if (matchingRule.successRate < 0.3 && matchingRule.priority < 10) {
      matchingRule.priority += 1; // Lower priority for poor performing rules
    } else if (matchingRule.successRate > 0.8 && matchingRule.priority > 1) {
      matchingRule.priority -= 1; // Higher priority for well performing rules
    }
  }

  /**
   * Get performance metrics for the AI Head Agent
   */
  getPerformanceMetrics(): {
    totalLeadsAnalyzed: number;
    averageAnalysisTime: number;
    routingAccuracy: number;
    averageConfidence: number;
    rulePerformance: Array<{
      ruleId: string;
      successRate: number;
      usageCount: number;
    }>;
  } {
    const totalLeads = this.routingHistory.size;
    const allFeedback = Array.from(this.performanceHistory.values()).flat();

    const successfulRoutings = allFeedback.filter(
      (f) => f.actualOutcome.conversionSuccessful
    );
    const routingAccuracy =
      allFeedback.length > 0
        ? successfulRoutings.length / allFeedback.length
        : 0;

    const confidenceSum = Array.from(this.routingHistory.values()).reduce(
      (sum, analysis) => sum + analysis.confidence,
      0
    );
    const averageConfidence = totalLeads > 0 ? confidenceSum / totalLeads : 0;

    const rulePerformance = this.config.routingRules
      .filter((rule) => rule.successRate !== undefined)
      .map((rule) => ({
        ruleId: rule.id,
        successRate: rule.successRate || 0,
        usageCount: allFeedback.filter(
          (f) =>
            f.routingDecision.targetAgent === rule.action.targetAgent &&
            f.routingDecision.priority === rule.action.priority
        ).length,
      }));

    return {
      totalLeadsAnalyzed: totalLeads,
      averageAnalysisTime: 150, // Placeholder - would be calculated from actual timing data
      routingAccuracy,
      averageConfidence,
      rulePerformance,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<AIHeadAgentConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Add or update a routing rule
   */
  addRoutingRule(rule: RoutingRule): void {
    const existingIndex = this.config.routingRules.findIndex(
      (r) => r.id === rule.id
    );
    if (existingIndex >= 0) {
      this.config.routingRules[existingIndex] = rule;
    } else {
      this.config.routingRules.push(rule);
    }

    // Re-sort rules by priority
    this.config.routingRules.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Remove a routing rule
   */
  removeRoutingRule(ruleId: string): void {
    this.config.routingRules = this.config.routingRules.filter(
      (r) => r.id !== ruleId
    );
  }

  /**
   * Get lead age in hours
   */
  private getLeadAgeInHours(lead: Lead): number {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - lead.createdAt.getTime());
    return diffTime / (1000 * 60 * 60);
  }

  /**
   * Get routing history for a specific lead
   */
  getLeadRoutingHistory(leadId: string): LeadAnalysisResult | undefined {
    return this.routingHistory.get(leadId);
  }

  /**
   * Get performance feedback for a specific lead
   */
  getLeadPerformanceFeedback(leadId: string): PerformanceFeedback[] {
    return this.performanceHistory.get(leadId) || [];
  }

  /**
   * Clear performance history (useful for testing or reset)
   */
  clearPerformanceHistory(): void {
    this.performanceHistory.clear();
    this.routingHistory.clear();
  }

  /**
   * Receive optimization feedback and apply improvements
   * This method is called by the ContinuousOptimizationLoop
   */
  async receiveOptimizationFeedback(feedback: {
    routingAdjustments?: {
      urgencyThresholds?: { high: number; medium: number };
      intentThresholds?: { high: number; medium: number };
      sourceQualityWeights?: Partial<Record<LeadSource, number>>;
    };
    newRoutingRules?: RoutingRule[];
    ruleUpdates?: Array<{ ruleId: string; updates: Partial<RoutingRule> }>;
    ruleRemovals?: string[];
  }): Promise<void> {
    try {
      // Apply routing adjustments
      if (feedback.routingAdjustments) {
        const updates: Partial<AIHeadAgentConfig> = {};

        if (feedback.routingAdjustments.urgencyThresholds) {
          updates.urgencyThresholds =
            feedback.routingAdjustments.urgencyThresholds;
        }

        if (feedback.routingAdjustments.intentThresholds) {
          updates.intentThresholds =
            feedback.routingAdjustments.intentThresholds;
        }

        if (feedback.routingAdjustments.sourceQualityWeights) {
          updates.sourceQualityWeights = {
            ...this.config.sourceQualityWeights,
            ...feedback.routingAdjustments.sourceQualityWeights,
          };
        }

        this.updateConfig(updates);
      }

      // Add new routing rules
      if (feedback.newRoutingRules) {
        for (const rule of feedback.newRoutingRules) {
          this.addRoutingRule(rule);
        }
      }

      // Update existing routing rules
      if (feedback.ruleUpdates) {
        for (const update of feedback.ruleUpdates) {
          const existingRule = this.config.routingRules.find(
            (r) => r.id === update.ruleId
          );
          if (existingRule) {
            const updatedRule = { ...existingRule, ...update.updates };
            this.addRoutingRule(updatedRule); // This will replace the existing rule
          }
        }
      }

      // Remove routing rules
      if (feedback.ruleRemovals) {
        for (const ruleId of feedback.ruleRemovals) {
          this.removeRoutingRule(ruleId);
        }
      }

      console.log('Applied optimization feedback to AI Head Agent');
    } catch (error) {
      console.error('Error applying optimization feedback:', error);
      throw error;
    }
  }

  /**
   * Get current routing configuration for optimization analysis
   */
  getRoutingConfiguration(): {
    urgencyThresholds: { high: number; medium: number };
    intentThresholds: { high: number; medium: number };
    sourceQualityWeights: Record<LeadSource, number>;
    routingRules: RoutingRule[];
    optimizationEnabled: boolean;
  } {
    return {
      urgencyThresholds: { ...this.config.urgencyThresholds },
      intentThresholds: { ...this.config.intentThresholds },
      sourceQualityWeights: { ...this.config.sourceQualityWeights },
      routingRules: [...this.config.routingRules],
      optimizationEnabled: this.config.optimizationEnabled,
    };
  }

  /**
   * Enable or disable optimization
   */
  setOptimizationEnabled(enabled: boolean): void {
    this.config.optimizationEnabled = enabled;
  }
}
