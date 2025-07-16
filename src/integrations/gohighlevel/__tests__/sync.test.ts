import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { GoHighLevelSync } from "../sync";
import { GoHighLevelClient } from "../client";
import { Lead } from "../../../types/lead";
import { Interaction } from "../../../types/interaction";

// Mock the client
vi.mock("../client");

describe("GoHighLevelSync", () => {
  let sync: GoHighLevelSync;
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
      healthCheck: vi.fn(),
      getRateLimitStatus: vi.fn(),
    } as any;

    sync = new GoHighLevelSync(mockClient);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("syncLeadToGHL", () => {
    const mockLead: Lead = {
      id: "lead-123",
      source: "website",
      contactInfo: {
        name: "John Doe",
        email: "john@example.com",
        phone: "+1234567890",
        preferredChannel: "email",
        timezone: "America/New_York",
      },
      leadType: "hot",
      urgencyLevel: 8,
      intentSignals: ["ready-to-buy", "budget-confirmed"],
      qualificationData: {
        budget: { min: 250000, max: 350000 },
        location: "New York",
        propertyType: "condo",
        timeline: "3 months",
        qualificationScore: 0.85,
      },
      status: "new",
      assignedAgent: "agent-1",
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01"),
    };

    it("should create new contact when contact does not exist", async () => {
      // Mock finding no existing contact
      mockClient.get.mockResolvedValueOnce({ data: { contacts: [] } });

      // Mock creating new contact
      mockClient.post.mockResolvedValueOnce({
        data: { id: "contact-123", email: "john@example.com" },
      });

      // Mock creating opportunity
      mockClient.post.mockResolvedValueOnce({
        data: { id: "opp-123", contactId: "contact-123" },
      });

      const result = await sync.syncLeadToGHL(mockLead);

      expect(result).toBe("contact-123");
      expect(mockClient.get).toHaveBeenCalledWith("/contacts", {
        params: { email: "john@example.com" },
      });
      expect(mockClient.post).toHaveBeenCalledWith(
        "/contacts",
        expect.objectContaining({
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
          phone: "+1234567890",
        })
      );
    });

    it("should update existing contact when contact exists", async () => {
      const existingContact = { id: "contact-456", email: "john@example.com" };

      // Mock finding existing contact
      mockClient.get.mockResolvedValueOnce({
        data: { contacts: [existingContact] },
      });

      // Mock updating contact
      mockClient.put.mockResolvedValueOnce({ data: existingContact });

      // Mock creating opportunity
      mockClient.post.mockResolvedValueOnce({
        data: { id: "opp-123", contactId: "contact-456" },
      });

      const result = await sync.syncLeadToGHL(mockLead);

      expect(result).toBe("contact-456");
      expect(mockClient.put).toHaveBeenCalledWith(
        "/contacts/contact-456",
        expect.objectContaining({
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
        })
      );
    });

    it("should handle leads without qualification data", async () => {
      const leadWithoutQualification: Lead = {
        ...mockLead,
        qualificationData: {
          qualificationScore: 0,
        },
      };

      mockClient.get.mockResolvedValueOnce({ data: { contacts: [] } });
      mockClient.post.mockResolvedValueOnce({
        data: { id: "contact-123", email: "john@example.com" },
      });

      const result = await sync.syncLeadToGHL(leadWithoutQualification);

      expect(result).toBe("contact-123");
      // Should not create opportunity for unqualified leads
      expect(mockClient.post).toHaveBeenCalledTimes(1); // Only contact creation
    });

    it("should throw error when sync fails", async () => {
      mockClient.get.mockRejectedValue(new Error("API Error"));

      await expect(sync.syncLeadToGHL(mockLead)).rejects.toThrow("API Error");
    });
  });

  describe("syncInteractionToGHL", () => {
    const mockInteraction: Interaction = {
      id: "interaction-123",
      leadId: "lead-123",
      agentId: "agent-1",
      type: "call",
      direction: "outbound",
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
        scheduledAt: new Date("2024-01-02"),
        description: "Follow up on property viewing",
      },
      timestamp: new Date("2024-01-01T10:00:00Z"),
    };

    it("should create note for interaction", async () => {
      mockClient.post.mockResolvedValueOnce({
        data: { id: "note-123", contactId: "contact-123" },
      });

      await sync.syncInteractionToGHL(mockInteraction, "contact-123");

      expect(mockClient.post).toHaveBeenCalledWith(
        "/contacts/notes",
        expect.objectContaining({
          contactId: "contact-123",
          body: expect.stringContaining("Interaction Type: CALL"),
          dateAdded: "2024-01-01T10:00:00.000Z",
        })
      );
    });

    it("should format interaction note correctly", async () => {
      mockClient.post.mockResolvedValueOnce({
        data: { id: "note-123", contactId: "contact-123" },
      });

      await sync.syncInteractionToGHL(mockInteraction, "contact-123");

      const noteCall = mockClient.post.mock.calls[0];
      const noteBody = noteCall[1].body;

      expect(noteBody).toContain("Interaction Type: CALL");
      expect(noteBody).toContain("Direction: outbound");
      expect(noteBody).toContain("Agent: agent-1");
      expect(noteBody).toContain("Duration: 300 seconds");
      expect(noteBody).toContain("Sentiment: positive (0.8)");
      expect(noteBody).toContain("✓ Appointment booked");
      expect(noteBody).toContain("Content:");
      expect(noteBody).toContain("Called to discuss property requirements");
    });

    it("should throw error when note creation fails", async () => {
      mockClient.post.mockRejectedValue(new Error("Note creation failed"));

      await expect(
        sync.syncInteractionToGHL(mockInteraction, "contact-123")
      ).rejects.toThrow("Note creation failed");
    });
  });

  describe("findContactByEmail", () => {
    it("should return contact when found", async () => {
      const mockContact = { id: "contact-123", email: "test@example.com" };
      mockClient.get.mockResolvedValueOnce({
        data: { contacts: [mockContact] },
      });

      const result = await sync.findContactByEmail("test@example.com");

      expect(result).toEqual(mockContact);
      expect(mockClient.get).toHaveBeenCalledWith("/contacts", {
        params: { email: "test@example.com" },
      });
    });

    it("should return null when contact not found", async () => {
      mockClient.get.mockResolvedValueOnce({ data: { contacts: [] } });

      const result = await sync.findContactByEmail("notfound@example.com");

      expect(result).toBeNull();
    });

    it("should return null when email is undefined", async () => {
      const result = await sync.findContactByEmail(undefined);

      expect(result).toBeNull();
      expect(mockClient.get).not.toHaveBeenCalled();
    });

    it("should return null on 404 error", async () => {
      const error = new Error("Not found");
      (error as any).response = { status: 404 };
      mockClient.get.mockRejectedValue(error);

      const result = await sync.findContactByEmail("test@example.com");

      expect(result).toBeNull();
    });

    it("should throw error on non-404 errors", async () => {
      const error = new Error("Server error");
      (error as any).response = { status: 500 };
      mockClient.get.mockRejectedValue(error);

      await expect(sync.findContactByEmail("test@example.com")).rejects.toThrow(
        "Server error"
      );
    });
  });

  describe("batchSyncLeads", () => {
    const mockLeads: Lead[] = [
      {
        id: "lead-1",
        source: "website",
        contactInfo: {
          name: "John Doe",
          email: "john@example.com",
          preferredChannel: "email",
          timezone: "UTC",
        },
        leadType: "hot",
        urgencyLevel: 8,
        intentSignals: [],
        qualificationData: {
          qualificationScore: 0.8,
        },
        status: "new",
        assignedAgent: "agent-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "lead-2",
        source: "third_party",
        contactInfo: {
          name: "Jane Smith",
          email: "jane@example.com",
          preferredChannel: "sms",
          timezone: "UTC",
        },
        leadType: "warm",
        urgencyLevel: 6,
        intentSignals: [],
        qualificationData: {
          qualificationScore: 0.6,
        },
        status: "new",
        assignedAgent: "agent-2",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    it("should sync multiple leads successfully", async () => {
      // Mock successful syncs
      mockClient.get
        .mockResolvedValueOnce({ data: { contacts: [] } }) // lead-1 not found
        .mockResolvedValueOnce({ data: { contacts: [] } }); // lead-2 not found

      mockClient.post
        .mockResolvedValueOnce({ data: { id: "contact-1" } }) // create contact for lead-1
        .mockResolvedValueOnce({ data: { id: "opp-1" } }) // create opportunity for lead-1
        .mockResolvedValueOnce({ data: { id: "contact-2" } }) // create contact for lead-2
        .mockResolvedValueOnce({ data: { id: "opp-2" } }); // create opportunity for lead-2

      const result = await sync.batchSyncLeads(mockLeads);

      expect(result.success).toEqual(["contact-1", "contact-2"]);
      expect(result.failed).toEqual([]);
    });

    it("should handle partial failures", async () => {
      // Mock first lead success, second lead failure
      mockClient.get
        .mockResolvedValueOnce({ data: { contacts: [] } }) // lead-1 not found
        .mockRejectedValueOnce(new Error("API Error")); // lead-2 fails

      mockClient.post
        .mockResolvedValueOnce({ data: { id: "contact-1" } }) // create contact for lead-1
        .mockResolvedValueOnce({ data: { id: "opp-1" } }); // create opportunity for lead-1

      const result = await sync.batchSyncLeads(mockLeads);

      expect(result.success).toEqual(["contact-1"]);
      expect(result.failed).toEqual([
        {
          leadId: "lead-2",
          error: "API Error",
        },
      ]);
    });
  });
});
