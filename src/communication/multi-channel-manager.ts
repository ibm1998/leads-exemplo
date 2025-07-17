import {
  CommunicationChannel,
  CommunicationPreference,
  CommunicationAttempt,
  ConversationContext,
  ChannelSelectionCriteria,
  CommunicationValidation,
} from "../types/communication";
import { Lead } from "../types/lead";
import { Interaction, InteractionType } from "../types/interaction";
import { generateUUID } from "../types/validation";

/**
 * Multi-channel communication manager
 * Handles channel selection, frequency capping, opt-out management, and conversation continuity
 */
export class MultiChannelCommunicationManager {
  private communicationPreferences: Map<string, CommunicationPreference> =
    new Map();
  private communicationAttempts: Map<string, CommunicationAttempt[]> =
    new Map();
  private conversationContexts: Map<string, ConversationContext[]> = new Map();

  /**
   * Set communication preferences for a lead
   */
  async setCommunicationPreferences(
    preferences: Partial<
      Omit<CommunicationPreference, "createdAt" | "updatedAt">
    > & {
      leadId: string;
      preferredChannels: CommunicationChannel[];
    }
  ): Promise<void> {
    const existingPrefs = this.communicationPreferences.get(preferences.leadId);

    // Apply defaults for missing fields
    const prefsWithDefaults = {
      leadId: preferences.leadId,
      preferredChannels:
        preferences.preferredChannels.length > 0
          ? preferences.preferredChannels
          : ["email" as CommunicationChannel], // Ensure at least one preferred channel
      optedOutChannels: preferences.optedOutChannels || [],
      bestTimeToContact: preferences.bestTimeToContact,
      frequencyLimits: preferences.frequencyLimits || {
        maxDailyContacts: 3,
        maxWeeklyContacts: 10,
        cooldownPeriodHours: 24,
      },
      createdAt: existingPrefs?.createdAt || new Date(),
      updatedAt: new Date(),
    };

    // Skip validation for internal data structures to avoid date serialization issues

    this.communicationPreferences.set(preferences.leadId, prefsWithDefaults);
  }

  /**
   * Get communication preferences for a lead
   */
  async getCommunicationPreferences(
    leadId: string
  ): Promise<CommunicationPreference | null> {
    return this.communicationPreferences.get(leadId) || null;
  }

  /**
   * Opt out a lead from a specific channel
   */
  async optOutFromChannel(
    leadId: string,
    channel: CommunicationChannel
  ): Promise<void> {
    const preferences = await this.getCommunicationPreferences(leadId);

    if (!preferences) {
      // Create default preferences with opt-out
      await this.setCommunicationPreferences({
        leadId,
        preferredChannels: ["email", "sms", "voice", "whatsapp"].filter(
          (c) => c !== channel
        ) as CommunicationChannel[],
        optedOutChannels: [channel],
      });
      return;
    }

    // Add to opted out channels if not already present
    if (!preferences.optedOutChannels.includes(channel)) {
      preferences.optedOutChannels.push(channel);
    }

    // Remove from preferred channels if present
    preferences.preferredChannels = preferences.preferredChannels.filter(
      (c) => c !== channel
    );

    // Ensure at least one preferred channel remains
    if (preferences.preferredChannels.length === 0) {
      preferences.preferredChannels = ["email"]; // Default fallback
    }

    await this.setCommunicationPreferences(preferences);
  }

  /**
   * Opt in a lead to a specific channel
   */
  async optInToChannel(
    leadId: string,
    channel: CommunicationChannel
  ): Promise<void> {
    const preferences = await this.getCommunicationPreferences(leadId);

    if (!preferences) {
      await this.setCommunicationPreferences({
        leadId,
        preferredChannels: [channel],
        optedOutChannels: [],
      });
      return;
    }

    // Remove from opted out channels
    preferences.optedOutChannels = preferences.optedOutChannels.filter(
      (c) => c !== channel
    );

    // Add to preferred channels if not already present
    if (!preferences.preferredChannels.includes(channel)) {
      preferences.preferredChannels.push(channel);
    }

    await this.setCommunicationPreferences(preferences);
  }

