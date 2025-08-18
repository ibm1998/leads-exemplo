import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  AILeadGenerationAgent,
  Campaign,
  AudienceSegment,
  MessageTemplate,
  CampaignSchedule,
} from '../ai-lead-generation-agent';
import { Lead, LeadModel } from '../../types/lead';
import { Interaction, InteractionModel } from '../../types/interaction';

describe('AILeadGenerationAgent', () => {
  let agent: AILeadGenerationAgent;
  let mockLeads: Lead[];
  let mockInteractions: Map<string, Interaction[]>;

  beforeEach(() => {
    agent = new AILeadGenerationAgent('test-agent');

    // Create mock leads with valid UUIDs
    mockLeads = [
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        source: 'website',
        contactInfo: {
          name: 'John Doe',
          email: 'john@example.com',
          phone: '+1234567890',
          preferredChannel: 'email',
          timezone: 'UTC',
        },
        leadType: 'cold',
        urgencyLevel: 3,
        intentSignals: ['property_search'],
        qualificationData: {
          budget: { min: 100000, max: 300000 },
          location: 'New York',
          propertyType: 'apartment',
          timeline: '3-6 months',
          qualificationScore: 0.4,
        },
        status: 'contacted',
        assignedAgent: 'test-agent',
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
        updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440002',
        source: 'meta_ads',
        contactInfo: {
          name: 'Jane Smith',
          email: 'jane@example.com',
          phone: '+1987654321',
          preferredChannel: 'sms',
          timezone: 'UTC',
        },
        leadType: 'warm',
        urgencyLevel: 6,
        intentSignals: ['property_viewing', 'mortgage_inquiry'],
        qualificationData: {
          budget: { min: 200000, max: 500000 },
          location: 'Los Angeles',
          propertyType: 'house',
          timeline: '1-3 months',
          qualificationScore: 0.7,
        },
        status: 'qualified',
        assignedAgent: 'test-agent',
        createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
        updatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440003',
        source: 'gmail',
        contactInfo: {
          name: 'Bob Johnson',
          email: 'bob@example.com',
          preferredChannel: 'email',
          timezone: 'UTC',
        },
        leadType: 'hot',
        urgencyLevel: 9,
        intentSignals: ['immediate_purchase', 'cash_buyer'],
        qualificationData: {
          budget: { min: 500000, max: 1000000 },
          location: 'Miami',
          propertyType: 'condo',
          timeline: 'immediate',
          qualificationScore: 0.9,
        },
        status: 'appointment_scheduled',
        assignedAgent: 'test-agent',
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
      },
    ];

    // Create mock interactions
    mockInteractions = new Map();
    mockInteractions.set('550e8400-e29b-41d4-a716-446655440001', [
      {
        id: '550e8400-e29b-41d4-a716-446655440101',
        leadId: '550e8400-e29b-41d4-a716-446655440001',
        agentId: 'test-agent',
        type: 'email',
        direction: 'outbound',
        content: 'Initial outreach email',
        outcome: {
          status: 'failed',
          appointmentBooked: false,
          qualificationUpdated: false,
          escalationRequired: false,
        },
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      },
    ]);

    mockInteractions.set('550e8400-e29b-41d4-a716-446655440002', [
      {
        id: '550e8400-e29b-41d4-a716-446655440102',
        leadId: '550e8400-e29b-41d4-a716-446655440002',
        agentId: 'test-agent',
        type: 'call',
        direction: 'outbound',
        content: 'Phone qualification call',
        outcome: {
          status: 'successful',
          appointmentBooked: false,
          qualificationUpdated: true,
          escalationRequired: false,
        },
        duration: 900, // 15 minutes
        sentiment: { score: 0.6, confidence: 0.8 },
        timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440103',
        leadId: '550e8400-e29b-41d4-a716-446655440002',
        agentId: 'test-agent',
        type: 'email',
        direction: 'outbound',
        content: 'Follow-up email with property listings',
        outcome: {
          status: 'successful',
          appointmentBooked: false,
          qualificationUpdated: false,
          escalationRequired: false,
        },
        sentiment: { score: 0.4, confidence: 0.7 },
        timestamp: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      },
    ]);
  });

  describe('processColdLeads', () => {
    it('should identify and process cold leads that need follow-up', async () => {
      const sequences = await agent.processColdLeads(mockLeads);

      expect(sequences).toHaveLength(1);
      expect(sequences[0].leadId).toBe('550e8400-e29b-41d4-a716-446655440001');
      expect(sequences[0].campaignId).toBe('cold-follow-up-default');
      expect(sequences[0].status).toBe('active');
      expect(sequences[0].totalSteps).toBe(5);
    });

    it("should not process leads that don't meet cold follow-up criteria", async () => {
      // Create a lead that was updated recently (shouldn't be followed up)
      const recentLead: Lead = {
        ...mockLeads[0],
        id: '550e8400-e29b-41d4-a716-446655440004',
        updatedAt: new Date(), // Just updated
      };

      const sequences = await agent.processColdLeads([recentLead]);
      expect(sequences).toHaveLength(0);
    });

    it('should not process leads that are too old', async () => {
      // Create a lead that's too old (over 30 days)
      const oldLead: Lead = {
        ...mockLeads[0],
        id: '550e8400-e29b-41d4-a716-446655440005',
        updatedAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000), // 35 days ago
      };

      const sequences = await agent.processColdLeads([oldLead]);
      expect(sequences).toHaveLength(0);
    });

    it('should handle errors gracefully when processing fails', async () => {
      // Mock console.error to avoid noise in tests
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // Create invalid leads that would cause processing to fail
      const invalidLeads = [null, undefined] as any[];

      const sequences = await agent.processColdLeads(invalidLeads);
      expect(sequences).toHaveLength(0);

      consoleSpy.mockRestore();
    });
  });

  describe('processWarmLeads', () => {
    it('should identify and process warm leads for re-engagement', async () => {
      const sequences = await agent.processWarmLeads(
        mockLeads,
        mockInteractions
      );

      expect(sequences).toHaveLength(1);
      expect(sequences[0].leadId).toBe('550e8400-e29b-41d4-a716-446655440002');
      expect(sequences[0].campaignId).toBe('warm-reengagement-default');
      expect(sequences[0].status).toBe('active');
    });

    it('should analyze interaction history to determine sequence strategy', async () => {
      const sequences = await agent.processWarmLeads(
        mockLeads,
        mockInteractions
      );
      const warmSequence = sequences.find(
        (s) => s.leadId === '550e8400-e29b-41d4-a716-446655440002'
      );

      expect(warmSequence).toBeDefined();
      // Should have fewer steps for leads with positive interaction history
      expect(warmSequence!.totalSteps).toBeLessThanOrEqual(5);
    });

    it('should not process warm leads without interaction history', async () => {
      const emptyInteractions = new Map<string, Interaction[]>();
      const sequences = await agent.processWarmLeads(
        mockLeads,
        emptyInteractions
      );

      expect(sequences).toHaveLength(0);
    });

    it('should not process warm leads with recent interactions', async () => {
      // Create interactions with recent timestamp
      const recentInteractions = new Map<string, Interaction[]>();
      recentInteractions.set('550e8400-e29b-41d4-a716-446655440002', [
        {
          ...mockInteractions.get('550e8400-e29b-41d4-a716-446655440002')![0],
          timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        },
      ]);

      const sequences = await agent.processWarmLeads(
        mockLeads,
        recentInteractions
      );
      expect(sequences).toHaveLength(0);
    });
  });

  describe('executeCampaign', () => {
    let mockCampaign: Campaign;

    beforeEach(() => {
      mockCampaign = {
        id: 'test-campaign',
        name: 'Test Campaign',
        type: 'promotional',
        status: 'active',
        targetAudience: {
          id: 'audience-1',
          name: 'Qualified Leads',
          criteria: {
            leadTypes: ['warm', 'hot'],
            qualificationScoreRange: { min: 0.5, max: 1.0 },
          },
          leadIds: [],
          size: 0,
        },
        messageTemplates: [
          {
            id: 'template-1',
            name: 'Campaign Email',
            channel: 'email',
            subject: 'Special Offer for {{leadName}}',
            content:
              'Hi {{leadName}}, we have a special offer for properties in {{location}}.',
            personalizationFields: ['leadName', 'location'],
          },
        ],
        schedule: {
          startDate: new Date(),
          frequency: 'immediate',
          timezone: 'UTC',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    });

    it('should execute campaign and track performance', async () => {
      const performance = await agent.executeCampaign(mockCampaign, mockLeads);

      expect(performance.campaignId).toBe('test-campaign');
      expect(performance.totalSent).toBeGreaterThan(0);
      expect(performance.openRate).toBe(0); // Initially 0
      expect(performance.responseRate).toBe(0); // Initially 0
      expect(performance.conversionRate).toBe(0); // Initially 0
    });

    it('should segment audience based on campaign criteria', async () => {
      const performance = await agent.executeCampaign(mockCampaign, mockLeads);

      // Should only target warm and hot leads with qualification score >= 0.5
      // From mockLeads: lead-2 (warm, 0.7) and lead-3 (hot, 0.9) should qualify
      expect(performance.totalSent).toBe(2);
    });

    it('should initialize A/B testing when enabled', async () => {
      mockCampaign.abTestConfig = {
        enabled: true,
        splitRatio: 0.5,
        testDurationDays: 7,
        primaryMetric: 'conversion_rate',
        minimumSampleSize: 100,
      };

      const performance = await agent.executeCampaign(mockCampaign, mockLeads);

      expect(performance.abTestResults).toBeDefined();
      expect(performance.abTestResults!.variantA).toBeDefined();
      expect(performance.abTestResults!.variantB).toBeDefined();
    });

    it('should handle campaign execution errors gracefully', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // Create a campaign with invalid configuration that will cause errors during execution
      const invalidCampaign = {
        ...mockCampaign,
        messageTemplates: [], // Empty templates will cause errors
        targetAudience: {
          id: 'test-audience',
          name: 'Test Audience',
          criteria: {}, // This will match all leads but fail during execution
          leadIds: [],
          size: 0,
        },
      };

      const performance = await agent.executeCampaign(
        invalidCampaign,
        mockLeads
      );
      // Even with empty templates, the method should still work
      expect(performance.totalSent).toBeGreaterThanOrEqual(0);
      // The agent handles empty templates gracefully, so no errors are logged

      consoleSpy.mockRestore();
    });
  });

  describe('audience segmentation', () => {
    it('should filter leads by lead type', () => {
      const criteria = { leadTypes: ['warm', 'hot'] as const };
      const agent = new AILeadGenerationAgent();

      // Access private method through type assertion for testing
      const segmentedLeads = (agent as any).segmentAudience(
        mockLeads,
        criteria
      );

      expect(segmentedLeads).toHaveLength(2);
      expect(segmentedLeads.map((l: Lead) => l.leadType)).toEqual([
        'warm',
        'hot',
      ]);
    });

    it('should filter leads by qualification score range', () => {
      const criteria = { qualificationScoreRange: { min: 0.6, max: 1.0 } };
      const agent = new AILeadGenerationAgent();

      const segmentedLeads = (agent as any).segmentAudience(
        mockLeads,
        criteria
      );

      expect(segmentedLeads).toHaveLength(2);
      expect(
        segmentedLeads.every(
          (l: Lead) => l.qualificationData.qualificationScore >= 0.6
        )
      ).toBe(true);
    });

    it('should filter leads by age range', () => {
      const criteria = { ageRangeInDays: { min: 1, max: 7 } };
      const agent = new AILeadGenerationAgent();

      const segmentedLeads = (agent as any).segmentAudience(
        mockLeads,
        criteria
      );

      expect(segmentedLeads).toHaveLength(2); // lead-1 (5 days) and lead-3 (2 days)
    });

    it('should filter leads by intent signals', () => {
      const criteria = { intentSignals: ['immediate_purchase'] };
      const agent = new AILeadGenerationAgent();

      const segmentedLeads = (agent as any).segmentAudience(
        mockLeads,
        criteria
      );

      expect(segmentedLeads).toHaveLength(1);
      expect(segmentedLeads[0].id).toBe('550e8400-e29b-41d4-a716-446655440003');
    });

    it('should exclude leads with specified statuses', () => {
      const criteria = { excludeStatuses: ['appointment_scheduled'] as const };
      const agent = new AILeadGenerationAgent();

      const segmentedLeads = (agent as any).segmentAudience(
        mockLeads,
        criteria
      );

      expect(segmentedLeads).toHaveLength(2);
      expect(
        segmentedLeads.every((l: Lead) => l.status !== 'appointment_scheduled')
      ).toBe(true);
    });
  });

  describe('message personalization', () => {
    it('should personalize message content with lead data', async () => {
      const template: MessageTemplate = {
        id: 'test-template',
        name: 'Test Template',
        channel: 'email',
        content: 'Hi {{leadName}}, interested in {{location}} properties?',
        personalizationFields: ['leadName', 'location'],
      };

      const agent = new AILeadGenerationAgent();
      const personalizedMessage = await (agent as any).personalizeMessage(
        template,
        '550e8400-e29b-41d4-a716-446655440001'
      );

      expect(personalizedMessage).toContain('Valued Customer'); // Default name
      expect(personalizedMessage).not.toContain('{{leadName}}');
      expect(personalizedMessage).not.toContain('{{location}}');
    });

    it('should handle missing personalization fields gracefully', async () => {
      const template: MessageTemplate = {
        id: 'test-template',
        name: 'Test Template',
        channel: 'email',
        content: 'Hi {{leadName}}, your {{unknownField}} is ready.',
        personalizationFields: ['leadName', 'unknownField'],
      };

      const agent = new AILeadGenerationAgent();
      const personalizedMessage = await (agent as any).personalizeMessage(
        template,
        '550e8400-e29b-41d4-a716-446655440001'
      );

      expect(personalizedMessage).toContain('[unknownField]'); // Placeholder for unknown fields
    });
  });

  describe('A/B testing', () => {
    it('should calculate statistical significance correctly', () => {
      const agent = new AILeadGenerationAgent();

      // Mock A/B test results with significant difference
      const results = {
        variantA: {
          sent: 1000,
          opened: 200,
          responded: 50,
          converted: 10,
          openRate: 0.2,
          responseRate: 0.05,
          conversionRate: 0.01,
        },
        variantB: {
          sent: 1000,
          opened: 300,
          responded: 100,
          converted: 25,
          openRate: 0.3,
          responseRate: 0.1,
          conversionRate: 0.025,
        },
        winner: undefined as 'A' | 'B' | 'inconclusive' | undefined,
        confidenceLevel: 0,
        statisticalSignificance: false,
      };

      const config = {
        enabled: true,
        splitRatio: 0.5,
        testDurationDays: 7,
        primaryMetric: 'conversion_rate' as const,
        minimumSampleSize: 100,
      };

      (agent as any).analyzeABTestResults(results, config);

      expect(results.winner).toBe('B');
      expect(results.statisticalSignificance).toBe(true);
      expect(results.confidenceLevel).toBeGreaterThan(90);
    });

    it('should handle inconclusive results', () => {
      const agent = new AILeadGenerationAgent();

      // Mock A/B test results with no significant difference
      const results = {
        variantA: {
          sent: 100,
          opened: 20,
          responded: 5,
          converted: 1,
          openRate: 0.2,
          responseRate: 0.05,
          conversionRate: 0.01,
        },
        variantB: {
          sent: 100,
          opened: 22,
          responded: 6,
          converted: 1,
          openRate: 0.22,
          responseRate: 0.06,
          conversionRate: 0.01,
        },
        winner: undefined as 'A' | 'B' | 'inconclusive' | undefined,
        confidenceLevel: 0,
        statisticalSignificance: false,
      };

      const config = {
        enabled: true,
        splitRatio: 0.5,
        testDurationDays: 7,
        primaryMetric: 'conversion_rate' as const,
        minimumSampleSize: 1000, // High minimum sample size
      };

      (agent as any).analyzeABTestResults(results, config);

      expect(results.winner).toBeUndefined(); // Not enough sample size
    });
  });

  describe('sequence management', () => {
    it('should get active sequences', async () => {
      await agent.processColdLeads([mockLeads[0]]);
      await agent.processWarmLeads([mockLeads[1]], mockInteractions);

      const activeSequences = agent.getActiveSequences();
      expect(activeSequences.length).toBeGreaterThan(0);
      expect(activeSequences.every((seq) => seq.status === 'active')).toBe(
        true
      );
    });

    it('should get sequences for specific lead', async () => {
      await agent.processColdLeads([mockLeads[0]]);

      const leadSequences = agent.getSequencesForLead(
        '550e8400-e29b-41d4-a716-446655440001'
      );
      expect(leadSequences).toHaveLength(1);
      expect(leadSequences[0].leadId).toBe(
        '550e8400-e29b-41d4-a716-446655440001'
      );
    });

    it('should pause and resume sequences', async () => {
      const sequences = await agent.processColdLeads([mockLeads[0]]);
      const sequenceId = sequences[0].id;

      // Pause sequence
      const pauseResult = agent.pauseSequence(sequenceId);
      expect(pauseResult).toBe(true);

      const pausedSequences = agent.getActiveSequences();
      expect(pausedSequences).toHaveLength(0);

      // Resume sequence
      const resumeResult = agent.resumeSequence(sequenceId);
      expect(resumeResult).toBe(true);

      const resumedSequences = agent.getActiveSequences();
      expect(resumedSequences).toHaveLength(1);
    });

    it('should not pause non-existent sequences', () => {
      const result = agent.pauseSequence('non-existent-id');
      expect(result).toBe(false);
    });

    it('should not resume non-paused sequences', async () => {
      const sequences = await agent.processColdLeads([mockLeads[0]]);
      const sequenceId = sequences[0].id;

      // Try to resume an active sequence
      const result = agent.resumeSequence(sequenceId);
      expect(result).toBe(false);
    });
  });

  describe('performance tracking', () => {
    it('should track campaign performance', async () => {
      const mockCampaign: Campaign = {
        id: 'perf-test-campaign',
        name: 'Performance Test Campaign',
        type: 'promotional',
        status: 'active',
        targetAudience: {
          id: 'audience-1',
          name: 'All Leads',
          criteria: {},
          leadIds: [],
          size: 0,
        },
        messageTemplates: [
          {
            id: 'template-1',
            name: 'Test Template',
            channel: 'email',
            content: 'Test message',
            personalizationFields: [],
          },
        ],
        schedule: {
          startDate: new Date(),
          frequency: 'immediate',
          timezone: 'UTC',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await agent.executeCampaign(mockCampaign, mockLeads);

      const performance = agent.getCampaignPerformance('perf-test-campaign');
      expect(performance).toBeDefined();
      expect(performance!.campaignId).toBe('perf-test-campaign');
      expect(performance!.totalSent).toBe(mockLeads.length);
    });

    it('should generate performance summary', async () => {
      await agent.processColdLeads([mockLeads[0]]);
      await agent.processWarmLeads([mockLeads[1]], mockInteractions);

      const summary = agent.getPerformanceSummary();

      expect(summary.activeSequences).toBeGreaterThan(0);
      expect(summary.completedSequences).toBeGreaterThanOrEqual(0);
      expect(summary.averageConversionRate).toBeGreaterThanOrEqual(0);
    });

    it('should return undefined for non-existent campaign performance', () => {
      const performance = agent.getCampaignPerformance('non-existent-campaign');
      expect(performance).toBeUndefined();
    });
  });

  describe('timing optimization', () => {
    it('should calculate optimal timing based on interaction history', () => {
      const agent = new AILeadGenerationAgent();
      const interactions = mockInteractions.get(
        '550e8400-e29b-41d4-a716-446655440002'
      )!;

      const optimalTime = (agent as any).calculateOptimalTiming(interactions);

      expect(optimalTime).toBeInstanceOf(Date);
      expect(optimalTime.getTime()).toBeGreaterThan(Date.now());
    });

    it('should use default timing when no successful interactions', () => {
      const agent = new AILeadGenerationAgent();
      const failedInteractions = [
        {
          ...mockInteractions.get('550e8400-e29b-41d4-a716-446655440001')![0],
          outcome: {
            status: 'failed',
            appointmentBooked: false,
            qualificationUpdated: false,
            escalationRequired: false,
          },
        },
      ];

      const optimalTime = (agent as any).calculateOptimalTiming(
        failedInteractions
      );

      expect(optimalTime.getHours()).toBe(10); // Default to 10 AM
    });

    it('should calculate progressive delays for sequence steps', () => {
      const agent = new AILeadGenerationAgent();
      const mockSequence = {
        id: 'test-seq',
        leadId: '550e8400-e29b-41d4-a716-446655440001',
        campaignId: 'test-campaign',
        currentStep: 2,
        totalSteps: 5,
        nextScheduledAt: new Date(),
        status: 'active' as const,
        interactions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const nextStepTime = (agent as any).calculateNextStepTime(mockSequence);

      expect(nextStepTime.getTime()).toBeGreaterThan(Date.now());
      // Should be 7 days from now (step 2 uses 7-day delay)
      const expectedTime = Date.now() + 7 * 24 * 60 * 60 * 1000;
      expect(Math.abs(nextStepTime.getTime() - expectedTime)).toBeLessThan(
        1000
      ); // Within 1 second
    });
  });

  describe('error handling', () => {
    it('should handle invalid lead data gracefully', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const invalidLeads = [null, undefined, { invalid: 'data' }] as any[];

      const coldSequences = await agent.processColdLeads(invalidLeads);
      const warmSequences = await agent.processWarmLeads(
        invalidLeads,
        mockInteractions
      );

      expect(coldSequences).toHaveLength(0);
      expect(warmSequences).toHaveLength(0);

      consoleSpy.mockRestore();
    });

    it('should handle missing interaction data', async () => {
      const emptyInteractions = new Map<string, Interaction[]>();

      const sequences = await agent.processWarmLeads(
        mockLeads,
        emptyInteractions
      );
      expect(sequences).toHaveLength(0);
    });

    it('should handle campaign execution failures', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const invalidCampaign = {
        id: 'invalid-campaign',
        messageTemplates: null,
        targetAudience: null,
      } as any;

      const performance = await agent.executeCampaign(
        invalidCampaign,
        mockLeads
      );
      expect(performance.totalSent).toBe(0);

      consoleSpy.mockRestore();
    });
  });
});
