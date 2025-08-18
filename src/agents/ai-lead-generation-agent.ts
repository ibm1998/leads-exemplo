import { Lead, LeadModel, LeadType, LeadStatus } from '../types/lead';
import {
  Interaction,
  InteractionModel,
  CreateInteraction,
} from '../types/interaction';
import { AgentPerformanceModel } from '../types/agent-performance';

// Campaign types and interfaces
export interface Campaign {
  id: string;
  name: string;
  type: 'cold_follow_up' | 'warm_reengagement' | 'promotional';
  status: 'active' | 'paused' | 'completed';
  targetAudience: AudienceSegment;
  messageTemplates: MessageTemplate[];
  schedule: CampaignSchedule;
  abTestConfig?: ABTestConfig;
  createdAt: Date;
  updatedAt: Date;
}

export interface AudienceSegment {
  id: string;
  name: string;
  criteria: SegmentationCriteria;
  leadIds: string[];
  size: number;
}

export interface SegmentationCriteria {
  leadTypes?: LeadType[];
  sources?: string[];
  ageRangeInDays?: { min: number; max: number };
  qualificationScoreRange?: { min: number; max: number };
  lastInteractionDaysAgo?: { min: number; max: number };
  intentSignals?: string[];
  excludeStatuses?: LeadStatus[];
}

export interface MessageTemplate {
  id: string;
  name: string;
  channel: 'email' | 'sms' | 'whatsapp';
  subject?: string;
  content: string;
  personalizationFields: string[];
  abTestVariant?: 'A' | 'B';
}

export interface CampaignSchedule {
  startDate: Date;
  endDate?: Date;
  frequency: 'immediate' | 'daily' | 'weekly' | 'monthly';
  timeOfDay?: string; // HH:MM format
  timezone: string;
  maxContactsPerDay?: number;
}

export interface ABTestConfig {
  enabled: boolean;
  splitRatio: number; // 0.5 for 50/50 split
  testDurationDays: number;
  primaryMetric: 'open_rate' | 'response_rate' | 'conversion_rate';
  minimumSampleSize: number;
}

export interface OutboundSequence {
  id: string;
  leadId: string;
  campaignId: string;
  currentStep: number;
  totalSteps: number;
  nextScheduledAt: Date;
  status: 'active' | 'paused' | 'completed' | 'failed';
  interactions: string[]; // Interaction IDs
  createdAt: Date;
  updatedAt: Date;
}

export interface MessagePersonalization {
  leadName: string;
  companyName?: string;
  lastInteractionDate?: string;
  propertyInterest?: string;
  location?: string;
  customFields: Record<string, string>;
}

export interface CampaignPerformance {
  campaignId: string;
  totalSent: number;
  delivered: number;
  opened: number;
  responded: number;
  converted: number;
  bounced: number;
  unsubscribed: number;
  openRate: number;
  responseRate: number;
  conversionRate: number;
  abTestResults?: ABTestResults;
}

export interface ABTestResults {
  variantA: VariantPerformance;
  variantB: VariantPerformance;
  winner?: 'A' | 'B' | 'inconclusive';
  confidenceLevel: number;
  statisticalSignificance: boolean;
}

export interface VariantPerformance {
  sent: number;
  opened: number;
  responded: number;
  converted: number;
  openRate: number;
  responseRate: number;
  conversionRate: number;
}

/**
 * AI Lead Generation Agent for outbound processing
 * Handles cold lead follow-up, warm lead re-engagement, and campaign-driven outreach
 */
export class AILeadGenerationAgent {
  private agentId: string;
  private campaigns: Map<string, Campaign> = new Map();
  private sequences: Map<string, OutboundSequence> = new Map();
  private performanceData: Map<string, CampaignPerformance> = new Map();

  constructor(agentId: string = 'ai-lead-generation-agent') {
    this.agentId = agentId;
  }

