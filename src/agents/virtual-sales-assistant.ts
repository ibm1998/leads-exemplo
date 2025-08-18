import { Lead, LeadModel, QualificationData } from '../types/lead';
import {
  Interaction,
  InteractionModel,
  CreateInteraction,
} from '../types/interaction';

/**
 * Voice AI configuration for speech processing
 */
export interface VoiceAIConfig {
  provider: 'elevenlabs' | 'azure' | 'google';
  apiKey: string;
  voiceId?: string;
  language: string;
  speechToTextModel?: string;
  textToSpeechModel?: string;
}

/**
 * Qualification script configuration
 */
export interface QualificationScript {
  id: string;
  name: string;
  questions: QualificationQuestion[];
  scoringRules: ScoringRule[];
  enabled: boolean;
}

/**
 * Individual qualification question
 */
export interface QualificationQuestion {
  id: string;
  type: 'budget' | 'location' | 'timeline' | 'property_type' | 'custom';
  question: string;
  followUpQuestions?: string[];
  expectedAnswerType: 'number' | 'text' | 'boolean' | 'choice';
  choices?: string[];
  required: boolean;
  weight: number; // For scoring
}

/**
 * Scoring rule for qualification
 */
export interface ScoringRule {
  questionId: string;
  condition: string; // e.g., "budget > 500000"
  score: number;
  description: string;
}

/**
 * Call session data
 */
export interface CallSession {
  id: string;
  leadId: string;
  startTime: Date;
  endTime?: Date;
  status: 'active' | 'completed' | 'transferred' | 'failed';
  transcript: CallTranscript[];
  qualificationData: Partial<QualificationData>;
  appointmentBooked: boolean;
  transferReason?: string;
  qualificationScore: number;
}

/**
 * Call transcript entry
 */
export interface CallTranscript {
  timestamp: Date;
  speaker: 'agent' | 'customer';
  text: string;
  confidence?: number;
  sentiment?: number;
}

/**
 * Appointment booking data
 */
export interface AppointmentBooking {
  id: string;
  leadId: string;
  type: 'consultation' | 'property_viewing' | 'follow_up';
  scheduledAt: Date;
  duration: number; // in minutes
  location?: string;
  notes?: string;
  confirmed: boolean;
  remindersSent: number;
}

/**
 * Human transfer request
 */
export interface HumanTransferRequest {
  id: string;
  leadId: string;
  sessionId: string;
  reason:
    | 'complex_query'
    | 'technical_issue'
    | 'customer_request'
    | 'escalation';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  context: string;
  transferredAt: Date;
  assignedAgent?: string;
  resolved: boolean;
}

/**
 * Virtual Sales Assistant configuration
 */
export interface VSAConfig {
  voiceAI: VoiceAIConfig;
  qualificationScripts: QualificationScript[];
  appointmentBooking: {
    calendarIntegration: 'google' | 'outlook' | 'calendly';
    defaultDuration: number;
    availableTimeSlots: string[];
    bufferTime: number; // minutes between appointments
  };
  humanTransfer: {
    enabled: boolean;
    transferThreshold: number; // complexity score threshold
    availableAgents: string[];
    maxWaitTime: number; // seconds
  };
  responseTimeSLA: number; // seconds
}

/**
 * Default configuration
 */
const DEFAULT_VSA_CONFIG: VSAConfig = {
  voiceAI: {
    provider: 'elevenlabs',
    apiKey: process.env.ELEVENLABS_API_KEY || '',
    language: 'en-US',
  },
  qualificationScripts: [],
  appointmentBooking: {
    calendarIntegration: 'google',
    defaultDuration: 30,
    availableTimeSlots: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'],
    bufferTime: 15,
  },
  humanTransfer: {
    enabled: true,
    transferThreshold: 0.7,
    availableAgents: [],
    maxWaitTime: 300,
  },
  responseTimeSLA: 60,
};

/**
 * Virtual Sales Assistant - Voice AI for hot lead processing
 *
 * Responsibilities:
 * - Immediate voice response to hot leads within 60 seconds
 * - Dynamic qualification using predefined scripts
 * - Appointment booking with calendar integration
 * - Seamless human transfer for complex conversations
 */
export class VirtualSalesAssistant {
  private config: VSAConfig;
  private activeSessions: Map<string, CallSession> = new Map();
  private appointments: Map<string, AppointmentBooking> = new Map();
  private transferRequests: Map<string, HumanTransferRequest> = new Map();

