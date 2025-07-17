import { z } from "zod";
import { ValidationResult, validateData } from "./validation";

// Communication channel enum
export const CommunicationChannelSchema = z.enum([
  "email",
  "sms",
  "voice",
  "whatsapp",
]);

export type CommunicationChannel = z.infer<typeof CommunicationChannelSchema>;

// Communication preference schema
export const CommunicationPreferenceSchema = z.object({
  leadId: z.string().uuid(),
  preferredChannels: z.array(CommunicationChannelSchema).min(1),
  optedOutChannels: z.array(CommunicationChannelSchema).default([]),
  bestTimeToContact: z
    .object({
      startHour: z.number().min(0).max(23),
      endHour: z.number().min(0).max(23),
      timezone: z.string(),
    })
    .optional(),
  frequencyLimits: z
    .object({
      maxDailyContacts: z.number().min(1).max(10).default(3),
      maxWeeklyContacts: z.number().min(1).max(20).default(10),
      cooldownPeriodHours: z.number().min(1).max(168).default(24), // 1 hour to 1 week
    })
    .default({
      maxDailyContacts: 3,
      maxWeeklyContacts: 10,
      cooldownPeriodHours: 24,
    }),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type CommunicationPreference = z.infer<
  typeof CommunicationPreferenceSchema
>;

// Communication attempt schema
export const CommunicationAttemptSchema = z.object({
  id: z.string().uuid(),
  leadId: z.string().uuid(),
  channel: CommunicationChannelSchema,
  attemptedAt: z.coerce.date(),
  successful: z.boolean(),
  failureReason: z.string().optional(),
  interactionId: z.string().uuid().optional(),
});

export type CommunicationAttempt = z.infer<typeof CommunicationAttemptSchema>;

// Conversation context schema for continuity across channels
export const ConversationContextSchema = z.object({
  id: z.string().uuid(),
  leadId: z.string().uuid(),
  topic: z.string(),
  lastChannel: CommunicationChannelSchema,
  context: z.record(z.any()), // Flexible context storage
  interactionIds: z.array(z.string().uuid()),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type ConversationContext = z.infer<typeof ConversationContextSchema>;

// Channel selection criteria schema
export const ChannelSelectionCriteriaSchema = z.object({
  urgency: z.enum(["low", "medium", "high"]),
  messageType: z.enum(["informational", "promotional", "urgent", "follow_up"]),
  leadProfile: z.object({
    leadType: z.enum(["hot", "warm", "cold"]),
    responseHistory: z.array(CommunicationChannelSchema),
    preferredChannel: CommunicationChannelSchema,
  }),
  contextualFactors: z.object({
    timeOfDay: z.number().min(0).max(23),
    dayOfWeek: z.number().min(0).max(6), // 0 = Sunday
    previousFailures: z.array(CommunicationChannelSchema),
  }),
});

export type ChannelSelectionCriteria = z.infer<
  typeof ChannelSelectionCriteriaSchema
>;

// Communication validation functions
export const CommunicationValidation = {
  validateCommunicationPreference(
    data: unknown
  ): ValidationResult<CommunicationPreference> {
    return validateData(
      CommunicationPreferenceSchema,
      data,
      "Communication preference validation"
    ) as ValidationResult<CommunicationPreference>;
  },

  validateCommunicationAttempt(
    data: unknown
  ): ValidationResult<CommunicationAttempt> {
    return validateData(
      CommunicationAttemptSchema,
      data,
      "Communication attempt validation"
    );
  },

  validateConversationContext(
    data: unknown
  ): ValidationResult<ConversationContext> {
    return validateData(
      ConversationContextSchema,
      data,
      "Conversation context validation"
    );
  },

  validateChannelSelectionCriteria(
    data: unknown
  ): ValidationResult<ChannelSelectionCriteria> {
    return validateData(
      ChannelSelectionCriteriaSchema,
      data,
      "Channel selection criteria validation"
    );
  },

  /**
   * Check if a channel is opted out
   */
  isChannelOptedOut(
    preferences: CommunicationPreference,
    channel: CommunicationChannel
  ): boolean {
    return preferences.optedOutChannels.includes(channel);
  },

  /**
   * Check if it's within the preferred contact time
   */
  isWithinContactTime(
    preferences: CommunicationPreference,
    currentTime: Date
  ): boolean {
    if (!preferences.bestTimeToContact) return true;

    const { startHour, endHour } = preferences.bestTimeToContact;
    const currentHour = currentTime.getHours();

    if (startHour <= endHour) {
      return currentHour >= startHour && currentHour <= endHour;
    } else {
      // Handle overnight time ranges (e.g., 22:00 to 06:00)
      return currentHour >= startHour || currentHour <= endHour;
    }
  },
};
