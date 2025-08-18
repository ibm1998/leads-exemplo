import { Lead, LeadModel, LeadStatus } from '../types/lead';
import {
  Interaction,
  InteractionModel,
  CreateInteraction,
  InteractionType,
} from '../types/interaction';

/**
 * Re-engagement trigger configuration
 */
export interface ReengagementTrigger {
  id: string;
  name: string;
  condition: (lead: Lead, interactions: Interaction[]) => boolean;
  priority: 'high' | 'medium' | 'low';
  enabled: boolean;
  cooldownDays: number; // Days to wait before re-triggering
}

/**
 * Message template for personalized outreach
 */
export interface MessageTemplate {
  id: string;
  name: string;
  channel: InteractionType;
  subject?: string; // For email
  content: string;
  variables: string[]; // Variables that can be replaced in content
  enabled: boolean;
}

/**
 * Re-engagement campaign configuration
 */
export interface ReengagementCampaign {
  id: string;
  name: string;
  triggers: string[]; // Trigger IDs
  messageSequence: CampaignMessage[];
  enabled: boolean;
  maxAttempts: number;
  successCriteria: string[]; // What constitutes success
}

/**
 * Campaign message with timing
 */
export interface CampaignMessage {
  templateId: string;
  channel: InteractionType;
  delayDays: number; // Days after previous message or trigger
  conditions?: string[]; // Optional conditions to send this message
}

/**
 * Re-engagement session tracking
 */
export interface ReengagementSession {
  id: string;
  leadId: string;
  campaignId: string;
  triggerId: string;
  startedAt: Date;
  status: 'active' | 'completed' | 'paused' | 'failed';
  currentStep: number;
  messagesAttempted: number;
  lastContactAt?: Date;
  responseReceived: boolean;
  completedAt?: Date;
  outcome?: 're_engaged' | 'no_response' | 'opted_out' | 'converted';
}

/**
 * Customer engagement history analysis
 */
export interface EngagementAnalysis {
  leadId: string;
  daysSinceLastInteraction: number;
  totalInteractions: number;
  preferredChannel: InteractionType;
  bestContactTime: string;
  engagementScore: number; // 0-1 scale
  personalizedFactors: string[];
  riskLevel: 'low' | 'medium' | 'high';
}

/**
 * Response handling result
 */
export interface ResponseHandlingResult {
  sessionId: string;
  responseType: 'positive' | 'negative' | 'neutral' | 'opt_out';
  nextAction:
    | 'continue_campaign'
    | 'escalate'
    | 'mark_converted'
    | 'pause'
    | 'end';
  reasoning: string[];
  scheduledFollowUp?: Date;
}

/**
 * Customer Retention & Re-engagement Agent configuration
 */
export interface CustomerRetentionConfig {
  inactivityThresholdDays: number;
  triggers: ReengagementTrigger[];
  messageTemplates: MessageTemplate[];
  campaigns: ReengagementCampaign[];
  channels: {
    sms: { enabled: boolean; provider: string };
    email: { enabled: boolean; provider: string };
    whatsapp: { enabled: boolean; provider: string };
  };
  responseAnalysis: {
    positiveKeywords: string[];
    negativeKeywords: string[];
    optOutKeywords: string[];
  };
  maxConcurrentCampaigns: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: CustomerRetentionConfig = {
  inactivityThresholdDays: 60,
  triggers: [],
  messageTemplates: [],
  campaigns: [],
  channels: {
    sms: { enabled: true, provider: 'twilio' },
    email: { enabled: true, provider: 'sendgrid' },
    whatsapp: { enabled: true, provider: 'twilio' },
  },
  responseAnalysis: {
    positiveKeywords: [
      'yes',
      'interested',
      'sure',
      'okay',
      'sounds good',
      'tell me more',
      'when',
      'how',
      'what',
      'where',
      'schedule',
      'meeting',
      'call',
    ],
    negativeKeywords: [
      'no',
      'not interested',
      'busy',
      'later',
      'maybe',
      'not now',
      "don't",
      "can't",
      "won't",
      'not ready',
    ],
    optOutKeywords: [
      'stop',
      'unsubscribe',
      'remove',
      'opt out',
      'no more',
      'leave me alone',
      "don't contact",
      'take me off',
    ],
  },
  maxConcurrentCampaigns: 50,
};

/**
 * Customer Retention & Re-engagement Agent
 *
 * Responsibilities:
 * - Detect inactive customers (60+ days without interaction)
 * - Generate personalized re-engagement messages
 * - Execute multi-channel outreach campaigns
 * - Handle responses and route to appropriate workflows
 * - Track engagement success and optimize campaigns
 */
export class CustomerRetentionAgent {
  private config: CustomerRetentionConfig;
  private activeSessions: Map<string, ReengagementSession> = new Map();
  private engagementAnalyses: Map<string, EngagementAnalysis> = new Map();