  /**
   * Process cold leads that haven't responded to initial outreach
   */
  async processColdLeads(leads: Lead[]): Promise<OutboundSequence[]> {
    const coldLeads = leads.filter(
      (lead) =>
        lead &&
        lead.leadType === 'cold' &&
        lead.status === 'contacted' &&
        this.shouldFollowUpColdLead(lead)
    );

    const sequences: OutboundSequence[] = [];

    for (const lead of coldLeads) {
      try {
        const sequence = await this.createColdFollowUpSequence(lead);
        sequences.push(sequence);

        // Start the sequence immediately
        await this.executeSequenceStep(sequence);
      } catch (error) {
        console.error(`Failed to process cold lead ${lead.id}:`, error);
      }
    }

    return sequences;
  }

  /**
   * Re-engage warm leads based on interaction history
   */
  async processWarmLeads(
    leads: Lead[],
    interactionHistory: Map<string, Interaction[]>
  ): Promise<OutboundSequence[]> {
    const warmLeads = leads.filter(
      (lead) =>
        lead &&
        lead.leadType === 'warm' &&
        this.shouldReengageWarmLead(lead, interactionHistory.get(lead.id) || [])
    );

    const sequences: OutboundSequence[] = [];

    for (const lead of warmLeads) {
      try {
        const interactions = interactionHistory.get(lead.id) || [];
        const sequence = await this.createWarmReengagementSequence(
          lead,
          interactions
        );
        sequences.push(sequence);

        // Start the sequence with personalized timing
        await this.scheduleSequenceExecution(
          sequence,
          this.calculateOptimalTiming(interactions)
        );
      } catch (error) {
        console.error(`Failed to process warm lead ${lead.id}:`, error);
      }
    }

    return sequences;
  }

  /**
   * Execute campaign-driven outreach with audience segmentation
   */
  async executeCampaign(
    campaign: Campaign,
    leads: Lead[]
  ): Promise<CampaignPerformance> {
    // Segment audience based on campaign criteria
    const targetLeads = this.segmentAudience(
      leads,
      campaign.targetAudience?.criteria || {}
    );

    // Initialize campaign performance tracking
    const performance: CampaignPerformance = {
      campaignId: campaign.id,
      totalSent: 0,
      delivered: 0,
      opened: 0,
      responded: 0,
      converted: 0,
      bounced: 0,
      unsubscribed: 0,
      openRate: 0,
      responseRate: 0,
      conversionRate: 0,
    };

    // Set up A/B testing if enabled
    if (campaign.abTestConfig?.enabled) {
      performance.abTestResults = this.initializeABTest(campaign.abTestConfig);
    }

    // Execute campaign for each target lead
    for (const lead of targetLeads) {
      try {
        const sequence = await this.createCampaignSequence(lead, campaign);
        await this.executeSequenceStep(sequence);
        performance.totalSent++;
      } catch (error) {
        console.error(`Failed to execute campaign for lead ${lead.id}:`, error);
      }
    }

    this.performanceData.set(campaign.id, performance);
    return performance;
  }