  /**
   * Select the best communication channel based on criteria
   */
  async selectOptimalChannel(
    leadId: string,
    criteria: ChannelSelectionCriteria
  ): Promise<CommunicationChannel | null> {
    const preferences = await this.getCommunicationPreferences(leadId);

    // Get available channels (not opted out)
    const availableChannels = preferences
      ? preferences.preferredChannels.filter(
          (channel) =>
            !CommunicationValidation.isChannelOptedOut(preferences, channel)
        )
      : (["email", "sms", "voice", "whatsapp"] as CommunicationChannel[]);

    if (availableChannels.length === 0) {
      return null;
    }

    // Remove channels that have failed recently
    const viableChannels = availableChannels.filter(
      (channel) =>
        !criteria.contextualFactors.previousFailures.includes(channel)
    );

    const channelsToConsider =
      viableChannels.length > 0 ? viableChannels : availableChannels;

    // Channel selection logic based on criteria
    const channelScores = new Map<CommunicationChannel, number>();

    for (const channel of channelsToConsider) {
      let score = 0;

      // Base preference score
      if (criteria.leadProfile.preferredChannel === channel) {
        score += 50;
      }

      // Response history bonus
      if (criteria.leadProfile.responseHistory.includes(channel)) {
        score += 30;
      }

      // Urgency-based scoring
      switch (criteria.urgency) {
        case "high":
          if (channel === "voice" || channel === "sms") score += 40;
          break;
        case "medium":
          if (channel === "sms" || channel === "whatsapp") score += 20;
          break;
        case "low":
          if (channel === "email") score += 10;
          break;
      }

      // Message type scoring
      switch (criteria.messageType) {
        case "urgent":
          if (channel === "voice") score += 30;
          if (channel === "sms") score += 20;
          break;
        case "promotional":
          if (channel === "email") score += 20;
          if (channel === "whatsapp") score += 15;
          break;
        case "follow_up":
          if (channel === "sms" || channel === "whatsapp") score += 15;
          break;
        case "informational":
          if (channel === "email") score += 10;
          break;
      }

      // Lead type scoring
      switch (criteria.leadProfile.leadType) {
        case "hot":
          if (channel === "voice") score += 25;
          break;
        case "warm":
          if (channel === "sms" || channel === "whatsapp") score += 15;
          break;
        case "cold":
          if (channel === "email") score += 10;
          break;
      }

      // Time-based scoring
      const currentHour = criteria.contextualFactors.timeOfDay;
      if (currentHour >= 9 && currentHour <= 17) {
        // Business hours - voice calls are more acceptable
        if (channel === "voice") score += 15;
      } else if (currentHour >= 18 && currentHour <= 21) {
        // Evening - text-based preferred
        if (channel === "sms" || channel === "whatsapp") score += 10;
      }

      channelScores.set(channel, score);
    }

    // Return channel with highest score
    let bestChannel: CommunicationChannel | null = null;
    let highestScore = -1;

    for (const [channel, score] of channelScores) {
      if (score > highestScore) {
        highestScore = score;
        bestChannel = channel;
      }
    }

    return bestChannel;
  }

  /**
   * Check if communication is allowed based on frequency limits
   */
  async canCommunicate(
    leadId: string,
    channel: CommunicationChannel
  ): Promise<{
    allowed: boolean;
    reason?: string;
    nextAllowedTime?: Date;
  }> {
    const preferences = await this.getCommunicationPreferences(leadId);

    // Check if channel is opted out
    if (
      preferences &&
      CommunicationValidation.isChannelOptedOut(preferences, channel)
    ) {
      return {
        allowed: false,
        reason: `Lead has opted out of ${channel} communications`,
      };
    }

    // Check time-based restrictions
    if (
      preferences &&
      !CommunicationValidation.isWithinContactTime(preferences, new Date())
    ) {
      const nextContactTime = this.calculateNextContactTime(preferences);
      return {
        allowed: false,
        reason: "Outside of preferred contact hours",
        nextAllowedTime: nextContactTime,
      };
    }

    const attempts = this.communicationAttempts.get(leadId) || [];
    const now = new Date();

    // Check daily limits
    const todayAttempts = attempts.filter((attempt) => {
      const attemptDate = new Date(attempt.attemptedAt);
      return attemptDate.toDateString() === now.toDateString();
    });

    const dailyLimit = preferences?.frequencyLimits.maxDailyContacts || 3;
    if (todayAttempts.length >= dailyLimit) {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0); // 9 AM next day

      return {
        allowed: false,
        reason: `Daily communication limit (${dailyLimit}) reached`,
        nextAllowedTime: tomorrow,
      };
    }

    // Check weekly limits
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const weeklyAttempts = attempts.filter(
      (attempt) => new Date(attempt.attemptedAt) >= weekStart
    );

    const weeklyLimit = preferences?.frequencyLimits.maxWeeklyContacts || 10;
    if (weeklyAttempts.length >= weeklyLimit) {
      const nextWeek = new Date(weekStart);
      nextWeek.setDate(nextWeek.getDate() + 7);

      return {
        allowed: false,
        reason: `Weekly communication limit (${weeklyLimit}) reached`,
        nextAllowedTime: nextWeek,
      };
    }

    // Check cooldown period
    const lastAttempt = attempts
      .filter((attempt) => attempt.channel === channel)
      .sort(
        (a, b) =>
          new Date(b.attemptedAt).getTime() - new Date(a.attemptedAt).getTime()
      )[0];