  constructor(config: Partial<CustomerRetentionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initializeDefaultConfiguration();
  }

  /**
   * Initialize default triggers, templates, and campaigns
   */
  private initializeDefaultConfiguration(): void {
    if (this.config.triggers.length === 0) {
      this.initializeDefaultTriggers();
    }
    if (this.config.messageTemplates.length === 0) {
      this.initializeDefaultTemplates();
    }
    if (this.config.campaigns.length === 0) {
      this.initializeDefaultCampaigns();
    }
  }

  /**
   * Initialize default re-engagement triggers
   */
  private initializeDefaultTriggers(): void {
    const defaultTriggers: ReengagementTrigger[] = [
      {
        id: 'inactive_60_days',
        name: '60 Days Inactive',
        condition: (lead, interactions) => {
          const daysSinceLastInteraction =
            this.getDaysSinceLastInteraction(interactions);
          return daysSinceLastInteraction >= 60 && lead.status !== 'dormant';
        },
        priority: 'medium',
        enabled: true,
        cooldownDays: 30,
      },
      {
        id: 'inactive_90_days',
        name: '90 Days Inactive - High Priority',
        condition: (lead, interactions) => {
          const daysSinceLastInteraction =
            this.getDaysSinceLastInteraction(interactions);
          return daysSinceLastInteraction >= 90 && lead.status !== 'dormant';
        },
        priority: 'high',
        enabled: true,
        cooldownDays: 45,
      },
      {
        id: 'qualified_but_inactive',
        name: 'Qualified Lead Gone Inactive',
        condition: (lead, interactions) => {
          const daysSinceLastInteraction =
            this.getDaysSinceLastInteraction(interactions);
          return (
            daysSinceLastInteraction >= 30 &&
            lead.qualificationData.qualificationScore > 0.6 &&
            lead.status !== 'converted' &&
            lead.status !== 'lost'
          );
        },
        priority: 'high',
        enabled: true,
        cooldownDays: 14,
      },
      {
        id: 'appointment_no_show',
        name: 'Appointment No-Show Follow-up',
        condition: (lead, interactions) => {
          const recentInteractions = interactions.filter(
            (i) => Date.now() - i.timestamp.getTime() < 7 * 24 * 60 * 60 * 1000 // Last 7 days
          );
          return recentInteractions.some(
            (i) => i.outcome.appointmentBooked && !i.outcome.escalationRequired
          );
        },
        priority: 'high',
        enabled: true,
        cooldownDays: 7,
      },
    ];

    this.config.triggers = defaultTriggers;
  }