  constructor(config: Partial<VSAConfig> = {}) {
    this.config = { ...DEFAULT_VSA_CONFIG, ...config };
    this.initializeDefaultScripts();
  }

  /**
   * Initialize default qualification scripts
   */
  private initializeDefaultScripts(): void {
    if (this.config.qualificationScripts.length === 0) {
      const defaultScript: QualificationScript = {
        id: 'real-estate-basic',
        name: 'Basic Real Estate Qualification',
        questions: [
          {
            id: 'budget',
            type: 'budget',
            question: "What's your budget range for this property purchase?",
            followUpQuestions: [
              'Is this your maximum budget or are you flexible?',
              'Do you have pre-approval for financing?',
            ],
            expectedAnswerType: 'text',
            required: true,
            weight: 0.3,
          },
          {
            id: 'location',
            type: 'location',
            question:
              'Which areas or neighborhoods are you most interested in?',
            followUpQuestions: [
              'Are you open to nearby areas as well?',
              "What's most important about the location for you?",
            ],
            expectedAnswerType: 'text',
            required: true,
            weight: 0.2,
          },
          {
            id: 'timeline',
            type: 'timeline',
            question: 'When are you looking to make a purchase?',
            followUpQuestions: [
              'Is this timeline flexible?',
              'Do you need to sell your current home first?',
            ],
            expectedAnswerType: 'choice',
            choices: [
              'Within 30 days',
              '1-3 months',
              '3-6 months',
              '6+ months',
            ],
            required: true,
            weight: 0.25,
          },
          {
            id: 'property_type',
            type: 'property_type',
            question: 'What type of property are you looking for?',
            followUpQuestions: [
              'How many bedrooms and bathrooms do you need?',
              'Any specific features that are must-haves?',
            ],
            expectedAnswerType: 'choice',
            choices: [
              'Single Family Home',
              'Condo',
              'Townhouse',
              'Multi-family',
              'Other',
            ],
            required: false,
            weight: 0.15,
          },
        ],
        scoringRules: [
          {
            questionId: 'budget',
            condition: 'budget_mentioned',
            score: 0.3,
            description: 'Customer provided budget information',
          },
          {
            questionId: 'timeline',
            condition: 'timeline_within_3_months',
            score: 0.25,
            description: 'Customer has near-term timeline',
          },
          {
            questionId: 'location',
            condition: 'specific_location_mentioned',
            score: 0.2,
            description: 'Customer has specific location preferences',
          },
        ],
        enabled: true,
      };

      this.config.qualificationScripts = [defaultScript];
    }
  }

