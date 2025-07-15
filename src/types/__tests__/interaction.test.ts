import { describe, it, expect, beforeEach } from "vitest";
import {
  Interaction,
  InteractionModel,
  InteractionValidation,
  CreateInteraction,
  UpdateInteraction,
  InteractionOutcome,
  SentimentScore,
  ScheduledAction,
  InteractionType,
  InteractionDirection,
} from "../interaction";
import { ValidationError } from "../validation";

describe("InteractionValidation", () => {
  const validOutcome: InteractionOutcome = {
    status: "successful",
    appointmentBooked: true,
    qualificationUpdated: false,
    escalationRequired: false,
  };

  const validSentiment: SentimentScore = {
    score: 0.8,
    confidence: 0.9,
  };

  const validScheduledAction: ScheduledAction = {
    action: "follow_up_call",
    scheduledAt: new Date(Date.now() + 86400000), // Tomorrow
    description: "Follow up on appointment booking",
  };

  const validInteraction: Interaction = {
    id: "123e4567-e89b-12d3-a456-426614174000",
    leadId: "456e7890-e89b-12d3-a456-426614174001",
    agentId: "agent-123",
    type: "call" as InteractionType,
    direction: "outbound" as InteractionDirection,
    content: "Called to discuss property requirements",
    outcome: validOutcome,
    duration: 300, // 5 minutes
    sentiment: validSentiment,
    nextAction: validScheduledAction,
    timestamp: new Date(),
  };

  describe("validateInteraction", () => {
    it("should validate correct interaction data", () => {
      const result =
        InteractionValidation.validateInteraction(validInteraction);
      expect(result.success).toBe(true);
    });

    it("should reject interaction with invalid ID", () => {
      const invalidInteraction = { ...validInteraction, id: "invalid-id" };
      const result =
        InteractionValidation.validateInteraction(invalidInteraction);
      expect(result.success).toBe(false);
    });

    it("should reject interaction with empty content", () => {
      const invalidInteraction = { ...validInteraction, content: "" };
      const result =
        InteractionValidation.validateInteraction(invalidInteraction);
      expect(result.success).toBe(false);
    });

    it("should reject interaction with excessive duration", () => {
      const invalidInteraction = { ...validInteraction, duration: 100000 };
      const result =
        InteractionValidation.validateInteraction(invalidInteraction);
      expect(result.success).toBe(false);
    });

    it("should reject interaction with negative duration", () => {
      const invalidInteraction = { ...validInteraction, duration: -10 };
      const result =
        InteractionValidation.validateInteraction(invalidInteraction);
      expect(result.success).toBe(false);
    });
  });

  describe("validateSentimentScore", () => {
    it("should validate correct sentiment score", () => {
      const result =
        InteractionValidation.validateSentimentScore(validSentiment);
      expect(result.success).toBe(true);
    });

    it("should reject sentiment score outside range", () => {
      const invalidSentiment = { score: 1.5, confidence: 0.9 };
      const result =
        InteractionValidation.validateSentimentScore(invalidSentiment);
      expect(result.success).toBe(false);
    });

    it("should reject confidence outside range", () => {
      const invalidSentiment = { score: 0.5, confidence: 1.5 };
      const result =
        InteractionValidation.validateSentimentScore(invalidSentiment);
      expect(result.success).toBe(false);
    });
  });

  describe("business logic validation", () => {
    it("should identify successful interactions", () => {
      expect(InteractionValidation.isSuccessful(validInteraction)).toBe(true);
    });

    it("should identify interactions requiring escalation", () => {
      const escalationInteraction = {
        ...validInteraction,
        outcome: { ...validOutcome, escalationRequired: true },
      };
      expect(
        InteractionValidation.requiresEscalation(escalationInteraction)
      ).toBe(true);
    });

    it("should identify appointment bookings", () => {
      expect(InteractionValidation.hasAppointmentBooked(validInteraction)).toBe(
        true
      );
    });

    it("should identify voice calls", () => {
      expect(InteractionValidation.isVoiceCall(validInteraction)).toBe(true);
    });

    it("should identify positive sentiment", () => {
      expect(InteractionValidation.hasPositiveSentiment(validInteraction)).toBe(
        true
      );
    });

    it("should validate reasonable duration for interaction type", () => {
      expect(
        InteractionValidation.hasReasonableDuration(validInteraction)
      ).toBe(true);

      // Test unreasonable duration for SMS
      const smsInteraction = {
        ...validInteraction,
        type: "sms" as InteractionType,
        duration: 300, // 5 minutes is too long for SMS
      };
      expect(InteractionValidation.hasReasonableDuration(smsInteraction)).toBe(
        false
      );
    });
  });
});