    if (lastAttempt) {
      const cooldownHours =
        preferences?.frequencyLimits.cooldownPeriodHours || 24;
      const cooldownEnd = new Date(lastAttempt.attemptedAt);
      cooldownEnd.setHours(cooldownEnd.getHours() + cooldownHours);

      if (now < cooldownEnd) {
        return {
          allowed: false,
          reason: `Cooldown period active for ${channel}`,
          nextAllowedTime: cooldownEnd,
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Record a communication attempt
   */
  async recordCommunicationAttempt(
    leadId: string,
    channel: CommunicationChannel,
    successful: boolean,
    failureReason?: string,
    interactionId?: string
  ): Promise<void> {
    const attempt: CommunicationAttempt = {
      id: generateUUID(),
      leadId,
      channel,
      attemptedAt: new Date(),
      successful,
      failureReason,
      interactionId,
    };

    // Skip validation for internal data structures to avoid date serialization issues

    const attempts = this.communicationAttempts.get(leadId) || [];
    attempts.push(attempt);
    this.communicationAttempts.set(leadId, attempts);

    // Keep only last 100 attempts per lead to prevent memory issues
    if (attempts.length > 100) {
      attempts.splice(0, attempts.length - 100);
    }
  }

  /**
   * Create or update conversation context for continuity across channels
   */
  async updateConversationContext(
    leadId: string,
    topic: string,
    channel: CommunicationChannel,
    context: Record<string, any>,
    interactionId: string
  ): Promise<void> {
    const contexts = this.conversationContexts.get(leadId) || [];

    // Find existing context for this topic
    let existingContext = contexts.find((ctx) => ctx.topic === topic);

    if (existingContext) {
      existingContext.lastChannel = channel;
      existingContext.context = { ...existingContext.context, ...context };
      existingContext.interactionIds.push(interactionId);
      existingContext.updatedAt = new Date();
    } else {
      const newContext: ConversationContext = {
        id: generateUUID(),
        leadId,
        topic,
        lastChannel: channel,
        context,
        interactionIds: [interactionId],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Skip validation for internal data structures to avoid date serialization issues

      contexts.push(newContext);
    }

    this.conversationContexts.set(leadId, contexts);
  }

  /**
   * Get conversation context for a lead and topic
   */
  async getConversationContext(
    leadId: string,
    topic: string
  ): Promise<ConversationContext | null> {
    const contexts = this.conversationContexts.get(leadId) || [];
    return contexts.find((ctx) => ctx.topic === topic) || null;
  }

  /**
   * Get all conversation contexts for a lead
   */
  async getAllConversationContexts(
    leadId: string
  ): Promise<ConversationContext[]> {
    return this.conversationContexts.get(leadId) || [];
  }

  /**
   * Get communication attempts for a lead
   */
  async getCommunicationAttempts(
    leadId: string
  ): Promise<CommunicationAttempt[]> {
    return this.communicationAttempts.get(leadId) || [];
  }

  /**
   * Get recent failed attempts for channel selection
   */
  async getRecentFailedChannels(
    leadId: string,
    hoursBack: number = 24
  ): Promise<CommunicationChannel[]> {
    const attempts = await this.getCommunicationAttempts(leadId);
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - hoursBack);

    return attempts
      .filter(
        (attempt) =>
          !attempt.successful && new Date(attempt.attemptedAt) >= cutoffTime
      )
      .map((attempt) => attempt.channel);
  }

  /**
   * Calculate next allowed contact time based on preferences
   */
  private calculateNextContactTime(preferences: CommunicationPreference): Date {
    if (!preferences.bestTimeToContact) {
      return new Date(); // No restrictions
    }

    const now = new Date();
    const { startHour, endHour } = preferences.bestTimeToContact;

    const nextContactTime = new Date(now);

    if (now.getHours() < startHour) {
      // Before contact window today
      nextContactTime.setHours(startHour, 0, 0, 0);
    } else if (now.getHours() > endHour) {
      // After contact window today, set to start time tomorrow
      nextContactTime.setDate(nextContactTime.getDate() + 1);
      nextContactTime.setHours(startHour, 0, 0, 0);
    } else {
      // Currently in window, return current time
      return now;
    }

    return nextContactTime;
  }

  /**
   * Clear old data to prevent memory leaks
   */
  async cleanup(daysToKeep: number = 30): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    // Clean up old communication attempts
    for (const [leadId, attempts] of this.communicationAttempts) {
      const filteredAttempts = attempts.filter(
        (attempt) => new Date(attempt.attemptedAt) >= cutoffDate
      );

      if (filteredAttempts.length === 0) {
        this.communicationAttempts.delete(leadId);
      } else {
        this.communicationAttempts.set(leadId, filteredAttempts);
      }
    }

    // Clean up old conversation contexts
    for (const [leadId, contexts] of this.conversationContexts) {
      const filteredContexts = contexts.filter(
        (context) => new Date(context.updatedAt) >= cutoffDate
      );

      if (filteredContexts.length === 0) {
        this.conversationContexts.delete(leadId);
      } else {
        this.conversationContexts.set(leadId, filteredContexts);
      }
    }
  }
}
