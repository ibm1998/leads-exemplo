import { Lead, LeadModel, LeadStatus } from '../types/lead';
import {
  Interaction,
  InteractionModel,
  CreateInteraction,
  InteractionType,
  SentimentScore,
} from '../types/interaction';

/**
 * Project completion trigger configuration
 */
export interface ProjectCompletionTrigger {
  id: string;
  name: string;
  condition: (lead: Lead, interactions: Interaction[]) => boolean;
  priority: 'high' | 'medium' | 'low';
  enabled: boolean;
  delayHours: number; // Hours to wait after completion before triggering
}

/**
 * Feedback collection template
 */
export interface FeedbackTemplate {
  id: string;
  name: string;
  channel: InteractionType;
  subject?: string; // For email
  content: string;
  variables: string[]; // Variables that can be replaced in content
  feedbackType: 'initial' | 'follow_up' | 'review_request';
  enabled: boolean;
}

/**
 * Review platform configuration
 */
export interface ReviewPlatform {
  id: string;
  name: string;
  url: string;
  instructions: string;
  enabled: boolean;
}

/**
 * Feedback collection session
 */
export interface FeedbackSession {
  id: string;
  leadId: string;
  triggerId: string;
  startedAt: Date;
  status: 'active' | 'completed' | 'escalated' | 'failed';
  feedbackReceived: boolean;
  sentimentScore?: SentimentScore;
  feedbackContent?: string;
  reviewRequested: boolean;
  escalationRequired: boolean;
  completedAt?: Date;
  outcome?:
    | 'positive_review'
    | 'negative_escalated'
    | 'no_response'
    | 'neutral';
}

/**
 * Feedback analysis result
 */
export interface FeedbackAnalysis {
  sessionId: string;
  sentiment: SentimentScore;
  issues: string[];
  positiveAspects: string[];
  reviewWorthy: boolean;
  escalationRequired: boolean;
  suggestedActions: string[];
}

/**
 * Issue escalation data
 */
export interface IssueEscalation {
  id: string;
  sessionId: string;
  leadId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  issues: string[];
  feedbackContent: string;
  escalatedAt: Date;
  assignedTo?: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  resolution?: string;
}

/**
 * Review & Feedback Collector Agent configuration
 */
export interface ReviewFeedbackConfig {
  triggers: ProjectCompletionTrigger[];
  feedbackTemplates: FeedbackTemplate[];
  reviewPlatforms: ReviewPlatform[];
  sentimentAnalysis: {
    positiveThreshold: number; // Above this score is considered positive
    negativeThreshold: number; // Below this score requires escalation
    issueKeywords: string[];
    positiveKeywords: string[];
  };
  escalation: {
    enabled: boolean;
    autoAssign: boolean;
    notificationChannels: string[];
  };
  followUpDelayHours: number;
  maxFollowUpAttempts: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: ReviewFeedbackConfig = {
  triggers: [],
  feedbackTemplates: [],
  reviewPlatforms: [],
  sentimentAnalysis: {
    positiveThreshold: 0.3,
    negativeThreshold: -0.3,
    issueKeywords: [
      'problem',
      'issue',
      'complaint',
      'disappointed',
      'unhappy',
      'poor',
      'bad',
      'terrible',
      'awful',
      'worst',
      'delay',
      'late',
      'unprofessional',
      'rude',
      'mistake',
      'error',
      'wrong',
      'damaged',
      'broken',
      'defect',
      'quality',
      'overpriced',
      'expensive',
      'hidden costs',
      'surprise fees',
    ],
    positiveKeywords: [
      'excellent',
      'great',
      'amazing',
      'wonderful',
      'fantastic',
      'outstanding',
      'professional',
      'helpful',
      'friendly',
      'knowledgeable',
      'responsive',
      'quick',
      'efficient',
      'smooth',
      'easy',
      'recommend',
      'satisfied',
      'happy',
      'pleased',
      'impressed',
      'exceeded expectations',
      'quality',
      'value',
      'fair price',
    ],
  },
  escalation: {
    enabled: true,
    autoAssign: false,
    notificationChannels: ['email', 'slack'],
  },
  followUpDelayHours: 72, // 3 days
  maxFollowUpAttempts: 2,
};

/**
 * Review & Feedback Collector Agent
 *
 * Responsibilities:
 * - Detect project completion and trigger feedback collection
 * - Send congratulatory messages and request feedback
 * - Analyze feedback sentiment and content
 * - Escalate negative feedback to human management
 * - Guide positive feedback to public review platforms
 * - Track feedback collection success and optimize approaches
 */
export class ReviewFeedbackCollectorAgent {
  private config: ReviewFeedbackConfig;
  private activeSessions: Map<string, FeedbackSession> = new Map();
  private escalations: Map<string, IssueEscalation> = new Map();