  /**
   * Initiate voice call to hot lead
   */
  async initiateCall(lead: Lead): Promise<CallSession> {
    // Validate lead has phone number
    if (!lead.contactInfo.phone) {
      throw new Error('Lead must have phone number for voice call');
    }

    // Create call session
    const session: CallSession = {
      id: this.generateSessionId(),
      leadId: lead.id,
      startTime: new Date(),
      status: 'active',
      transcript: [],
      qualificationData: {},
      appointmentBooked: false,
      qualificationScore: 0,
    };

    this.activeSessions.set(session.id, session);

    try {
      // Initiate voice call (simulated - would integrate with actual voice service)
      await this.startVoiceCall(lead.contactInfo.phone, session.id);

      // Add initial greeting to transcript
      await this.addToTranscript(
        session.id,
        'agent',
        this.generateGreeting(lead)
      );

      return session;
    } catch (error) {
      session.status = 'failed';
      this.activeSessions.set(session.id, session);
      throw new Error(
        `Failed to initiate call: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Start voice call (integration point for voice service)
   */
  private async startVoiceCall(
    phoneNumber: string,
    sessionId: string
  ): Promise<void> {
    // This would integrate with actual voice AI service like ElevenLabs
    // For now, we'll simulate the call initiation
    console.log(
      `Initiating voice call to ${phoneNumber} for session ${sessionId}`
    );

    // Simulate call connection delay
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  /**
   * Generate personalized greeting
   */
  private generateGreeting(lead: Lead): string {
    const timeOfDay = this.getTimeOfDay();
    const name = lead.contactInfo.name.split(' ')[0]; // Use first name

    return `Good ${timeOfDay}, ${name}! This is Sarah from Premier Real Estate. Thank you for your interest in our properties. I'm calling to help you find exactly what you're looking for. Do you have a few minutes to chat about your real estate needs?`;
  }

  /**
   * Get appropriate time of day greeting
   */
  private getTimeOfDay(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    return 'evening';
  }

  /**
   * Process customer response and continue qualification
   */
  async processCustomerResponse(
    sessionId: string,
    response: string
  ): Promise<string> {
    const session = this.activeSessions.get(sessionId);
    if (!session || session.status !== 'active') {
      throw new Error('Invalid or inactive session');
    }

    // Add customer response to transcript
    await this.addToTranscript(sessionId, 'customer', response);

    // Analyze response for intent and sentiment
    const analysis = await this.analyzeResponse(response);

    // Check if human transfer is needed
    if (this.shouldTransferToHuman(analysis, session)) {
      return await this.initiateHumanTransfer(sessionId, 'complex_query');
    }

    // Continue with qualification script
    const nextQuestion = await this.getNextQualificationQuestion(
      session,
      response
    );

    if (nextQuestion) {
      await this.addToTranscript(sessionId, 'agent', nextQuestion);
      return nextQuestion;
    }

    // Qualification complete - attempt appointment booking
    return await this.attemptAppointmentBooking(sessionId);
  }

  /**
   * Add entry to call transcript
   */
  private async addToTranscript(
    sessionId: string,
    speaker: 'agent' | 'customer',
    text: string
  ): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    const transcriptEntry: CallTranscript = {
      timestamp: new Date(),
      speaker,
      text,
      confidence: speaker === 'customer' ? 0.85 : 1.0, // Simulated confidence
    };

    session.transcript.push(transcriptEntry);
    this.activeSessions.set(sessionId, session);
  }

  /**
   * Analyze customer response for intent and complexity
   */
  private async analyzeResponse(response: string): Promise<{
    intent: string;
    sentiment: number;
    complexity: number;
    keywords: string[];
  }> {
    // Simplified analysis - in production would use NLP service
    const lowerResponse = response.toLowerCase();

    let sentiment = 0;
    let complexity = 0;
    const keywords: string[] = [];

    // Sentiment analysis (simplified)
    const positiveWords = [
      'yes',
      'interested',
      'great',
      'perfect',
      'love',
      'excited',
    ];
    const negativeWords = ['no', 'not', "don't", "can't", "won't", 'difficult'];

    positiveWords.forEach((word) => {
      if (lowerResponse.includes(word)) sentiment += 0.2;
    });

    negativeWords.forEach((word) => {
      if (lowerResponse.includes(word)) sentiment -= 0.2;
    });

    // Enhanced complexity analysis
    const complexPhrases = [
      'it depends',
      'complicated',
      'not sure',
      'maybe',
      'let me think',
      'coordinate with',
      'financial arrangements',
      'various factors',
      'need to discuss',
      'have to check',
      'depends on',
      "it's complex",
    ];

    complexPhrases.forEach((phrase) => {
      if (lowerResponse.includes(phrase)) complexity += 0.3;
    });

    // Additional complexity indicators
    const complexityIndicators = [
      'because',
      'however',
      'although',
      'but',
      'except',
      'unless',
      'spouse',
      'partner',
      'family',
      'lawyer',
      'accountant',
    ];

    complexityIndicators.forEach((indicator) => {
      if (lowerResponse.includes(indicator)) complexity += 0.2;
    });

    // Long responses are often more complex
    if (response.length > 100) complexity += 0.2;
    if (response.length > 200) complexity += 0.3;

    // Multiple sentences indicate complexity
    const sentenceCount = response
      .split(/[.!?]+/)
      .filter((s) => s.trim().length > 0).length;
    if (sentenceCount > 2) complexity += 0.2;

    // Keyword extraction (simplified)
    const realEstateKeywords = [
      'budget',
      'price',
      'location',
      'bedroom',
      'bathroom',
      'house',
      'condo',
    ];
    realEstateKeywords.forEach((keyword) => {
      if (lowerResponse.includes(keyword)) keywords.push(keyword);
    });

    return {
      intent: keywords.length > 0 ? 'property_inquiry' : 'general',
      sentiment: Math.max(-1, Math.min(1, sentiment)),
      complexity: Math.max(0, Math.min(1, complexity)),
      keywords,
    };
  }

  /**
   * Determine if conversation should be transferred to human
   */
  private shouldTransferToHuman(analysis: any, session: CallSession): boolean {
    // Transfer if complexity is too high
    if (analysis.complexity > this.config.humanTransfer.transferThreshold) {
      return true;
    }

    // Transfer if customer explicitly requests human agent
    if (
      analysis.keywords.includes('human') ||
      analysis.keywords.includes('agent')
    ) {
      return true;
    }

    // Transfer if sentiment is very negative
    if (analysis.sentiment < -0.5) {
      return true;
    }

    // Transfer if call duration is too long (over 10 minutes)
    const callDuration = Date.now() - session.startTime.getTime();
    if (callDuration > 600000) {
      // 10 minutes
      return true;
    }

    return false;
  }

  /**
   * Get next qualification question based on script and previous responses
   */
  private async getNextQualificationQuestion(
    session: CallSession,
    lastResponse: string
  ): Promise<string | null> {
    const script = this.config.qualificationScripts.find((s) => s.enabled);
    if (!script) return null;

    // First, update qualification data based on the last response
    this.updateQualificationDataFromResponse(session, lastResponse);

    // Find next unanswered required question
    for (const question of script.questions) {
      if (
        question.required &&
        !this.hasAnsweredQuestion(session, question.id)
      ) {
        return question.question;
      }
    }

    // All required questions answered, ask optional ones
    for (const question of script.questions) {
      if (
        !question.required &&
        !this.hasAnsweredQuestion(session, question.id)
      ) {
        return question.question;
      }
    }

    // All questions answered
    return null;
  }

  /**
   * Check if question has been answered in the session
   */
  private hasAnsweredQuestion(
    session: CallSession,
    questionId: string
  ): boolean {
    // Check if we have qualification data for this question type
    switch (questionId) {
      case 'budget':
        return !!session.qualificationData.budget;
      case 'location':
        return !!session.qualificationData.location;
      case 'timeline':
        return !!session.qualificationData.timeline;
      case 'property_type':
        return !!session.qualificationData.propertyType;
      default:
        // For custom questions, check if keywords were mentioned
        const questionTypes = {
          urgency: ['urgent', 'rush', 'soon', 'quickly'],
        };

        const question = this.config.qualificationScripts
          .find((s) => s.enabled)
          ?.questions.find((q) => q.id === questionId);

        if (!question) return false;

        const relevantWords =
          questionTypes[questionId as keyof typeof questionTypes] || [];

        return session.transcript.some(
          (entry) =>
            entry.speaker === 'customer' &&
            relevantWords.some((word) =>
              entry.text.toLowerCase().includes(word)
            )
        );
    }
  }

  /**
   * Update qualification data based on customer response (legacy method)
   */
  private updateQualificationData(
    session: CallSession,
    question: QualificationQuestion,
    response: string
  ): void {
    // This method is kept for compatibility but updateQualificationDataFromResponse is preferred
    this.updateQualificationDataFromResponse(session, response);
  }

  /**
   * Update qualification data from customer response
   */
  private updateQualificationDataFromResponse(
    session: CallSession,
    response: string
  ): void {
    const lowerResponse = response.toLowerCase();

    // Extract budget information
    const budgetMatch = response.match(/\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/);
    if (budgetMatch && !session.qualificationData.budget) {
      const amount = parseInt(budgetMatch[1].replace(/,/g, ''));
      session.qualificationData.budget = {
        min: amount * 0.8,
        max: amount * 1.2,
      };
    }

    // Extract location information
    const locationKeywords = [
      'downtown',
      'area',
      'neighborhood',
      'location',
      'district',
    ];
    if (
      locationKeywords.some((keyword) => lowerResponse.includes(keyword)) &&
      !session.qualificationData.location
    ) {
      session.qualificationData.location = response;
    }

    // Extract timeline information
    const timelineKeywords = ['month', 'week', 'day', 'soon', 'urgent', 'time'];
    if (
      timelineKeywords.some((keyword) => lowerResponse.includes(keyword)) &&
      !session.qualificationData.timeline
    ) {
      session.qualificationData.timeline = response;
    }

    // Extract property type information
    const propertyKeywords = [
      'house',
      'condo',
      'apartment',
      'townhouse',
      'home',
      'bedroom',
    ];
    if (
      propertyKeywords.some((keyword) => lowerResponse.includes(keyword)) &&
      !session.qualificationData.propertyType
    ) {
      session.qualificationData.propertyType = response;
    }

    // Update qualification score
    session.qualificationScore = this.calculateQualificationScore(session);
    this.activeSessions.set(session.id, session);
  }

  /**
   * Calculate qualification score based on collected data
   */
  private calculateQualificationScore(session: CallSession): number {
    const script = this.config.qualificationScripts.find((s) => s.enabled);
    if (!script) return 0;

    let score = 0;
    let maxScore = 0;

    for (const rule of script.scoringRules) {
      maxScore += rule.score;

      // Apply scoring rule (simplified logic)
      switch (rule.condition) {
        case 'budget_mentioned':
          if (session.qualificationData.budget) score += rule.score;
          break;
        case 'timeline_within_3_months':
          if (session.qualificationData.timeline?.includes('month'))
            score += rule.score;
          break;
        case 'specific_location_mentioned':
          if (session.qualificationData.location) score += rule.score;
          break;
      }
    }

    return maxScore > 0 ? score / maxScore : 0;
  }

  /**
   * Attempt to book appointment
   */
  private async attemptAppointmentBooking(sessionId: string): Promise<string> {
    const session = this.activeSessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    // Generate appointment booking message
    const bookingMessage = `Based on what you've told me, I'd love to schedule a consultation to show you some properties that match your criteria. I have availability ${this.getAvailableSlots()}. What works best for you?`;

    await this.addToTranscript(sessionId, 'agent', bookingMessage);
    return bookingMessage;
  }

  /**
   * Get available appointment slots
   */
  private getAvailableSlots(): string {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const slots = this.config.appointmentBooking.availableTimeSlots.slice(0, 3);
    return slots.map((slot) => `tomorrow at ${slot}`).join(', or ');
  }

  /**
   * Book appointment
   */
  async bookAppointment(
    sessionId: string,
    appointmentDetails: {
      type: AppointmentBooking['type'];
      scheduledAt: Date;
      location?: string;
      notes?: string;
    }
  ): Promise<AppointmentBooking> {
    const session = this.activeSessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    const appointment: AppointmentBooking = {
      id: this.generateAppointmentId(),
      leadId: session.leadId,
      type: appointmentDetails.type,
      scheduledAt: appointmentDetails.scheduledAt,
      duration: this.config.appointmentBooking.defaultDuration,
      location: appointmentDetails.location,
      notes: appointmentDetails.notes,
      confirmed: false,
      remindersSent: 0,
    };

    this.appointments.set(appointment.id, appointment);

    // Update session
    session.appointmentBooked = true;
    this.activeSessions.set(sessionId, session);

    // Send confirmation message
    const confirmationMessage = `Perfect! I've scheduled your ${
      appointment.type
    } for ${appointment.scheduledAt.toLocaleDateString()} at ${appointment.scheduledAt.toLocaleTimeString()}. You'll receive a confirmation email shortly with all the details.`;

    await this.addToTranscript(sessionId, 'agent', confirmationMessage);

    return appointment;
  }

  /**
   * Initiate human transfer
   */
  async initiateHumanTransfer(
    sessionId: string,
    reason: HumanTransferRequest['reason']
  ): Promise<string> {
    const session = this.activeSessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    const transferRequest: HumanTransferRequest = {
      id: this.generateTransferId(),
      leadId: session.leadId,
      sessionId,
      reason,
      priority: this.determinePriority(reason, session),
      context: this.generateTransferContext(session),
      transferredAt: new Date(),
      resolved: false,
    };

    this.transferRequests.set(transferRequest.id, transferRequest);

    // Update session status
    session.status = 'transferred';
    session.transferReason = reason;
    this.activeSessions.set(sessionId, session);

    const transferMessage =
      'I understand this requires more detailed discussion. Let me connect you with one of our senior agents who can better assist you. Please hold for just a moment.';

    await this.addToTranscript(sessionId, 'agent', transferMessage);

    // Attempt to find available human agent
    await this.findAvailableAgent(transferRequest.id);

    return transferMessage;
  }

  /**
   * Determine transfer priority
   */
  private determinePriority(
    reason: HumanTransferRequest['reason'],
    session: CallSession
  ): HumanTransferRequest['priority'] {
    if (reason === 'escalation') return 'urgent';
    if (session.qualificationScore > 0.8) return 'high';
    if (reason === 'complex_query') return 'medium';
    return 'low';
  }

  /**
   * Generate transfer context
   */
  private generateTransferContext(session: CallSession): string {
    const context = {
      qualificationData: session.qualificationData,
      qualificationScore: session.qualificationScore,
      callDuration: Date.now() - session.startTime.getTime(),
      keyPoints: this.extractKeyPoints(session.transcript),
    };

    return JSON.stringify(context, null, 2);
  }

  /**
   * Extract key points from transcript
   */
  private extractKeyPoints(transcript: CallTranscript[]): string[] {
    const keyPoints: string[] = [];

    transcript.forEach((entry) => {
      if (entry.speaker === 'customer') {
        const text = entry.text.toLowerCase();
        if (text.includes('budget') || text.includes('price')) {
          keyPoints.push('Discussed budget/pricing');
        }
        if (text.includes('location') || text.includes('area')) {
          keyPoints.push('Discussed location preferences');
        }
        if (text.includes('urgent') || text.includes('soon')) {
          keyPoints.push('Expressed urgency');
        }
      }
    });

    return keyPoints;
  }

  /**
   * Find available human agent for transfer
   */
  private async findAvailableAgent(transferRequestId: string): Promise<void> {
    const transferRequest = this.transferRequests.get(transferRequestId);
    if (!transferRequest) return;

    // Simulate finding available agent
    const availableAgents = this.config.humanTransfer.availableAgents;
    if (availableAgents.length > 0) {
      const assignedAgent = availableAgents[0]; // Simple assignment logic
      transferRequest.assignedAgent = assignedAgent;
      this.transferRequests.set(transferRequestId, transferRequest);
    }
  }

  /**
   * Complete call session
   */
  async completeCall(sessionId: string): Promise<Interaction> {
    const session = this.activeSessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    const wasTransferred = session.status === 'transferred';

    session.endTime = new Date();
    // Only set to completed if it wasn't transferred
    if (session.status !== 'transferred') {
      session.status = 'completed';
    }
    this.activeSessions.set(sessionId, session);

    // Create interaction record
    const interaction = InteractionModel.create({
      leadId: session.leadId,
      agentId: 'virtual-sales-assistant',
      type: 'call',
      direction: 'outbound',
      content: this.generateCallSummary(session),
      outcome: {
        status: wasTransferred ? 'transferred' : 'successful',
        appointmentBooked: session.appointmentBooked,
        qualificationUpdated: session.qualificationScore > 0,
        escalationRequired: wasTransferred,
      },
      duration: session.endTime
        ? Math.floor(
            (session.endTime.getTime() - session.startTime.getTime()) / 1000
          )
        : undefined,
    });

    return interaction.data;
  }

  /**
   * Generate call summary
   */
  private generateCallSummary(session: CallSession): string {
    const duration = session.endTime
      ? Math.floor(
          (session.endTime.getTime() - session.startTime.getTime()) / 1000 / 60
        )
      : 0;

    let summary = `Virtual Sales Assistant call completed. Duration: ${duration} minutes. `;
    summary += `Qualification score: ${Math.round(
      session.qualificationScore * 100
    )}%. `;

    if (session.appointmentBooked) {
      summary += 'Appointment successfully booked. ';
    }

    if (session.status === 'transferred') {
      summary += `Transferred to human agent due to: ${session.transferReason}. `;
    }

    if (Object.keys(session.qualificationData).length > 0) {
      summary += `Qualification data collected: ${JSON.stringify(
        session.qualificationData
      )}`;
    }

    return summary;
  }

  /**
   * Get active call sessions
   */
  getActiveSessions(): CallSession[] {
    return Array.from(this.activeSessions.values()).filter(
      (session) => session.status === 'active'
    );
  }

  /**
   * Get call session by ID
   */
  getSession(sessionId: string): CallSession | undefined {
    return this.activeSessions.get(sessionId);
  }

  /**
   * Get appointments
   */
  getAppointments(): AppointmentBooking[] {
    return Array.from(this.appointments.values());
  }

  /**
   * Get transfer requests
   */
  getTransferRequests(): HumanTransferRequest[] {
    return Array.from(this.transferRequests.values());
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<VSAConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `vsa-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique appointment ID
   */
  private generateAppointmentId(): string {
    return `apt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique transfer ID
   */
  private generateTransferId(): string {
    return `xfr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
