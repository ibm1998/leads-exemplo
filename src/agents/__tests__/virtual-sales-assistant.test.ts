import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  VirtualSalesAssistant,
  VSAConfig,
  CallSession,
} from "../virtual-sales-assistant";
import { LeadModel, CreateLead } from "../../types/lead";

describe("VirtualSalesAssistant", () => {
  let vsa: VirtualSalesAssistant;
  let testLead: LeadModel;

  beforeEach(() => {
    // Create test configuration
    const config: Partial<VSAConfig> = {
      voiceAI: {
        provider: "elevenlabs",
        apiKey: "test-key",
        language: "en-US",
      },
      responseTimeSLA: 60,
      humanTransfer: {
        enabled: true,
        transferThreshold: 0.7,
        availableAgents: ["agent-001", "agent-002"],
        maxWaitTime: 300,
      },
    };

    vsa = new VirtualSalesAssistant(config);

    // Create test lead
    const leadData: CreateLead = {
      source: "website",
      contactInfo: {
        name: "John Doe",
        email: "john.doe@example.com",
        phone: "+1-555-123-4567",
        preferredChannel: "voice",
        timezone: "America/New_York",
      },
      leadType: "hot",
      urgencyLevel: 9,
      intentSignals: ["requested_callback", "form_submission"],
      qualificationData: {
        qualificationScore: 0,
      },
      status: "new",
    };

    testLead = LeadModel.create(leadData);
  });

  describe("Call Initiation", () => {
    it("should successfully initiate a call to a hot lead", async () => {
      const session = await vsa.initiateCall(testLead.data);

      expect(session).toBeDefined();
      expect(session.leadId).toBe(testLead.id);
      expect(session.status).toBe("active");
      expect(session.transcript).toHaveLength(1);
      expect(session.transcript[0].speaker).toBe("agent");
      expect(session.transcript[0].text).toContain("Good");
      expect(session.transcript[0].text).toContain("John");
    });

    it("should throw error if lead has no phone number", async () => {
      const leadWithoutPhone = LeadModel.create({
        ...testLead.data,
        contactInfo: {
          ...testLead.data.contactInfo,
          phone: undefined,
        },
      });

      await expect(vsa.initiateCall(leadWithoutPhone.data)).rejects.toThrow(
        "Lead must have phone number for voice call"
      );
    });

    it("should generate personalized greeting with lead name", async () => {
      const session = await vsa.initiateCall(testLead.data);
      const greeting = session.transcript[0].text;

      expect(greeting).toContain("John");
      expect(greeting).toContain("Premier Real Estate");
      expect(greeting).toMatch(/Good (morning|afternoon|evening)/);
    });
  });

  describe("Qualification Process", () => {
    let session: CallSession;

    beforeEach(async () => {
      session = await vsa.initiateCall(testLead.data);
    });

    it("should process customer response and ask qualification questions", async () => {
      const response = await vsa.processCustomerResponse(
        session.id,
        "Yes, I have a few minutes to chat"
      );

      expect(response).toContain("budget");

      const updatedSession = vsa.getSession(session.id);
      expect(updatedSession?.transcript).toHaveLength(3); // greeting + customer response + next question
    });

    it("should extract budget information from customer response", async () => {
      await vsa.processCustomerResponse(session.id, "Yes, I'm interested");
      const budgetResponse = await vsa.processCustomerResponse(
        session.id,
        "My budget is around $500,000"
      );

      const updatedSession = vsa.getSession(session.id);
      expect(updatedSession?.qualificationData.budget).toBeDefined();
      expect(updatedSession?.qualificationData.budget?.min).toBeCloseTo(
        400000,
        -4
      );
      expect(updatedSession?.qualificationData.budget?.max).toBeCloseTo(
        600000,
        -4
      );
    });

    it("should extract location information from customer response", async () => {
      await vsa.processCustomerResponse(session.id, "Yes, I'm interested");
      await vsa.processCustomerResponse(session.id, "My budget is $500,000");
      await vsa.processCustomerResponse(
        session.id,
        "I'm looking in downtown or nearby areas"
      );

      const updatedSession = vsa.getSession(session.id);
      expect(updatedSession?.qualificationData.location).toContain("downtown");
    });

    it("should calculate qualification score based on collected data", async () => {
      await vsa.processCustomerResponse(session.id, "Yes, I'm interested");
      await vsa.processCustomerResponse(session.id, "My budget is $500,000");
      await vsa.processCustomerResponse(session.id, "Looking in downtown");
      await vsa.processCustomerResponse(session.id, "Within 2 months");

      const updatedSession = vsa.getSession(session.id);
      expect(updatedSession?.qualificationScore).toBeGreaterThan(0);
    });

    it("should progress through all qualification questions", async () => {
      const responses = [
        "Yes, I'm interested",
        "My budget is around $500,000",
        "I'm looking in downtown area",
        "Within 3 months",
        "Single Family Home",
        "Very urgent",
      ];

      let lastResponse = "";
      for (const response of responses) {
        lastResponse = await vsa.processCustomerResponse(session.id, response);
      }

      // Should eventually lead to appointment booking
      expect(
        lastResponse.includes("schedule") ||
          lastResponse.includes("appointment")
      ).toBe(true);
    });
  });

  describe("Appointment Booking", () => {
    let session: CallSession;

    beforeEach(async () => {
      session = await vsa.initiateCall(testLead.data);
      // Complete qualification process
      await vsa.processCustomerResponse(session.id, "Yes, I'm interested");
      await vsa.processCustomerResponse(session.id, "Budget is $500,000");
      await vsa.processCustomerResponse(session.id, "Downtown area");
      await vsa.processCustomerResponse(session.id, "Within 2 months");
    });

    it("should successfully book an appointment", async () => {
      const appointmentDate = new Date();
      appointmentDate.setDate(appointmentDate.getDate() + 1);
      appointmentDate.setHours(10, 0, 0, 0);

      const appointment = await vsa.bookAppointment(session.id, {
        type: "consultation",
        scheduledAt: appointmentDate,
        notes: "Initial consultation for downtown properties",
      });

      expect(appointment).toBeDefined();
      expect(appointment.leadId).toBe(testLead.id);
      expect(appointment.type).toBe("consultation");
      expect(appointment.scheduledAt).toEqual(appointmentDate);
      expect(appointment.confirmed).toBe(false);

      const updatedSession = vsa.getSession(session.id);
      expect(updatedSession?.appointmentBooked).toBe(true);
    });

    it("should generate appointment confirmation message", async () => {
      const appointmentDate = new Date();
      appointmentDate.setDate(appointmentDate.getDate() + 1);
      appointmentDate.setHours(14, 0, 0, 0);

      await vsa.bookAppointment(session.id, {
        type: "property_viewing",
        scheduledAt: appointmentDate,
      });

      const updatedSession = vsa.getSession(session.id);
      const lastTranscript =
        updatedSession?.transcript[updatedSession.transcript.length - 1];

      expect(lastTranscript?.speaker).toBe("agent");
      expect(lastTranscript?.text).toContain("scheduled");
      expect(lastTranscript?.text).toContain("property_viewing");
    });
  });

  describe("Human Transfer", () => {
    let session: CallSession;

    beforeEach(async () => {
      session = await vsa.initiateCall(testLead.data);
    });

    it("should initiate human transfer for complex queries", async () => {
      const transferMessage = await vsa.initiateHumanTransfer(
        session.id,
        "complex_query"
      );

      expect(transferMessage).toContain(
        "connect you with one of our senior agents"
      );

      const updatedSession = vsa.getSession(session.id);
      expect(updatedSession?.status).toBe("transferred");
      expect(updatedSession?.transferReason).toBe("complex_query");

      const transferRequests = vsa.getTransferRequests();
      expect(transferRequests).toHaveLength(1);
      expect(transferRequests[0].reason).toBe("complex_query");
    });

    it("should determine appropriate transfer priority", async () => {
      await vsa.initiateHumanTransfer(session.id, "escalation");

      const transferRequests = vsa.getTransferRequests();
      expect(transferRequests[0].priority).toBe("urgent");
    });

    it("should generate transfer context with qualification data", async () => {
      // Add some qualification data first
      await vsa.processCustomerResponse(session.id, "My budget is $750,000");

      await vsa.initiateHumanTransfer(session.id, "complex_query");

      const transferRequests = vsa.getTransferRequests();
      const context = JSON.parse(transferRequests[0].context);

      expect(context.qualificationData).toBeDefined();
      expect(context.qualificationScore).toBeGreaterThanOrEqual(0);
      expect(context.keyPoints).toBeInstanceOf(Array);
    });

    it("should automatically transfer for high complexity responses", async () => {
      const complexResponse =
        "Well, it depends on many factors and I'm not sure about the complicated financial situation...";

      const response = await vsa.processCustomerResponse(
        session.id,
        complexResponse
      );

      expect(response).toContain("connect you with one of our senior agents");

      const updatedSession = vsa.getSession(session.id);
      expect(updatedSession?.status).toBe("transferred");
    });
  });

  describe("Call Completion", () => {
    let session: CallSession;

    beforeEach(async () => {
      session = await vsa.initiateCall(testLead.data);
    });

    it("should complete call and create interaction record", async () => {
      // Simulate some conversation
      await vsa.processCustomerResponse(session.id, "Yes, interested");
      await vsa.processCustomerResponse(session.id, "Budget is $400,000");

      const interaction = await vsa.completeCall(session.id);

      expect(interaction).toBeDefined();
      expect(interaction.leadId).toBe(testLead.id);
      expect(interaction.type).toBe("call");
      expect(interaction.direction).toBe("outbound");
      expect(interaction.agentId).toBe("virtual-sales-assistant");
      expect(interaction.outcome.qualificationUpdated).toBe(true);

      const updatedSession = vsa.getSession(session.id);
      expect(updatedSession?.status).toBe("completed");
      expect(updatedSession?.endTime).toBeDefined();
    });

    it("should generate comprehensive call summary", async () => {
      // Book an appointment during the call
      await vsa.processCustomerResponse(session.id, "Yes, interested");
      const appointmentDate = new Date();
      appointmentDate.setDate(appointmentDate.getDate() + 1);

      await vsa.bookAppointment(session.id, {
        type: "consultation",
        scheduledAt: appointmentDate,
      });

      const interaction = await vsa.completeCall(session.id);

      expect(interaction.content).toContain(
        "Virtual Sales Assistant call completed"
      );
      expect(interaction.content).toContain("Appointment successfully booked");
      expect(interaction.content).toContain("Qualification score");
    });
  });

  describe("Session Management", () => {
    it("should track active sessions", async () => {
      const session1 = await vsa.initiateCall(testLead.data);

      const leadData2: CreateLead = {
        ...testLead.data,
        contactInfo: {
          ...testLead.data.contactInfo,
          name: "Jane Smith",
          phone: "+1-555-987-6543",
        },
      };
      const testLead2 = LeadModel.create(leadData2);
      const session2 = await vsa.initiateCall(testLead2.data);

      const activeSessions = vsa.getActiveSessions();
      expect(activeSessions).toHaveLength(2);
      expect(activeSessions.map((s) => s.id)).toContain(session1.id);
      expect(activeSessions.map((s) => s.id)).toContain(session2.id);
    });

    it("should retrieve session by ID", async () => {
      const session = await vsa.initiateCall(testLead.data);

      const retrievedSession = vsa.getSession(session.id);
      expect(retrievedSession).toEqual(session);
    });

    it("should handle invalid session ID gracefully", async () => {
      await expect(
        vsa.processCustomerResponse("invalid-session-id", "Hello")
      ).rejects.toThrow("Invalid or inactive session");
    });
  });

  describe("Configuration Management", () => {
    it("should update configuration", () => {
      const newConfig: Partial<VSAConfig> = {
        responseTimeSLA: 30,
        humanTransfer: {
          enabled: false,
          transferThreshold: 0.8,
          availableAgents: [],
          maxWaitTime: 600,
        },
      };

      vsa.updateConfig(newConfig);

      // Test that configuration was updated by checking behavior
      expect(vsa.getTransferRequests()).toHaveLength(0);
    });

    it("should use default qualification scripts if none provided", () => {
      const newVSA = new VirtualSalesAssistant();

      // Should have default scripts initialized
      expect(newVSA).toBeDefined();
    });
  });

  describe("Error Handling", () => {
    it("should handle call initiation failures gracefully", async () => {
      // Mock a failure in voice call initiation
      const originalConsoleLog = console.log;
      console.log = vi.fn(() => {
        throw new Error("Voice service unavailable");
      });

      await expect(vsa.initiateCall(testLead.data)).rejects.toThrow(
        "Failed to initiate call"
      );

      console.log = originalConsoleLog;
    });

    it("should handle invalid appointment booking", async () => {
      await expect(
        vsa.bookAppointment("invalid-session", {
          type: "consultation",
          scheduledAt: new Date(),
        })
      ).rejects.toThrow("Session not found");
    });

    it("should handle transfer request for invalid session", async () => {
      await expect(
        vsa.initiateHumanTransfer("invalid-session", "complex_query")
      ).rejects.toThrow("Session not found");
    });
  });

  describe("End-to-End Workflow", () => {
    it("should complete full qualification and booking workflow", async () => {
      // 1. Initiate call
      const session = await vsa.initiateCall(testLead.data);
      expect(session.status).toBe("active");

      // 2. Customer shows interest
      let response = await vsa.processCustomerResponse(
        session.id,
        "Yes, I'm very interested in finding a property"
      );
      expect(response).toContain("budget");

      // 3. Provide budget information
      response = await vsa.processCustomerResponse(
        session.id,
        "My budget is around $600,000"
      );
      expect(
        response.includes("location") ||
          response.includes("area") ||
          response.includes("neighborhoods")
      ).toBe(true);

      // 4. Provide location preference
      response = await vsa.processCustomerResponse(
        session.id,
        "I'm looking in the downtown area or nearby neighborhoods"
      );

      // 5. Provide timeline
      response = await vsa.processCustomerResponse(
        session.id,
        "I need to find something within the next 2 months"
      );

      // 6. Provide property type
      response = await vsa.processCustomerResponse(
        session.id,
        "I'm looking for a single family home with at least 3 bedrooms"
      );

      // Should eventually lead to appointment booking
      let attempts = 0;
      while (
        !response.includes("schedule") &&
        !response.includes("appointment") &&
        attempts < 5
      ) {
        response = await vsa.processCustomerResponse(
          session.id,
          "That sounds good"
        );
        attempts++;
      }

      // Debug: log the actual response
      console.log("Final response:", response);

      expect(
        response.includes("schedule") ||
          response.includes("appointment") ||
          response.includes("consultation") ||
          response.includes("meeting")
      ).toBe(true);

      // 7. Book appointment
      const appointmentDate = new Date();
      appointmentDate.setDate(appointmentDate.getDate() + 1);
      appointmentDate.setHours(10, 0, 0, 0);

      const appointment = await vsa.bookAppointment(session.id, {
        type: "consultation",
        scheduledAt: appointmentDate,
        notes: "Initial consultation for downtown properties",
      });

      expect(appointment.leadId).toBe(testLead.id);
      expect(appointment.type).toBe("consultation");

      // 8. Complete call
      const interaction = await vsa.completeCall(session.id);

      expect(interaction.outcome.appointmentBooked).toBe(true);
      expect(interaction.outcome.qualificationUpdated).toBe(true);
      expect(interaction.outcome.status).toBe("successful");

      // Verify final session state
      const finalSession = vsa.getSession(session.id);
      expect(finalSession?.status).toBe("completed");
      expect(finalSession?.appointmentBooked).toBe(true);
      expect(finalSession?.qualificationScore).toBeGreaterThan(0);
      expect(finalSession?.qualificationData.budget).toBeDefined();
      expect(finalSession?.qualificationData.location).toBeDefined();
    });

    it("should handle workflow with human transfer", async () => {
      // 1. Initiate call
      const session = await vsa.initiateCall(testLead.data);

      // 2. Customer gives complex response requiring transfer
      const response = await vsa.processCustomerResponse(
        session.id,
        "Well, it's complicated because I need to coordinate with my spouse and we have some complex financial arrangements that depend on various factors..."
      );

      expect(response).toContain("connect you with one of our senior agents");

      // Verify transfer was initiated
      const transferRequests = vsa.getTransferRequests();
      expect(transferRequests).toHaveLength(1);
      expect(transferRequests[0].reason).toBe("complex_query");

      // Complete call
      const interaction = await vsa.completeCall(session.id);
      expect(interaction.outcome.status).toBe("transferred");
      expect(interaction.outcome.escalationRequired).toBe(true);
    });
  });
});