  /**
   * Initialize default message templates
   */
  private initializeDefaultTemplates(): void {
    const defaultTemplates: MessageTemplate[] = [
      {
        id: 'sms_gentle_reengagement',
        name: 'SMS Gentle Re-engagement',
        channel: 'sms',
        content:
          "Hi {{name}}! It's been a while since we last spoke about your real estate needs. We have some exciting new properties that might interest you. Would you like to hear about them? Reply YES to continue or STOP to opt out.",
        variables: ['name'],
        enabled: true,
      },
      {
        id: 'email_personalized_update',
        name: 'Email Personalized Market Update',
        channel: 'email',
        subject: '{{name}}, New Properties in {{location}} - Perfect for You!',
        content: `Hi {{name}},

I hope this email finds you well! It's been {{daysSinceContact}} days since we last connected about your search for a {{propertyType}} in {{location}}.

I wanted to reach out because we've had some fantastic new listings come on the market that match exactly what you were looking for:

• Properties in your preferred {{location}} area
• Within your {{budget}} budget range
• {{propertyType}} with the features you mentioned

The market has been moving quickly, and I'd hate for you to miss out on these opportunities. Would you like to schedule a quick 15-minute call to discuss these new options?

You can reply to this email or call me directly at {{agentPhone}}.

Best regards,
{{agentName}}
Premier Real Estate`,
        variables: [
          'name',
          'daysSinceContact',
          'propertyType',
          'location',
          'budget',
          'agentPhone',
          'agentName',
        ],
        enabled: true,
      },
      {
        id: 'whatsapp_special_offer',
        name: 'WhatsApp Special Offer',
        channel: 'whatsapp',
        content:
          '🏠 Hi {{name}}! We have a special opportunity that might interest you. New properties just listed in {{location}} with exclusive early access for our valued clients. Interested in a private showing? Let me know! 📱',
        variables: ['name', 'location'],
        enabled: true,
      },
      {
        id: 'email_market_report',
        name: 'Email Market Report',
        channel: 'email',
        subject: '{{location}} Market Update - What You Need to Know',
        content: `Hi {{name}},

I thought you'd be interested in the latest market trends for {{location}}, especially given your previous interest in the area.

Here are the key highlights:
• Average home prices: {{marketData}}
• New listings this month: {{newListings}}
• Market trend: {{trend}}

Based on your previous search criteria, now might be a great time to explore your options. The market conditions are favorable for buyers like yourself.

Would you like to schedule a brief consultation to discuss how these trends might affect your home buying plans?

Best,
{{agentName}}`,
        variables: [
          'name',
          'location',
          'marketData',
          'newListings',
          'trend',
          'agentName',
        ],
        enabled: true,
      },
    ];

    this.config.messageTemplates = defaultTemplates;
  }

  /**
   * Initialize default re-engagement campaigns
   */
  private initializeDefaultCampaigns(): void {
    const defaultCampaigns: ReengagementCampaign[] = [
      {
        id: 'gentle_reengagement',
        name: 'Gentle Re-engagement Campaign',
        triggers: ['inactive_60_days'],
        messageSequence: [
          {
            templateId: 'sms_gentle_reengagement',
            channel: 'sms',
            delayDays: 0,
          },
          {
            templateId: 'email_personalized_update',
            channel: 'email',
            delayDays: 3,
            conditions: ['no_sms_response'],
          },
          {
            templateId: 'whatsapp_special_offer',
            channel: 'whatsapp',
            delayDays: 7,
            conditions: ['no_email_response'],
          },
        ],
        enabled: true,
        maxAttempts: 3,
        successCriteria: ['response_received', 'appointment_booked'],
      },
      {
        id: 'high_value_reengagement',
        name: 'High-Value Lead Re-engagement',
        triggers: ['qualified_but_inactive', 'inactive_90_days'],
        messageSequence: [
          {
            templateId: 'email_personalized_update',
            channel: 'email',
            delayDays: 0,
          },
          {
            templateId: 'sms_gentle_reengagement',
            channel: 'sms',
            delayDays: 2,
            conditions: ['no_email_response'],
          },
          {
            templateId: 'email_market_report',
            channel: 'email',
            delayDays: 7,
            conditions: ['no_sms_response'],
          },
        ],
        enabled: true,
        maxAttempts: 3,
        successCriteria: [
          'response_received',
          'appointment_booked',
          'qualification_updated',
        ],
      },
      {
        id: 'appointment_recovery',
        name: 'Appointment No-Show Recovery',
        triggers: ['appointment_no_show'],
        messageSequence: [
          {
            templateId: 'sms_gentle_reengagement',
            channel: 'sms',
            delayDays: 1,
          },
          {
            templateId: 'email_personalized_update',
            channel: 'email',
            delayDays: 3,
            conditions: ['no_sms_response'],
          },
        ],
        enabled: true,
        maxAttempts: 2,
        successCriteria: ['response_received', 'appointment_rescheduled'],
      },
    ];

    this.config.campaigns = defaultCampaigns;
  }