  /**
   * Create cold follow-up sequence with personalized messaging
   */
  private async createColdFollowUpSequence(
    lead: Lead
  ): Promise<OutboundSequence> {
    const sequenceId = `cold-${lead.id}-${Date.now()}`;

    const sequence: OutboundSequence = {
      id: sequenceId,
      leadId: lead.id,
      campaignId: 'cold-follow-up-default',
      currentStep: 0,
      totalSteps: 5, // 5-step cold follow-up sequence
      nextScheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Start in 24 hours
      status: 'active',
      interactions: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.sequences.set(sequenceId, sequence);
    return sequence;
  }

  /**
   * Create warm re-engagement sequence based on interaction history
   */
  private async createWarmReengagementSequence(
    lead: Lead,
    interactions: Interaction[]
  ): Promise<OutboundSequence> {
    const sequenceId = `warm-${lead.id}-${Date.now()}`;
    const lastInteraction = interactions[interactions.length - 1];

    // Analyze interaction history to determine sequence strategy
    const sequenceStrategy = this.analyzeInteractionHistory(interactions);

    const sequence: OutboundSequence = {
      id: sequenceId,
      leadId: lead.id,
      campaignId: 'warm-reengagement-default',
      currentStep: 0,
      totalSteps: sequenceStrategy.totalSteps,
      nextScheduledAt: this.calculateNextContactTime(lastInteraction),
      status: 'active',
      interactions: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.sequences.set(sequenceId, sequence);
    return sequence;
  }

  /**
   * Create campaign-specific sequence
   */
  private async createCampaignSequence(
    lead: Lead,
    campaign: Campaign
  ): Promise<OutboundSequence> {
    const sequenceId = `campaign-${campaign.id}-${lead.id}-${Date.now()}`;

    const sequence: OutboundSequence = {
      id: sequenceId,
      leadId: lead.id,
      campaignId: campaign.id,
      currentStep: 0,
      totalSteps: campaign.messageTemplates.length,
      nextScheduledAt: campaign.schedule.startDate,
      status: 'active',
      interactions: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.sequences.set(sequenceId, sequence);
    return sequence;
  }

  /**
   * Execute a single step in an outbound sequence
   */
  private async executeSequenceStep(sequence: OutboundSequence): Promise<void> {
    if (sequence.currentStep >= sequence.totalSteps) {
      sequence.status = 'completed';
      return;
    }

    try {
      // Get the message template for current step
      const messageTemplate = await this.getMessageTemplateForStep(sequence);

      // Personalize the message
      const personalizedMessage = await this.personalizeMessage(
        messageTemplate,
        sequence.leadId
      );

      // Create and send interaction
      const interaction = await this.createOutboundInteraction(
        sequence.leadId,
        messageTemplate.channel,
        personalizedMessage
      );

      // Update sequence
      sequence.interactions.push(interaction.id);
      sequence.currentStep++;
      sequence.nextScheduledAt = this.calculateNextStepTime(sequence);
      sequence.updatedAt = new Date();

      // Schedule next step if not completed
      if (sequence.currentStep < sequence.totalSteps) {
        await this.scheduleSequenceExecution(
          sequence,
          sequence.nextScheduledAt
        );
      } else {
        sequence.status = 'completed';
      }
    } catch (error) {
      console.error(
        `Failed to execute sequence step for ${sequence.id}:`,
        error
      );
      sequence.status = 'failed';
    }
  }

  /**
   * Segment audience based on criteria
   */
  private segmentAudience(
    leads: Lead[],
    criteria: SegmentationCriteria
  ): Lead[] {
    return leads.filter((lead) => {
      // Filter by lead types
      if (criteria.leadTypes && !criteria.leadTypes.includes(lead.leadType)) {
        return false;
      }

      // Filter by sources
      if (criteria.sources && !criteria.sources.includes(lead.source)) {
        return false;
      }

      // Filter by age range
      if (criteria.ageRangeInDays) {
        const leadModel = new LeadModel(lead);
        const ageInDays = leadModel.getAgeInDays();
        if (
          ageInDays < criteria.ageRangeInDays.min ||
          ageInDays > criteria.ageRangeInDays.max
        ) {
          return false;
        }
      }

      // Filter by qualification score
      if (criteria.qualificationScoreRange) {
        const score = lead.qualificationData.qualificationScore;
        if (
          score < criteria.qualificationScoreRange.min ||
          score > criteria.qualificationScoreRange.max
        ) {
          return false;
        }
      }

      // Filter by last interaction
      if (criteria.lastInteractionDaysAgo) {
        const leadModel = new LeadModel(lead);
        const daysSinceUpdate = leadModel.getDaysSinceUpdate();
        if (
          daysSinceUpdate < criteria.lastInteractionDaysAgo.min ||
          daysSinceUpdate > criteria.lastInteractionDaysAgo.max
        ) {
          return false;
        }
      }

      // Filter by intent signals
      if (criteria.intentSignals && criteria.intentSignals.length > 0) {
        const hasRequiredSignals = criteria.intentSignals.some((signal) =>
          lead.intentSignals.includes(signal)
        );
        if (!hasRequiredSignals) {
          return false;
        }
      }

      // Exclude certain statuses
      if (
        criteria.excludeStatuses &&
        criteria.excludeStatuses.includes(lead.status)
      ) {
        return false;
      }

      return true;
    });
  }

  /**
   * Personalize message content based on lead data
   */
  private async personalizeMessage(
    template: MessageTemplate,
    leadId: string
  ): Promise<string> {
    // This would typically fetch lead data from database
    // For now, we'll simulate personalization
    const personalization: MessagePersonalization = {
      leadName: 'Valued Customer', // Would be fetched from lead data
      companyName: 'Your Company',
      customFields: {},
    };

    let personalizedContent = template.content;

    // Replace personalization fields
    template.personalizationFields.forEach((field) => {
      const value = this.getPersonalizationValue(personalization, field);
      personalizedContent = personalizedContent.replace(`{{${field}}}`, value);
    });

    return personalizedContent;
  }

  /**
   * Get personalization value for a field
   */
  private getPersonalizationValue(
    personalization: MessagePersonalization,
    field: string
  ): string {
    switch (field) {
      case 'leadName':
        return personalization.leadName;
      case 'companyName':
        return personalization.companyName || 'Your Company';
      case 'lastInteractionDate':
        return personalization.lastInteractionDate || 'recently';
      case 'propertyInterest':
        return personalization.propertyInterest || 'your area of interest';
      case 'location':
        return personalization.location || 'your area';
      default:
        return personalization.customFields[field] || `[${field}]`;
    }
  }

  /**
   * Create outbound interaction
   */
  private async createOutboundInteraction(
    leadId: string,
    channel: 'email' | 'sms' | 'whatsapp',
    content: string
  ): Promise<InteractionModel> {
    const interactionData: CreateInteraction = {
      leadId,
      agentId: this.agentId,
      type:
        channel === 'email' ? 'email' : channel === 'sms' ? 'sms' : 'whatsapp',
      direction: 'outbound',
      content,
      outcome: {
        status: 'pending',
        appointmentBooked: false,
        qualificationUpdated: false,
        escalationRequired: false,
      },
    };

    return InteractionModel.create(interactionData);
  }

  /**
   * Initialize A/B test configuration
   */
  private initializeABTest(config: ABTestConfig): ABTestResults {
    return {
      variantA: {
        sent: 0,
        opened: 0,
        responded: 0,
        converted: 0,
        openRate: 0,
        responseRate: 0,
        conversionRate: 0,
      },
      variantB: {
        sent: 0,
        opened: 0,
        responded: 0,
        converted: 0,
        openRate: 0,
        responseRate: 0,
        conversionRate: 0,
      },
      confidenceLevel: 0,
      statisticalSignificance: false,
    };
  }

  /**
   * Analyze A/B test results and determine winner
   */
  private analyzeABTestResults(
    results: ABTestResults,
    config: ABTestConfig
  ): void {
    const { variantA, variantB } = results;

    // Calculate statistical significance using chi-square test (simplified)
    const totalA = variantA.sent;
    const totalB = variantB.sent;
    const successA = this.getSuccessCount(variantA, config.primaryMetric);
    const successB = this.getSuccessCount(variantB, config.primaryMetric);

    if (
      totalA >= config.minimumSampleSize &&
      totalB >= config.minimumSampleSize
    ) {
      const pValue = this.calculatePValue(successA, totalA, successB, totalB);
      results.confidenceLevel = (1 - pValue) * 100;
      results.statisticalSignificance = pValue < 0.05;

      if (results.statisticalSignificance) {
        const rateA = successA / totalA;
        const rateB = successB / totalB;
        results.winner = rateA > rateB ? 'A' : 'B';
      } else {
        results.winner = 'inconclusive';
      }
    }
  }

  /**
   * Get success count based on primary metric
   */
  private getSuccessCount(variant: VariantPerformance, metric: string): number {
    switch (metric) {
      case 'open_rate':
        return variant.opened;
      case 'response_rate':
        return variant.responded;
      case 'conversion_rate':
        return variant.converted;
      default:
        return variant.responded;
    }
  }

  /**
   * Calculate p-value for statistical significance (simplified chi-square test)
   */
  private calculatePValue(
    successA: number,
    totalA: number,
    successB: number,
    totalB: number
  ): number {
    // Simplified p-value calculation - in production, use proper statistical library
    const pooledRate = (successA + successB) / (totalA + totalB);
    const expectedA = totalA * pooledRate;
    const expectedB = totalB * pooledRate;

    const chiSquare =
      Math.pow(successA - expectedA, 2) / expectedA +
      Math.pow(totalA - successA - (totalA - expectedA), 2) /
        (totalA - expectedA) +
      Math.pow(successB - expectedB, 2) / expectedB +
      Math.pow(totalB - successB - (totalB - expectedB), 2) /
        (totalB - expectedB);

    // Simplified p-value approximation
    return Math.exp(-chiSquare / 2);
  }

  // Helper methods for sequence management
  private shouldFollowUpColdLead(lead: Lead): boolean {
    const leadModel = new LeadModel(lead);
    const daysSinceUpdate = leadModel.getDaysSinceUpdate();
    return daysSinceUpdate >= 3 && daysSinceUpdate <= 30; // Follow up between 3-30 days
  }

  private shouldReengageWarmLead(
    lead: Lead,
    interactions: Interaction[]
  ): boolean {
    if (interactions.length === 0) return false;

    const lastInteraction = interactions[interactions.length - 1];
    const daysSinceLastInteraction = Math.ceil(
      (Date.now() - lastInteraction.timestamp.getTime()) / (1000 * 60 * 60 * 24)
    );

    return daysSinceLastInteraction >= 7 && daysSinceLastInteraction <= 90; // Re-engage between 7-90 days
  }

  private analyzeInteractionHistory(interactions: Interaction[]): {
    totalSteps: number;
    strategy: string;
  } {
    const positiveInteractions = interactions.filter(
      (i) => i.sentiment && i.sentiment.score > 0
    ).length;
    const totalInteractions = interactions.length;

    if (positiveInteractions / totalInteractions > 0.6) {
      return { totalSteps: 3, strategy: 'gentle_reengagement' };
    } else {
      return { totalSteps: 5, strategy: 'value_focused_reengagement' };
    }
  }

  private calculateOptimalTiming(interactions: Interaction[]): Date {
    // Analyze interaction patterns to determine optimal contact time
    const hourCounts = new Array(24).fill(0);

    interactions.forEach((interaction) => {
      if (interaction.outcome.status === 'successful') {
        const hour = interaction.timestamp.getHours();
        hourCounts[hour]++;
      }
    });

    // Find the hour with most successful interactions
    const optimalHour = hourCounts.indexOf(Math.max(...hourCounts));

    const nextContact = new Date();
    nextContact.setDate(nextContact.getDate() + 1); // Tomorrow
    nextContact.setHours(optimalHour || 10, 0, 0, 0); // Default to 10 AM if no pattern

    return nextContact;
  }

  private calculateNextContactTime(lastInteraction: Interaction): Date {
    const baseDelay = 24 * 60 * 60 * 1000; // 24 hours
    let multiplier = 1;

    // Increase delay based on interaction outcome
    if (lastInteraction.outcome.status === 'failed') {
      multiplier = 3; // Wait 3 days after failed interaction
    } else if (
      lastInteraction.sentiment &&
      lastInteraction.sentiment.score < 0
    ) {
      multiplier = 2; // Wait 2 days after negative sentiment
    }

    return new Date(Date.now() + baseDelay * multiplier);
  }

  private calculateNextStepTime(sequence: OutboundSequence): Date {
    // Progressive delays: 1 day, 3 days, 7 days, 14 days, 30 days
    const delays = [1, 3, 7, 14, 30];
    const delayIndex = Math.min(sequence.currentStep, delays.length - 1);
    const delayDays = delays[delayIndex];

    return new Date(Date.now() + delayDays * 24 * 60 * 60 * 1000);
  }

  private async getMessageTemplateForStep(
    sequence: OutboundSequence
  ): Promise<MessageTemplate> {
    // This would typically fetch from database or campaign configuration
    // For now, return a default template based on sequence type
    const stepTemplates = this.getDefaultTemplatesForSequence(sequence);
    return stepTemplates[sequence.currentStep] || stepTemplates[0];
  }

  private getDefaultTemplatesForSequence(
    sequence: OutboundSequence
  ): MessageTemplate[] {
    if (sequence.campaignId.includes('cold')) {
      return this.getColdFollowUpTemplates();
    } else if (sequence.campaignId.includes('warm')) {
      return this.getWarmReengagementTemplates();
    } else {
      return this.getDefaultCampaignTemplates();
    }
  }

  private getColdFollowUpTemplates(): MessageTemplate[] {
    return [
      {
        id: 'cold-1',
        name: 'Initial Follow-up',
        channel: 'email',
        subject: 'Following up on your inquiry',
        content:
          'Hi {{leadName}}, I wanted to follow up on your recent inquiry about {{propertyInterest}}. Are you still looking for properties in {{location}}?',
        personalizationFields: ['leadName', 'propertyInterest', 'location'],
      },
      {
        id: 'cold-2',
        name: 'Value Proposition',
        channel: 'email',
        subject: 'Exclusive properties in {{location}}',
        content:
          'Hi {{leadName}}, I have some exclusive listings in {{location}} that might interest you. Would you like to schedule a quick call to discuss?',
        personalizationFields: ['leadName', 'location'],
      },
    ];
  }

  private getWarmReengagementTemplates(): MessageTemplate[] {
    return [
      {
        id: 'warm-1',
        name: 'Gentle Re-engagement',
        channel: 'email',
        subject: "Hope you're doing well, {{leadName}}",
        content:
          "Hi {{leadName}}, It's been a while since we last spoke on {{lastInteractionDate}}. I wanted to check in and see if you're still interested in {{propertyInterest}}.",
        personalizationFields: [
          'leadName',
          'lastInteractionDate',
          'propertyInterest',
        ],
      },
    ];
  }

  private getDefaultCampaignTemplates(): MessageTemplate[] {
    return [
      {
        id: 'campaign-1',
        name: 'Campaign Message',
        channel: 'email',
        subject: 'Special offer for {{leadName}}',
        content:
          "Hi {{leadName}}, We have a special offer that might interest you. Let's discuss how we can help with your property needs.",
        personalizationFields: ['leadName'],
      },
    ];
  }

  private async scheduleSequenceExecution(
    sequence: OutboundSequence,
    scheduledTime: Date
  ): Promise<void> {
    // In a real implementation, this would integrate with a job scheduler
    // For now, we'll just log the scheduling
    console.log(
      `Scheduled sequence ${
        sequence.id
      } for execution at ${scheduledTime.toISOString()}`
    );
  }

  /**
   * Get campaign performance data
   */
  getCampaignPerformance(campaignId: string): CampaignPerformance | undefined {
    return this.performanceData.get(campaignId);
  }

  /**
   * Get all active sequences
   */
  getActiveSequences(): OutboundSequence[] {
    return Array.from(this.sequences.values()).filter(
      (seq) => seq.status === 'active'
    );
  }

  /**
   * Get sequences for a specific lead
   */
  getSequencesForLead(leadId: string): OutboundSequence[] {
    return Array.from(this.sequences.values()).filter(
      (seq) => seq.leadId === leadId
    );
  }

  /**
   * Pause a sequence
   */
  pauseSequence(sequenceId: string): boolean {
    const sequence = this.sequences.get(sequenceId);
    if (sequence && sequence.status === 'active') {
      sequence.status = 'paused';
      sequence.updatedAt = new Date();
      return true;
    }
    return false;
  }

  /**
   * Resume a paused sequence
   */
  resumeSequence(sequenceId: string): boolean {
    const sequence = this.sequences.get(sequenceId);
    if (sequence && sequence.status === 'paused') {
      sequence.status = 'active';
      sequence.updatedAt = new Date();
      return true;
    }
    return false;
  }

  /**
   * Get agent performance summary
   */
  getPerformanceSummary(): {
    totalCampaigns: number;
    activeSequences: number;
    completedSequences: number;
    averageConversionRate: number;
  } {
    const campaigns = Array.from(this.performanceData.values());
    const sequences = Array.from(this.sequences.values());

    const totalConversions = campaigns.reduce(
      (sum, perf) => sum + perf.converted,
      0
    );
    const totalSent = campaigns.reduce((sum, perf) => sum + perf.totalSent, 0);

    return {
      totalCampaigns: campaigns.length,
      activeSequences: sequences.filter((seq) => seq.status === 'active')
        .length,
      completedSequences: sequences.filter((seq) => seq.status === 'completed')
        .length,
      averageConversionRate: totalSent > 0 ? totalConversions / totalSent : 0,
    };
  }
}