  constructor(config: Partial<ReviewFeedbackConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initializeDefaultConfiguration();
  }

  /**
   * Initialize default triggers, templates, and platforms
   */
  private initializeDefaultConfiguration(): void {
    if (this.config.triggers.length === 0) {
      this.initializeDefaultTriggers();
    }
    if (this.config.feedbackTemplates.length === 0) {
      this.initializeDefaultTemplates();
    }
    if (this.config.reviewPlatforms.length === 0) {
      this.initializeDefaultPlatforms();
    }
  }

  /**
   * Initialize default project completion triggers
   */
  private initializeDefaultTriggers(): void {
    const defaultTriggers: ProjectCompletionTrigger[] = [
      {
        id: 'project_completed',
        name: 'Project Marked as Completed',
        condition: (lead, interactions) => {
          return lead.status === 'converted';
        },
        priority: 'high',
        enabled: true,
        delayHours: 24, // Wait 24 hours after completion
      },
      {
        id: 'successful_transaction',
        name: 'Successful Transaction Completed',
        condition: (lead, interactions) => {
          const recentInteractions = interactions.filter(
            (i) => Date.now() - i.timestamp.getTime() < 7 * 24 * 60 * 60 * 1000 // Last 7 days
          );
          return (
            lead.status === 'converted' &&
            recentInteractions.some(
              (i) =>
                i.outcome.status === 'successful' &&
                i.content.toLowerCase().includes('closing')
            )
          );
        },
        priority: 'high',
        enabled: true,
        delayHours: 48, // Wait 48 hours after transaction
      },
      {
        id: 'appointment_completed',
        name: 'Appointment Successfully Completed',
        condition: (lead, interactions) => {
          const recentInteractions = interactions.filter(
            (i) => Date.now() - i.timestamp.getTime() < 3 * 24 * 60 * 60 * 1000 // Last 3 days
          );
          return recentInteractions.some(
            (i) =>
              i.outcome.appointmentBooked &&
              i.outcome.status === 'successful' &&
              !i.outcome.escalationRequired
          );
        },
        priority: 'medium',
        enabled: true,
        delayHours: 24,
      },
    ];

    this.config.triggers = defaultTriggers;
  }

