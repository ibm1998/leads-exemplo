import { z } from "zod";
import {
  ValidationResult,
  validateData,
  generateUUID,
  sanitizeString,
} from "./validation";

// Interaction type enum
export const InteractionTypeSchema = z.enum([
  "call",
  "sms",
  "email",
  "whatsapp",
]);

export type InteractionType = z.infer<typeof InteractionTypeSchema>;

// Interaction direction enum
export const InteractionDirectionSchema = z.enum(["inbound", "outbound"]);

export type InteractionDirection = z.infer<typeof InteractionDirectionSchema>;

// Interaction outcome schema
export const InteractionOutcomeSchema = z.object({
  status: z.enum(["successful", "failed", "transferred", "pending"]),
  appointmentBooked: z.boolean(),
  qualificationUpdated: z.boolean(),
  escalationRequired: z.boolean(),
});

export type InteractionOutcome = z.infer<typeof InteractionOutcomeSchema>;

// Sentiment score schema
export const SentimentScoreSchema = z.object({
  score: z.number().min(-1).max(1), // -1 (negative) to 1 (positive)
  confidence: z.number().min(0).max(1), // 0 to 1
});

export type SentimentScore = z.infer<typeof SentimentScoreSchema>;

// Scheduled action schema
export const ScheduledActionSchema = z.object({
  action: z.string(),
  scheduledAt: z.date(),
  description: z.string().optional(),
});

export type ScheduledAction = z.infer<typeof ScheduledActionSchema>;

// Main Interaction schema with enhanced validation
export const InteractionSchema = z.object({
  id: z.string().uuid(),
  leadId: z.string().uuid(),
  agentId: z.string().min(1, "Agent ID is required"),
  type: InteractionTypeSchema,
  direction: InteractionDirectionSchema,
  content: z
    .string()
    .min(1, "Content is required")
    .max(10000, "Content must be less than 10000 characters")
    .transform(sanitizeString),
  outcome: InteractionOutcomeSchema,
  duration: z.number().min(0).max(86400).optional(), // Duration in seconds, max 24 hours
  sentiment: SentimentScoreSchema.optional(),
  nextAction: ScheduledActionSchema.optional(),
  timestamp: z.date(),
});

export type Interaction = z.infer<typeof InteractionSchema>;

// Create Interaction input schema
export const CreateInteractionSchema = InteractionSchema.omit({
  id: true,
  timestamp: true,
});

export type CreateInteraction = z.infer<typeof CreateInteractionSchema>;

// Update Interaction input schema
export const UpdateInteractionSchema = CreateInteractionSchema.partial().extend(
  {
    id: z.string().uuid(),
  }
);

export type UpdateInteraction = z.infer<typeof UpdateInteractionSchema>;
/**
 * Interaction validation functions
 */
export const InteractionValidation = {
  /**
   * Validate a complete interaction object
   */
  validateInteraction(data: unknown): ValidationResult<Interaction> {
    return validateData(InteractionSchema, data, "Interaction validation");
  },

  /**
   * Validate interaction creation data
   */
  validateCreateInteraction(
    data: unknown
  ): ValidationResult<CreateInteraction> {
    return validateData(
      CreateInteractionSchema,
      data,
      "Create interaction validation"
    );
  },

  /**
   * Validate interaction update data
   */
  validateUpdateInteraction(
    data: unknown
  ): ValidationResult<UpdateInteraction> {
    return validateData(
      UpdateInteractionSchema,
      data,
      "Update interaction validation"
    );
  },

  /**
   * Validate sentiment score
   */
  validateSentimentScore(data: unknown): ValidationResult<SentimentScore> {
    return validateData(
      SentimentScoreSchema,
      data,
      "Sentiment score validation"
    );
  },

  /**
   * Validate scheduled action
   */
  validateScheduledAction(data: unknown): ValidationResult<ScheduledAction> {
    return validateData(
      ScheduledActionSchema,
      data,
      "Scheduled action validation"
    );
  },

  /**
   * Check if interaction is successful
   */
  isSuccessful(interaction: Interaction): boolean {
    return interaction.outcome.status === "successful";
  },

  /**
   * Check if interaction requires escalation
   */
  requiresEscalation(interaction: Interaction): boolean {
    return interaction.outcome.escalationRequired;
  },

  /**
   * Check if interaction resulted in appointment booking
   */
  hasAppointmentBooked(interaction: Interaction): boolean {
    return interaction.outcome.appointmentBooked;
  },

  /**
   * Check if interaction is a voice call
   */
  isVoiceCall(interaction: Interaction): boolean {
    return interaction.type === "call";
  },

  /**
   * Check if interaction has positive sentiment
   */
  hasPositiveSentiment(interaction: Interaction): boolean {
    return interaction.sentiment ? interaction.sentiment.score > 0 : false;
  },

  /**
   * Check if interaction duration is reasonable for type
   */
  hasReasonableDuration(interaction: Interaction): boolean {
    if (!interaction.duration) return true;

    const reasonableDurations: Record<
      InteractionType,
      { min: number; max: number }
    > = {
      call: { min: 30, max: 3600 }, // 30 seconds to 1 hour
      sms: { min: 0, max: 60 }, // SMS should be instant
      email: { min: 0, max: 300 }, // Up to 5 minutes for email processing
      whatsapp: { min: 0, max: 300 }, // Up to 5 minutes for WhatsApp
    };

    const limits = reasonableDurations[interaction.type];
    return (
      interaction.duration >= limits.min && interaction.duration <= limits.max
    );
  },
};