describe("InteractionModel", () => {
  let validCreateInteraction: CreateInteraction;

  beforeEach(() => {
    validCreateInteraction = {
      leadId: "456e7890-e89b-12d3-a456-426614174001",
      agentId: "agent-123",
      type: "call" as InteractionType,
      direction: "outbound" as InteractionDirection,
      content: "Called to discuss property requirements",
      outcome: {
        status: "successful",
        appointmentBooked: true,
        qualificationUpdated: false,
        escalationRequired: false,
      },
      duration: 300,
      sentiment: {
        score: 0.8,
        confidence: 0.9,
      },
      nextAction: {
        action: "follow_up_call",
        scheduledAt: new Date(Date.now() + 86400000),
        description: "Follow up on appointment booking",
      },
    };
  });

  describe("create", () => {
    it("should create a new interaction with generated ID and timestamp", () => {
      const interaction = InteractionModel.create(validCreateInteraction);

      expect(interaction.id).toBeDefined();
      expect(interaction.data.timestamp).toBeInstanceOf(Date);
      expect(interaction.data.content).toBe(
        "Called to discuss property requirements"
      );
    });

    it("should throw ValidationError for invalid data", () => {
      const invalidData = { ...validCreateInteraction, content: "" };
      expect(() => InteractionModel.create(invalidData)).toThrow(
        ValidationError
      );
    });
  });

  describe("fromData", () => {
    it("should create interaction from valid data", () => {
      const interactionData = {
        ...validCreateInteraction,
        id: "123e4567-e89b-12d3-a456-426614174000",
        timestamp: new Date(),
      };

      const interaction = InteractionModel.fromData(interactionData);
      expect(interaction.id).toBe(interactionData.id);
    });

    it("should throw ValidationError for invalid data", () => {
      const invalidData = { invalid: "data" };
      expect(() => InteractionModel.fromData(invalidData)).toThrow(
        ValidationError
      );
    });
  });

  describe("updateOutcome", () => {
    let interaction: InteractionModel;

    beforeEach(() => {
      interaction = InteractionModel.create(validCreateInteraction);
    });

    it("should update outcome with valid data", () => {
      interaction.updateOutcome({ status: "failed" });
      expect(interaction.data.outcome.status).toBe("failed");
    });

    it("should throw ValidationError for invalid outcome", () => {
      expect(() => {
        interaction.updateOutcome({ status: "invalid" as any });
      }).toThrow(ValidationError);
    });
  });

  describe("setSentiment", () => {
    let interaction: InteractionModel;

    beforeEach(() => {
      interaction = InteractionModel.create(validCreateInteraction);
    });

    it("should set sentiment with valid data", () => {
      const newSentiment = { score: -0.5, confidence: 0.8 };
      interaction.setSentiment(newSentiment);
      expect(interaction.data.sentiment).toEqual(newSentiment);
    });

    it("should throw ValidationError for invalid sentiment", () => {
      const invalidSentiment = { score: 2.0, confidence: 0.8 };
      expect(() => {
        interaction.setSentiment(invalidSentiment);
      }).toThrow(ValidationError);
    });
  });

  describe("scheduleNextAction", () => {
    let interaction: InteractionModel;

    beforeEach(() => {
      interaction = InteractionModel.create(validCreateInteraction);
    });

    it("should schedule next action with valid data", () => {
      const futureDate = new Date(Date.now() + 86400000);
      const action = {
        action: "send_email",
        scheduledAt: futureDate,
        description: "Send follow-up email",
      };

      interaction.scheduleNextAction(action);
      expect(interaction.data.nextAction).toEqual(action);
    });

    it("should throw error for past scheduled date", () => {
      const pastDate = new Date(Date.now() - 86400000);
      const action = {
        action: "send_email",
        scheduledAt: pastDate,
        description: "Send follow-up email",
      };

      expect(() => {
        interaction.scheduleNextAction(action);
      }).toThrow("Scheduled action must be in the future");
    });
  });

  describe("outcome management methods", () => {
    let interaction: InteractionModel;

    beforeEach(() => {
      interaction = InteractionModel.create({
        ...validCreateInteraction,
        outcome: {
          status: "pending",
          appointmentBooked: false,
          qualificationUpdated: false,
          escalationRequired: false,
        },
      });
    });

    it("should mark as successful", () => {
      interaction.markAsSuccessful();
      expect(interaction.data.outcome.status).toBe("successful");
    });

    it("should mark as failed", () => {
      interaction.markAsFailed();
      expect(interaction.data.outcome.status).toBe("failed");
    });

    it("should mark as transferred", () => {
      interaction.markAsTransferred();
      expect(interaction.data.outcome.status).toBe("transferred");
    });

    it("should mark appointment as booked", () => {
      interaction.markAppointmentBooked();
      expect(interaction.data.outcome.appointmentBooked).toBe(true);
    });

    it("should mark qualification as updated", () => {
      interaction.markQualificationUpdated();
      expect(interaction.data.outcome.qualificationUpdated).toBe(true);
    });

    it("should mark for escalation", () => {
      interaction.markForEscalation();
      expect(interaction.data.outcome.escalationRequired).toBe(true);
    });
  });

  describe("business logic methods", () => {
    let interaction: InteractionModel;

    beforeEach(() => {
      interaction = InteractionModel.create(validCreateInteraction);
    });

    it("should check if interaction is successful", () => {
      expect(interaction.isSuccessful()).toBe(true);
    });

    it("should check if interaction requires escalation", () => {
      expect(interaction.requiresEscalation()).toBe(false);
    });

    it("should check if appointment was booked", () => {
      expect(interaction.hasAppointmentBooked()).toBe(true);
    });

    it("should check if interaction is voice call", () => {
      expect(interaction.isVoiceCall()).toBe(true);
    });

    it("should check if interaction has positive sentiment", () => {
      expect(interaction.hasPositiveSentiment()).toBe(true);
    });

    it("should check if duration is reasonable", () => {
      expect(interaction.hasReasonableDuration()).toBe(true);
    });

    it("should calculate age in minutes", () => {
      const age = interaction.getAgeInMinutes();
      expect(age).toBeGreaterThanOrEqual(0);
    });

    it("should get duration in minutes", () => {
      const duration = interaction.getDurationInMinutes();
      expect(duration).toBe(5); // 300 seconds = 5 minutes
    });

    it("should check if next action is due", () => {
      // Should not be due since it's scheduled for tomorrow
      expect(interaction.isNextActionDue()).toBe(false);
    });

    it("should get interaction summary", () => {
      const summary = interaction.getSummary();
      expect(summary).toContain("CALL");
      expect(summary).toContain("outbound");
      expect(summary).toContain("successful");
      expect(summary).toContain("5min");
      expect(summary).toContain("+0.80");
    });
  });

  describe("toString and toJSON", () => {
    let interaction: InteractionModel;

    beforeEach(() => {
      interaction = InteractionModel.create(validCreateInteraction);
    });

    it("should convert to string", () => {
      const str = interaction.toString();
      expect(str).toContain("Interaction(");
      expect(str).toContain("call");
      expect(str).toContain("successful");
    });

    it("should convert to JSON", () => {
      const json = interaction.toJSON();
      expect(json).toEqual(interaction.data);
    });
  });
});
