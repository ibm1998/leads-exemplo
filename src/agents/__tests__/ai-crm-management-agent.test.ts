import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import {
  AICRMManagementAgent,
  CRMSyncResult,
  DataQualityIssue,
} from '../ai-crm-management-agent';
import { DatabaseManager } from '../../database/manager';
import { GoHighLevelClient } from '../../integrations/gohighlevel/client';
import { Lead, LeadStatus } from '../../types/lead';
import {
  Interaction,
  InteractionType,
  InteractionDirection,
} from '../../types/interaction';

// Mock dependencies
vi.mock('../../database/manager');
vi.mock('../../integrations/gohighlevel/client');
vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('AICRMManagementAgent', () => {
  let agent: AICRMManagementAgent;
  let mockDbManager: DatabaseManager;
  let mockGhlClient: GoHighLevelClient;

  const mockLead: Lead = {
    id: 'lead-123',
    source: 'website',
    contactInfo: {
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+1234567890',
      preferredChannel: 'email',
      timezone: 'UTC',
    },
    leadType: 'warm',
    urgencyLevel: 5,
    intentSignals: ['interested', 'budget-confirmed'],
    qualificationData: {
      budget: { min: 100000, max: 200000 },
      location: 'New York',
      propertyType: 'apartment',
      timeline: '3-6 months',
      qualificationScore: 0.7,
    },
    status: 'qualified',
    assignedAgent: 'agent-456',
    createdAt: new Date('2024-01-01T10:00:00Z'),
    updatedAt: new Date('2024-01-01T10:00:00Z'),
  };

  const mockInteraction: Interaction = {
    id: 'interaction-789',
    leadId: 'lead-123',
    agentId: 'virtual-sales-assistant',
    type: 'call',
    direction: 'outbound',
    content: 'Initial qualification call completed successfully',
    outcome: {
      status: 'successful',
      appointmentBooked: true,
      qualificationUpdated: true,
      escalationRequired: false,
    },
    duration: 300,
    sentiment: {
      score: 0.8,
      confidence: 0.9,
    },
    timestamp: new Date('2024-01-01T11:00:00Z'),
  };

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock instances
    mockDbManager = new DatabaseManager();
    mockGhlClient = new GoHighLevelClient({ apiKey: 'test-key' });

    // Setup database manager mocks
    (mockDbManager.query as Mock) = vi.fn();

    // Create agent instance
    agent = new AICRMManagementAgent(mockDbManager, mockGhlClient, {
      syncTimeoutMs: 5000,
      maxRetries: 3,
      batchSize: 50,
      auditRetentionDays: 365,
      duplicateThreshold: 0.8,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('logInteraction', () => {
    it('should log interaction successfully within SLA', async () => {
      // Mock database operations
      (mockDbManager.query as Mock)
        .mockResolvedValueOnce({ rows: [] }) // Insert interaction
        .mockResolvedValueOnce({ rows: [mockDatabaseRow(mockLead)] }) // Get lead
        .mockResolvedValueOnce({ rows: [] }); // Insert audit log

      // Mock GoHighLevel sync
      const mockSyncLeadToGHL = vi.fn().mockResolvedValue('contact-123');
      const mockSyncInteractionToGHL = vi.fn().mockResolvedValue(undefined);

      // Replace the sync methods
      (agent as any).ghlSync = {
        syncLeadToGHL: mockSyncLeadToGHL,
        syncInteractionToGHL: mockSyncInteractionToGHL,
      };

      const result = await agent.logInteraction(mockInteraction);

      expect(result.success).toBe(true);
      expect(result.contactId).toBe('contact-123');
      expect(result.syncTime).toBeLessThan(5000);
      expect(mockDbManager.query).toHaveBeenCalledTimes(3);
      expect(mockSyncLeadToGHL).toHaveBeenCalledWith(mockLead);
      expect(mockSyncInteractionToGHL).toHaveBeenCalledWith(
        mockInteraction,
        'contact-123'
      );
    });

    it('should handle sync timeout gracefully', async () => {
      // Mock slow database operation
      (mockDbManager.query as Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 6000))
      );

      const result = await agent.logInteraction(mockInteraction);

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
      expect(result.syncTime).toBeGreaterThan(4900);
    });

    it('should queue for retry on failure within SLA', async () => {
      // Mock database failure
      (mockDbManager.query as Mock).mockRejectedValue(
        new Error('Database error')
      );

      const result = await agent.logInteraction(mockInteraction);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
      expect(result.syncTime).toBeLessThan(5000);
    });
  });

  describe('updateLeadStatus', () => {
    it('should update lead status successfully', async () => {
      // Create a valid lead with proper UUID
      const validLead = {
        ...mockLead,
        id: '550e8400-e29b-41d4-a716-446655440000', // Valid UUID
        status: 'qualified' as LeadStatus,
      };

      // Mock database operations
      (mockDbManager.query as Mock)
        .mockResolvedValueOnce({ rows: [mockDatabaseRow(validLead)] }) // Get current lead
        .mockResolvedValueOnce({ rows: [] }) // Update lead
        .mockResolvedValueOnce({ rows: [] }); // Insert audit log

      // Mock GoHighLevel sync
      const mockSyncLeadToGHL = vi.fn().mockResolvedValue('contact-123');
      (agent as any).ghlSync = {
        syncLeadToGHL: mockSyncLeadToGHL,
      };

      const result = await agent.updateLeadStatus(
        validLead.id,
        'appointment_scheduled',
        'agent-456',
        { reason: 'Customer confirmed appointment' }
      );

      expect(result.success).toBe(true);
      expect(result.contactId).toBe('contact-123');
      expect(mockDbManager.query).toHaveBeenCalledTimes(3);
      expect(mockSyncLeadToGHL).toHaveBeenCalled();
    });

    it('should reject invalid status transitions', async () => {
      // Create a lead with converted status
      const convertedLead = {
        ...mockLead,
        id: '550e8400-e29b-41d4-a716-446655440001', // Valid UUID
        status: 'converted' as LeadStatus,
      };

      // Mock database operations
      (mockDbManager.query as Mock).mockResolvedValueOnce({
        rows: [mockDatabaseRow(convertedLead)],
      });

      const result = await agent.updateLeadStatus(
        convertedLead.id,
        'new',
        'agent-456'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid status transition');
    });

    it('should handle non-existent lead', async () => {
      // Mock empty result
      (mockDbManager.query as Mock).mockResolvedValueOnce({ rows: [] });

      const result = await agent.updateLeadStatus(
        'non-existent-lead',
        'contacted',
        'agent-456'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('detectDuplicates', () => {
    it('should detect email duplicates', async () => {
      // Mock database queries for duplicate detection
      (mockDbManager.query as Mock)
        .mockResolvedValueOnce({
          rows: [
            { email: 'john@example.com', lead_ids: ['lead-1', 'lead-2'] },
            { email: 'jane@example.com', lead_ids: ['lead-3', 'lead-4'] },
          ],
        }) // Email duplicates
        .mockResolvedValueOnce({ rows: [] }) // Phone duplicates
        .mockResolvedValueOnce({ rows: [] }); // Name duplicates

      const issues = await agent.detectDuplicates();

      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe('duplicate');
      expect(issues[0].severity).toBe('high');
      expect(issues[0].affectedRecords).toEqual([
        'lead-1',
        'lead-2',
        'lead-3',
        'lead-4',
      ]);
      expect(issues[0].description).toContain('duplicate email addresses');
    });

    it('should detect phone duplicates', async () => {
      // Mock database queries
      (mockDbManager.query as Mock)
        .mockResolvedValueOnce({ rows: [] }) // Email duplicates
        .mockResolvedValueOnce({
          rows: [{ phone: '+1234567890', lead_ids: ['lead-1', 'lead-2'] }],
        }) // Phone duplicates
        .mockResolvedValueOnce({ rows: [] }); // Name duplicates

      const issues = await agent.detectDuplicates();

      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe('duplicate');
      expect(issues[0].severity).toBe('medium');
      expect(issues[0].affectedRecords).toEqual(['lead-1', 'lead-2']);
      expect(issues[0].description).toContain('duplicate phone numbers');
    });

    it('should detect name duplicates', async () => {
      // Mock database queries
      (mockDbManager.query as Mock)
        .mockResolvedValueOnce({ rows: [] }) // Email duplicates
        .mockResolvedValueOnce({ rows: [] }) // Phone duplicates
        .mockResolvedValueOnce({
          rows: [
            { normalized_name: 'john doe', lead_ids: ['lead-1', 'lead-2'] },
          ],
        }); // Name duplicates

      const issues = await agent.detectDuplicates();

      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe('duplicate');
      expect(issues[0].severity).toBe('low');
      expect(issues[0].affectedRecords).toEqual(['lead-1', 'lead-2']);
      expect(issues[0].description).toContain('similar names');
    });
  });

  describe('validateDataQuality', () => {
    it('should detect missing contact information', async () => {
      // Mock database queries
      (mockDbManager.query as Mock)
        .mockResolvedValueOnce({
          rows: [{ id: 'lead-1' }, { id: 'lead-2' }],
        }) // Missing contact info
        .mockResolvedValueOnce({ rows: [] }) // Invalid emails
        .mockResolvedValueOnce({ rows: [] }); // Data inconsistencies

      const issues = await agent.validateDataQuality();

      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe('missing_data');
      expect(issues[0].severity).toBe('high');
      expect(issues[0].affectedRecords).toEqual(['lead-1', 'lead-2']);
      expect(issues[0].description).toContain(
        'missing essential contact information'
      );
    });

    it('should detect invalid email formats', async () => {
      // Mock database queries
      (mockDbManager.query as Mock)
        .mockResolvedValueOnce({ rows: [] }) // Missing contact info
        .mockResolvedValueOnce({
          rows: [{ id: 'lead-1' }, { id: 'lead-2' }],
        }) // Invalid emails
        .mockResolvedValueOnce({ rows: [] }); // Data inconsistencies

      const issues = await agent.validateDataQuality();

      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe('validation');
      expect(issues[0].severity).toBe('medium');
      expect(issues[0].affectedRecords).toEqual(['lead-1', 'lead-2']);
      expect(issues[0].description).toContain('invalid email formats');
    });

    it('should detect data inconsistencies', async () => {
      // Mock database queries
      (mockDbManager.query as Mock)
        .mockResolvedValueOnce({ rows: [] }) // Missing contact info
        .mockResolvedValueOnce({ rows: [] }) // Invalid emails
        .mockResolvedValueOnce({
          rows: [{ id: 'lead-1' }],
        }); // Data inconsistencies

      const issues = await agent.validateDataQuality();

      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe('inconsistency');
      expect(issues[0].severity).toBe('medium');
      expect(issues[0].affectedRecords).toEqual(['lead-1']);
      expect(issues[0].description).toContain('data inconsistencies');
    });
  });

  describe('createAuditLog', () => {
    it('should create audit log entry successfully', async () => {
      (mockDbManager.query as Mock).mockResolvedValueOnce({ rows: [] });

      await agent.createAuditLog({
        entityType: 'lead',
        entityId: 'lead-123',
        action: 'update',
        changes: { status: { old: 'new', new: 'contacted' } },
        agentId: 'test-agent',
        timestamp: new Date(),
        metadata: { test: 'data' },
      });

      expect(mockDbManager.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        expect.arrayContaining([
          expect.any(String), // id
          'lead',
          'lead-123',
          'update',
          expect.stringContaining('status'),
          undefined, // user_id
          'test-agent',
          expect.any(Date),
          expect.stringContaining('test'),
        ])
      );
    });

    it('should handle audit log creation errors gracefully', async () => {
      (mockDbManager.query as Mock).mockRejectedValue(
        new Error('Database error')
      );

      // Should not throw error
      await expect(
        agent.createAuditLog({
          entityType: 'lead',
          entityId: 'lead-123',
          action: 'update',
          changes: { status: { old: 'new', new: 'contacted' } },
          agentId: 'test-agent',
          timestamp: new Date(),
        })
      ).resolves.toBeUndefined();
    });
  });

  describe('syncAllPendingData', () => {
    it('should sync all pending leads and interactions', async () => {
      // Mock database queries for pending data
      (mockDbManager.query as Mock)
        .mockResolvedValueOnce({
          rows: [mockDatabaseRow(mockLead)],
        }) // Pending leads
        .mockResolvedValueOnce({
          rows: [mockDatabaseRowInteraction(mockInteraction)],
        }); // Pending interactions

      // Mock batch sync methods
      const mockBatchSyncLeads = vi.fn().mockResolvedValue({
        success: ['contact-1'],
        failed: [],
      });
      const mockBatchSyncInteractions = vi.fn().mockResolvedValue({
        success: 1,
        failed: [],
      });

      (agent as any).ghlSync = {
        batchSyncLeads: mockBatchSyncLeads,
        batchSyncInteractions: mockBatchSyncInteractions,
      };

      const result = await agent.syncAllPendingData();

      expect(result.leads.success).toBe(1);
      expect(result.leads.failed).toBe(0);
      expect(result.interactions.success).toBe(1);
      expect(result.interactions.failed).toBe(0);
      expect(mockBatchSyncLeads).toHaveBeenCalledWith([mockLead]);
      expect(mockBatchSyncInteractions).toHaveBeenCalled();
    });
  });

  // Helper functions to create mock database rows
  function mockDatabaseRow(lead: Lead): any {
    return {
      id: lead.id,
      source: lead.source,
      name: lead.contactInfo.name,
      email: lead.contactInfo.email,
      phone: lead.contactInfo.phone,
      preferred_channel: lead.contactInfo.preferredChannel,
      timezone: lead.contactInfo.timezone,
      lead_type: lead.leadType,
      urgency_level: lead.urgencyLevel,
      intent_signals: lead.intentSignals,
      budget_min: lead.qualificationData.budget?.min,
      budget_max: lead.qualificationData.budget?.max,
      location: lead.qualificationData.location,
      property_type: lead.qualificationData.propertyType,
      timeline: lead.qualificationData.timeline,
      qualification_score: lead.qualificationData.qualificationScore,
      status: lead.status,
      assigned_agent: lead.assignedAgent,
      created_at: lead.createdAt,
      updated_at: lead.updatedAt,
    };
  }

  function mockDatabaseRowInteraction(interaction: Interaction): any {
    return {
      id: interaction.id,
      lead_id: interaction.leadId,
      agent_id: interaction.agentId,
      type: interaction.type,
      direction: interaction.direction,
      content: interaction.content,
      outcome_status: interaction.outcome.status,
      appointment_booked: interaction.outcome.appointmentBooked,
      qualification_updated: interaction.outcome.qualificationUpdated,
      escalation_required: interaction.outcome.escalationRequired,
      duration_seconds: interaction.duration,
      sentiment_score: interaction.sentiment?.score,
      next_action: interaction.nextAction?.action,
      next_action_scheduled_at: interaction.nextAction?.scheduledAt,
      created_at: interaction.timestamp,
    };
  }
});