  /**
   * Initialize default feedback templates
   */
  private initializeDefaultTemplates(): void {
    const defaultTemplates: FeedbackTemplate[] = [
      {
        id: 'congratulatory_email',
        name: 'Congratulatory Email with Feedback Request',
        channel: 'email',
        subject: 'Congratulations on Your New Home, {{name}}! 🏠',
        content: `Dear {{name}},

Congratulations on the successful completion of your real estate transaction! 🎉

It has been our absolute pleasure working with you throughout this journey. We hope you're settling into your new {{propertyType}} and that everything has exceeded your expectations.

Your satisfaction is our top priority, and we would love to hear about your experience working with our team. Your feedback helps us continue to provide exceptional service to all our clients.

Would you mind taking just 2 minutes to share your thoughts about:
• How was your overall experience with our team?
• What did we do well that you appreciated most?
• Is there anything we could have done better?
• Would you recommend our services to friends and family?

You can simply reply to this email with your feedback, or if you prefer, we'd be happy to schedule a quick 5-minute call at your convenience.

Thank you again for choosing us for your real estate needs. We wish you all the best in your new home!

Warm regards,
{{agentName}}
{{companyName}}

P.S. If you had a great experience, we'd be incredibly grateful if you could share a review on Google or Zillow. It really helps other families find us when they need real estate services.`,
        variables: ['name', 'propertyType', 'agentName', 'companyName'],
        feedbackType: 'initial',
        enabled: true,
      },
      {
        id: 'sms_feedback_request',
        name: 'SMS Feedback Request',
        channel: 'sms',
        content:
          "Hi {{name}}! Congrats on your new home! 🏠 We'd love to hear about your experience with us. Could you share a quick review? It would mean the world to us! Reply with your thoughts or call {{phone}}. Thanks! - {{agentName}}",
        variables: ['name', 'phone', 'agentName'],
        feedbackType: 'initial',
        enabled: true,
      },
      {
        id: 'follow_up_email',
        name: 'Follow-up Feedback Request',
        channel: 'email',
        subject: 'Quick Follow-up: How Was Your Experience?',
        content: `Hi {{name}},

I hope you're enjoying your new {{propertyType}}! 

I wanted to follow up on my previous message about sharing your experience with our team. Your feedback is incredibly valuable to us and helps us serve future clients better.

If you have just a minute, I'd love to hear:
• How would you rate your overall experience? (1-10)
• What was the best part of working with us?
• Any suggestions for improvement?

You can reply directly to this email or give me a call at {{phone}}.

Also, if you were happy with our service, a quick Google review would be amazing and really helps other families find us.

Thank you so much!

Best,
{{agentName}}`,
        variables: ['name', 'propertyType', 'phone', 'agentName'],
        feedbackType: 'follow_up',
        enabled: true,
      },
      {
        id: 'review_request_email',
        name: 'Review Request for Satisfied Customers',
        channel: 'email',
        subject: 'Would You Mind Sharing Your Experience Online?',
        content: `Hi {{name}},

Thank you so much for the wonderful feedback about your experience with our team! It truly means the world to us to know that we exceeded your expectations.

Since you had such a positive experience, would you mind sharing a quick review online? It would help other families discover our services when they're looking for real estate help.

Here are a few places where your review would make a big impact:

🌟 Google Reviews: {{googleReviewLink}}
🏠 Zillow: {{zillowReviewLink}}
📍 Yelp: {{yelpReviewLink}}

It only takes 2-3 minutes, and your honest review helps us continue to grow and serve more families in our community.

Thank you again for choosing us and for considering sharing your experience!

Gratefully,
{{agentName}}
{{companyName}}`,
        variables: [
          'name',
          'googleReviewLink',
          'zillowReviewLink',
          'yelpReviewLink',
          'agentName',
          'companyName',
        ],
        feedbackType: 'review_request',
        enabled: true,
      },
    ];

    this.config.feedbackTemplates = defaultTemplates;
  }

  /**
   * Initialize default review platforms
   */
  private initializeDefaultPlatforms(): void {
    const defaultPlatforms: ReviewPlatform[] = [
      {
        id: 'google',
        name: 'Google Reviews',
        url: 'https://g.page/r/YOUR_BUSINESS_ID/review',
        instructions:
          'Click the link above and select the number of stars that represents your experience, then write a brief review about our service.',
        enabled: true,
      },
      {
        id: 'zillow',
        name: 'Zillow',
        url: 'https://www.zillow.com/profile/YOUR_AGENT_PROFILE',
        instructions:
          "Visit our Zillow profile and click 'Write a Review' to share your experience with future clients.",
        enabled: true,
      },
      {
        id: 'yelp',
        name: 'Yelp',
        url: 'https://www.yelp.com/biz/YOUR_BUSINESS_ID',
        instructions:
          "Find our business on Yelp and click 'Write a Review' to help other families find our services.",
        enabled: true,
      },
      {
        id: 'facebook',
        name: 'Facebook',
        url: 'https://www.facebook.com/YOUR_BUSINESS_PAGE/reviews',
        instructions:
          'Visit our Facebook page and leave a review to help us reach more families in our community.',
        enabled: true,
      },
    ];

    this.config.reviewPlatforms = defaultPlatforms;
  }

