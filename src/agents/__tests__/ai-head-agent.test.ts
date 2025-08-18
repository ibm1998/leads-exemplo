import { describe, it, expect, beforeEach } from 'vitest';
import {
  AIHeadAgent,
  PerformanceFeedback,
  RoutingRule,
} from '../ai-head-agent';
import { Lead, LeadModel } from '../../types/lead';

describe('AIHeadAgent', () => {
  let aiHeadAgent: AIHeadAgent;
  let mockLead: Lead;

  beforeEach(() => {
    aiHeadAgent = new AIHeadAgent();

    // Create a mock lead for testing
    mockLead = {
      id: 'test-lead-123',
      source: 'website',
      contactInfo: {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+1234567890',
        preferredChannel: 'email',
        timezone: 'UTC',
      },
      leadType: 'warm',
      urgencyLevel: 6,
      intentSignals: ['form_submission', 'requested_callback'],
      qualificationData: {
        budget: { min: 100000, max: 500000 },
        location: 'New York',
        propertyType: 'apartment',
        timeline: '3 months',
        qualificationScore: 0.7,
      },
      status: 'new',
      assignedAgent: undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  });

  describe('Lead Analysis', () => {
    it('should analyze a hot lead correctly', async () => {
      const hotLead: Lead = {
        ...mockLead,
        leadType: 'hot',
        urgencyLevel: 9,
        intentSignals: [
          'requested_callback',
          'asked_about_pricing',
          'phone_inquiry',
        ],
        qualificationData: {
          ...mockLead.qualificationData,
          qualificationScore: 0.9,
        },
      };

      const analysis = await aiHeadAgent.analyzeLead(hotLead);

      expect(analysis.leadId).toBe(hotLead.id);
      expect(analysis.leadType).toBe('hot');
      expect(analysis.urgencyLevel).toBeGreaterThanOrEqual(8);
      expect(analysis.intentScore).toBeGreaterThan(0.5);
      expect(analysis.routingRecommendation.targetAgent).toBe('inbound');
      expect(analysis.routingRecommendation.priority).toBe('high');
      expect(analysis.confidence).toBeGreaterThan(0.7);
    });

    it('should analyze a cold lead correctly', async () => {
      const coldLead: Lead = {
        ...mockLead,
        leadType: 'cold',
        urgencyLevel: 2,
        intentSignals: [],
        source: 'meta_ads',
        qualificationData: {
          ...mockLead.qualificationData,
          qualificationScore: 0.1,
        },
      };

      const analysis = await aiHeadAgent.analyzeLead(coldLead);

      expect(analysis.leadType).toBe('cold');
      expect(analysis.urgencyLevel).toBeLessThan(5);
      expect(analysis.intentScore).toBeLessThan(0.3);
      expect(analysis.routingRecommendation.targetAgent).toBe('outbound');
      expect(analysis.routingRecommendation.priority).toBe('low');
    });

    it('should calculate intent score based on signals', async () => {
      const leadWithHighIntent: Lead = {
        ...mockLead,
        intentSignals: [
          'requested_callback',
          'asked_about_pricing',
          'form_submission',
        ],
      };

      const analysis = await aiHeadAgent.analyzeLead(leadWithHighIntent);
      expect(analysis.intentScore).toBeGreaterThan(0.6);

      const leadWithLowIntent: Lead = {
        ...mockLead,
        intentSignals: ['email_opened'],
      };

      const lowIntentAnalysis = await aiHeadAgent.analyzeLead(
        leadWithLowIntent
      );
      expect(lowIntentAnalysis.intentScore).toBeLessThan(0.4);
    });

    it('should evaluate source quality correctly', async () => {
      const websiteLead: Lead = { ...mockLead, source: 'website' };
      const metaLead: Lead = { ...mockLead, source: 'meta_ads' };

      const websiteAnalysis = await aiHeadAgent.analyzeLead(websiteLead);
      const metaAnalysis = await aiHeadAgent.analyzeLead(metaLead);

      expect(websiteAnalysis.sourceQuality).toBeGreaterThan(
        metaAnalysis.sourceQuality
      );
    });

    it('should adjust urgency based on lead age and other factors', async () => {
      // Test with fresh lead
      const freshLead: Lead = {
        ...mockLead,
        createdAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
        urgencyLevel: 5,
      };

      const freshAnalysis = await aiHeadAgent.analyzeLead(freshLead);

      // Test with old lead
      const oldLead: Lead = {
        ...mockLead,
        createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
        urgencyLevel: 5,
      };

      const oldAnalysis = await aiHeadAgent.analyzeLead(oldLead);

      expect(freshAnalysis.urgencyLevel).toBeGreaterThanOrEqual(
        oldAnalysis.urgencyLevel
      );
    });

    it('should calculate confidence based on data completeness', async () => {
      const completeDataLead: Lead = {
        ...mockLead,
        contactInfo: {
          ...mockLead.contactInfo,
          email: 'test@example.com',
          phone: '+1234567890',
        },
        intentSignals: [
          'form_submission',
          'requested_callback',
          'asked_about_pricing',
        ],
        qualificationData: {
          ...mockLead.qualificationData,
          qualificationScore: 0.8,
        },
      };

      const incompleteDataLead: Lead = {
        ...mockLead,
        contactInfo: {
          ...mockLead.contactInfo,
          email: undefined,
          phone: undefined,
        },
        intentSignals: [],
        qualificationData: {
          ...mockLead.qualificationData,
          qualificationScore: 0,
        },
      };

      const completeAnalysis = await aiHeadAgent.analyzeLead(completeDataLead);
      const incompleteAnalysis = await aiHeadAgent.analyzeLead(
        incompleteDataLead
      );

      expect(completeAnalysis.confidence).toBeGreaterThan(
        incompleteAnalysis.confidence
      );
    });
  });

  describe('Routing Logic', () => {
    it('should route hot leads to inbound agent', async () => {
      const hotLead: Lead = {
        ...mockLead,
        urgencyLevel: 9,
        leadType: 'hot',
      };

      const analysis = await aiHeadAgent.analyzeLead(hotLead);
      expect(analysis.routingRecommendation.targetAgent).toBe('inbound');
      expect(analysis.routingRecommendation.priority).toBe('high');
    });

    it('should route direct website inquiries to inbound agent', async () => {
      const websiteInquiry: Lead = {
        ...mockLead,
        source: 'website',
        intentSignals: ['form_submission', 'requested_callback'],
      };

      const analysis = await aiHeadAgent.analyzeLead(websiteInquiry);
      expect(analysis.routingRecommendation.targetAgent).toBe('inbound');
    });

    it('should route cold leads to outbound agent', async () => {
      const coldLead: Lead = {
        ...mockLead,
        leadType: 'cold',
        urgencyLevel: 2,
        intentSignals: [],
      };

      const analysis = await aiHeadAgent.analyzeLead(coldLead);
      expect(analysis.routingRecommendation.targetAgent).toBe('outbound');
      expect(analysis.routingRecommendation.priority).toBe('low');
    });

    it('should provide appropriate estimated response times', async () => {
      const hotLead: Lead = { ...mockLead, urgencyLevel: 9, leadType: 'hot' };
      const coldLead: Lead = {
        ...mockLead,
        urgencyLevel: 2,
        leadType: 'cold',
        intentSignals: [],
      };

      const hotAnalysis = await aiHeadAgent.analyzeLead(hotLead);
      const coldAnalysis = await aiHeadAgent.analyzeLead(coldLead);

      expect(
        hotAnalysis.routingRecommendation.estimatedResponseTime
      ).toBeLessThan(coldAnalysis.routingRecommendation.estimatedResponseTime);
    });

    it('should include reasoning in routing decisions', async () => {
      const analysis = await aiHeadAgent.analyzeLead(mockLead);

      expect(analysis.routingRecommendation.reasoning).toBeInstanceOf(Array);
      expect(analysis.routingRecommendation.reasoning.length).toBeGreaterThan(
        0
      );
      expect(analysis.routingRecommendation.suggestedActions).toBeInstanceOf(
        Array
      );
    });
  });

  describe('Performance Feedback Processing', () => {
    it('should store performance feedback', async () => {
      const analysis = await aiHeadAgent.analyzeLead(mockLead);

      const feedback: PerformanceFeedback = {
        leadId: mockLead.id,
        routingDecision: analysis.routingRecommendation,
        actualOutcome: {
          conversionSuccessful: true,
          responseTime: 45,
          customerSatisfaction: 4.5,
          appointmentBooked: true,
        },
        timestamp: new Date(),
      };

      await aiHeadAgent.processPerformanceFeedback(feedback);

      const storedFeedback = aiHeadAgent.getLeadPerformanceFeedback(
        mockLead.id
      );
      expect(storedFeedback).toHaveLength(1);
      expect(storedFeedback[0]).toEqual(feedback);
    });

    it('should optimize routing rules based on feedback', async () => {
      const analysis = await aiHeadAgent.analyzeLead(mockLead);

      // Simulate multiple successful outcomes
      for (let i = 0; i < 5; i++) {
        const feedback: PerformanceFeedback = {
          leadId: `lead-${i}`,
          routingDecision: analysis.routingRecommendation,
          actualOutcome: {
            conversionSuccessful: true,
            responseTime: 30,
            appointmentBooked: true,
          },
          timestamp: new Date(),
        };
        await aiHeadAgent.processPerformanceFeedback(feedback);
      }

      const metrics = aiHeadAgent.getPerformanceMetrics();
      expect(metrics.routingAccuracy).toBe(1.0); // 100% success rate
    });

    it('should adjust routing based on poor performance', async () => {
      const analysis = await aiHeadAgent.analyzeLead(mockLead);

      // Simulate multiple failed outcomes
      for (let i = 0; i < 5; i++) {
        const feedback: PerformanceFeedback = {
          leadId: `lead-${i}`,
          routingDecision: analysis.routingRecommendation,
          actualOutcome: {
            conversionSuccessful: false,
            responseTime: 120,
            appointmentBooked: false,
          },
          timestamp: new Date(),
        };
        await aiHeadAgent.processPerformanceFeedback(feedback);
      }

      const metrics = aiHeadAgent.getPerformanceMetrics();
      expect(metrics.routingAccuracy).toBe(0.0); // 0% success rate
    });
  });

  describe('Routing Rules Management', () => {
    it('should add custom routing rules', () => {
      const customRule: RoutingRule = {
        id: 'custom-rule',
        name: 'Custom Test Rule',
        condition: (lead) => lead.source === 'referral',
        action: {
          targetAgent: 'inbound',
          priority: 'high',
          reasoning: ['Referral leads get priority'],
          estimatedResponseTime: 30,
          suggestedActions: ['Immediate contact'],
        },
        priority: 1,
        enabled: true,
      };

      aiHeadAgent.addRoutingRule(customRule);

      // Test that the rule is applied
      const referralLead: Lead = { ...mockLead, source: 'referral' };

      return aiHeadAgent.analyzeLead(referralLead).then((analysis) => {
        expect(analysis.routingRecommendation.targetAgent).toBe('inbound');
        expect(analysis.routingRecommendation.priority).toBe('high');
      });
    });

    it('should remove routing rules', async () => {
      const customRule: RoutingRule = {
        id: 'removable-rule',
        name: 'Removable Rule',
        condition: () => true,
        action: {
          targetAgent: 'inbound',
          priority: 'high',
          reasoning: ['Always inbound'],
          estimatedResponseTime: 30,
          suggestedActions: [],
        },
        priority: 1,
        enabled: true,
      };

      aiHeadAgent.addRoutingRule(customRule);
      aiHeadAgent.removeRoutingRule('removable-rule');

      // The rule should no longer affect routing
      const analysis = await aiHeadAgent.analyzeLead(mockLead);
      // Should fall back to default routing logic
      expect(analysis.routingRecommendation.reasoning).not.toContain(
        'Always inbound'
      );
    });

    it('should respect rule priority order', async () => {
      // Create agent with no default rules to test priority clearly
      const testAgent = new AIHeadAgent({ routingRules: [] });

      const highPriorityRule: RoutingRule = {
        id: 'high-priority',
        name: 'High Priority Rule',
        condition: () => true,
        action: {
          targetAgent: 'inbound',
          priority: 'high',
          reasoning: ['High priority rule'],
          estimatedResponseTime: 15,
          suggestedActions: [],
        },
        priority: 1,
        enabled: true,
      };

      const lowPriorityRule: RoutingRule = {
        id: 'low-priority',
        name: 'Low Priority Rule',
        condition: () => true,
        action: {
          targetAgent: 'outbound',
          priority: 'low',
          reasoning: ['Low priority rule'],
          estimatedResponseTime: 300,
          suggestedActions: [],
        },
        priority: 10,
        enabled: true,
      };

      testAgent.addRoutingRule(lowPriorityRule);
      testAgent.addRoutingRule(highPriorityRule);

      const analysis = await testAgent.analyzeLead(mockLead);
      expect(analysis.routingRecommendation.reasoning).toContain(
        'High priority rule'
      );
    });
  });

  describe('Performance Metrics', () => {
    it('should calculate performance metrics correctly', async () => {
      // Analyze some leads
      await aiHeadAgent.analyzeLead(mockLead);
      await aiHeadAgent.analyzeLead({ ...mockLead, id: 'lead-2' });

      const metrics = aiHeadAgent.getPerformanceMetrics();

      expect(metrics.totalLeadsAnalyzed).toBe(2);
      expect(metrics.averageConfidence).toBeGreaterThan(0);
      expect(metrics.rulePerformance).toBeInstanceOf(Array);
    });

    it('should track routing history', async () => {
      const analysis = await aiHeadAgent.analyzeLead(mockLead);

      const history = aiHeadAgent.getLeadRoutingHistory(mockLead.id);
      expect(history).toBeDefined();
      expect(history?.leadId).toBe(mockLead.id);
      expect(history?.analysisTimestamp).toBeInstanceOf(Date);
    });
  });

  describe('Configuration Management', () => {
    it('should update configuration', async () => {
      const newConfig = {
        responseTimeSLA: 30,
        urgencyThresholds: {
          high: 9,
          medium: 6,
        },
      };

      aiHeadAgent.updateConfig(newConfig);

      // Test that the new configuration is applied by checking if a lead with urgency 9 is treated as high priority
      const hotLead: Lead = { ...mockLead, urgencyLevel: 9, leadType: 'hot' };

      const analysis = await aiHeadAgent.analyzeLead(hotLead);
      // The urgency level should be at least 9 (could be higher due to other factors)
      expect(analysis.urgencyLevel).toBeGreaterThanOrEqual(9);
      expect(analysis.routingRecommendation.priority).toBe('high');
    });

    it('should disable optimization when configured', async () => {
      aiHeadAgent.updateConfig({ optimizationEnabled: false });

      const analysis = await aiHeadAgent.analyzeLead(mockLead);
      const feedback: PerformanceFeedback = {
        leadId: mockLead.id,
        routingDecision: analysis.routingRecommendation,
        actualOutcome: {
          conversionSuccessful: false,
          responseTime: 200,
          appointmentBooked: false,
        },
        timestamp: new Date(),
      };

      await aiHeadAgent.processPerformanceFeedback(feedback);

      // With optimization disabled, rules shouldn't be adjusted
      const metrics = aiHeadAgent.getPerformanceMetrics();
      expect(
        metrics.rulePerformance.every(
          (rule) => rule.successRate === 0 || rule.usageCount === 0
        )
      ).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid lead data gracefully', async () => {
      const invalidLead = { ...mockLead, id: '' }; // Invalid ID

      await expect(
        aiHeadAgent.analyzeLead(invalidLead as Lead)
      ).rejects.toThrow();
    });

    it('should provide fallback routing when no rules match', async () => {
      // Create agent with no routing rules
      const emptyAgent = new AIHeadAgent({ routingRules: [] });

      // Use a lead that won't match any default conditions
      const simpleLead: Lead = {
        ...mockLead,
        leadType: 'cold',
        urgencyLevel: 1,
        intentSignals: [],
        source: 'other',
        qualificationData: {
          ...mockLead.qualificationData,
          qualificationScore: 0.1,
        },
      };

      const analysis = await emptyAgent.analyzeLead(simpleLead);

      expect(analysis.routingRecommendation.targetAgent).toBe('outbound');
      expect(analysis.routingRecommendation.reasoning).toContain(
        'No specific routing rule matched'
      );
    });
  });

  describe('Lead Type Evaluation', () => {
    it('should re-evaluate lead type when existing type seems inaccurate', async () => {
      const mislabeledLead: Lead = {
        ...mockLead,
        leadType: 'cold', // Labeled as cold
        urgencyLevel: 9, // But has high urgency
        intentSignals: ['requested_callback', 'asked_about_pricing'], // And strong intent
        qualificationData: {
          ...mockLead.qualificationData,
          qualificationScore: 0.9, // And high qualification
        },
      };

      const analysis = await aiHeadAgent.analyzeLead(mislabeledLead);

      // Should be re-evaluated as hot despite original label
      expect(analysis.leadType).toBe('hot');
    });

    it('should keep accurate lead type when it matches other factors', async () => {
      const accurateHotLead: Lead = {
        ...mockLead,
        leadType: 'hot',
        urgencyLevel: 9,
        intentSignals: ['requested_callback', 'phone_inquiry'],
        qualificationData: {
          ...mockLead.qualificationData,
          qualificationScore: 0.8,
        },
      };

      const analysis = await aiHeadAgent.analyzeLead(accurateHotLead);
      expect(analysis.leadType).toBe('hot');
    });
  });
});