  /**
   * Detect inactive customers and trigger re-engagement campaigns
   */
  async detectInactiveCustomers(
    leads: Lead[],
    interactions: Map<string, Interaction[]>
  ): Promise<ReengagementSession[]> {
    const triggeredSessions: ReengagementSession[] = [];

    for (const lead of leads) {
      const leadInteractions = interactions.get(lead.id) || [];

      // Skip if already in an active campaign
      if (this.hasActiveCampaign(lead.id)) {
        continue;
      }

      // Check each trigger
      for (const trigger of this.config.triggers.filter((t) => t.enabled)) {
        if (trigger.condition(lead, leadInteractions)) {
          // Check cooldown period
          if (await this.isInCooldownPeriod(lead.id, trigger.id)) {
            continue;
          }

          // Find matching campaigns
          const matchingCampaigns = this.config.campaigns.filter(
            (c) => c.enabled && c.triggers.includes(trigger.id)
          );

          if (matchingCampaigns.length > 0) {
            const campaign = matchingCampaigns[0]; // Take the first matching campaign
            const session = await this.startReengagementCampaign(
              lead,
              campaign,
              trigger
            );
            triggeredSessions.push(session);
            break; // Only start one campaign per lead per detection cycle
          }
        }
      }
    }

    return triggeredSessions;
  }

  /**
   * Start a re-engagement campaign for a lead
   */
  async startReengagementCampaign(
    lead: Lead,
    campaign: ReengagementCampaign,
    trigger: ReengagementTrigger
  ): Promise<ReengagementSession> {
    const session: ReengagementSession = {
      id: this.generateSessionId(),
      leadId: lead.id,
      campaignId: campaign.id,
      triggerId: trigger.id,
      startedAt: new Date(),
      status: 'active',
      currentStep: 0,
      messagesAttempted: 0,
      responseReceived: false,
    };

    this.activeSessions.set(session.id, session);

    // Generate engagement analysis
    const analysis = await this.analyzeCustomerEngagement(lead, []);
    this.engagementAnalyses.set(lead.id, analysis);

    // Send first message
    await this.executeNextCampaignStep(session.id);

    return session;
  }

  /**
   * Execute the next step in a campaign
   */
  async executeNextCampaignStep(sessionId: string): Promise<boolean> {
    const session = this.activeSessions.get(sessionId);
    if (!session || session.status !== 'active') {
      return false;
    }

    const campaign = this.config.campaigns.find(
      (c) => c.id === session.campaignId
    );
    if (!campaign) {
      return false;
    }

    // Check if we've reached max attempts
    if (session.messagesAttempted >= campaign.maxAttempts) {
      session.status = 'completed';
      session.outcome = 'no_response';
      session.completedAt = new Date();
      this.activeSessions.set(sessionId, session);
      return false;
    }

    // Get next message in sequence
    const nextMessage = campaign.messageSequence[session.currentStep];
    if (!nextMessage) {
      session.status = 'completed';
      session.outcome = 'no_response';
      session.completedAt = new Date();
      this.activeSessions.set(sessionId, session);
      return false;
    }

    // Check if conditions are met for this message
    if (
      nextMessage.conditions &&
      !this.checkMessageConditions(session, nextMessage.conditions)
    ) {
      session.currentStep++;
      return await this.executeNextCampaignStep(sessionId);
    }

    // Send the message
    const success = await this.sendReengagementMessage(sessionId, nextMessage);

    if (success) {
      session.messagesAttempted++;
      session.currentStep++;
      session.lastContactAt = new Date();
      this.activeSessions.set(sessionId, session);
    }

    return success;
  }

  /**
   * Send a re-engagement message
   */
  async sendReengagementMessage(
    sessionId: string,
    campaignMessage: CampaignMessage
  ): Promise<boolean> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return false;

    const template = this.config.messageTemplates.find(
      (t) => t.id === campaignMessage.templateId
    );
    if (!template) return false;

    // Get lead data for personalization
    // In a real implementation, this would fetch from database
    const leadData = await this.getLeadData(session.leadId);
    const analysis = this.engagementAnalyses.get(session.leadId);

    // Generate personalized message
    const personalizedMessage = await this.personalizeMessage(
      template,
      leadData,
      analysis
    );

    // Send message via appropriate channel
    const success = await this.sendMessage(
      campaignMessage.channel,
      leadData.contactInfo,
      personalizedMessage
    );

