import { WorkflowDefinition, WorkflowNode } from './n8n-client';
import { LeadSource, LeadType } from '../types/lead';

/**
 * Agent coordination workflow types
 */
export type AgentWorkflowType =
  | 'lead_routing'
  | 'inbound_processing'
  | 'outbound_processing'
  | 'customer_retention'
  | 'feedback_collection'
  | 'appointment_coordination'
  | 'crm_management'
  | 'analytics_processing'
  | 'optimization_loop';

/**
 * Workflow template configuration
 */
export interface WorkflowTemplateConfig {
  name: string;
  description: string;
  type: AgentWorkflowType;
  triggers: WorkflowTrigger[];
  parameters: Record<string, any>;
}

/**
 * Workflow trigger configuration
 */
export interface WorkflowTrigger {
  type: 'webhook' | 'schedule' | 'manual';
  config: Record<string, any>;
}

/**
 * n8n workflow template generator
 */
export class WorkflowTemplateGenerator {
  /**
   * Generate lead routing workflow template
   */
  static generateLeadRoutingWorkflow(config: {
    webhookPath?: string;
    aiHeadAgentEndpoint: string;
    inboundAgentEndpoint: string;
    outboundAgentEndpoint: string;
  }): WorkflowDefinition {
    const nodes: WorkflowNode[] = [
      // Webhook trigger for new leads
      {
        id: 'webhook-trigger',
        name: 'Lead Webhook',
        type: 'n8n-nodes-base.webhook',
        typeVersion: 1,
        position: [100, 200],
        parameters: {
          path: config.webhookPath || 'lead-routing',
          httpMethod: 'POST',
          responseMode: 'responseNode',
        },
      },

      // AI Head Agent analysis
      {
        id: 'ai-head-analysis',
        name: 'AI Head Agent Analysis',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 3,
        position: [300, 200],
        parameters: {
          method: 'POST',
          url: config.aiHeadAgentEndpoint,
          sendBody: true,
          bodyParameters: {
            parameters: [
              {
                name: 'lead',
                value: '={{ $json }}',
              },
            ],
          },
          options: {
            timeout: 30000,
          },
        },
      },

      // Route to Inbound Agent
      {
        id: 'route-inbound',
        name: 'Route to Inbound Agent',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 3,
        position: [500, 100],
        parameters: {
          method: 'POST',
          url: config.inboundAgentEndpoint,
          sendBody: true,
          bodyParameters: {
            parameters: [
              {
                name: 'lead',
                value: "={{ $('webhook-trigger').item.json }}",
              },
              {
                name: 'analysis',
                value: "={{ $('ai-head-analysis').item.json }}",
              },
            ],
          },
        },
      },

      // Route to Outbound Agent
      {
        id: 'route-outbound',
        name: 'Route to Outbound Agent',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 3,
        position: [500, 300],
        parameters: {
          method: 'POST',
          url: config.outboundAgentEndpoint,
          sendBody: true,
          bodyParameters: {
            parameters: [
              {
                name: 'lead',
                value: "={{ $('webhook-trigger').item.json }}",
              },
              {
                name: 'analysis',
                value: "={{ $('ai-head-analysis').item.json }}",
              },
            ],
          },
        },
      },

      // Routing decision switch
      {
        id: 'routing-switch',
        name: 'Routing Decision',
        type: 'n8n-nodes-base.switch',
        typeVersion: 1,
        position: [400, 200],
        parameters: {
          conditions: {
            options: {
              caseSensitive: true,
              leftValue: '',
              typeValidation: 'strict',
            },
            conditions: [
              {
                leftValue:
                  "={{ $('ai-head-analysis').item.json.routingRecommendation.targetAgent }}",
                rightValue: 'inbound',
                operator: {
                  type: 'string',
                  operation: 'equals',
                },
              },
            ],
            combinator: 'and',
          },
          fallbackOutput: 1,
        },
      },

      // Response node
      {
        id: 'webhook-response',
        name: 'Webhook Response',
        type: 'n8n-nodes-base.respondToWebhook',
        typeVersion: 1,
        position: [700, 200],
        parameters: {
          respondWith: 'json',
          responseBody:
            '={{ { "status": "routed", "agent": $(\'ai-head-analysis\').item.json.routingRecommendation.targetAgent, "leadId": $(\'webhook-trigger\').item.json.id } }}',
        },
      },
    ];

    const connections = {
      'webhook-trigger': {
        main: [
          [
            {
              node: 'ai-head-analysis',
              type: 'main',
              index: 0,
            },
          ],
        ],
      },
      'ai-head-analysis': {
        main: [
          [
            {
              node: 'routing-switch',
              type: 'main',
              index: 0,
            },
          ],
        ],
      },
      'routing-switch': {
        main: [
          [
            {
              node: 'route-inbound',
              type: 'main',
              index: 0,
            },
          ],
          [
            {
              node: 'route-outbound',
              type: 'main',
              index: 0,
            },
          ],
        ],
      },
      'route-inbound': {
        main: [
          [
            {
              node: 'webhook-response',
              type: 'main',
              index: 0,
            },
          ],
        ],
      },
      'route-outbound': {
        main: [
          [
            {
              node: 'webhook-response',
              type: 'main',
              index: 0,
            },
          ],
        ],
      },
    };

    return {
      id: '',
      name: 'Lead Routing Workflow',
      active: true,
      nodes,
      connections,
      settings: {
        executionOrder: 'v1',
        saveManualExecutions: true,
      },
    };
  }