  /**
   * Detect completed projects and trigger feedback collection
   */
  async detectCompletedProjects(
    leads: Lead[],
    interactions: Map<string, Interaction[]>
  ): Promise<FeedbackSession[]> {
    const triggeredSessions: FeedbackSession[] = [];

    for (const lead of leads) {
      const leadInteractions = interactions.get(lead.id) || [];

      // Skip if already has an active feedback session
      if (this.hasActiveFeedbackSession(lead.id)) {
        continue;
      }

      // Check each trigger
      for (const trigger of this.config.triggers.filter((t) => t.enabled)) {
        if (trigger.condition(lead, leadInteractions)) {
          // Check if enough time has passed since completion
          if (await this.isWithinDelayPeriod(lead.id, trigger.delayHours)) {
            continue;
          }

          const session = await this.startFeedbackCollection(lead, trigger);
          triggeredSessions.push(session);
          break; // Only start one session per lead per detection cycle
        }
      }
    }

    return triggeredSessions;
  }

  /**
   * Start feedback collection for a completed project
   */
  async startFeedbackCollection(
    lead: Lead,
    trigger: ProjectCompletionTrigger
  ): Promise<FeedbackSession> {
    const session: FeedbackSession = {
      id: this.generateSessionId(),
      leadId: lead.id,
      triggerId: trigger.id,
      startedAt: new Date(),
      status: 'active',
      feedbackReceived: false,
      reviewRequested: false,
      escalationRequired: false,
    };

    this.activeSessions.set(session.id, session);

    // Send initial congratulatory message with feedback request
    await this.sendInitialFeedbackRequest(session.id);

    return session;
  }

  /**
   * Send initial feedback request message
   */
  async sendInitialFeedbackRequest(sessionId: string): Promise<boolean> {
    const session = this.activeSessions.get(sessionId);
    if (!session || session.status !== 'active') {
      return false;
    }

    // Get lead data for personalization
    const leadData = await this.getLeadData(session.leadId);

    // Choose appropriate template based on preferred channel
    const preferredChannel = leadData.contactInfo.preferredChannel;
    let template = this.config.feedbackTemplates.find(
      (t) =>
        t.channel === preferredChannel &&
        t.feedbackType === 'initial' &&
        t.enabled
    );

    // Fallback to email if preferred channel template not available
    if (!template) {
      template = this.config.feedbackTemplates.find(
        (t) =>
          t.channel === 'email' && t.feedbackType === 'initial' && t.enabled
      );
    }

    if (!template) {
      console.error('No initial feedback template available');
      return false;
    }

    // Personalize and send message
    const personalizedMessage = await this.personalizeMessage(
      template,
      leadData
    );
    const success = await this.sendMessage(
      template.channel,
      leadData.contactInfo,
      personalizedMessage
    );

    if (success) {
      // Create interaction record
      const interaction = InteractionModel.create({
        leadId: session.leadId,
        agentId: 'review-feedback-collector',
        type: template.channel,
        direction: 'outbound',
        content: personalizedMessage.content,
        outcome: {
          status: 'pending',
          appointmentBooked: false,
          qualificationUpdated: false,
          escalationRequired: false,
        },
      });

      console.log(`Initial feedback request sent: ${interaction.id}`);

      // Schedule follow-up if no response received
      setTimeout(
        () => this.checkForFollowUp(sessionId),
        this.config.followUpDelayHours * 60 * 60 * 1000
      );
    }

    return success;
  }

