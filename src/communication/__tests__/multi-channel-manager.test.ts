import { describe, it, expect, beforeEach, vi } from "vitest";
import { MultiChannelCommunicationManager } from "../multi-channel-manager";
import {
  CommunicationChannel,
  CommunicationPreference,
  ChannelSelectionCriteria,
} from "../../types/communication";
import { generateUUID } from "../../types/validation";

describe("MultiChannelCommunicationManager", () => {
  let manager: MultiChannelCommunicationManager;
  const testLeadId = "550e8400-e29b-41d4-a716-446655440000";

  beforeEach(() => {
    manager = new MultiChannelCommunicationManager();
    vi.clearAllMocks();
  });

  describe("Communication Preferences", () => {
    it("should set and get communication preferences", async () => {
      const preferences = {
        leadId: testLeadId,
        preferredChannels: ["email", "sms"] as CommunicationChannel[],
        optedOutChannels: ["voice"] as CommunicationChannel[],
        bestTimeToContact: {
          startHour: 9,
          endHour: 17,
          timezone: "UTC",
        },
        frequencyLimits: {
          maxDailyContacts: 2,
          maxWeeklyContacts: 8,
          cooldownPeriodHours: 12,
        },
      };

      await manager.setCommunicationPreferences(preferences);
      const retrieved = await manager.getCommunicationPreferences(testLeadId);

      expect(retrieved).toBeTruthy();
      expect(retrieved!.leadId).toBe(testLeadId);
      expect(retrieved!.preferredChannels).toEqual(["email", "sms"]);
      expect(retrieved!.optedOutChannels).toEqual(["voice"]);
      expect(retrieved!.bestTimeToContact?.startHour).toBe(9);
      expect(retrieved!.frequencyLimits.maxDailyContacts).toBe(2);
    });

    it("should handle opt-out from channel", async () => {
      // Set initial preferences
      await manager.setCommunicationPreferences({
        leadId: testLeadId,
        preferredChannels: ["email", "sms", "whatsapp"],
        optedOutChannels: [],
      });

      // Opt out from SMS
      await manager.optOutFromChannel(testLeadId, "sms");

      const preferences = await manager.getCommunicationPreferences(testLeadId);
      expect(preferences!.optedOutChannels).toContain("sms");
      expect(preferences!.preferredChannels).not.toContain("sms");
    });

    it("should handle opt-in to channel", async () => {
      // Set initial preferences with SMS opted out
      await manager.setCommunicationPreferences({
        leadId: testLeadId,
        preferredChannels: ["email"],
        optedOutChannels: ["sms"],
      });

      // Opt in to SMS
      await manager.optInToChannel(testLeadId, "sms");

      const preferences = await manager.getCommunicationPreferences(testLeadId);
      expect(preferences!.optedOutChannels).not.toContain("sms");
      expect(preferences!.preferredChannels).toContain("sms");
    });

    it("should create default preferences when opting out without existing preferences", async () => {
      await manager.optOutFromChannel(testLeadId, "voice");

      const preferences = await manager.getCommunicationPreferences(testLeadId);
      expect(preferences!.optedOutChannels).toContain("voice");
      expect(preferences!.preferredChannels).not.toContain("voice");
    });
  });

  describe("Channel Selection", () => {
    beforeEach(async () => {
      await manager.setCommunicationPreferences({
        leadId: testLeadId,
        preferredChannels: ["email", "sms", "whatsapp"],
        optedOutChannels: ["voice"],
      });
    });

    it("should select voice for high urgency hot leads", async () => {
      const criteria: ChannelSelectionCriteria = {
        urgency: "high",
        messageType: "urgent",
        leadProfile: {
          leadType: "hot",
          responseHistory: ["voice"],
          preferredChannel: "voice",
        },
        contextualFactors: {
          timeOfDay: 14, // 2 PM
          dayOfWeek: 2, // Tuesday
          previousFailures: [],
        },
      };

      // First opt back in to voice for this test
      await manager.optInToChannel(testLeadId, "voice");

      const selectedChannel = await manager.selectOptimalChannel(
        testLeadId,
        criteria
      );
      expect(selectedChannel).toBe("voice");
    });

    it("should select email for low urgency informational messages", async () => {
      const criteria: ChannelSelectionCriteria = {
        urgency: "low",
        messageType: "informational",
        leadProfile: {
          leadType: "cold",
          responseHistory: ["email"],
          preferredChannel: "email",
        },
        contextualFactors: {
          timeOfDay: 10,
          dayOfWeek: 1,
          previousFailures: [],
        },
      };

      const selectedChannel = await manager.selectOptimalChannel(
        testLeadId,
        criteria
      );
      expect(selectedChannel).toBe("email");
    });

    it("should avoid channels with recent failures", async () => {
      const criteria: ChannelSelectionCriteria = {
        urgency: "medium",
        messageType: "follow_up",
        leadProfile: {
          leadType: "warm",
          responseHistory: ["sms", "email"],
          preferredChannel: "sms",
        },
        contextualFactors: {
          timeOfDay: 15,
          dayOfWeek: 3,
          previousFailures: ["sms"], // SMS failed recently
        },
      };

      const selectedChannel = await manager.selectOptimalChannel(
        testLeadId,
        criteria
      );
      expect(selectedChannel).not.toBe("sms");
      expect(["email", "whatsapp"]).toContain(selectedChannel);
    });

    it("should return null when no channels are available", async () => {
      // Opt out of all channels
      await manager.optOutFromChannel(testLeadId, "email");
      await manager.optOutFromChannel(testLeadId, "sms");
      await manager.optOutFromChannel(testLeadId, "whatsapp");

      const criteria: ChannelSelectionCriteria = {
        urgency: "medium",
        messageType: "follow_up",
        leadProfile: {
          leadType: "warm",
          responseHistory: [],
          preferredChannel: "email",
        },
        contextualFactors: {
          timeOfDay: 15,
          dayOfWeek: 3,
          previousFailures: [],
        },
      };

      const selectedChannel = await manager.selectOptimalChannel(
        testLeadId,
        criteria
      );
      expect(selectedChannel).toBeNull();
    });
  });

  describe("Frequency Capping", () => {
    beforeEach(async () => {
      await manager.setCommunicationPreferences({
        leadId: testLeadId,
        preferredChannels: ["email", "sms"],
        optedOutChannels: [],
        frequencyLimits: {
          maxDailyContacts: 2,
          maxWeeklyContacts: 5,
          cooldownPeriodHours: 4,
        },
      });
    });

    it("should allow communication when within limits", async () => {
      const result = await manager.canCommunicate(testLeadId, "email");
      expect(result.allowed).toBe(true);
    });

    it("should block communication when daily limit is reached", async () => {
      // Record 2 attempts today (reaching daily limit)
      await manager.recordCommunicationAttempt(testLeadId, "email", true);
      await manager.recordCommunicationAttempt(testLeadId, "sms", true);

      const result = await manager.canCommunicate(testLeadId, "email");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Daily communication limit");
      expect(result.nextAllowedTime).toBeTruthy();
    });

    it("should block communication during cooldown period", async () => {
      // Record a recent attempt on the same channel
      await manager.recordCommunicationAttempt(testLeadId, "email", true);

      const result = await manager.canCommunicate(testLeadId, "email");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Cooldown period active");
    });

    it("should block communication when channel is opted out", async () => {
      await manager.optOutFromChannel(testLeadId, "email");

      const result = await manager.canCommunicate(testLeadId, "email");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("opted out");
    });

    it("should respect time-based restrictions", async () => {
      // Set contact hours to 9-17
      await manager.setCommunicationPreferences({
        leadId: testLeadId,
        preferredChannels: ["email"],
        optedOutChannels: [],
        bestTimeToContact: {
          startHour: 9,
          endHour: 17,
          timezone: "UTC",
        },
      });

      // Mock current time to be outside contact hours (8 AM)
      const mockDate = new Date();
      mockDate.setHours(8, 0, 0, 0);
      vi.setSystemTime(mockDate);

      const result = await manager.canCommunicate(testLeadId, "email");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Outside of preferred contact hours");
    });
  });

  describe("Communication Attempts Tracking", () => {
    it("should record successful communication attempts", async () => {
      const interactionId = generateUUID();
      await manager.recordCommunicationAttempt(
        testLeadId,
        "email",
        true,
        undefined,
        interactionId
      );

      const attempts = await manager.getCommunicationAttempts(testLeadId);
      expect(attempts).toHaveLength(1);
      expect(attempts[0].successful).toBe(true);
      expect(attempts[0].channel).toBe("email");
      expect(attempts[0].interactionId).toBe(interactionId);
    });

    it("should record failed communication attempts with reason", async () => {
      await manager.recordCommunicationAttempt(
        testLeadId,
        "sms",
        false,
        "Invalid phone number"
      );

      const attempts = await manager.getCommunicationAttempts(testLeadId);
      expect(attempts).toHaveLength(1);
      expect(attempts[0].successful).toBe(false);
      expect(attempts[0].failureReason).toBe("Invalid phone number");
    });

    it("should get recent failed channels", async () => {
      // Record some failed attempts
      await manager.recordCommunicationAttempt(
        testLeadId,
        "sms",
        false,
        "Network error"
      );
      await manager.recordCommunicationAttempt(
        testLeadId,
        "voice",
        false,
        "No answer"
      );
      await manager.recordCommunicationAttempt(testLeadId, "email", true);

      const failedChannels = await manager.getRecentFailedChannels(
        testLeadId,
        24
      );
      expect(failedChannels).toContain("sms");
      expect(failedChannels).toContain("voice");
      expect(failedChannels).not.toContain("email");
    });
  });

  describe("Conversation Continuity", () => {
    it("should create and update conversation context", async () => {
      const interactionId = generateUUID();
      await manager.updateConversationContext(
        testLeadId,
        "property_inquiry",
        "email",
        { propertyType: "apartment", budget: "500k" },
        interactionId
      );

      const context = await manager.getConversationContext(
        testLeadId,
        "property_inquiry"
      );
      expect(context).toBeTruthy();
      expect(context!.topic).toBe("property_inquiry");
      expect(context!.lastChannel).toBe("email");
      expect(context!.context.propertyType).toBe("apartment");
      expect(context!.interactionIds).toContain(interactionId);
    });

    it("should update existing conversation context", async () => {
      const interactionId1 = generateUUID();
      const interactionId2 = generateUUID();

      // Create initial context
      await manager.updateConversationContext(
        testLeadId,
        "property_inquiry",
        "email",
        { propertyType: "apartment" },
        interactionId1
      );

      // Update with new information
      await manager.updateConversationContext(
        testLeadId,
        "property_inquiry",
        "sms",
        { budget: "600k", location: "downtown" },
        interactionId2
      );

      const context = await manager.getConversationContext(
        testLeadId,
        "property_inquiry"
      );
      expect(context!.lastChannel).toBe("sms");
      expect(context!.context.propertyType).toBe("apartment");
      expect(context!.context.budget).toBe("600k");
      expect(context!.context.location).toBe("downtown");
      expect(context!.interactionIds).toEqual([interactionId1, interactionId2]);
    });

    it("should get all conversation contexts for a lead", async () => {
      const interactionId1 = generateUUID();
      const interactionId2 = generateUUID();

      await manager.updateConversationContext(
        testLeadId,
        "property_inquiry",
        "email",
        { propertyType: "apartment" },
        interactionId1
      );

      await manager.updateConversationContext(
        testLeadId,
        "appointment_scheduling",
        "sms",
        { preferredTime: "morning" },
        interactionId2
      );

      const contexts = await manager.getAllConversationContexts(testLeadId);
      expect(contexts).toHaveLength(2);
      expect(contexts.map((c) => c.topic)).toContain("property_inquiry");
      expect(contexts.map((c) => c.topic)).toContain("appointment_scheduling");
    });
  });

  describe("Data Cleanup", () => {
    it("should clean up old communication attempts", async () => {
      // Record some attempts
      await manager.recordCommunicationAttempt(testLeadId, "email", true);
      await manager.recordCommunicationAttempt(testLeadId, "sms", false);

      // Mock old date for one attempt
      const attempts = await manager.getCommunicationAttempts(testLeadId);
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 35); // 35 days ago
      attempts[0].attemptedAt = oldDate;

      // Run cleanup (keep 30 days)
      await manager.cleanup(30);

      const remainingAttempts = await manager.getCommunicationAttempts(
        testLeadId
      );
      expect(remainingAttempts).toHaveLength(1);
      expect(remainingAttempts[0].channel).toBe("sms");
    });

    it("should clean up old conversation contexts", async () => {
      const interactionId = generateUUID();
      await manager.updateConversationContext(
        testLeadId,
        "old_topic",
        "email",
        { test: "data" },
        interactionId
      );

      // Mock old date
      const contexts = await manager.getAllConversationContexts(testLeadId);
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 35);
      contexts[0].updatedAt = oldDate;

      await manager.cleanup(30);

      const remainingContexts = await manager.getAllConversationContexts(
        testLeadId
      );
      expect(remainingContexts).toHaveLength(0);
    });
  });

  describe("Edge Cases", () => {
    it("should handle invalid communication preference data", async () => {
      const invalidPreferences = {
        leadId: "invalid-uuid",
        preferredChannels: [],
        optedOutChannels: [],
      };

      // Since we removed strict validation for internal data structures,
      // this should now succeed but with default fallbacks
      await expect(
        manager.setCommunicationPreferences(invalidPreferences)
      ).resolves.not.toThrow();

      const preferences = await manager.getCommunicationPreferences(
        "invalid-uuid"
      );
      expect(preferences).toBeTruthy();
      expect(preferences!.preferredChannels).toHaveLength(1); // Should have fallback
    });

    it("should handle missing preferences gracefully", async () => {
      const nonExistentLeadId = "550e8400-e29b-41d4-a716-446655440001";
      const preferences = await manager.getCommunicationPreferences(
        nonExistentLeadId
      );
      expect(preferences).toBeNull();
    });

    it("should maintain at least one preferred channel when opting out", async () => {
      await manager.setCommunicationPreferences({
        leadId: testLeadId,
        preferredChannels: ["email"],
        optedOutChannels: [],
      });

      await manager.optOutFromChannel(testLeadId, "email");

      const preferences = await manager.getCommunicationPreferences(testLeadId);
      expect(preferences!.preferredChannels).toHaveLength(1);
      expect(preferences!.preferredChannels[0]).toBe("email"); // Fallback
    });

    it("should handle overnight contact time ranges", async () => {
      await manager.setCommunicationPreferences({
        leadId: testLeadId,
        preferredChannels: ["email"],
        optedOutChannels: [],
        bestTimeToContact: {
          startHour: 22, // 10 PM
          endHour: 6, // 6 AM (next day)
          timezone: "UTC",
        },
      });

      // Test time within range (11 PM)
      const mockDate = new Date();
      mockDate.setHours(23, 0, 0, 0);
      vi.setSystemTime(mockDate);

      let result = await manager.canCommunicate(testLeadId, "email");
      expect(result.allowed).toBe(true);

      // Test time outside range (8 AM)
      mockDate.setHours(8, 0, 0, 0);
      vi.setSystemTime(mockDate);

      result = await manager.canCommunicate(testLeadId, "email");
      expect(result.allowed).toBe(false);
    });
  });
});