  /**
   * Generate inbound processing workflow template
   */
  static generateInboundProcessingWorkflow(config: {
    virtualSalesAssistantEndpoint: string;
    customerRetentionEndpoint: string;
    feedbackCollectorEndpoint: string;
    crmManagementEndpoint: string;
  }): WorkflowDefinition {
    const nodes: WorkflowNode[] = [
      // Webhook trigger for inbound leads
      {
        id: 'inbound-webhook',
        name: 'Inbound Lead Webhook',
        type: 'n8n-nodes-base.webhook',
        typeVersion: 1,
        position: [100, 200],
        parameters: {
          path: 'inbound-processing',
          httpMethod: 'POST',
        },
      },

      // Lead type switch
      {
        id: 'lead-type-switch',
        name: 'Lead Type Decision',
        type: 'n8n-nodes-base.switch',
        typeVersion: 1,
        position: [300, 200],
        parameters: {
          conditions: {
            options: {
              caseSensitive: true,
            },
            conditions: [
              {
                leftValue: '={{ $json.analysis.leadType }}',
                rightValue: 'hot',
                operator: {
                  type: 'string',
                  operation: 'equals',
                },
              },
              {
                leftValue: '={{ $json.lead.status }}',
                rightValue: 'dormant',
                operator: {
                  type: 'string',
                  operation: 'equals',
                },
              },
              {
                leftValue: '={{ $json.lead.status }}',
                rightValue: 'converted',
                operator: {
                  type: 'string',
                  operation: 'equals',
                },
              },
            ],
            combinator: 'or',
          },
        },
      },

      // Virtual Sales Assistant for hot leads
      {
        id: 'virtual-sales-assistant',
        name: 'Virtual Sales Assistant',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 3,
        position: [500, 100],
        parameters: {
          method: 'POST',
          url: config.virtualSalesAssistantEndpoint,
          sendBody: true,
          bodyParameters: {
            parameters: [
              {
                name: 'lead',
                value: "={{ $('inbound-webhook').item.json.lead }}",
              },
              {
                name: 'analysis',
                value: "={{ $('inbound-webhook').item.json.analysis }}",
              },
            ],
          },
        },
      },

      // Customer Retention for dormant leads
      {
        id: 'customer-retention',
        name: 'Customer Retention Agent',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 3,
        position: [500, 200],
        parameters: {
          method: 'POST',
          url: config.customerRetentionEndpoint,
          sendBody: true,
          bodyParameters: {
            parameters: [
              {
                name: 'lead',
                value: "={{ $('inbound-webhook').item.json.lead }}",
              },
            ],
          },
        },
      },

      // Feedback Collector for converted leads
      {
        id: 'feedback-collector',
        name: 'Review & Feedback Collector',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 3,
        position: [500, 300],
        parameters: {
          method: 'POST',
          url: config.feedbackCollectorEndpoint,
          sendBody: true,
          bodyParameters: {
            parameters: [
              {
                name: 'lead',
                value: "={{ $('inbound-webhook').item.json.lead }}",
              },
            ],
          },
        },
      },

      // CRM Management update
      {
        id: 'crm-update',
        name: 'CRM Management Update',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 3,
        position: [700, 200],
        parameters: {
          method: 'POST',
          url: config.crmManagementEndpoint,
          sendBody: true,
          bodyParameters: {
            parameters: [
              {
                name: 'leadId',
                value: "={{ $('inbound-webhook').item.json.lead.id }}",
              },
              {
                name: 'interaction',
                value: '={{ $json }}',
              },
              {
                name: 'source',
                value: 'inbound_processing',
              },
            ],
          },
        },
      },
    ];

    const connections = {
      'inbound-webhook': {
        main: [
          [
            {
              node: 'lead-type-switch',
              type: 'main',
              index: 0,
            },
          ],
        ],
      },
      'lead-type-switch': {
        main: [
          [
            {
              node: 'virtual-sales-assistant',
              type: 'main',
              index: 0,
            },
          ],
          [
            {
              node: 'customer-retention',
              type: 'main',
              index: 0,
            },
          ],
          [
            {
              node: 'feedback-collector',
              type: 'main',
              index: 0,
            },
          ],
        ],
      },
      'virtual-sales-assistant': {
        main: [
          [
            {
              node: 'crm-update',
              type: 'main',
              index: 0,
            },
          ],
        ],
      },
      'customer-retention': {
        main: [
          [
            {
              node: 'crm-update',
              type: 'main',
              index: 0,
            },
          ],
        ],
      },
      'feedback-collector': {
        main: [
          [
            {
              node: 'crm-update',
              type: 'main',
              index: 0,
            },
          ],
        ],
      },
    };

    return {
      id: '',
      name: 'Inbound Processing Workflow',
      active: true,
      nodes,
      connections,
      settings: {
        executionOrder: 'v1',
        saveManualExecutions: true,
      },
    };
  }