  /**
   * Handle customer feedback response
   */
  async handleFeedbackResponse(
    leadId: string,
    feedbackContent: string,
    channel: InteractionType
  ): Promise<FeedbackAnalysis> {
    // Find active session for this lead
    const session = Array.from(this.activeSessions.values()).find(
      (s) => s.leadId === leadId && s.status === 'active'
    );

    if (!session) {
      throw new Error('No active feedback session found for lead');
    }

    // Analyze the feedback
    const analysis = await this.analyzeFeedback(session.id, feedbackContent);

    // Update session with feedback
    session.feedbackReceived = true;
    session.feedbackContent = feedbackContent;
    session.sentimentScore = analysis.sentiment;
    this.activeSessions.set(session.id, session);

    // Create interaction record
    const interaction = InteractionModel.create({
      leadId,
      agentId: 'review-feedback-collector',
      type: channel,
      direction: 'inbound',
      content: feedbackContent,
      outcome: {
        status: 'successful',
        appointmentBooked: false,
        qualificationUpdated: false,
        escalationRequired: analysis.escalationRequired,
      },
      sentiment: analysis.sentiment,
    });

    console.log(`Feedback received and analyzed: ${interaction.id}`);

    // Handle based on analysis results
    if (analysis.escalationRequired) {
      await this.escalateNegativeFeedback(session, analysis);
    } else if (analysis.reviewWorthy) {
      await this.requestPublicReview(session, analysis);
    } else {
      // Neutral feedback - complete session
      session.status = 'completed';
      session.outcome = 'neutral';
      session.completedAt = new Date();
      this.activeSessions.set(session.id, session);
    }

    return analysis;
  }

  /**
   * Analyze feedback content and sentiment
   */
  async analyzeFeedback(
    sessionId: string,
    feedbackContent: string
  ): Promise<FeedbackAnalysis> {
    const sentiment = await this.analyzeSentiment(feedbackContent);
    const issues = this.extractIssues(feedbackContent);
    const positiveAspects = this.extractPositiveAspects(feedbackContent);

    const analysis: FeedbackAnalysis = {
      sessionId,
      sentiment,
      issues,
      positiveAspects,
      reviewWorthy:
        sentiment.score >= this.config.sentimentAnalysis.positiveThreshold,
      escalationRequired:
        sentiment.score <= this.config.sentimentAnalysis.negativeThreshold ||
        issues.length > 0,
      suggestedActions: [],
    };

    // Generate suggested actions based on analysis
    if (analysis.escalationRequired) {
      analysis.suggestedActions.push('Escalate to human management');
      analysis.suggestedActions.push(
        'Schedule follow-up call to address issues'
      );
    } else if (analysis.reviewWorthy) {
      analysis.suggestedActions.push('Request public review');
      analysis.suggestedActions.push('Thank customer for positive feedback');
    } else {
      analysis.suggestedActions.push('Send thank you message');
      analysis.suggestedActions.push('Complete feedback collection');
    }

    return analysis;
  }

  /**
   * Analyze sentiment of feedback content
   */
  private async analyzeSentiment(content: string): Promise<SentimentScore> {
    const lowerContent = content.toLowerCase();

    // Count positive and negative keywords
    const positiveMatches =
      this.config.sentimentAnalysis.positiveKeywords.filter((keyword) =>
        lowerContent.includes(keyword.toLowerCase())
      ).length;

    const negativeMatches = this.config.sentimentAnalysis.issueKeywords.filter(
      (keyword) => lowerContent.includes(keyword.toLowerCase())
    ).length;

    // Simple sentiment calculation
    const totalMatches = positiveMatches + negativeMatches;
    let score = 0;
    let confidence = 0.5;

    if (totalMatches > 0) {
      score = (positiveMatches - negativeMatches) / totalMatches;
      confidence = Math.min(0.9, 0.5 + totalMatches * 0.1);
    }

    // Adjust for content length and context
    if (content.length > 200) {
      confidence = Math.min(0.95, confidence + 0.1);
    }

    return {
      score: Math.max(-1, Math.min(1, score)),
      confidence: Math.max(0.1, Math.min(1, confidence)),
    };
  }

