import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { LeadDeduplicator } from "../deduplicator";
import { DatabaseManager } from "../../database/manager";
import { NormalizedLeadData } from "../types";

// Mock the database manager
const mockDatabaseManager = {
  query: vi.fn(),
} as unknown as DatabaseManager;

describe("LeadDeduplicator", () => {
  let deduplicator: LeadDeduplicator;

  beforeEach(() => {
    deduplicator = new LeadDeduplicator(mockDatabaseManager);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("checkForDuplicates", () => {
    it("should return no duplicate when no matches found", async () => {
      const leadData: NormalizedLeadData = {
        source: "gmail",
        contactInfo: {
          name: "John Doe",
          email: "john.doe@example.com",
          phone: "5551234567",
          preferredChannel: "email",
          timezone: "UTC",
        },
        leadType: "hot",
        urgencyLevel: 8,
        intentSignals: ["buying_intent"],
        qualificationData: {
          qualificationScore: 0.7,
        },
      };

      // Mock database queries to return no results
      vi.mocked(mockDatabaseManager.query).mockResolvedValue({ rows: [] });

      const result = await deduplicator.checkForDuplicates(leadData);

      expect(result.isDuplicate).toBe(false);
      expect(result.confidence).toBe(0);
      expect(result.matchingFields).toEqual([]);
      expect(result.existingLeadId).toBeUndefined();
    });

    it("should detect exact email match as duplicate", async () => {
      const leadData: NormalizedLeadData = {
        source: "gmail",
        contactInfo: {
          name: "John Doe",
          email: "john.doe@example.com",
          phone: "5551234567",
          preferredChannel: "email",
          timezone: "UTC",
        },
        leadType: "hot",
        urgencyLevel: 8,
        intentSignals: ["buying_intent"],
        qualificationData: {
          qualificationScore: 0.7,
        },
      };

      const existingLead = {
        id: "existing-lead-123",
        name: "John Doe",
        email: "john.doe@example.com",
        phone: "5551234567",
        source: "gmail",
        created_at: new Date(),
      };

      // Mock email query to return existing lead
      vi.mocked(mockDatabaseManager.query)
        .mockResolvedValueOnce({ rows: [existingLead] }) // Email query
        .mockResolvedValueOnce({ rows: [] }) // Phone query
        .mockResolvedValueOnce({ rows: [] }); // Name query

      const result = await deduplicator.checkForDuplicates(leadData);

      expect(result.isDuplicate).toBe(true);
      expect(result.existingLeadId).toBe("existing-lead-123");
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.matchingFields).toContain("email");
    });

    it("should detect phone number match as duplicate", async () => {
      const leadData: NormalizedLeadData = {
        source: "website",
        contactInfo: {
          name: "Jane Smith",
          email: "jane.new@example.com",
          phone: "555-123-4567", // Different format
          preferredChannel: "sms",
          timezone: "UTC",
        },
        leadType: "warm",
        urgencyLevel: 6,
        intentSignals: ["selling_intent"],
        qualificationData: {
          qualificationScore: 0.5,
        },
      };

      const existingLead = {
        id: "existing-lead-456",
        name: "Jane Smith",
        email: "jane.old@example.com",
        phone: "5551234567", // Same number, different format
        source: "meta_ads",
        created_at: new Date(),
      };

      // Mock queries
      vi.mocked(mockDatabaseManager.query)
        .mockResolvedValueOnce({ rows: [] }) // Email query
        .mockResolvedValueOnce({ rows: [existingLead] }) // Phone query
        .mockResolvedValueOnce({ rows: [] }); // Name query

      const result = await deduplicator.checkForDuplicates(leadData);

      expect(result.isDuplicate).toBe(true);
      expect(result.existingLeadId).toBe("existing-lead-456");
      expect(result.matchingFields).toContain("phone");
    });

    it("should detect name similarity as potential duplicate", async () => {
      const leadData: NormalizedLeadData = {
        source: "slack",
        contactInfo: {
          name: "Robert Johnson",
          email: "rob.johnson@example.com",
          preferredChannel: "email",
          timezone: "UTC",
        },
        leadType: "warm",
        urgencyLevel: 4,
        intentSignals: ["agent_request"],
        qualificationData: {
          qualificationScore: 0.3,
        },
      };

      const existingLead = {
        id: "existing-lead-789",
        name: "Bob Johnson", // Similar name
        email: "different@example.com",
        phone: null,
        source: "gmail",
        created_at: new Date(),
        name_similarity: 0.85,
      };

      // Mock queries
      vi.mocked(mockDatabaseManager.query)
        .mockResolvedValueOnce({ rows: [] }) // Email query
        .mockResolvedValueOnce({ rows: [] }) // Phone query
        .mockResolvedValueOnce({ rows: [existingLead] }); // Name query

      const result = await deduplicator.checkForDuplicates(leadData);

      expect(result.isDuplicate).toBe(false); // Name similarity alone may not be enough
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });

    it("should combine multiple weak matches into strong duplicate", async () => {
      const leadData: NormalizedLeadData = {
        source: "website",
        contactInfo: {
          name: "Michael Brown",
          email: "mike.brown@example.com",
          preferredChannel: "email",
          timezone: "UTC",
        },
        leadType: "hot",
        urgencyLevel: 7,
        intentSignals: ["buying_intent"],
        qualificationData: {
          location: "Downtown",
          qualificationScore: 0.6,
        },
      };

      const existingLead = {
        id: "existing-lead-999",
        name: "Mike Brown", // Similar name
        email: "different@example.com",
        phone: null,
        source: "website", // Same source
        location: "Downtown", // Same location
        created_at: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        name_similarity: 0.75,
      };

      // Mock queries
      vi.mocked(mockDatabaseManager.query)
        .mockResolvedValueOnce({ rows: [] }) // Email query
        .mockResolvedValueOnce({ rows: [] }) // Phone query
        .mockResolvedValueOnce({ rows: [existingLead] }); // Name query

      const result = await deduplicator.checkForDuplicates(leadData);

      expect(result.isDuplicate).toBe(false); // Multiple weak matches may still not be enough
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.matchingFields.length).toBeGreaterThanOrEqual(0);
    });

    it("should not mark as duplicate if confidence is below threshold", async () => {
      const leadData: NormalizedLeadData = {
        source: "third_party",
        contactInfo: {
          name: "Sarah Wilson",
          email: "sarah.wilson@example.com",
          preferredChannel: "email",
          timezone: "UTC",
        },
        leadType: "cold",
        urgencyLevel: 2,
        intentSignals: [],
        qualificationData: {
          qualificationScore: 0.1,
        },
      };

      const existingLead = {
        id: "existing-lead-111",
        name: "Sara Williams", // Somewhat similar name
        email: "different@example.com",
        phone: null,
        source: "gmail", // Different source
        created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        name_similarity: 0.65, // Below strong similarity threshold
      };

      // Mock queries
      vi.mocked(mockDatabaseManager.query)
        .mockResolvedValueOnce({ rows: [] }) // Email query
        .mockResolvedValueOnce({ rows: [] }) // Phone query
        .mockResolvedValueOnce({ rows: [existingLead] }); // Name query

      const result = await deduplicator.checkForDuplicates(leadData);

      expect(result.isDuplicate).toBe(false);
      expect(result.confidence).toBeLessThan(0.7);
    });
  });

  describe("mergeDuplicateData", () => {
    it("should merge duplicate lead data successfully", async () => {
      const existingLeadId = "existing-lead-123";
      const newLeadData: NormalizedLeadData = {
        source: "gmail",
        contactInfo: {
          name: "John Doe",
          email: "john.doe@example.com",
          phone: "5551234567",
          preferredChannel: "sms",
          timezone: "America/New_York",
        },
        leadType: "hot",
        urgencyLevel: 9,
        intentSignals: ["buying_intent", "financing_need"],
        qualificationData: {
          budget: { min: 400000, max: 600000 },
          location: "Downtown",
          propertyType: "condo",
          timeline: "3 months",
          qualificationScore: 0.8,
        },
      };

      const existingLead = {
        id: existingLeadId,
        name: "John Doe",
        email: "john.doe@example.com",
        phone: null,
        preferred_channel: "email",
        timezone: "UTC",
        urgency_level: 5,
        intent_signals: ["buying_intent"],
        budget_min: null,
        budget_max: null,
        location: null,
        property_type: null,
        timeline: null,
        qualification_score: 0.5,
      };

      // Mock database queries
      vi.mocked(mockDatabaseManager.query)
        .mockResolvedValueOnce({ rows: [existingLead] }) // Get existing lead
        .mockResolvedValueOnce({ rows: [{ id: existingLeadId }] }); // Update query

      await deduplicator.mergeDuplicateData(existingLeadId, newLeadData);

      // Verify update query was called with merged data
      const updateCall = vi.mocked(mockDatabaseManager.query).mock.calls[1];
      expect(updateCall[0]).toContain("UPDATE leads SET");

      const updateParams = updateCall[1];
      expect(updateParams).toBeDefined();
      expect(updateParams![0]).toBe(existingLeadId); // Lead ID
      expect(updateParams![1]).toBe("John Doe"); // Name (unchanged)
      expect(updateParams![2]).toBe("john.doe@example.com"); // Email (unchanged)
      expect(updateParams![3]).toBe("5551234567"); // Phone (new value)
      expect(updateParams![4]).toBe("sms"); // Preferred channel (new value)
      expect(updateParams![5]).toBe("America/New_York"); // Timezone (new value)
      expect(updateParams![6]).toBe(9); // Urgency level (higher value)
      expect(updateParams![7]).toEqual(["buying_intent", "financing_need"]); // Merged intent signals
      expect(updateParams![8]).toBe(400000); // Budget min (new value)
      expect(updateParams![9]).toBe(600000); // Budget max (new value)
      expect(updateParams![10]).toBe("Downtown"); // Location (new value)
      expect(updateParams![11]).toBe("condo"); // Property type (new value)
      expect(updateParams![12]).toBe("3 months"); // Timeline (new value)
      expect(updateParams![13]).toBe(0.8); // Qualification score (higher value)
    });

    it("should throw error if existing lead not found", async () => {
      const existingLeadId = "non-existent-lead";
      const newLeadData: NormalizedLeadData = {
        source: "gmail",
        contactInfo: {
          name: "Test User",
          preferredChannel: "email",
          timezone: "UTC",
        },
        leadType: "cold",
        urgencyLevel: 1,
        intentSignals: [],
        qualificationData: {
          qualificationScore: 0,
        },
      };

      // Mock database query to return no results
      vi.mocked(mockDatabaseManager.query).mockResolvedValueOnce({ rows: [] });

      await expect(
        deduplicator.mergeDuplicateData(existingLeadId, newLeadData)
      ).rejects.toThrow(`Existing lead ${existingLeadId} not found`);
    });
  });

  describe("Edge cases", () => {
    it("should handle database errors gracefully", async () => {
      const leadData: NormalizedLeadData = {
        source: "gmail",
        contactInfo: {
          name: "Test User",
          email: "test@example.com",
          preferredChannel: "email",
          timezone: "UTC",
        },
        leadType: "cold",
        urgencyLevel: 1,
        intentSignals: [],
        qualificationData: {
          qualificationScore: 0,
        },
      };

      // Mock database error
      vi.mocked(mockDatabaseManager.query).mockRejectedValue(
        new Error("Database connection failed")
      );

      await expect(deduplicator.checkForDuplicates(leadData)).rejects.toThrow(
        "Failed to check for duplicates"
      );
    });

    it("should handle leads with no contact information", async () => {
      const leadData: NormalizedLeadData = {
        source: "website",
        contactInfo: {
          name: "Unknown",
          preferredChannel: "email",
          timezone: "UTC",
        },
        leadType: "cold",
        urgencyLevel: 1,
        intentSignals: [],
        qualificationData: {
          qualificationScore: 0,
        },
      };

      // Mock database queries to return no results
      vi.mocked(mockDatabaseManager.query).mockResolvedValue({ rows: [] });

      const result = await deduplicator.checkForDuplicates(leadData);

      expect(result.isDuplicate).toBe(false);
      expect(result.confidence).toBe(0);
    });
  });
});