  /**
   * Generate outbound processing workflow template
   */
  static generateOutboundProcessingWorkflow(config: {
    leadGenerationEndpoint: string;
    appointmentCoordinatorEndpoint: string;
    crmManagementEndpoint: string;
  }): WorkflowDefinition {
    const nodes: WorkflowNode[] = [
      // Webhook trigger for outbound leads
      {
        id: 'outbound-webhook',
        name: 'Outbound Lead Webhook',
        type: 'n8n-nodes-base.webhook',
        typeVersion: 1,
        position: [100, 200],
        parameters: {
          path: 'outbound-processing',
          httpMethod: 'POST',
        },
      },

      // Lead Generation Agent
      {
        id: 'lead-generation',
        name: 'AI Lead Generation Agent',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 3,
        position: [300, 200],
        parameters: {
          method: 'POST',
          url: config.leadGenerationEndpoint,
          sendBody: true,
          bodyParameters: {
            parameters: [
              {
                name: 'lead',
                value: '={{ $json.lead }}',
              },
              {
                name: 'analysis',
                value: '={{ $json.analysis }}',
              },
            ],
          },
        },
      },

      // Check if appointment needed
      {
        id: 'appointment-check',
        name: 'Check Appointment Need',
        type: 'n8n-nodes-base.switch',
        typeVersion: 1,
        position: [500, 200],
        parameters: {
          conditions: {
            options: {
              caseSensitive: true,
            },
            conditions: [
              {
                leftValue: '={{ $json.needsAppointment }}',
                rightValue: true,
                operator: {
                  type: 'boolean',
                  operation: 'true',
                },
              },
            ],
          },
        },
      },

      // Appointment Coordinator
      {
        id: 'appointment-coordinator',
        name: 'Appointment & Workflow Coordinator',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 3,
        position: [700, 150],
        parameters: {
          method: 'POST',
          url: config.appointmentCoordinatorEndpoint,
          sendBody: true,
          bodyParameters: {
            parameters: [
              {
                name: 'lead',
                value: "={{ $('outbound-webhook').item.json.lead }}",
              },
              {
                name: 'generationResult',
                value: "={{ $('lead-generation').item.json }}",
              },
            ],
          },
        },
      },

      // CRM Management update
      {
        id: 'crm-update',
        name: 'CRM Management Update',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 3,
        position: [700, 250],
        parameters: {
          method: 'POST',
          url: config.crmManagementEndpoint,
          sendBody: true,
          bodyParameters: {
            parameters: [
              {
                name: 'leadId',
                value: "={{ $('outbound-webhook').item.json.lead.id }}",
              },
              {
                name: 'interaction',
                value: "={{ $('lead-generation').item.json }}",
              },
              {
                name: 'source',
                value: 'outbound_processing',
              },
            ],
          },
        },
      },
    ];

    const connections = {
      'outbound-webhook': {
        main: [
          [
            {
              node: 'lead-generation',
              type: 'main',
              index: 0,
            },
          ],
        ],
      },
      'lead-generation': {
        main: [
          [
            {
              node: 'appointment-check',
              type: 'main',
              index: 0,
            },
          ],
        ],
      },
      'appointment-check': {
        main: [
          [
            {
              node: 'appointment-coordinator',
              type: 'main',
              index: 0,
            },
          ],
          [
            {
              node: 'crm-update',
              type: 'main',
              index: 0,
            },
          ],
        ],
      },
      'appointment-coordinator': {
        main: [
          [
            {
              node: 'crm-update',
              type: 'main',
              index: 0,
            },
          ],
        ],
      },
    };

    return {
      id: '',
      name: 'Outbound Processing Workflow',
      active: true,
      nodes,
      connections,
      settings: {
        executionOrder: 'v1',
        saveManualExecutions: true,
      },
    };
  }