  /**
   * Extract issues from feedback content
   */
  private extractIssues(content: string): string[] {
    const lowerContent = content.toLowerCase();
    const issues: string[] = [];

    for (const keyword of this.config.sentimentAnalysis.issueKeywords) {
      if (lowerContent.includes(keyword.toLowerCase())) {
        // Extract sentence containing the issue
        const sentences = content.split(/[.!?]+/);
        const issueSentence = sentences.find((sentence) =>
          sentence.toLowerCase().includes(keyword.toLowerCase())
        );
        if (issueSentence && !issues.includes(issueSentence.trim())) {
          issues.push(issueSentence.trim());
        }
      }
    }

    return issues;
  }

  /**
   * Extract positive aspects from feedback content
   */
  private extractPositiveAspects(content: string): string[] {
    const lowerContent = content.toLowerCase();
    const positiveAspects: string[] = [];

    for (const keyword of this.config.sentimentAnalysis.positiveKeywords) {
      if (lowerContent.includes(keyword.toLowerCase())) {
        // Extract sentence containing the positive aspect
        const sentences = content.split(/[.!?]+/);
        const positiveSentence = sentences.find((sentence) =>
          sentence.toLowerCase().includes(keyword.toLowerCase())
        );
        if (
          positiveSentence &&
          !positiveAspects.includes(positiveSentence.trim())
        ) {
          positiveAspects.push(positiveSentence.trim());
        }
      }
    }

    return positiveAspects;
  }

  /**
   * Escalate negative feedback to human management
   */
  async escalateNegativeFeedback(
    session: FeedbackSession,
    analysis: FeedbackAnalysis
  ): Promise<void> {
    if (!this.config.escalation.enabled) {
      console.log('Escalation disabled, marking session as completed');
      session.status = 'completed';
      session.outcome = 'negative_escalated';
      session.completedAt = new Date();
      this.activeSessions.set(session.id, session);
      return;
    }

    // Determine severity based on sentiment score and issues
    let severity: IssueEscalation['severity'] = 'medium';
    if (analysis.sentiment.score <= -0.7 || analysis.issues.length >= 3) {
      severity = 'high';
    } else if (
      analysis.sentiment.score <= -0.9 ||
      analysis.issues.some(
        (issue) =>
          issue.toLowerCase().includes('legal') ||
          issue.toLowerCase().includes('lawsuit') ||
          issue.toLowerCase().includes('fraud')
      )
    ) {
      severity = 'critical';
    } else if (
      analysis.sentiment.score > -0.5 &&
      analysis.issues.length === 1
    ) {
      severity = 'low';
    }

    const escalation: IssueEscalation = {
      id: this.generateEscalationId(),
      sessionId: session.id,
      leadId: session.leadId,
      severity,
      issues: analysis.issues,
      feedbackContent: session.feedbackContent || '',
      escalatedAt: new Date(),
      status: 'open',
    };

    this.escalations.set(escalation.id, escalation);

    // Update session
    session.escalationRequired = true;
    session.status = 'escalated';
    this.activeSessions.set(session.id, session);

    // Send escalation notifications
    await this.sendEscalationNotifications(escalation);

    console.log(
      `Negative feedback escalated: ${escalation.id} (${severity} severity)`
    );
  }