    if (success) {
      // Create interaction record
      const interaction = InteractionModel.create({
        leadId: session.leadId,
        agentId: 'customer-retention-agent',
        type: campaignMessage.channel,
        direction: 'outbound',
        content: personalizedMessage.content,
        outcome: {
          status: 'pending',
          appointmentBooked: false,
          qualificationUpdated: false,
          escalationRequired: false,
        },
      });

      // In a real implementation, this would be saved to database
      console.log(`Re-engagement message sent: ${interaction.id}`);
    }

    return success;
  }

  /**
   * Personalize message template with lead data
   */
  async personalizeMessage(
    template: MessageTemplate,
    leadData: any,
    analysis?: EngagementAnalysis
  ): Promise<{ subject?: string; content: string }> {
    let content = template.content;
    let subject = template.subject;

    // Replace variables with actual data
    const replacements: Record<string, string> = {
      name: leadData.contactInfo.name.split(' ')[0], // First name
      location: leadData.qualificationData.location || 'your preferred area',
      propertyType: leadData.qualificationData.propertyType || 'property',
      budget: this.formatBudget(leadData.qualificationData.budget),
      daysSinceContact: analysis?.daysSinceLastInteraction.toString() || '60',
      agentName: 'Sarah Johnson',
      agentPhone: '(555) 123-4567',
      marketData: '$450K - $650K',
      newListings: '12',
      trend: 'Favorable for buyers',
    };

    // Replace variables in content
    for (const [variable, value] of Object.entries(replacements)) {
      const regex = new RegExp(`{{${variable}}}`, 'g');
      content = content.replace(regex, value);
    }

    // Replace variables in subject if it exists
    if (subject) {
      for (const [variable, value] of Object.entries(replacements)) {
        const regex = new RegExp(`{{${variable}}}`, 'g');
        subject = subject.replace(regex, value);
      }
    }

    return { subject, content };
  }

  /**
   * Send message via specified channel
   */
  async sendMessage(
    channel: InteractionType,
    contactInfo: any,
    message: { subject?: string; content: string }
  ): Promise<boolean> {
    try {
      switch (channel) {
        case 'sms':
          if (!this.config.channels.sms.enabled || !contactInfo.phone) {
            return false;
          }
          return await this.sendSMS(contactInfo.phone, message.content);

        case 'email':
          if (!this.config.channels.email.enabled || !contactInfo.email) {
            return false;
          }
          return await this.sendEmail(
            contactInfo.email,
            message.subject || 'Re-engagement',
            message.content
          );

        case 'whatsapp':
          if (!this.config.channels.whatsapp.enabled || !contactInfo.phone) {
            return false;
          }
          return await this.sendWhatsApp(contactInfo.phone, message.content);

        default:
          return false;
      }
    } catch (error) {
      console.error(`Failed to send ${channel} message:`, error);
      return false;
    }
  }