  /**
   * Generate optimization loop workflow template
   */
  static generateOptimizationLoopWorkflow(config: {
    analyticsAgentEndpoint: string;
    aiHeadAgentEndpoint: string;
    scheduleInterval: string;
  }): WorkflowDefinition {
    const nodes: WorkflowNode[] = [
      // Schedule trigger for optimization
      {
        id: 'schedule-trigger',
        name: 'Optimization Schedule',
        type: 'n8n-nodes-base.cron',
        typeVersion: 1,
        position: [100, 200],
        parameters: {
          rule: {
            interval: [
              {
                field: config.scheduleInterval || 'hour',
              },
            ],
          },
        },
      },

      // Analytics Agent data collection
      {
        id: 'analytics-collection',
        name: 'Analytics Data Collection',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 3,
        position: [300, 200],
        parameters: {
          method: 'GET',
          url: `${config.analyticsAgentEndpoint}/performance-data`,
        },
      },

      // Generate optimization recommendations
      {
        id: 'optimization-analysis',
        name: 'Generate Optimization Recommendations',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 3,
        position: [500, 200],
        parameters: {
          method: 'POST',
          url: `${config.analyticsAgentEndpoint}/optimize`,
          sendBody: true,
          bodyParameters: {
            parameters: [
              {
                name: 'performanceData',
                value: '={{ $json }}',
              },
            ],
          },
        },
      },

      // Apply optimizations to AI Head Agent
      {
        id: 'apply-optimizations',
        name: 'Apply Optimizations',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 3,
        position: [700, 200],
        parameters: {
          method: 'POST',
          url: `${config.aiHeadAgentEndpoint}/optimization-feedback`,
          sendBody: true,
          bodyParameters: {
            parameters: [
              {
                name: 'optimizations',
                value: '={{ $json }}',
              },
            ],
          },
        },
      },
    ];

    const connections = {
      'schedule-trigger': {
        main: [
          [
            {
              node: 'analytics-collection',
              type: 'main',
              index: 0,
            },
          ],
        ],
      },
      'analytics-collection': {
        main: [
          [
            {
              node: 'optimization-analysis',
              type: 'main',
              index: 0,
            },
          ],
        ],
      },
      'optimization-analysis': {
        main: [
          [
            {
              node: 'apply-optimizations',
              type: 'main',
              index: 0,
            },
          ],
        ],
      },
    };

    return {
      id: '',
      name: 'Optimization Loop Workflow',
      active: true,
      nodes,
      connections,
      settings: {
        executionOrder: 'v1',
        saveManualExecutions: true,
      },
    };
  }

  /**
   * Get all available workflow templates
   */
  static getAvailableTemplates(): WorkflowTemplateConfig[] {
    return [
      {
        name: 'Lead Routing Workflow',
        description:
          'Routes incoming leads to appropriate agents based on AI Head Agent analysis',
        type: 'lead_routing',
        triggers: [{ type: 'webhook', config: { path: 'lead-routing' } }],
        parameters: {
          aiHeadAgentEndpoint: 'http://localhost:3000/api/agents/ai-head',
          inboundAgentEndpoint: 'http://localhost:3000/api/agents/inbound',
          outboundAgentEndpoint: 'http://localhost:3000/api/agents/outbound',
        },
      },
      {
        name: 'Inbound Processing Workflow',
        description:
          'Processes inbound leads through appropriate specialized agents',
        type: 'inbound_processing',
        triggers: [{ type: 'webhook', config: { path: 'inbound-processing' } }],
        parameters: {
          virtualSalesAssistantEndpoint:
            'http://localhost:3000/api/agents/virtual-sales',
          customerRetentionEndpoint:
            'http://localhost:3000/api/agents/customer-retention',
          feedbackCollectorEndpoint:
            'http://localhost:3000/api/agents/feedback-collector',
          crmManagementEndpoint:
            'http://localhost:3000/api/agents/crm-management',
        },
      },
      {
        name: 'Outbound Processing Workflow',
        description:
          'Processes outbound leads through lead generation and appointment coordination',
        type: 'outbound_processing',
        triggers: [
          { type: 'webhook', config: { path: 'outbound-processing' } },
        ],
        parameters: {
          leadGenerationEndpoint:
            'http://localhost:3000/api/agents/lead-generation',
          appointmentCoordinatorEndpoint:
            'http://localhost:3000/api/agents/appointment-coordinator',
          crmManagementEndpoint:
            'http://localhost:3000/api/agents/crm-management',
        },
      },
      {
        name: 'Optimization Loop Workflow',
        description:
          'Continuously optimizes system performance based on analytics data',
        type: 'optimization_loop',
        triggers: [{ type: 'schedule', config: { interval: 'hour' } }],
        parameters: {
          analyticsAgentEndpoint: 'http://localhost:3000/api/agents/analytics',
          aiHeadAgentEndpoint: 'http://localhost:3000/api/agents/ai-head',
          scheduleInterval: 'hour',
        },
      },
    ];
  }
}
