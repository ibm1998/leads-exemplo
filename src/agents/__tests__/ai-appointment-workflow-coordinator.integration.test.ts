import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  AIAppointmentWorkflowCoordinator,
  Campaign,
  CampaignAudience,
  CampaignStep,
} from "../ai-appointment-workflow-coordinator";
import { LeadModel, CreateLead } from "../../types/lead";

describe("AIAppointmentWorkflowCoordinator Integration Tests", () => {
  let coordinator: AIAppointmentWorkflowCoordinator;
  let testLead: LeadModel;

  beforeEach(() => {
    coordinator = new AIAppointmentWorkflowCoordinator();

    // Create a test lead
    const leadData: CreateLead = {
      source: "website",
      contactInfo: {
        name: "John Doe",
        email: "john@example.com",
        phone: "+1234567890",
        preferredChannel: "email",
        timezone: "UTC",
      },
      leadType: "hot",
      urgencyLevel: 8,
      intentSignals: ["property_inquiry", "budget_discussed"],
      qualificationData: {
        budget: { min: 100000, max: 500000 },
        location: "New York",
        propertyType: "Apartment",
        timeline: "3 months",
        qualificationScore: 0.8,
      },
      status: "new",
    };

    testLead = LeadModel.create(leadData);
  });

  describe("End-to-End Campaign Workflows", () => {
    it("should execute complete callback sequence campaign", async () => {
      // Create a multi-step callback campaign
      const targetAudience: CampaignAudience = {
        leadTypes: ["hot"],
        sources: ["website"],
        qualificationScoreMin: 0.7,
      };

      const steps: Omit<CampaignStep, "id">[] = [
        {
          order: 1,
          type: "callback",
          delayHours: 1,
          content: "Initial callback within 1 hour",
        },
        {
          order: 2,
          type: "message",
          delayHours: 24,
          content: "Follow-up message after 24 hours",
        },
        {
          order: 3,
          type: "appointment",
          delayHours: 48,
          content: "Schedule consultation after 48 hours",
        },
      ];

      const campaign = await coordinator.createCampaign(
        "Hot Lead Callback Sequence",
        "callback_sequence",
        targetAudience,
        steps
      );

      // Execute each step of the campaign
      for (const step of campaign.steps) {
        const success = await coordinator.executeCampaignStep(
          campaign.id,
          testLead.id,
          step.id
        );
        expect(success).toBe(true);
      }

      // Verify campaign performance
      const performance = coordinator.getCampaignPerformance(campaign.id);
      expect(performance).toBeDefined();
      expect(performance!.completedSteps).toBe(3);
      expect(performance!.callbacksScheduled).toBe(1);
      expect(performance!.appointmentsBooked).toBe(1);

      // Verify callbacks and appointments were created
      const leadAppointments = coordinator.getLeadAppointments(testLead.id);
      expect(leadAppointments).toHaveLength(1);
      expect(leadAppointments[0].type).toBe("consultation");
    });

    it("should handle appointment booking with full reminder workflow", async () => {
      const scheduledAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours from now

      // Book appointment
      const appointment = await coordinator.bookAppointment(
        testLead.id,
        "consultation",
        scheduledAt,
        90, // 90 minutes
        "Main Office",
        undefined
      );

      expect(appointment.status).toBe("scheduled");
      expect(appointment.confirmationSent).toBe(false);

      // Confirm appointment
      const confirmed = await coordinator.confirmAppointment(appointment.id);
      expect(confirmed.status).toBe("confirmed");
      expect(confirmed.confirmationSent).toBe(true);

      // Verify reminder sequence was created
      const reminderSequences = (coordinator as any).reminderSequences;
      const sequence = Array.from(reminderSequences.values()).find(
        (rs: any) => rs.appointmentId === appointment.id
      ) as any;

      expect(sequence).toBeDefined();
      expect(sequence.status).toBe("active");
      expect(sequence.reminders).toHaveLength(2);

      // Test rescheduling
      const newTime = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours from now
      const rescheduled = await coordinator.rescheduleAppointment(
        appointment.id,
        newTime,
        "Client requested different time"
      );

      expect(rescheduled.scheduledAt).toEqual(newTime);
      expect(rescheduled.status).toBe("rescheduled");
      expect(rescheduled.notes).toContain("Client requested different time");
    });

    it("should process campaign-driven outreach workflow", async () => {
      // Create campaign for warm lead re-engagement
      const targetAudience: CampaignAudience = {
        leadTypes: ["warm"],
        sources: ["meta_ads", "website"],
        qualificationScoreMin: 0.5,
        tags: ["previous_interest"],
      };

      const steps: Omit<CampaignStep, "id">[] = [
        {
          order: 1,
          type: "email",
          delayHours: 0,
          content: "Re-engagement email with special offer",
        },
        {
          order: 2,
          type: "wait",
          delayHours: 72,
          content: "Wait 3 days for response",
        },
        {
          order: 3,
          type: "callback",
          delayHours: 0,
          content: "Follow-up call if no response",
        },
        {
          order: 4,
          type: "appointment",
          delayHours: 24,
          content: "Schedule site visit if interested",
        },
      ];

      const campaign = await coordinator.createCampaign(
        "Warm Lead Re-engagement",
        "re_engagement",
        targetAudience,
        steps
      );

      // Simulate lead responding to campaign
      const warmLead = LeadModel.create({
        ...testLead.data,
        leadType: "warm",
        urgencyLevel: 5,
        qualificationData: {
          ...testLead.data.qualificationData,
          qualificationScore: 0.6,
        },
      });

      // Execute campaign steps
      let stepCount = 0;
      for (const step of campaign.steps) {
        const success = await coordinator.executeCampaignStep(
          campaign.id,
          warmLead.id,
          step.id
        );
        expect(success).toBe(true);
        stepCount++;
      }

      // Verify all steps were executed
      const performance = coordinator.getCampaignPerformance(campaign.id);
      expect(performance!.completedSteps).toBe(stepCount);
      expect(performance!.callbacksScheduled).toBe(1);
      expect(performance!.appointmentsBooked).toBe(1);

      // Verify appointment was created
      const appointments = coordinator.getLeadAppointments(warmLead.id);
      expect(appointments).toHaveLength(1);
      expect(appointments[0].type).toBe("consultation");
    });

    it("should handle callback scheduling and processing workflow", async () => {
      // Schedule multiple callbacks at different times
      const callback1Time = new Date(Date.now() - 60 * 1000); // 1 minute ago (due)
      const callback2Time = new Date(Date.now() - 30 * 1000); // 30 seconds ago (due)
      const callback3Time = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now (future)

      const callback1 = await coordinator.scheduleCallback(
        testLead.id,
        callback1Time
      );
      const callback2 = await coordinator.scheduleCallback(
        testLead.id,
        callback2Time
      );
      const callback3 = await coordinator.scheduleCallback(
        testLead.id,
        callback3Time
      );

      expect(callback1.status).toBe("pending");
      expect(callback2.status).toBe("pending");
      expect(callback3.status).toBe("pending");

      // Mock the attemptCallback method for controlled testing
      let callAttempts = 0;
      vi.spyOn(coordinator as any, "attemptCallback").mockImplementation(
        async (callback: any) => {
          callAttempts++;
          // First callback succeeds, second fails
          return callback.id === callback1.id;
        }
      );

      // Wait a bit to ensure callbacks are due
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Process pending callbacks
      await coordinator.processPendingCallbacks();

      // Check callback statuses
      const callbacks = (coordinator as any).callbacks;
      const updatedCallback1 = callbacks.get(callback1.id);
      const updatedCallback2 = callbacks.get(callback2.id);
      const updatedCallback3 = callbacks.get(callback3.id);

      expect(updatedCallback1.status).toBe("completed");
      expect(updatedCallback1.attempts).toBe(1);

      expect(updatedCallback2.status).toBe("pending"); // Still pending, will retry
      expect(updatedCallback2.attempts).toBe(1);

      expect(updatedCallback3.status).toBe("pending"); // Not due yet
      expect(updatedCallback3.attempts).toBe(0);

      expect(callAttempts).toBeGreaterThan(0);
    });

    it("should track and optimize campaign performance", async () => {
      // Create multiple campaigns with different performance characteristics
      const highPerformingCampaign = await coordinator.createCampaign(
        "High Converting Campaign",
        "appointment_booking",
        { leadTypes: ["hot"], sources: ["website"] },
        [
          {
            order: 1,
            type: "callback",
            delayHours: 1,
            content: "Quick callback",
          },
          {
            order: 2,
            type: "appointment",
            delayHours: 2,
            content: "Book appointment",
          },
        ]
      );

      const lowPerformingCampaign = await coordinator.createCampaign(
        "Low Converting Campaign",
        "follow_up",
        { leadTypes: ["cold"], sources: ["third_party"] },
        [
          { order: 1, type: "email", delayHours: 24, content: "Cold email" },
          { order: 2, type: "wait", delayHours: 168, content: "Wait a week" },
        ]
      );

      // Simulate high performance for first campaign
      for (let i = 0; i < 5; i++) {
        const leadId = `lead-${i}`;
        for (const step of highPerformingCampaign.steps) {
          await coordinator.executeCampaignStep(
            highPerformingCampaign.id,
            leadId,
            step.id
          );
        }
      }

      // Simulate low performance for second campaign
      for (let i = 0; i < 3; i++) {
        const leadId = `cold-lead-${i}`;
        // Only execute first step
        await coordinator.executeCampaignStep(
          lowPerformingCampaign.id,
          leadId,
          lowPerformingCampaign.steps[0].id
        );
      }

      // Check performance metrics
      const highPerf = coordinator.getCampaignPerformance(
        highPerformingCampaign.id
      );
      const lowPerf = coordinator.getCampaignPerformance(
        lowPerformingCampaign.id
      );

      expect(highPerf!.appointmentsBooked).toBe(5);
      expect(highPerf!.callbacksScheduled).toBe(5);
      expect(highPerf!.completedSteps).toBe(10); // 5 leads × 2 steps

      expect(lowPerf!.appointmentsBooked).toBe(0);
      expect(lowPerf!.callbacksScheduled).toBe(0);
      expect(lowPerf!.completedSteps).toBe(3); // 3 leads × 1 step

      // Get agent performance data
      const period = {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000),
        end: new Date(),
      };

      const agentPerformance = coordinator.getAgentPerformance(period);
      expect(agentPerformance.metrics.totalInteractions).toBeGreaterThan(0);
      expect(agentPerformance.optimizationSuggestions).toBeDefined();
      expect(agentPerformance.optimizationSuggestions.length).toBeGreaterThan(
        0
      );
    });

    it("should handle complex multi-channel campaign coordination", async () => {
      // Create a complex campaign that uses multiple communication channels
      const targetAudience: CampaignAudience = {
        leadTypes: ["hot", "warm"],
        sources: ["website", "meta_ads"],
        qualificationScoreMin: 0.6,
      };

      const steps: Omit<CampaignStep, "id">[] = [
        {
          order: 1,
          type: "email",
          delayHours: 0,
          content: "Welcome email with property details",
        },
        {
          order: 2,
          type: "callback",
          delayHours: 2,
          content: "Follow-up call to discuss interest",
        },
        {
          order: 3,
          type: "message",
          delayHours: 24,
          content: "SMS with appointment booking link",
        },
        {
          order: 4,
          type: "appointment",
          delayHours: 48,
          content: "Schedule property viewing",
        },
      ];

      const campaign = await coordinator.createCampaign(
        "Multi-Channel Property Campaign",
        "appointment_booking",
        targetAudience,
        steps
      );

      // Execute campaign for multiple leads
      const leads = [testLead.id, "lead-2", "lead-3"];

      for (const leadId of leads) {
        for (const step of campaign.steps) {
          const success = await coordinator.executeCampaignStep(
            campaign.id,
            leadId,
            step.id
          );
          expect(success).toBe(true);
        }
      }

      // Verify campaign results
      const performance = coordinator.getCampaignPerformance(campaign.id);
      expect(performance!.completedSteps).toBe(12); // 3 leads × 4 steps
      expect(performance!.callbacksScheduled).toBe(3);
      expect(performance!.appointmentsBooked).toBe(3);

      // Verify appointments were created for all leads
      for (const leadId of leads) {
        const appointments = coordinator.getLeadAppointments(leadId);
        expect(appointments).toHaveLength(1);
        expect(appointments[0].type).toBe("consultation");
      }

      // Check upcoming appointments
      const upcoming = coordinator.getUpcomingAppointments(72); // Next 72 hours
      expect(upcoming.length).toBeGreaterThan(0);
    });
  });

  describe("Error Recovery and Resilience", () => {
    it("should handle partial campaign failures gracefully", async () => {
      const campaign = await coordinator.createCampaign(
        "Failure Test Campaign",
        "callback_sequence",
        { leadTypes: ["hot"], sources: ["website"] },
        [
          {
            order: 1,
            type: "callback",
            delayHours: 1,
            content: "First callback",
          },
          {
            order: 2,
            type: "appointment",
            delayHours: 2,
            content: "Book appointment",
          },
          {
            order: 3,
            type: "message",
            delayHours: 3,
            content: "Confirmation message",
          },
        ]
      );

      // Mock bookAppointment to fail on the appointment step
      let callCount = 0;
      const originalBookAppointment =
        coordinator.bookAppointment.bind(coordinator);
      vi.spyOn(coordinator, "bookAppointment").mockImplementation(
        async (...args) => {
          callCount++;
          if (callCount === 1) {
            throw new Error("Appointment booking system unavailable");
          }
          return originalBookAppointment(...args);
        }
      );

      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      // Execute campaign steps
      const results: boolean[] = [];
      for (const step of campaign.steps) {
        const success = await coordinator.executeCampaignStep(
          campaign.id,
          testLead.id,
          step.id
        );
        results.push(success);
      }

      // First step should succeed, second should fail, third should succeed
      expect(results[0]).toBe(true); // callback step succeeds
      expect(results[1]).toBe(false); // appointment step fails due to mock
      expect(results[2]).toBe(true); // message step succeeds

      // Verify error was logged
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to execute campaign step"),
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it("should maintain data consistency during concurrent operations", async () => {
      // Create multiple campaigns and execute them concurrently
      const campaigns = await Promise.all([
        coordinator.createCampaign(
          "Concurrent Campaign 1",
          "callback_sequence",
          { leadTypes: ["hot"], sources: ["website"] },
          [{ order: 1, type: "callback", delayHours: 1, content: "Callback 1" }]
        ),
        coordinator.createCampaign(
          "Concurrent Campaign 2",
          "appointment_booking",
          { leadTypes: ["warm"], sources: ["meta_ads"] },
          [
            {
              order: 1,
              type: "appointment",
              delayHours: 2,
              content: "Appointment 1",
            },
          ]
        ),
        coordinator.createCampaign(
          "Concurrent Campaign 3",
          "follow_up",
          { leadTypes: ["cold"], sources: ["third_party"] },
          [{ order: 1, type: "message", delayHours: 0, content: "Message 1" }]
        ),
      ]);

      // Execute all campaigns concurrently for multiple leads
      const leads = ["lead-1", "lead-2", "lead-3"];
      const promises: Promise<boolean>[] = [];

      for (const campaign of campaigns) {
        for (const leadId of leads) {
          for (const step of campaign.steps) {
            promises.push(
              coordinator.executeCampaignStep(campaign.id, leadId, step.id)
            );
          }
        }
      }

      // Wait for all operations to complete
      const results = await Promise.all(promises);

      // All operations should succeed
      expect(results.every((result) => result === true)).toBe(true);

      // Verify data consistency
      for (const campaign of campaigns) {
        const performance = coordinator.getCampaignPerformance(campaign.id);
        expect(performance!.completedSteps).toBe(3); // 3 leads × 1 step each
      }

      // Verify total appointments and callbacks
      const allAppointments = leads.flatMap((leadId) =>
        coordinator.getLeadAppointments(leadId)
      );
      expect(allAppointments.length).toBe(3); // One appointment campaign × 3 leads
    });
  });
});