  /**
   * Send SMS message
   */
  private async sendSMS(
    phoneNumber: string,
    content: string
  ): Promise<boolean> {
    // Integration with SMS provider (e.g., Twilio)
    console.log(`Sending SMS to ${phoneNumber}: ${content}`);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 100));
    return true;
  }

  /**
   * Send email message
   */
  private async sendEmail(
    email: string,
    subject: string,
    content: string
  ): Promise<boolean> {
    // Integration with email provider (e.g., SendGrid)
    console.log(
      `Sending email to ${email} with subject "${subject}": ${content}`
    );
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 100));
    return true;
  }

  /**
   * Send WhatsApp message
   */
  private async sendWhatsApp(
    phoneNumber: string,
    content: string
  ): Promise<boolean> {
    // Integration with WhatsApp Business API
    console.log(`Sending WhatsApp to ${phoneNumber}: ${content}`);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 100));
    return true;
  }

  /**
   * Handle customer response to re-engagement message
   */
  async handleCustomerResponse(
    leadId: string,
    responseContent: string,
    channel: InteractionType
  ): Promise<ResponseHandlingResult> {
    // Find active session for this lead
    const session = Array.from(this.activeSessions.values()).find(
      (s) => s.leadId === leadId && s.status === 'active'
    );

    if (!session) {
      throw new Error('No active re-engagement session found for lead');
    }

    // Analyze response
    const responseType = this.analyzeResponse(responseContent);

    // Update session
    session.responseReceived = true;
    this.activeSessions.set(session.id, session);

    // Determine next action based on response
    const result: ResponseHandlingResult = {
      sessionId: session.id,
      responseType,
      nextAction: this.determineNextAction(responseType, session),
      reasoning: [],
    };

    // Execute next action
    switch (result.nextAction) {
      case 'continue_campaign':
        result.reasoning.push(
          'Neutral response - continuing campaign sequence'
        );
        // Schedule next message if available
        setTimeout(
          () => this.executeNextCampaignStep(session.id),
          24 * 60 * 60 * 1000
        ); // 24 hours
        break;

      case 'escalate':
        result.reasoning.push('Positive response - escalating to human agent');
        await this.escalateToHumanAgent(session);
        break;

      case 'mark_converted':
        result.reasoning.push('Strong positive response indicating conversion');
        await this.markAsConverted(session);
        break;

      case 'pause':
        result.reasoning.push('Negative response - pausing campaign');
        await this.pauseCampaign(session);
        break;

      case 'end':
        result.reasoning.push(
          'Opt-out request - ending campaign and updating preferences'
        );
        await this.endCampaignWithOptOut(session);
        break;
    }

    // Create interaction record for the response
    const interaction = InteractionModel.create({
      leadId,
      agentId: 'customer-retention-agent',
      type: channel,
      direction: 'inbound',
      content: responseContent,
      outcome: {
        status: 'successful',
        appointmentBooked: result.nextAction === 'escalate',
        qualificationUpdated: responseType === 'positive',
        escalationRequired: result.nextAction === 'escalate',
      },
    });

    console.log(`Customer response processed: ${interaction.id}`);

    return result;
  }

  /**
   * Analyze customer response to determine sentiment and intent
   */
  private analyzeResponse(
    content: string
  ): ResponseHandlingResult['responseType'] {
    const lowerContent = content.toLowerCase();

    // Check for opt-out keywords first
    if (
      this.config.responseAnalysis.optOutKeywords.some((keyword) =>
        lowerContent.includes(keyword.toLowerCase())
      )
    ) {
      return 'opt_out';
    }

    // Check for positive keywords
    const positiveMatches =
      this.config.responseAnalysis.positiveKeywords.filter((keyword) =>
        lowerContent.includes(keyword.toLowerCase())
      ).length;

    // Check for negative keywords
    const negativeMatches =
      this.config.responseAnalysis.negativeKeywords.filter((keyword) =>
        lowerContent.includes(keyword.toLowerCase())
      ).length;

    if (positiveMatches > negativeMatches && positiveMatches > 0) {
      return 'positive';
    } else if (negativeMatches > positiveMatches && negativeMatches > 0) {
      return 'negative';
    } else {
      return 'neutral';
    }
  }

  /**
   * Determine next action based on response type and session state
   */
  private determineNextAction(
    responseType: ResponseHandlingResult['responseType'],
    session: ReengagementSession
  ): ResponseHandlingResult['nextAction'] {
    switch (responseType) {
      case 'positive':
        // Strong positive responses should be escalated
        if (session.messagesAttempted <= 1) {
          return 'escalate';
        } else {
          return 'mark_converted';
        }

      case 'negative':
        return 'pause';

      case 'opt_out':
        return 'end';

      case 'neutral':
      default:
        // Continue campaign if we haven't reached max attempts
        const campaign = this.config.campaigns.find(
          (c) => c.id === session.campaignId
        );
        if (campaign && session.messagesAttempted < campaign.maxAttempts) {
          return 'continue_campaign';
        } else {
          return 'pause';
        }
    }
  }

  /**
   * Escalate to human agent
   */
  private async escalateToHumanAgent(
    session: ReengagementSession
  ): Promise<void> {
    session.status = 'completed';
    session.outcome = 're_engaged';
    session.completedAt = new Date();
    this.activeSessions.set(session.id, session);

    // In a real implementation, this would integrate with the human agent queue
    console.log(`Escalating re-engaged lead ${session.leadId} to human agent`);
  }

  /**
   * Mark session as converted
   */
  private async markAsConverted(session: ReengagementSession): Promise<void> {
    session.status = 'completed';
    session.outcome = 'converted';
    session.completedAt = new Date();
    this.activeSessions.set(session.id, session);

    console.log(
      `Lead ${session.leadId} marked as converted from re-engagement`
    );
  }

  /**
   * Pause campaign
   */
  private async pauseCampaign(session: ReengagementSession): Promise<void> {
    session.status = 'paused';
    this.activeSessions.set(session.id, session);

    console.log(`Re-engagement campaign paused for lead ${session.leadId}`);
  }

  /**
   * End campaign with opt-out
   */
  private async endCampaignWithOptOut(
    session: ReengagementSession
  ): Promise<void> {
    session.status = 'completed';
    session.outcome = 'opted_out';
    session.completedAt = new Date();
    this.activeSessions.set(session.id, session);

    // Update lead preferences to respect opt-out
    console.log(`Lead ${session.leadId} opted out of re-engagement campaigns`);
  }

  /**
   * Analyze customer engagement history
   */
  async analyzeCustomerEngagement(
    lead: Lead,
    interactions: Interaction[]
  ): Promise<EngagementAnalysis> {
    const daysSinceLastInteraction =
      this.getDaysSinceLastInteraction(interactions);
    const totalInteractions = interactions.length;

    // Determine preferred channel based on interaction history
    const channelCounts = interactions.reduce((acc, interaction) => {
      acc[interaction.type] = (acc[interaction.type] || 0) + 1;
      return acc;
    }, {} as Record<InteractionType, number>);

    let preferredChannel: InteractionType = 'email'; // Default
    if (Object.keys(channelCounts).length > 0) {
      preferredChannel = Object.entries(channelCounts).reduce((a, b) =>
        channelCounts[a[0] as InteractionType] >
        channelCounts[b[0] as InteractionType]
          ? a
          : b
      )[0] as InteractionType;
    }

    // Calculate engagement score
    let engagementScore = 0.5; // Base score

    // Adjust based on qualification score
    engagementScore += lead.qualificationData.qualificationScore * 0.3;

    // Adjust based on interaction frequency
    if (totalInteractions > 5) engagementScore += 0.1;
    if (totalInteractions > 10) engagementScore += 0.1;

    // Adjust based on recency
    if (daysSinceLastInteraction < 30) engagementScore += 0.1;
    else if (daysSinceLastInteraction > 90) engagementScore -= 0.2;

    // Determine risk level
    let riskLevel: EngagementAnalysis['riskLevel'] = 'low';
    if (daysSinceLastInteraction > 90 || engagementScore < 0.3) {
      riskLevel = 'high';
    } else if (daysSinceLastInteraction > 60 || engagementScore < 0.5) {
      riskLevel = 'medium';
    }

    // Generate personalized factors
    const personalizedFactors: string[] = [];
    if (lead.qualificationData.location) {
      personalizedFactors.push(
        `Interested in ${lead.qualificationData.location}`
      );
    }
    if (lead.qualificationData.propertyType) {
      personalizedFactors.push(
        `Looking for ${lead.qualificationData.propertyType}`
      );
    }
    if (lead.qualificationData.budget) {
      personalizedFactors.push(
        `Budget: ${this.formatBudget(lead.qualificationData.budget)}`
      );
    }

    return {
      leadId: lead.id,
      daysSinceLastInteraction,
      totalInteractions,
      preferredChannel,
      bestContactTime: this.determineBestContactTime(interactions),
      engagementScore: Math.max(0, Math.min(1, engagementScore)),
      personalizedFactors,
      riskLevel,
    };
  }

  /**
   * Helper methods
   */
  private getDaysSinceLastInteraction(interactions: Interaction[]): number {
    if (interactions.length === 0) return 999; // Very high number for no interactions

    const lastInteraction = interactions.reduce((latest, current) =>
      current.timestamp > latest.timestamp ? current : latest
    );

    const diffTime = Date.now() - lastInteraction.timestamp.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  private determineBestContactTime(interactions: Interaction[]): string {
    // Analyze interaction times to determine best contact time
    // Simplified implementation - in reality would analyze response rates by time
    return '10:00 AM';
  }

  private formatBudget(budget?: { min?: number; max?: number }): string {
    if (!budget) return 'Budget not specified';

    if (budget.min && budget.max) {
      return `$${budget.min.toLocaleString()} - $${budget.max.toLocaleString()}`;
    } else if (budget.min) {
      return `$${budget.min.toLocaleString()}+`;
    } else if (budget.max) {
      return `Up to $${budget.max.toLocaleString()}`;
    }

    return 'Budget not specified';
  }

  private hasActiveCampaign(leadId: string): boolean {
    return Array.from(this.activeSessions.values()).some(
      (session) => session.leadId === leadId && session.status === 'active'
    );
  }

  private async isInCooldownPeriod(
    leadId: string,
    triggerId: string
  ): Promise<boolean> {
    // Check if this trigger was recently used for this lead
    // In a real implementation, this would check database records
    return false;
  }

  private async getLeadData(leadId: string): Promise<any> {
    // In a real implementation, this would fetch from database
    // For now, return mock data
    return {
      id: leadId,
      contactInfo: {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+1234567890',
      },
      qualificationData: {
        location: 'Downtown',
        propertyType: 'Condo',
        budget: { min: 400000, max: 600000 },
      },
    };
  }

  private checkMessageConditions(
    session: ReengagementSession,
    conditions: string[]
  ): boolean {
    // Check if conditions are met for sending this message
    // Simplified implementation
    return conditions.every((condition) => {
      switch (condition) {
        case 'no_sms_response':
        case 'no_email_response':
          return !session.responseReceived;
        default:
          return true;
      }
    });
  }

  private generateSessionId(): string {
    return `cra-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Public API methods
   */

  /**
   * Get active re-engagement sessions
   */
  getActiveSessions(): ReengagementSession[] {
    return Array.from(this.activeSessions.values()).filter(
      (session) => session.status === 'active'
    );
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): ReengagementSession | undefined {
    return this.activeSessions.get(sessionId);
  }

  /**
   * Get engagement analysis for a lead
   */
  getEngagementAnalysis(leadId: string): EngagementAnalysis | undefined {
    return this.engagementAnalyses.get(leadId);
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<CustomerRetentionConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Add or update a trigger
   */
  addTrigger(trigger: ReengagementTrigger): void {
    const existingIndex = this.config.triggers.findIndex(
      (t) => t.id === trigger.id
    );
    if (existingIndex >= 0) {
      this.config.triggers[existingIndex] = trigger;
    } else {
      this.config.triggers.push(trigger);
    }
  }

  /**
   * Add or update a message template
   */
  addMessageTemplate(template: MessageTemplate): void {
    const existingIndex = this.config.messageTemplates.findIndex(
      (t) => t.id === template.id
    );
    if (existingIndex >= 0) {
      this.config.messageTemplates[existingIndex] = template;
    } else {
      this.config.messageTemplates.push(template);
    }
  }

  /**
   * Add or update a campaign
   */
  addCampaign(campaign: ReengagementCampaign): void {
    const existingIndex = this.config.campaigns.findIndex(
      (c) => c.id === campaign.id
    );
    if (existingIndex >= 0) {
      this.config.campaigns[existingIndex] = campaign;
    } else {
      this.config.campaigns.push(campaign);
    }
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): {
    totalCampaignsStarted: number;
    activeCampaigns: number;
    completedCampaigns: number;
    reengagementRate: number;
    conversionRate: number;
    optOutRate: number;
  } {
    const allSessions = Array.from(this.activeSessions.values());
    const completedSessions = allSessions.filter(
      (s) => s.status === 'completed'
    );

    const reengaged = completedSessions.filter(
      (s) => s.outcome === 're_engaged'
    ).length;
    const converted = completedSessions.filter(
      (s) => s.outcome === 'converted'
    ).length;
    const optedOut = completedSessions.filter(
      (s) => s.outcome === 'opted_out'
    ).length;

    return {
      totalCampaignsStarted: allSessions.length,
      activeCampaigns: allSessions.filter((s) => s.status === 'active').length,
      completedCampaigns: completedSessions.length,
      reengagementRate:
        completedSessions.length > 0 ? reengaged / completedSessions.length : 0,
      conversionRate:
        completedSessions.length > 0 ? converted / completedSessions.length : 0,
      optOutRate:
        completedSessions.length > 0 ? optedOut / completedSessions.length : 0,
    };
  }
}
