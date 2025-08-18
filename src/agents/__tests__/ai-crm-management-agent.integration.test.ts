import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from 'vitest';
import { AICRMManagementAgent } from '../ai-crm-management-agent';
import { DatabaseManager } from '../../database/manager';
import { GoHighLevelClient } from '../../integrations/gohighlevel/client';
import { Lead, LeadModel } from '../../types/lead';
import { Interaction, InteractionModel } from '../../types/interaction';
import { config } from '../../config/environment';

// Integration tests require actual database and GHL API access
// These tests should be run in a test environment with proper setup
describe('AICRMManagementAgent Integration Tests', () => {
  let agent: AICRMManagementAgent;
  let dbManager: DatabaseManager;
  let ghlClient: GoHighLevelClient;
  let testLeadId: string;
  let testInteractionId: string;

  const testLead: Lead = {
    id: 'test-lead-integration-001',
    source: 'website',
    contactInfo: {
      name: 'Integration Test User',
      email: 'integration.test@example.com',
      phone: '+1555123456',
      preferredChannel: 'email',
      timezone: 'UTC',
    },
    leadType: 'warm',
    urgencyLevel: 6,
    intentSignals: ['integration-test', 'automated-test'],
    qualificationData: {
      budget: { min: 150000, max: 250000 },
      location: 'Test City',
      propertyType: 'condo',
      timeline: '6-12 months',
      qualificationScore: 0.75,
    },
    status: 'new',
    assignedAgent: 'integration-test-agent',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const testInteraction: Interaction = {
    id: 'test-interaction-integration-001',
    leadId: 'test-lead-integration-001',
    agentId: 'integration-test-agent',
    type: 'email',
    direction: 'outbound',
    content: 'Integration test interaction - automated test message',
    outcome: {
      status: 'successful',
      appointmentBooked: false,
      qualificationUpdated: true,
      escalationRequired: false,
    },
    duration: 120,
    sentiment: {
      score: 0.6,
      confidence: 0.85,
    },
    timestamp: new Date(),
  };

  beforeAll(async () => {
    // Skip integration tests if not in test environment
    if (!config.DATABASE_URL || !config.GHL_API_KEY) {
      console.log(
        'Skipping integration tests - missing test environment configuration'
      );
      return;
    }

    // Initialize database manager
    dbManager = new DatabaseManager();
    await dbManager.initialize();

    // Initialize GoHighLevel client with test API key
    ghlClient = new GoHighLevelClient({
      apiKey: config.GHL_API_KEY,
      baseUrl: config.GHL_BASE_URL || 'https://rest.gohighlevel.com/v1',
    });

    // Create CRM management agent
    agent = new AICRMManagementAgent(dbManager, ghlClient, {
      syncTimeoutMs: 10000, // Longer timeout for integration tests
      maxRetries: 2,
      batchSize: 10,
      auditRetentionDays: 30,
      duplicateThreshold: 0.8,
    });
  });

  afterAll(async () => {
    if (dbManager) {
      await dbManager.close();
    }
  });

  beforeEach(async () => {
    if (!agent) return;

    // Clean up any existing test data
    await cleanupTestData();
  });

  afterEach(async () => {
    if (!agent) return;

    // Clean up test data after each test
    await cleanupTestData();
  });

  describe('Real-time Interaction Logging', () => {
    it('should log interaction within 5-second SLA', async () => {
      if (!agent) return;

      // First create the lead in database
      await createTestLeadInDatabase();

      const startTime = Date.now();
      const result = await agent.logInteraction(testInteraction);
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(result.syncTime).toBeLessThan(5000);
      expect(endTime - startTime).toBeLessThan(5000);
      expect(result.contactId).toBeDefined();

      // Verify interaction was stored in database
      const storedInteraction = await getInteractionFromDatabase(
        testInteraction.id
      );
      expect(storedInteraction).toBeDefined();
      expect(storedInteraction.content).toBe(testInteraction.content);

      // Verify audit log was created
      const auditLogs = await getAuditLogsForEntity(
        'interaction',
        testInteraction.id
      );
      expect(auditLogs.length).toBeGreaterThan(0);
      expect(auditLogs[0].action).toBe('create');
    });

    it('should handle high-volume interaction logging', async () => {
      if (!agent) return;

      await createTestLeadInDatabase();

      const interactions: Interaction[] = [];
      for (let i = 0; i < 10; i++) {
        interactions.push({
          ...testInteraction,
          id: `test-interaction-${i}`,
          content: `Bulk test interaction ${i}`,
          timestamp: new Date(Date.now() + i * 1000),
        });
      }

      const results = await Promise.all(
        interactions.map((interaction) => agent.logInteraction(interaction))
      );

      // All interactions should succeed
      expect(results.every((r) => r.success)).toBe(true);

      // All should be within SLA
      expect(results.every((r) => r.syncTime < 5000)).toBe(true);

      // Verify all interactions were stored
      for (const interaction of interactions) {
        const stored = await getInteractionFromDatabase(interaction.id);
        expect(stored).toBeDefined();
      }
    });
  });

  describe('Lead Status Management', () => {
    it('should update lead status and sync to GoHighLevel', async () => {
      if (!agent) return;

      await createTestLeadInDatabase();

      const result = await agent.updateLeadStatus(
        testLead.id,
        'contacted',
        'integration-test-agent',
        { reason: 'Integration test status update' }
      );

      expect(result.success).toBe(true);
      expect(result.contactId).toBeDefined();

      // Verify lead status was updated in database
      const updatedLead = await getLeadFromDatabase(testLead.id);
      expect(updatedLead).toBeDefined();
      expect(updatedLead.status).toBe('contacted');

      // Verify audit log was created
      const auditLogs = await getAuditLogsForEntity('lead', testLead.id);
      expect(auditLogs.length).toBeGreaterThan(0);
      expect(auditLogs[0].action).toBe('update');
      expect(auditLogs[0].changes.status.old).toBe('new');
      expect(auditLogs[0].changes.status.new).toBe('contacted');
    });

    it('should handle pipeline progression correctly', async () => {
      if (!agent) return;

      await createTestLeadInDatabase();

      // Progress through valid status transitions
      const statusProgression: Array<{ status: any; agent: string }> = [
        { status: 'contacted', agent: 'agent-1' },
        { status: 'qualified', agent: 'agent-2' },
        { status: 'appointment_scheduled', agent: 'agent-3' },
        { status: 'in_progress', agent: 'agent-4' },
        { status: 'converted', agent: 'agent-5' },
      ];

      for (const { status, agent: agentId } of statusProgression) {
        const result = await agent.updateLeadStatus(
          testLead.id,
          status,
          agentId
        );
        expect(result.success).toBe(true);

        const updatedLead = await getLeadFromDatabase(testLead.id);
        expect(updatedLead.status).toBe(status);
      }

      // Verify all status changes were audited
      const auditLogs = await getAuditLogsForEntity('lead', testLead.id);
      expect(auditLogs.length).toBe(statusProgression.length);
    });
  });

  describe('Data Quality Management', () => {
    it('should detect duplicate leads', async () => {
      if (!agent) return;

      // Create multiple leads with same email
      const duplicateLeads = [
        {
          ...testLead,
          id: 'dup-lead-1',
          contactInfo: { ...testLead.contactInfo, name: 'Duplicate One' },
        },
        {
          ...testLead,
          id: 'dup-lead-2',
          contactInfo: { ...testLead.contactInfo, name: 'Duplicate Two' },
        },
        {
          ...testLead,
          id: 'dup-lead-3',
          contactInfo: { ...testLead.contactInfo, name: 'Duplicate Three' },
        },
      ];

      for (const lead of duplicateLeads) {
        await createLeadInDatabase(lead);
      }

      const issues = await agent.detectDuplicates();

      expect(issues.length).toBeGreaterThan(0);
      const emailDuplicateIssue = issues.find(
        (issue) =>
          issue.type === 'duplicate' && issue.description.includes('email')
      );
      expect(emailDuplicateIssue).toBeDefined();
      expect(emailDuplicateIssue!.affectedRecords.length).toBe(3);
    });

    it('should validate data quality comprehensively', async () => {
      if (!agent) return;

      // Create leads with various data quality issues
      const problematicLeads = [
        {
          ...testLead,
          id: 'missing-contact-lead',
          contactInfo: {
            ...testLead.contactInfo,
            email: undefined,
            phone: undefined,
          },
        },
        {
          ...testLead,
          id: 'invalid-email-lead',
          contactInfo: {
            ...testLead.contactInfo,
            email: 'invalid-email-format',
          },
        },
        {
          ...testLead,
          id: 'inconsistent-data-lead',
          qualificationData: {
            ...testLead.qualificationData,
            qualificationScore: 0.8,
            budget: undefined,
            location: undefined,
          },
        },
      ];

      for (const lead of problematicLeads) {
        await createLeadInDatabase(lead);
      }

      const issues = await agent.validateDataQuality();

      expect(issues.length).toBeGreaterThan(0);

      // Should detect missing contact info
      const missingContactIssue = issues.find(
        (issue) => issue.type === 'missing_data'
      );
      expect(missingContactIssue).toBeDefined();

      // Should detect invalid email
      const invalidEmailIssue = issues.find(
        (issue) => issue.type === 'validation'
      );
      expect(invalidEmailIssue).toBeDefined();

      // Should detect data inconsistencies
      const inconsistencyIssue = issues.find(
        (issue) => issue.type === 'inconsistency'
      );
      expect(inconsistencyIssue).toBeDefined();
    });
  });

  describe('Comprehensive Data Synchronization', () => {
    it('should sync all pending data to GoHighLevel', async () => {
      if (!agent) return;

      // Create multiple leads and interactions
      const leads = [
        { ...testLead, id: 'sync-lead-1' },
        {
          ...testLead,
          id: 'sync-lead-2',
          contactInfo: { ...testLead.contactInfo, email: 'sync2@example.com' },
        },
        {
          ...testLead,
          id: 'sync-lead-3',
          contactInfo: { ...testLead.contactInfo, email: 'sync3@example.com' },
        },
      ];

      const interactions = [
        { ...testInteraction, id: 'sync-interaction-1', leadId: 'sync-lead-1' },
        { ...testInteraction, id: 'sync-interaction-2', leadId: 'sync-lead-2' },
        { ...testInteraction, id: 'sync-interaction-3', leadId: 'sync-lead-3' },
      ];

      // Create leads in database
      for (const lead of leads) {
        await createLeadInDatabase(lead);
      }

      // Create interactions in database
      for (const interaction of interactions) {
        await createInteractionInDatabase(interaction);
      }

      const result = await agent.syncAllPendingData();

      expect(result.leads.success).toBeGreaterThan(0);
      expect(result.interactions.success).toBeGreaterThan(0);
      expect(result.leads.failed).toBe(0);
      expect(result.interactions.failed).toBe(0);
    });
  });

  describe('Audit Trail Verification', () => {
    it('should maintain comprehensive audit trail', async () => {
      if (!agent) return;

      await createTestLeadInDatabase();

      // Perform various operations
      await agent.logInteraction(testInteraction);
      await agent.updateLeadStatus(testLead.id, 'contacted', 'test-agent');
      await agent.updateLeadStatus(testLead.id, 'qualified', 'test-agent');

      // Verify audit trail
      const leadAuditLogs = await getAuditLogsForEntity('lead', testLead.id);
      const interactionAuditLogs = await getAuditLogsForEntity(
        'interaction',
        testInteraction.id
      );

      expect(leadAuditLogs.length).toBe(2); // Two status updates
      expect(interactionAuditLogs.length).toBe(1); // One interaction creation

      // Verify audit log structure
      const auditLog = leadAuditLogs[0];
      expect(auditLog.entityType).toBe('lead');
      expect(auditLog.entityId).toBe(testLead.id);
      expect(auditLog.action).toBe('update');
      expect(auditLog.changes).toBeDefined();
      expect(auditLog.agentId).toBe('test-agent');
      expect(auditLog.timestamp).toBeDefined();
    });
  });

  // Helper functions for integration tests

  async function createTestLeadInDatabase(): Promise<void> {
    await createLeadInDatabase(testLead);
  }

  async function createLeadInDatabase(lead: Lead): Promise<void> {
    await dbManager.query(
      `INSERT INTO leads (
        id, source, name, email, phone, preferred_channel, timezone,
        lead_type, urgency_level, intent_signals, budget_min, budget_max,
        location, property_type, timeline, qualification_score, status,
        assigned_agent, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
      [
        lead.id,
        lead.source,
        lead.contactInfo.name,
        lead.contactInfo.email,
        lead.contactInfo.phone,
        lead.contactInfo.preferredChannel,
        lead.contactInfo.timezone,
        lead.leadType,
        lead.urgencyLevel,
        lead.intentSignals,
        lead.qualificationData.budget?.min,
        lead.qualificationData.budget?.max,
        lead.qualificationData.location,
        lead.qualificationData.propertyType,
        lead.qualificationData.timeline,
        lead.qualificationData.qualificationScore,
        lead.status,
        lead.assignedAgent,
        lead.createdAt,
        lead.updatedAt,
      ]
    );
  }

  async function createInteractionInDatabase(
    interaction: Interaction
  ): Promise<void> {
    await dbManager.query(
      `INSERT INTO interactions (
        id, lead_id, agent_id, type, direction, content, outcome_status,
        appointment_booked, qualification_updated, escalation_required,
        duration_seconds, sentiment_score, next_action, next_action_scheduled_at,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        interaction.id,
        interaction.leadId,
        interaction.agentId,
        interaction.type,
        interaction.direction,
        interaction.content,
        interaction.outcome.status,
        interaction.outcome.appointmentBooked,
        interaction.outcome.qualificationUpdated,
        interaction.outcome.escalationRequired,
        interaction.duration,
        interaction.sentiment?.score,
        interaction.nextAction?.action,
        interaction.nextAction?.scheduledAt,
        interaction.timestamp,
      ]
    );
  }

  async function getLeadFromDatabase(leadId: string): Promise<any> {
    const result = await dbManager.query('SELECT * FROM leads WHERE id = $1', [
      leadId,
    ]);
    return result.rows[0];
  }

  async function getInteractionFromDatabase(
    interactionId: string
  ): Promise<any> {
    const result = await dbManager.query(
      'SELECT * FROM interactions WHERE id = $1',
      [interactionId]
    );
    return result.rows[0];
  }

  async function getAuditLogsForEntity(
    entityType: string,
    entityId: string
  ): Promise<any[]> {
    const result = await dbManager.query(
      'SELECT * FROM audit_logs WHERE entity_type = $1 AND entity_id = $2 ORDER BY timestamp DESC',
      [entityType, entityId]
    );
    return result.rows.map((row) => ({
      ...row,
      changes: JSON.parse(row.changes),
      metadata: JSON.parse(row.metadata),
    }));
  }

  async function cleanupTestData(): Promise<void> {
    // Clean up in reverse dependency order
    await dbManager.query(
      "DELETE FROM audit_logs WHERE entity_id LIKE 'test-%' OR entity_id LIKE 'dup-%' OR entity_id LIKE 'sync-%'"
    );
    await dbManager.query(
      "DELETE FROM interactions WHERE id LIKE 'test-%' OR id LIKE 'sync-%'"
    );
    await dbManager.query(
      "DELETE FROM leads WHERE id LIKE 'test-%' OR id LIKE 'dup-%' OR id LIKE 'sync-%'"
    );
  }
});