  /**
   * Request public review for positive feedback
   */
  async requestPublicReview(
    session: FeedbackSession,
    analysis: FeedbackAnalysis
  ): Promise<void> {
    const leadData = await this.getLeadData(session.leadId);

    // Find review request template
    const template = this.config.feedbackTemplates.find(
      (t) => t.feedbackType === 'review_request' && t.enabled
    );

    if (!template) {
      console.error('No review request template available');
      return;
    }

    // Personalize message with review platform links
    const personalizedMessage = await this.personalizeReviewRequest(
      template,
      leadData
    );

    // Send review request
    const success = await this.sendMessage(
      template.channel,
      leadData.contactInfo,
      personalizedMessage
    );

    if (success) {
      session.reviewRequested = true;
      session.status = 'completed';
      session.outcome = 'positive_review';
      session.completedAt = new Date();
      this.activeSessions.set(session.id, session);

      // Create interaction record
      const interaction = InteractionModel.create({
        leadId: session.leadId,
        agentId: 'review-feedback-collector',
        type: template.channel,
        direction: 'outbound',
        content: personalizedMessage.content,
        outcome: {
          status: 'successful',
          appointmentBooked: false,
          qualificationUpdated: false,
          escalationRequired: false,
        },
      });

      console.log(`Review request sent: ${interaction.id}`);
    }
  }

  /**
   * Check if follow-up is needed and send if appropriate
   */
  async checkForFollowUp(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session || session.status !== 'active' || session.feedbackReceived) {
      return;
    }

    // Count previous follow-up attempts
    const followUpAttempts = await this.getFollowUpAttempts(session.leadId);
    if (followUpAttempts >= this.config.maxFollowUpAttempts) {
      // Max attempts reached, complete session
      session.status = 'completed';
      session.outcome = 'no_response';
      session.completedAt = new Date();
      this.activeSessions.set(session.id, session);
      return;
    }

    // Send follow-up message
    await this.sendFollowUpMessage(sessionId);
  }

  /**
   * Send follow-up feedback request
   */
  async sendFollowUpMessage(sessionId: string): Promise<boolean> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return false;

    const leadData = await this.getLeadData(session.leadId);

    // Find follow-up template
    const template = this.config.feedbackTemplates.find(
      (t) => t.feedbackType === 'follow_up' && t.enabled
    );

    if (!template) {
      console.error('No follow-up template available');
      return false;
    }

    const personalizedMessage = await this.personalizeMessage(
      template,
      leadData
    );
    const success = await this.sendMessage(
      template.channel,
      leadData.contactInfo,
      personalizedMessage
    );

    if (success) {
      // Create interaction record
      const interaction = InteractionModel.create({
        leadId: session.leadId,
        agentId: 'review-feedback-collector',
        type: template.channel,
        direction: 'outbound',
        content: personalizedMessage.content,
        outcome: {
          status: 'pending',
          appointmentBooked: false,
          qualificationUpdated: false,
          escalationRequired: false,
        },
      });

      console.log(`Follow-up feedback request sent: ${interaction.id}`);

      // Schedule next follow-up check
      setTimeout(
        () => this.checkForFollowUp(sessionId),
        this.config.followUpDelayHours * 60 * 60 * 1000
      );
    }