/**
 * Interaction class with business logic methods
 */
export class InteractionModel {
  private _data: Interaction;

  constructor(data: Interaction) {
    const validation = InteractionValidation.validateInteraction(data);
    if (!validation.success) {
      throw validation.error;
    }
    this._data = validation.data;
  }

  /**
   * Create a new interaction from input data
   */
  static create(input: CreateInteraction): InteractionModel {
    const interactionData: Interaction = {
      ...input,
      id: generateUUID(),
      timestamp: new Date(),
    };

    return new InteractionModel(interactionData);
  }

  /**
   * Create interaction from unknown data with validation
   */
  static fromData(data: unknown): InteractionModel {
    const validation = InteractionValidation.validateInteraction(data);
    if (!validation.success) {
      throw validation.error;
    }
    return new InteractionModel(validation.data);
  }

  /**
   * Get interaction data
   */
  get data(): Interaction {
    return { ...this._data };
  }

  /**
   * Get interaction ID
   */
  get id(): string {
    return this._data.id;
  }

  /**
   * Get lead ID
   */
  get leadId(): string {
    return this._data.leadId;
  }

  /**
   * Get agent ID
   */
  get agentId(): string {
    return this._data.agentId;
  }

  /**
   * Get interaction outcome
   */
  get outcome(): InteractionOutcome {
    return { ...this._data.outcome };
  }

  /**
   * Update interaction outcome
   */
  updateOutcome(outcome: Partial<InteractionOutcome>): void {
    const validation = InteractionValidation.validateInteraction({
      ...this._data,
      outcome: { ...this._data.outcome, ...outcome },
    });

    if (!validation.success) {
      throw validation.error;
    }

    this._data.outcome = { ...this._data.outcome, ...outcome };
  }

  /**
   * Set sentiment score
   */
  setSentiment(sentiment: SentimentScore): void {
    const validation = InteractionValidation.validateSentimentScore(sentiment);
    if (!validation.success) {
      throw validation.error;
    }

    this._data.sentiment = sentiment;
  }

  /**
   * Schedule next action
   */
  scheduleNextAction(action: ScheduledAction): void {
    const validation = InteractionValidation.validateScheduledAction(action);
    if (!validation.success) {
      throw validation.error;
    }

    if (action.scheduledAt <= new Date()) {
      throw new Error("Scheduled action must be in the future");
    }

    this._data.nextAction = action;
  }

  /**
   * Mark as successful
   */
  markAsSuccessful(): void {
    this.updateOutcome({ status: "successful" });
  }

  /**
   * Mark as failed
   */
  markAsFailed(): void {
    this.updateOutcome({ status: "failed" });
  }

  /**
   * Mark as transferred
   */
  markAsTransferred(): void {
    this.updateOutcome({ status: "transferred" });
  }

  /**
   * Mark appointment as booked
   */
  markAppointmentBooked(): void {
    this.updateOutcome({ appointmentBooked: true });
  }

  /**
   * Mark qualification as updated
   */
  markQualificationUpdated(): void {
    this.updateOutcome({ qualificationUpdated: true });
  }

  /**
   * Mark for escalation
   */
  markForEscalation(): void {
    this.updateOutcome({ escalationRequired: true });
  }

  /**
   * Check if interaction is successful
   */
  isSuccessful(): boolean {
    return InteractionValidation.isSuccessful(this._data);
  }

  /**
   * Check if interaction requires escalation
   */
  requiresEscalation(): boolean {
    return InteractionValidation.requiresEscalation(this._data);
  }

  /**
   * Check if appointment was booked
   */
  hasAppointmentBooked(): boolean {
    return InteractionValidation.hasAppointmentBooked(this._data);
  }

  /**
   * Check if interaction is a voice call
   */
  isVoiceCall(): boolean {
    return InteractionValidation.isVoiceCall(this._data);
  }

  /**
   * Check if interaction has positive sentiment
   */
  hasPositiveSentiment(): boolean {
    return InteractionValidation.hasPositiveSentiment(this._data);
  }

  /**
   * Check if duration is reasonable for interaction type
   */
  hasReasonableDuration(): boolean {
    return InteractionValidation.hasReasonableDuration(this._data);
  }

  /**
   * Get interaction age in minutes
   */
  getAgeInMinutes(): number {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - this._data.timestamp.getTime());
    return Math.ceil(diffTime / (1000 * 60));
  }

  /**
   * Get interaction duration in minutes (if available)
   */
  getDurationInMinutes(): number | null {
    return this._data.duration ? Math.ceil(this._data.duration / 60) : null;
  }

  /**
   * Check if next action is due
   */
  isNextActionDue(): boolean {
    if (!this._data.nextAction) return false;
    return this._data.nextAction.scheduledAt <= new Date();
  }

  /**
   * Get summary of interaction
   */
  getSummary(): string {
    const duration = this.getDurationInMinutes();
    const durationText = duration ? ` (${duration}min)` : "";
    const sentiment = this._data.sentiment
      ? ` [${
          this._data.sentiment.score > 0 ? "+" : ""
        }${this._data.sentiment.score.toFixed(2)}]`
      : "";

    return `${this._data.type.toUpperCase()} ${this._data.direction} - ${
      this._data.outcome.status
    }${durationText}${sentiment}`;
  }

  /**
   * Convert to JSON
   */
  toJSON(): Interaction {
    return this.data;
  }

  /**
   * Convert to string representation
   */
  toString(): string {
    return `Interaction(${this._data.id}, ${this._data.type}, ${this._data.outcome.status})`;
  }
}
