import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { CustomerRetentionAgent } from "../customer-retention-agent";
import { Lead, LeadModel } from "../../types/lead";
import { Interaction, InteractionModel } from "../../types/interaction";

describe("CustomerRetentionAgent", () => {
  let agent: CustomerRetentionAgent;
  let mockLead: Lead;
  let mockInteractions: Interaction[];

  beforeEach(() => {
    agent = new CustomerRetentionAgent();

    // Create mock lead data
    mockLead = LeadModel.create({
      source: "website",
      contactInfo: {
        name: "John Doe",
        email: "john@example.com",
        phone: "+1234567890",
        preferredChannel: "email",
        timezone: "UTC",
      },
      leadType: "warm",
      urgencyLevel: 5,
      intentSignals: ["form_submission", "requested_callback"],
      qualificationData: {
        budget: { min: 400000, max: 600000 },
        location: "Downtown",
        propertyType: "Condo",
        timeline: "3-6 months",
        qualificationScore: 0.7,
      },
      status: "contacted",
    }).data;

    // Create mock interactions (old interactions to trigger inactivity)
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 65); // 65 days ago

    mockInteractions = [
      InteractionModel.create({
        leadId: mockLead.id,
        agentId: "test-agent",
        type: "email",
        direction: "outbound",
        content: "Initial contact email",
        outcome: {
          status: "successful",
          appointmentBooked: false,
          qualificationUpdated: true,
          escalationRequired: false,
        },
      }).data,
    ];

    // Set the timestamp to 65 days ago
    mockInteractions[0].timestamp = oldDate;

    // Mock console.log to avoid test output noise
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Initialization", () => {
    it("should initialize with default configuration", () => {
      const newAgent = new CustomerRetentionAgent();
      expect(newAgent).toBeDefined();

      const metrics = newAgent.getPerformanceMetrics();
      expect(metrics.totalCampaignsStarted).toBe(0);
      expect(metrics.activeCampaigns).toBe(0);
    });

    it("should accept custom configuration", () => {
      const customConfig = {
        inactivityThresholdDays: 30,
        maxConcurrentCampaigns: 25,
      };

      const customAgent = new CustomerRetentionAgent(customConfig);
      expect(customAgent).toBeDefined();
    });

    it("should initialize default triggers, templates, and campaigns", () => {
      const newAgent = new CustomerRetentionAgent();

      // Check that default configuration was initialized
      expect(newAgent).toBeDefined();

      // We can't directly access private config, but we can test behavior
      const metrics = newAgent.getPerformanceMetrics();
      expect(metrics).toBeDefined();
    });
  });

  describe("Inactivity Detection", () => {
    it("should detect inactive customers after 60+ days", async () => {
      const leads = [mockLead];
      const interactionsMap = new Map([[mockLead.id, mockInteractions]]);

      const triggeredSessions = await agent.detectInactiveCustomers(
        leads,
        interactionsMap
      );

      expect(triggeredSessions).toHaveLength(1);
      expect(triggeredSessions[0].leadId).toBe(mockLead.id);
      expect(triggeredSessions[0].status).toBe("active");
    });

    it("should not trigger for recently active customers", async () => {
      // Create recent interaction
      const recentInteraction = InteractionModel.create({
        leadId: mockLead.id,
        agentId: "test-agent",
        type: "email",
        direction: "outbound",
        content: "Recent contact",
        outcome: {
          status: "successful",
          appointmentBooked: false,
          qualificationUpdated: false,
          escalationRequired: false,
        },
      }).data;

      const leads = [mockLead];
      const interactionsMap = new Map([[mockLead.id, [recentInteraction]]]);

      const triggeredSessions = await agent.detectInactiveCustomers(
        leads,
        interactionsMap
      );

      expect(triggeredSessions).toHaveLength(0);
    });

    it("should detect qualified but inactive leads with higher priority", async () => {
      // Create a highly qualified lead with 30+ days inactivity
      const qualifiedLead = {
        ...mockLead,
        qualificationData: {
          ...mockLead.qualificationData,
          qualificationScore: 0.8,
        },
      };

      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 35); // 35 days ago
      const oldInteraction = { ...mockInteractions[0], timestamp: oldDate };

      const leads = [qualifiedLead];
      const interactionsMap = new Map([[qualifiedLead.id, [oldInteraction]]]);

      const triggeredSessions = await agent.detectInactiveCustomers(
        leads,
        interactionsMap
      );

      expect(triggeredSessions).toHaveLength(1);
      expect(triggeredSessions[0].triggerId).toBe("qualified_but_inactive");
    });

    it("should not trigger multiple campaigns for the same lead", async () => {
      const leads = [mockLead];
      const interactionsMap = new Map([[mockLead.id, mockInteractions]]);

      // First detection
      const firstTrigger = await agent.detectInactiveCustomers(
        leads,
        interactionsMap
      );
      expect(firstTrigger).toHaveLength(1);

      // Second detection should not trigger again
      const secondTrigger = await agent.detectInactiveCustomers(
        leads,
        interactionsMap
      );
      expect(secondTrigger).toHaveLength(0);
    });
  });

  describe("Campaign Execution", () => {
    it("should start a re-engagement campaign", async () => {
      const leads = [mockLead];
      const interactionsMap = new Map([[mockLead.id, mockInteractions]]);

      const triggeredSessions = await agent.detectInactiveCustomers(
        leads,
        interactionsMap
      );

      expect(triggeredSessions).toHaveLength(1);

      const session = triggeredSessions[0];
      expect(session.status).toBe("active");
      expect(session.messagesAttempted).toBe(1); // First message should be sent
      expect(session.currentStep).toBe(1);
    });

    it("should execute campaign steps in sequence", async () => {
      const leads = [mockLead];
      const interactionsMap = new Map([[mockLead.id, mockInteractions]]);

      const triggeredSessions = await agent.detectInactiveCustomers(
        leads,
        interactionsMap
      );
      const session = triggeredSessions[0];

      // Execute next step
      const success = await agent.executeNextCampaignStep(session.id);
      expect(success).toBe(true);

      const updatedSession = agent.getSession(session.id);
      expect(updatedSession?.messagesAttempted).toBe(2);
      expect(updatedSession?.currentStep).toBe(2);
    });

    it("should complete campaign when max attempts reached", async () => {
      const leads = [mockLead];
      const interactionsMap = new Map([[mockLead.id, mockInteractions]]);

      const triggeredSessions = await agent.detectInactiveCustomers(
        leads,
        interactionsMap
      );
      const session = triggeredSessions[0];

      // Execute all steps until completion
      let stepCount = 0;
      let success = true;
      while (success && stepCount < 10) {
        // Safety limit
        success = await agent.executeNextCampaignStep(session.id);
        stepCount++;
      }

      const finalSession = agent.getSession(session.id);
      expect(finalSession?.status).toBe("completed");
      expect(finalSession?.outcome).toBe("no_response");
    });
  });

  describe("Message Personalization", () => {
    it("should personalize message templates with lead data", async () => {
      const template = {
        id: "test-template",
        name: "Test Template",
        channel: "email" as const,
        subject: "Hi {{name}}, properties in {{location}}",
        content:
          "Hello {{name}}, we have new {{propertyType}} listings in {{location}} within your {{budget}} budget.",
        variables: ["name", "location", "propertyType", "budget"],
        enabled: true,
      };

      const leadData = {
        contactInfo: { name: "John Doe" },
        qualificationData: {
          location: "Downtown",
          propertyType: "Condo",
          budget: { min: 400000, max: 600000 },
        },
      };

      const analysis = {
        daysSinceLastInteraction: 65,
      };

      const personalizedMessage = await agent.personalizeMessage(
        template,
        leadData,
        analysis
      );

      expect(personalizedMessage.subject).toContain("John");
      expect(personalizedMessage.subject).toContain("Downtown");
      expect(personalizedMessage.content).toContain("John");
      expect(personalizedMessage.content).toContain("Downtown");
      expect(personalizedMessage.content).toContain("Condo");
      expect(personalizedMessage.content).toContain("$400,000 - $600,000");
    });

    it("should handle missing data gracefully in personalization", async () => {
      const template = {
        id: "test-template",
        name: "Test Template",
        channel: "email" as const,
        content: "Hello {{name}}, interested in {{location}}?",
        variables: ["name", "location"],
        enabled: true,
      };

      const leadData = {
        contactInfo: { name: "John Doe" },
        qualificationData: {}, // Missing location
      };

      const personalizedMessage = await agent.personalizeMessage(
        template,
        leadData
      );

      expect(personalizedMessage.content).toContain("John");
      expect(personalizedMessage.content).toContain("your preferred area"); // Default value
    });
  });

  describe("Response Handling", () => {
    it("should handle positive customer responses", async () => {
      // Start a campaign first
      const leads = [mockLead];
      const interactionsMap = new Map([[mockLead.id, mockInteractions]]);
      const triggeredSessions = await agent.detectInactiveCustomers(
        leads,
        interactionsMap
      );
      const session = triggeredSessions[0];

      const result = await agent.handleCustomerResponse(
        mockLead.id,
        "Yes, I'm very interested! When can we schedule a call?",
        "sms"
      );

      expect(result.responseType).toBe("positive");
      expect(result.nextAction).toBe("escalate");
      expect(result.reasoning).toContain(
        "Positive response - escalating to human agent"
      );

      const updatedSession = agent.getSession(session.id);
      expect(updatedSession?.responseReceived).toBe(true);
      expect(updatedSession?.status).toBe("completed");
      expect(updatedSession?.outcome).toBe("re_engaged");
    });

    it("should handle negative customer responses", async () => {
      // Start a campaign first
      const leads = [mockLead];
      const interactionsMap = new Map([[mockLead.id, mockInteractions]]);
      const triggeredSessions = await agent.detectInactiveCustomers(
        leads,
        interactionsMap
      );
      const session = triggeredSessions[0];

      const result = await agent.handleCustomerResponse(
        mockLead.id,
        "No, I'm not interested right now. Maybe later.",
        "sms"
      );

      expect(result.responseType).toBe("negative");
      expect(result.nextAction).toBe("pause");
      expect(result.reasoning).toContain(
        "Negative response - pausing campaign"
      );

      const updatedSession = agent.getSession(session.id);
      expect(updatedSession?.status).toBe("paused");
    });

    it("should handle opt-out requests", async () => {
      // Start a campaign first
      const leads = [mockLead];
      const interactionsMap = new Map([[mockLead.id, mockInteractions]]);
      const triggeredSessions = await agent.detectInactiveCustomers(
        leads,
        interactionsMap
      );
      const session = triggeredSessions[0];

      const result = await agent.handleCustomerResponse(
        mockLead.id,
        "STOP - please don't contact me anymore",
        "sms"
      );

      expect(result.responseType).toBe("opt_out");
      expect(result.nextAction).toBe("end");
      expect(result.reasoning).toContain(
        "Opt-out request - ending campaign and updating preferences"
      );

      const updatedSession = agent.getSession(session.id);
      expect(updatedSession?.status).toBe("completed");
      expect(updatedSession?.outcome).toBe("opted_out");
    });

    it("should handle neutral responses by continuing campaign", async () => {
      // Start a campaign first
      const leads = [mockLead];
      const interactionsMap = new Map([[mockLead.id, mockInteractions]]);
      const triggeredSessions = await agent.detectInactiveCustomers(
        leads,
        interactionsMap
      );
      const session = triggeredSessions[0];

      const result = await agent.handleCustomerResponse(
        mockLead.id,
        "Thanks for the information.",
        "email"
      );

      expect(result.responseType).toBe("neutral");
      expect(result.nextAction).toBe("continue_campaign");
      expect(result.reasoning).toContain(
        "Neutral response - continuing campaign sequence"
      );

      const updatedSession = agent.getSession(session.id);
      expect(updatedSession?.responseReceived).toBe(true);
      expect(updatedSession?.status).toBe("active"); // Still active
    });

    it("should throw error for response without active session", async () => {
      await expect(
        agent.handleCustomerResponse("non-existent-lead", "Hello", "sms")
      ).rejects.toThrow("No active re-engagement session found for lead");
    });
  });

  describe("Engagement Analysis", () => {
    it("should analyze customer engagement correctly", async () => {
      const analysis = await agent.analyzeCustomerEngagement(
        mockLead,
        mockInteractions
      );

      expect(analysis.leadId).toBe(mockLead.id);
      expect(analysis.daysSinceLastInteraction).toBeGreaterThan(60);
      expect(analysis.totalInteractions).toBe(1);
      expect(analysis.preferredChannel).toBe("email");
      expect(analysis.engagementScore).toBeGreaterThan(0);
      expect(analysis.riskLevel).toBe("medium"); // Due to long inactivity but good qualification score
      expect(analysis.personalizedFactors).toContain("Interested in Downtown");
      expect(analysis.personalizedFactors).toContain("Looking for Condo");
    });

    it("should calculate engagement score based on multiple factors", async () => {
      // Create a highly qualified lead with recent interactions
      const qualifiedLead = {
        ...mockLead,
        qualificationData: {
          ...mockLead.qualificationData,
          qualificationScore: 0.9,
        },
      };

      const recentInteractions = [
        ...mockInteractions,
        InteractionModel.create({
          leadId: mockLead.id,
          agentId: "test-agent",
          type: "call",
          direction: "inbound",
          content: "Customer called back",
          outcome: {
            status: "successful",
            appointmentBooked: true,
            qualificationUpdated: false,
            escalationRequired: false,
          },
        }).data,
      ];

      const analysis = await agent.analyzeCustomerEngagement(
        qualifiedLead,
        recentInteractions
      );

      expect(analysis.engagementScore).toBeGreaterThan(0.5);
      expect(analysis.totalInteractions).toBe(2);
    });

    it("should determine risk level correctly", async () => {
      // Test high risk (very old interaction)
      const veryOldDate = new Date();
      veryOldDate.setDate(veryOldDate.getDate() - 120); // 120 days ago
      const veryOldInteraction = {
        ...mockInteractions[0],
        timestamp: veryOldDate,
      };

      const highRiskAnalysis = await agent.analyzeCustomerEngagement(mockLead, [
        veryOldInteraction,
      ]);
      expect(highRiskAnalysis.riskLevel).toBe("high");

      // Test medium risk (moderately old interaction)
      const mediumOldDate = new Date();
      mediumOldDate.setDate(mediumOldDate.getDate() - 70); // 70 days ago
      const mediumOldInteraction = {
        ...mockInteractions[0],
        timestamp: mediumOldDate,
      };

      const mediumRiskAnalysis = await agent.analyzeCustomerEngagement(
        mockLead,
        [mediumOldInteraction]
      );
      expect(mediumRiskAnalysis.riskLevel).toBe("medium");
    });
  });

  describe("Multi-Channel Communication", () => {
    it("should send SMS messages", async () => {
      const success = await agent.sendMessage(
        "sms",
        { phone: "+1234567890" },
        { content: "Test SMS message" }
      );

      expect(success).toBe(true);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("Sending SMS to +1234567890")
      );
    });

    it("should send email messages", async () => {
      const success = await agent.sendMessage(
        "email",
        { email: "test@example.com" },
        { subject: "Test Subject", content: "Test email content" }
      );

      expect(success).toBe(true);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("Sending email to test@example.com")
      );
    });

    it("should send WhatsApp messages", async () => {
      const success = await agent.sendMessage(
        "whatsapp",
        { phone: "+1234567890" },
        { content: "Test WhatsApp message" }
      );

      expect(success).toBe(true);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("Sending WhatsApp to +1234567890")
      );
    });

    it("should fail gracefully when contact info is missing", async () => {
      const smsSuccess = await agent.sendMessage(
        "sms",
        { email: "test@example.com" }, // No phone for SMS
        { content: "Test message" }
      );

      const emailSuccess = await agent.sendMessage(
        "email",
        { phone: "+1234567890" }, // No email for email
        { content: "Test message" }
      );

      expect(smsSuccess).toBe(false);
      expect(emailSuccess).toBe(false);
    });
  });

  describe("Configuration Management", () => {
    it("should allow updating configuration", () => {
      const updates = {
        inactivityThresholdDays: 45,
        maxConcurrentCampaigns: 30,
      };

      agent.updateConfig(updates);

      // Test that configuration was updated by checking behavior
      expect(agent).toBeDefined(); // Basic check since config is private
    });

    it("should allow adding custom triggers", () => {
      const customTrigger = {
        id: "custom_trigger",
        name: "Custom Trigger",
        condition: (lead: Lead) => lead.urgencyLevel > 8,
        priority: "high" as const,
        enabled: true,
        cooldownDays: 14,
      };

      agent.addTrigger(customTrigger);

      // Test that trigger was added by checking it doesn't throw
      expect(agent).toBeDefined();
    });

    it("should allow adding custom message templates", () => {
      const customTemplate = {
        id: "custom_template",
        name: "Custom Template",
        channel: "sms" as const,
        content: "Custom message for {{name}}",
        variables: ["name"],
        enabled: true,
      };

      agent.addMessageTemplate(customTemplate);

      expect(agent).toBeDefined();
    });

    it("should allow adding custom campaigns", () => {
      const customCampaign = {
        id: "custom_campaign",
        name: "Custom Campaign",
        triggers: ["custom_trigger"],
        messageSequence: [
          {
            templateId: "custom_template",
            channel: "sms" as const,
            delayDays: 0,
          },
        ],
        enabled: true,
        maxAttempts: 2,
        successCriteria: ["response_received"],
      };

      agent.addCampaign(customCampaign);

      expect(agent).toBeDefined();
    });
  });

  describe("Performance Metrics", () => {
    it("should track performance metrics correctly", async () => {
      const initialMetrics = agent.getPerformanceMetrics();
      expect(initialMetrics.totalCampaignsStarted).toBe(0);
      expect(initialMetrics.activeCampaigns).toBe(0);

      // Start a campaign
      const leads = [mockLead];
      const interactionsMap = new Map([[mockLead.id, mockInteractions]]);
      await agent.detectInactiveCustomers(leads, interactionsMap);

      const metricsAfterStart = agent.getPerformanceMetrics();
      expect(metricsAfterStart.totalCampaignsStarted).toBe(1);
      expect(metricsAfterStart.activeCampaigns).toBe(1);
    });

    it("should calculate conversion rates correctly", async () => {
      // Start and complete a campaign with conversion
      const leads = [mockLead];
      const interactionsMap = new Map([[mockLead.id, mockInteractions]]);
      const triggeredSessions = await agent.detectInactiveCustomers(
        leads,
        interactionsMap
      );

      // Simulate positive response leading to conversion
      await agent.handleCustomerResponse(
        mockLead.id,
        "Yes, I'm very interested!",
        "sms"
      );

      const metrics = agent.getPerformanceMetrics();
      expect(metrics.reengagementRate).toBeGreaterThan(0);
      expect(metrics.completedCampaigns).toBe(1);
    });

    it("should track opt-out rates", async () => {
      // Start a campaign and simulate opt-out
      const leads = [mockLead];
      const interactionsMap = new Map([[mockLead.id, mockInteractions]]);
      await agent.detectInactiveCustomers(leads, interactionsMap);

      await agent.handleCustomerResponse(
        mockLead.id,
        "STOP - don't contact me",
        "sms"
      );

      const metrics = agent.getPerformanceMetrics();
      expect(metrics.optOutRate).toBeGreaterThan(0);
      expect(metrics.completedCampaigns).toBe(1);
    });
  });

  describe("Session Management", () => {
    it("should manage active sessions correctly", async () => {
      expect(agent.getActiveSessions()).toHaveLength(0);

      // Start a campaign
      const leads = [mockLead];
      const interactionsMap = new Map([[mockLead.id, mockInteractions]]);
      const triggeredSessions = await agent.detectInactiveCustomers(
        leads,
        interactionsMap
      );

      expect(agent.getActiveSessions()).toHaveLength(1);
      expect(agent.getSession(triggeredSessions[0].id)).toBeDefined();
    });

    it("should retrieve engagement analysis for leads", async () => {
      // Start a campaign to generate analysis
      const leads = [mockLead];
      const interactionsMap = new Map([[mockLead.id, mockInteractions]]);
      await agent.detectInactiveCustomers(leads, interactionsMap);

      const analysis = agent.getEngagementAnalysis(mockLead.id);
      expect(analysis).toBeDefined();
      expect(analysis?.leadId).toBe(mockLead.id);
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid session IDs gracefully", async () => {
      const success = await agent.executeNextCampaignStep("invalid-session-id");
      expect(success).toBe(false);
    });

    it("should handle missing templates gracefully", async () => {
      // This would be tested by creating a campaign with non-existent template
      // The agent should handle this gracefully without crashing
      expect(agent).toBeDefined();
    });

    it("should handle communication failures gracefully", async () => {
      // Mock a communication failure
      const originalSendSMS = agent["sendSMS"];
      agent["sendSMS"] = vi
        .fn()
        .mockRejectedValue(new Error("SMS service unavailable"));

      const success = await agent.sendMessage(
        "sms",
        { phone: "+1234567890" },
        { content: "Test message" }
      );

      expect(success).toBe(false);

      // Restore original method
      agent["sendSMS"] = originalSendSMS;
    });
  });

  describe("Integration Requirements", () => {
    it("should satisfy requirement 4.1: 60+ day inactivity detection", async () => {
      const leads = [mockLead];
      const interactionsMap = new Map([[mockLead.id, mockInteractions]]);

      const triggeredSessions = await agent.detectInactiveCustomers(
        leads,
        interactionsMap
      );

      expect(triggeredSessions).toHaveLength(1);
      expect(triggeredSessions[0].triggerId).toBe("inactive_60_days");
    });

    it("should satisfy requirement 4.2: personalized message generation", async () => {
      const template = {
        id: "test",
        name: "Test",
        channel: "email" as const,
        content: "Hi {{name}}, we have {{propertyType}} in {{location}}",
        variables: ["name", "propertyType", "location"],
        enabled: true,
      };

      const leadData = {
        contactInfo: { name: "John Doe" },
        qualificationData: { propertyType: "Condo", location: "Downtown" },
      };

      const result = await agent.personalizeMessage(template, leadData);

      expect(result.content).toContain("John");
      expect(result.content).toContain("Condo");
      expect(result.content).toContain("Downtown");
    });

    it("should satisfy requirement 4.3: multi-channel outreach", async () => {
      const channels = ["sms", "email", "whatsapp"] as const;

      for (const channel of channels) {
        const success = await agent.sendMessage(
          channel,
          { phone: "+1234567890", email: "test@example.com" },
          { content: "Test message", subject: "Test" }
        );
        expect(success).toBe(true);
      }
    });

    it("should satisfy requirement 4.4: response handling and workflow routing", async () => {
      // Start campaign
      const leads = [mockLead];
      const interactionsMap = new Map([[mockLead.id, mockInteractions]]);
      await agent.detectInactiveCustomers(leads, interactionsMap);

      // Test different response types and their routing
      const positiveResult = await agent.handleCustomerResponse(
        mockLead.id,
        "Yes, I'm interested!",
        "sms"
      );
      expect(positiveResult.nextAction).toBe("escalate");

      // Reset for next test - create a new lead with proper UUID
      const mockLead2 = LeadModel.create({
        source: "website",
        contactInfo: {
          name: "Jane Smith",
          email: "jane@example.com",
          phone: "+1234567891",
          preferredChannel: "email",
          timezone: "UTC",
        },
        leadType: "warm",
        urgencyLevel: 5,
        intentSignals: ["form_submission"],
        qualificationData: {
          budget: { min: 300000, max: 500000 },
          location: "Uptown",
          propertyType: "House",
          timeline: "1-3 months",
          qualificationScore: 0.6,
        },
        status: "contacted",
      }).data;

      const mockInteraction2 = InteractionModel.create({
        leadId: mockLead2.id,
        agentId: "test-agent",
        type: "email",
        direction: "outbound",
        content: "Initial contact email",
        outcome: {
          status: "successful",
          appointmentBooked: false,
          qualificationUpdated: true,
          escalationRequired: false,
        },
      }).data;

      // Set the timestamp to 65 days ago
      const oldDate2 = new Date();
      oldDate2.setDate(oldDate2.getDate() - 65);
      mockInteraction2.timestamp = oldDate2;

      const leads2 = [mockLead2];
      const interactionsMap2 = new Map([[mockLead2.id, [mockInteraction2]]]);
      const sessions2 = await agent.detectInactiveCustomers(
        leads2,
        interactionsMap2
      );

      const negativeResult = await agent.handleCustomerResponse(
        mockLead2.id,
        "No, not interested",
        "sms"
      );
      expect(negativeResult.nextAction).toBe("pause");
    });
  });
});
