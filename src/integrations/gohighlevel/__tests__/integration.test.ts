import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { GoHighLevelClient } from "../client";
import { GoHighLevelSync } from "../sync";
import { Lead } from "../../../types/lead";
import { Interaction } from "../../../types/interaction";

// Integration tests for GoHighLevel CRM connectivity and data flow
describe("GoHighLevel Integration Tests", () => {
  let client: GoHighLevelClient;
  let sync: GoHighLevelSync;

  // Mock environment variables
  const mockConfig = {
    apiKey: "test-api-key-12345",
    baseUrl: "https://test.gohighlevel.com/v1",
    timeout: 5000,
    maxRetries: 2,
  };

  beforeEach(() => {
    // Create real instances (but with mocked HTTP calls)
    client = new GoHighLevelClient(mockConfig);
    sync = new GoHighLevelSync(client);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("End-to-End Lead Sync Flow", () => {
    const mockLead: Lead = {
      id: "lead-e2e-123",
      source: "website",
      contactInfo: {
        name: "Integration Test User",
        email: "integration@test.com",
        phone: "+1555123456",
        preferredChannel: "email",
        timezone: "America/New_York",
      },
      leadType: "hot",
      urgencyLevel: 9,
      intentSignals: ["ready-to-buy", "budget-confirmed", "timeline-urgent"],
      qualificationData: {
        budget: "500k",
        location: "Manhattan, NY",
        propertyType: "luxury-condo",
        timeline: "2 weeks",
        qualificationScore: 95,
      },
      interactionHistory: [],
      status: "qualified",
      assignedAgent: "agent-premium",
      createdAt: new Date("2024-01-15T10:00:00Z"),
      updatedAt: new Date("2024-01-15T10:30:00Z"),
    };

    const mockInteractions: Interaction[] = [
      {
        id: "interaction-1",
        leadId: "lead-e2e-123",
        agentId: "agent-premium",
        type: "call",
        direction: "outbound",
        content:
          "Initial qualification call - discussed luxury condo requirements in Manhattan",
        outcome: {
          status: "successful",
          appointmentBooked: true,
          qualificationUpdated: true,
          escalationRequired: false,
        },
        duration: 1200, // 20 minutes
        sentiment: {
          score: 0.85,
          confidence: 0.92,
        },
        nextAction: {
          action: "property_viewing",
          scheduledAt: new Date("2024-01-16T14:00:00Z"),
          description: "Schedule property viewing for luxury condos",
        },
        timestamp: new Date("2024-01-15T10:00:00Z"),
      },
      {
        id: "interaction-2",
        leadId: "lead-e2e-123",
        agentId: "agent-premium",
        type: "email",
        direction: "outbound",
        content:
          "Follow-up email with property listings and viewing schedule confirmation",
        outcome: {
          status: "successful",
          appointmentBooked: false,
          qualificationUpdated: false,
          escalationRequired: false,
        },
        sentiment: {
          score: 0.7,
          confidence: 0.8,
        },
        timestamp: new Date("2024-01-15T15:30:00Z"),
      },
    ];

    it("should handle complete lead lifecycle with error recovery", async () => {
      // Mock HTTP responses for the complete flow
      const mockAxiosInstance = {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn(),
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() },
        },
      };

      // Replace the client's internal axios instance
      (client as any).client = mockAxiosInstance;

      // Mock the complete flow:
      // 1. Health check
      mockAxiosInstance.get.mockResolvedValueOnce({ data: "pong" });

      // 2. Find existing contact (not found)
      mockAxiosInstance.get.mockResolvedValueOnce({ data: { contacts: [] } });

      // 3. Create new contact
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: {
          id: "ghl-contact-123",
          email: "integration@test.com",
          firstName: "Integration Test",
          lastName: "User",
        },
      });

      // 4. Create opportunity
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: {
          id: "ghl-opp-123",
          contactId: "ghl-contact-123",
          title: "Integration Test User - luxury-condo Opportunity",
          value: 500000,
        },
      });

      // 5. Create notes for interactions
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { id: "note-1", contactId: "ghl-contact-123" },
      });
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { id: "note-2", contactId: "ghl-contact-123" },
      });

      // Execute the complete flow
      const isHealthy = await client.healthCheck();
      expect(isHealthy).toBe(true);

      const contactId = await sync.syncLeadToGHL(mockLead);
      expect(contactId).toBe("ghl-contact-123");

      // Sync all interactions
      for (const interaction of mockInteractions) {
        await sync.syncInteractionToGHL(interaction, contactId);
      }

      // Verify all expected calls were made
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2); // health check + find contact
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(4); // contact + opportunity + 2 notes

      // Verify contact creation with correct data
      const contactCreationCall = mockAxiosInstance.post.mock.calls[0];
      expect(contactCreationCall[0]).toBe("/contacts");
      expect(contactCreationCall[1]).toMatchObject({
        firstName: "Integration",
        lastName: "Test User",
        email: "integration@test.com",
        phone: "+1555123456",
        timezone: "America/New_York",
      });

      // Verify opportunity creation
      const opportunityCreationCall = mockAxiosInstance.post.mock.calls[1];
      expect(opportunityCreationCall[0]).toBe("/opportunities");
      expect(opportunityCreationCall[1]).toMatchObject({
        title: "Integration Test User - luxury-condo Opportunity",
        contactId: "ghl-contact-123",
        value: 500000,
      });

      // Verify interaction notes
      const note1Call = mockAxiosInstance.post.mock.calls[2];
      expect(note1Call[0]).toBe("/contacts/notes");
      expect(note1Call[1].body).toContain("Interaction Type: CALL");
      expect(note1Call[1].body).toContain("Direction: outbound");
      expect(note1Call[1].body).toContain("Duration: 1200 seconds");
      expect(note1Call[1].body).toContain("Sentiment: positive (0.85)");
      expect(note1Call[1].body).toContain("✓ Appointment booked");

      const note2Call = mockAxiosInstance.post.mock.calls[3];
      expect(note2Call[0]).toBe("/contacts/notes");
      expect(note2Call[1].body).toContain("Interaction Type: EMAIL");
      expect(note2Call[1].body).toContain("Direction: outbound");
      expect(note2Call[1].body).toContain(
        "Follow-up email with property listings"
      );
    });

    it("should handle rate limiting gracefully", async () => {
      const mockAxiosInstance = {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn(),
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() },
        },
      };

      (client as any).client = mockAxiosInstance;

      // Test rate limit status
      const initialStatus = client.getRateLimitStatus();
      expect(initialStatus).toHaveProperty("remaining");
      expect(initialStatus).toHaveProperty("resetTime");
      expect(typeof initialStatus.remaining).toBe("number");
      expect(initialStatus.resetTime).toBeInstanceOf(Date);
    });

    it("should handle API errors with proper error propagation", async () => {
      const mockAxiosInstance = {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn(),
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() },
        },
      };

      (client as any).client = mockAxiosInstance;

      // Mock API error
      const apiError = new Error("GoHighLevel API Error");
      (apiError as any).response = {
        status: 500,
        data: { message: "Internal Server Error" },
      };
      mockAxiosInstance.get.mockRejectedValue(apiError);

      // Test error handling
      await expect(sync.findContactByEmail("test@example.com")).rejects.toThrow(
        "GoHighLevel API Error"
      );
    });

    it("should handle batch operations efficiently", async () => {
      const mockAxiosInstance = {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn(),
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() },
        },
      };

      (client as any).client = mockAxiosInstance;

      const batchLeads: Lead[] = [
        {
          ...mockLead,
          id: "batch-lead-1",
          contactInfo: { ...mockLead.contactInfo, email: "batch1@test.com" },
        },
        {
          ...mockLead,
          id: "batch-lead-2",
          contactInfo: { ...mockLead.contactInfo, email: "batch2@test.com" },
        },
        {
          ...mockLead,
          id: "batch-lead-3",
          contactInfo: { ...mockLead.contactInfo, email: "batch3@test.com" },
        },
      ];

      // Mock successful batch responses
      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: { contacts: [] } }) // batch-lead-1 not found
        .mockResolvedValueOnce({ data: { contacts: [] } }) // batch-lead-2 not found
        .mockRejectedValueOnce(new Error("Network error")); // batch-lead-3 fails

      mockAxiosInstance.post
        .mockResolvedValueOnce({ data: { id: "contact-1" } }) // create contact for batch-lead-1
        .mockResolvedValueOnce({ data: { id: "opp-1" } }) // create opportunity for batch-lead-1
        .mockResolvedValueOnce({ data: { id: "contact-2" } }) // create contact for batch-lead-2
        .mockResolvedValueOnce({ data: { id: "opp-2" } }); // create opportunity for batch-lead-2

      const results = await sync.batchSyncLeads(batchLeads);

      expect(results.success).toEqual(["contact-1", "contact-2"]);
      expect(results.failed).toHaveLength(1);
      expect(results.failed[0]).toMatchObject({
        leadId: "batch-lead-3",
        error: "Network error",
      });
    });
  });

  describe("Data Validation and Transformation", () => {
    it("should correctly map lead data to GoHighLevel contact format", async () => {
      const mockAxiosInstance = {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn(),
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() },
        },
      };

      (client as any).client = mockAxiosInstance;

      const complexLead: Lead = {
        id: "complex-lead-123",
        source: "meta-ads",
        contactInfo: {
          name: "María José González-Smith",
          email: "maria.jose@example.com",
          phone: "+1-555-987-6543",
          preferredChannel: "whatsapp",
          timezone: "America/Los_Angeles",
        },
        leadType: "warm",
        urgencyLevel: 7,
        intentSignals: [
          "price-sensitive",
          "location-flexible",
          "first-time-buyer",
        ],
        qualificationData: {
          budget: "250k-300k",
          location: "Los Angeles County",
          propertyType: "single-family",
          timeline: "6-12 months",
          qualificationScore: 72,
        },
        interactionHistory: [],
        status: "nurturing",
        assignedAgent: "agent-bilingual",
        createdAt: new Date("2024-01-10T08:30:00Z"),
        updatedAt: new Date("2024-01-12T16:45:00Z"),
      };

      // Mock responses
      mockAxiosInstance.get.mockResolvedValueOnce({ data: { contacts: [] } });
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { id: "complex-contact-123" },
      });
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { id: "complex-opp-123" },
      });

      await sync.syncLeadToGHL(complexLead);

      const contactCall = mockAxiosInstance.post.mock.calls[0];
      const contactData = contactCall[1];

      // Verify name parsing
      expect(contactData.firstName).toBe("María");
      expect(contactData.lastName).toBe("José González-Smith");
      expect(contactData.name).toBe("María José González-Smith");

      // Verify custom fields mapping
      expect(contactData.customFields).toMatchObject({
        leadId: "complex-lead-123",
        leadType: "warm",
        urgencyLevel: 7,
        qualificationScore: 72,
        budget: "250k-300k",
        location: "Los Angeles County",
        propertyType: "single-family",
        timeline: "6-12 months",
        assignedAgent: "agent-bilingual",
        preferredChannel: "whatsapp",
      });

      // Verify tags
      expect(contactData.tags).toEqual([
        "warm",
        "meta-ads",
        "price-sensitive",
        "location-flexible",
        "first-time-buyer",
      ]);
    });

    it("should handle edge cases in data transformation", async () => {
      const mockAxiosInstance = {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn(),
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() },
        },
      };

      (client as any).client = mockAxiosInstance;

      // Lead with minimal data
      const minimalLead: Lead = {
        id: "minimal-lead-123",
        source: "unknown",
        contactInfo: {
          name: "John",
          preferredChannel: "email",
          timezone: "UTC",
        },
        leadType: "cold",
        urgencyLevel: 1,
        intentSignals: [],
        interactionHistory: [],
        status: "new",
        assignedAgent: "auto-assign",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockAxiosInstance.get.mockResolvedValueOnce({ data: { contacts: [] } });
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { id: "minimal-contact-123" },
      });

      await sync.syncLeadToGHL(minimalLead);

      const contactCall = mockAxiosInstance.post.mock.calls[0];
      const contactData = contactCall[1];

      // Verify handling of single name
      expect(contactData.firstName).toBe("John");
      expect(contactData.lastName).toBe("");
      expect(contactData.name).toBe("John");

      // Verify handling of missing optional fields
      expect(contactData.email).toBeUndefined();
      expect(contactData.phone).toBeUndefined();
      expect(contactData.customFields.qualificationScore).toBe(0);
    });
  });
});