    return success;
  }

  /**
   * Personalize message template with lead data
   */
  private async personalizeMessage(
    template: FeedbackTemplate,
    leadData: any
  ): Promise<{ subject?: string; content: string }> {
    let content = template.content;
    let subject = template.subject;

    // Basic replacements
    const replacements: Record<string, string> = {
      name: leadData.contactInfo.name.split(' ')[0], // First name
      propertyType: leadData.qualificationData.propertyType || 'property',
      agentName: 'Sarah Johnson',
      companyName: 'Premier Real Estate',
      phone: '(555) 123-4567',
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
   * Personalize review request with platform links
   */
  private async personalizeReviewRequest(
    template: FeedbackTemplate,
    leadData: any
  ): Promise<{ subject?: string; content: string }> {
    const baseMessage = await this.personalizeMessage(template, leadData);

    // Add review platform links
    const platformLinks: Record<string, string> = {};
    for (const platform of this.config.reviewPlatforms.filter(
      (p) => p.enabled
    )) {
      platformLinks[`${platform.id}ReviewLink`] = platform.url;
    }

    let content = baseMessage.content;
    for (const [variable, value] of Object.entries(platformLinks)) {
      const regex = new RegExp(`{{${variable}}}`, 'g');
      content = content.replace(regex, value);
    }

    return { ...baseMessage, content };
  }

  /**
   * Send message via specified channel
   */
  private async sendMessage(
    channel: InteractionType,
    contactInfo: any,
    message: { subject?: string; content: string }
  ): Promise<boolean> {
    try {
      switch (channel) {
        case 'sms':
          if (!contactInfo.phone) return false;
          return await this.sendSMS(contactInfo.phone, message.content);

        case 'email':
          if (!contactInfo.email) return false;
          return await this.sendEmail(
            contactInfo.email,
            message.subject || 'Feedback Request',
            message.content
          );

        case 'whatsapp':
          if (!contactInfo.phone) return false;
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
    console.log(`Sending SMS to ${phoneNumber}: ${content}`);
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
    console.log(
      `Sending email to ${email} with subject "${subject}": ${content}`
    );
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
    console.log(`Sending WhatsApp to ${phoneNumber}: ${content}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
    return true;
  }

  /**
   * Send escalation notifications
   */
  private async sendEscalationNotifications(
    escalation: IssueEscalation
  ): Promise<void> {
    for (const channel of this.config.escalation.notificationChannels) {
      const message = `URGENT: Negative customer feedback requires attention
      
Lead ID: ${escalation.leadId}
Severity: ${escalation.severity.toUpperCase()}
Issues: ${escalation.issues.join(', ')}

Feedback: "${escalation.feedbackContent}"

Please review and respond promptly.`;

      switch (channel) {
        case 'email':
          await this.sendEmail(
            'management@company.com',
            `URGENT: Customer Issue Escalation - ${escalation.severity.toUpperCase()}`,
            message
          );
          break;
        case 'slack':
          console.log(`Slack notification: ${message}`);
          break;
      }
    }
  }

  // Helper methods
  private generateSessionId(): string {
    return `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateEscalationId(): string {
    return `escalation_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
  }

  private hasActiveFeedbackSession(leadId: string): boolean {
    return Array.from(this.activeSessions.values()).some(
      (session) => session.leadId === leadId && session.status === 'active'
    );
  }

  private async isWithinDelayPeriod(
    leadId: string,
    delayHours: number
  ): Promise<boolean> {
    // In a real implementation, this would check the database for the completion timestamp
    // For now, we'll assume the delay period has passed
    return false;
  }

  private async getLeadData(leadId: string): Promise<any> {
    // In a real implementation, this would fetch from database
    return {
      id: leadId,
      contactInfo: {
        name: 'John Smith',
        email: 'john.smith@example.com',
        phone: '+1234567890',
        preferredChannel: 'email',
      },
      qualificationData: {
        propertyType: 'home',
      },
    };
  }

  private async getFollowUpAttempts(leadId: string): Promise<number> {
    // In a real implementation, this would count follow-up interactions from database
    return 0;
  }

  /**
   * Get active feedback sessions
   */
  getActiveSessions(): FeedbackSession[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Get escalations
   */
  getEscalations(): IssueEscalation[] {
    return Array.from(this.escalations.values());
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): FeedbackSession | undefined {
    return this.activeSessions.get(sessionId);
  }

  /**
   * Get escalation by ID
   */
  getEscalation(escalationId: string): IssueEscalation | undefined {
    return this.escalations.get(escalationId);
  }

  /**
   * Update escalation status
   */
  updateEscalationStatus(
    escalationId: string,
    status: IssueEscalation['status'],
    resolution?: string
  ): boolean {
    const escalation = this.escalations.get(escalationId);
    if (!escalation) return false;

    escalation.status = status;
    if (resolution) {
      escalation.resolution = resolution;
    }

    this.escalations.set(escalationId, escalation);
    return true;
  }
}
