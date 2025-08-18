import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WorkflowManager } from '../workflow-manager';
import { N8nClient } from '../n8n-client';

// Mock N8nClient
vi.mock('../n8n-client');
const MockedN8nClient = vi.mocked(N8nClient);

describe('WorkflowManager', () => {
  let workflowManager: WorkflowManager;
  let mockN8nClient: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock N8nClient instance
    mockN8nClient = {
      getWorkflows: vi.fn(),
      getWorkflow: vi.fn(),
      createWorkflow: vi.fn(),
      updateWorkflow: vi.fn(),
      deleteWorkflow: vi.fn(),
      activateWorkflow: vi.fn(),
      deactivateWorkflow: vi.fn(),
      executeWorkflow: vi.fn(),
      getWorkflowExecutions: vi.fn(),
      getWorkflowStats: vi.fn(),
      healthCheck: vi.fn(),
    };

    MockedN8nClient.mockImplementation(() => mockN8nClient);

    workflowManager = new WorkflowManager(mockN8nClient);
  });

  afterEach(async () => {
    await workflowManager.cleanup();
    vi.restoreAllMocks();
  });

  describe('initialize', () => {
    it('should initialize workflow manager successfully', async () => {
      const mockWorkflows = [
        {
          id: 'workflow-1',
          name: 'Lead Routing Workflow',
          active: true,
          nodes: [],
          connections: {},
        },
        {
          id: 'workflow-2',
          name: 'Inbound Processing Workflow',
          active: false,
          nodes: [],
          connections: {},
        },
      ];

      mockN8nClient.getWorkflows.mockResolvedValue(mockWorkflows);
      mockN8nClient.getWorkflowExecutions.mockResolvedValue([]);
      mockN8nClient.getWorkflowStats.mockResolvedValue({
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        averageExecutionTime: 0,
      });

      await workflowManager.initialize();

      expect(mockN8nClient.getWorkflows).toHaveBeenCalled();

      const statuses = workflowManager.getWorkflowStatuses();
      expect(statuses).toHaveLength(2);
      expect(statuses[0].name).toBe('Lead Routing Workflow');
      expect(statuses[0].type).toBe('lead_routing');
      expect(statuses[1].name).toBe('Inbound Processing Workflow');
      expect(statuses[1].type).toBe('inbound_processing');
    });

    it('should handle initialization errors', async () => {
      mockN8nClient.getWorkflows.mockRejectedValue(
        new Error('Connection failed')
      );

      await expect(workflowManager.initialize()).rejects.toThrow(
        'Connection failed'
      );
    });
  });

  describe('deployWorkflow', () => {
    it('should deploy lead routing workflow', async () => {
      const config = {
        name: 'Test Lead Routing',
        type: 'lead_routing' as const,
        parameters: {
          aiHeadAgentEndpoint: 'http://localhost:3000/api/agents/ai-head',
          inboundAgentEndpoint: 'http://localhost:3000/api/agents/inbound',
          outboundAgentEndpoint: 'http://localhost:3000/api/agents/outbound',
        },
        autoActivate: true,
        monitoring: {
          enabled: true,
          alertThresholds: {
            errorRate: 0.1,
            executionTime: 30000,
            failureCount: 5,
          },
        },
      };

      const createdWorkflow = {
        id: 'new-workflow-id',
        name: 'Test Lead Routing',
        active: true,
        nodes: [],
        connections: {},
      };

      mockN8nClient.createWorkflow.mockResolvedValue(createdWorkflow);

      const workflowId = await workflowManager.deployWorkflow(config);

      expect(workflowId).toBe('new-workflow-id');
      expect(mockN8nClient.createWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Lead Routing',
          active: true,
        })
      );

      const status = workflowManager.getWorkflowStatus('new-workflow-id');
      expect(status).toBeDefined();
      expect(status?.name).toBe('Test Lead Routing');
      expect(status?.type).toBe('lead_routing');
    });

    it('should deploy inbound processing workflow', async () => {
      const config = {
        name: 'Test Inbound Processing',
        type: 'inbound_processing' as const,
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
        autoActivate: false,
        monitoring: {
          enabled: true,
          alertThresholds: {
            errorRate: 0.1,
            executionTime: 30000,
            failureCount: 5,
          },
        },
      };

      const createdWorkflow = {
        id: 'inbound-workflow-id',
        name: 'Test Inbound Processing',
        active: false,
        nodes: [],
        connections: {},
      };

      mockN8nClient.createWorkflow.mockResolvedValue(createdWorkflow);

      const workflowId = await workflowManager.deployWorkflow(config);

      expect(workflowId).toBe('inbound-workflow-id');

      const status = workflowManager.getWorkflowStatus('inbound-workflow-id');
      expect(status?.type).toBe('inbound_processing');
      expect(status?.active).toBe(false);
    });

    it('should deploy outbound processing workflow', async () => {
      const config = {
        name: 'Test Outbound Processing',
        type: 'outbound_processing' as const,
        parameters: {
          leadGenerationEndpoint:
            'http://localhost:3000/api/agents/lead-generation',
          appointmentCoordinatorEndpoint:
            'http://localhost:3000/api/agents/appointment-coordinator',
          crmManagementEndpoint:
            'http://localhost:3000/api/agents/crm-management',
        },
        autoActivate: true,
        monitoring: {
          enabled: true,
          alertThresholds: {
            errorRate: 0.1,
            executionTime: 30000,
            failureCount: 5,
          },
        },
      };

      const createdWorkflow = {
        id: 'outbound-workflow-id',
        name: 'Test Outbound Processing',
        active: true,
        nodes: [],
        connections: {},
      };

      mockN8nClient.createWorkflow.mockResolvedValue(createdWorkflow);

      const workflowId = await workflowManager.deployWorkflow(config);

      expect(workflowId).toBe('outbound-workflow-id');

      const status = workflowManager.getWorkflowStatus('outbound-workflow-id');
      expect(status?.type).toBe('outbound_processing');
    });

    it('should deploy optimization loop workflow', async () => {
      const config = {
        name: 'Test Optimization Loop',
        type: 'optimization_loop' as const,
        parameters: {
          analyticsAgentEndpoint: 'http://localhost:3000/api/agents/analytics',
          aiHeadAgentEndpoint: 'http://localhost:3000/api/agents/ai-head',
          scheduleInterval: 'hour',
        },
        autoActivate: true,
        monitoring: {
          enabled: true,
          alertThresholds: {
            errorRate: 0.1,
            executionTime: 30000,
            failureCount: 5,
          },
        },
      };

      const createdWorkflow = {
        id: 'optimization-workflow-id',
        name: 'Test Optimization Loop',
        active: true,
        nodes: [],
        connections: {},
      };

      mockN8nClient.createWorkflow.mockResolvedValue(createdWorkflow);

      const workflowId = await workflowManager.deployWorkflow(config);

      expect(workflowId).toBe('optimization-workflow-id');

      const status = workflowManager.getWorkflowStatus(
        'optimization-workflow-id'
      );
      expect(status?.type).toBe('optimization_loop');
    });

    it('should handle unsupported workflow type', async () => {
      const config = {
        name: 'Unsupported Workflow',
        type: 'unsupported_type' as any,
        parameters: {},
        autoActivate: true,
        monitoring: {
          enabled: true,
          alertThresholds: {
            errorRate: 0.1,
            executionTime: 30000,
            failureCount: 5,
          },
        },
      };

      await expect(workflowManager.deployWorkflow(config)).rejects.toThrow(
        'Unsupported workflow type: unsupported_type'
      );
    });
  });

  describe('workflow management', () => {
    beforeEach(async () => {
      // Setup a test workflow
      const mockWorkflows = [
        {
          id: 'test-workflow',
          name: 'Test Workflow',
          active: true,
          nodes: [],
          connections: {},
        },
      ];

      mockN8nClient.getWorkflows.mockResolvedValue(mockWorkflows);
      mockN8nClient.getWorkflowExecutions.mockResolvedValue([]);
      mockN8nClient.getWorkflowStats.mockResolvedValue({
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        averageExecutionTime: 0,
      });

      await workflowManager.initialize();
    });

    it('should update workflow', async () => {
      const updates = { name: 'Updated Test Workflow' };

      await workflowManager.updateWorkflow('test-workflow', updates);

      expect(mockN8nClient.updateWorkflow).toHaveBeenCalledWith(
        'test-workflow',
        updates
      );

      const status = workflowManager.getWorkflowStatus('test-workflow');
      expect(status?.name).toBe('Updated Test Workflow');
    });

    it('should activate workflow', async () => {
      await workflowManager.activateWorkflow('test-workflow');

      expect(mockN8nClient.activateWorkflow).toHaveBeenCalledWith(
        'test-workflow'
      );

      const status = workflowManager.getWorkflowStatus('test-workflow');
      expect(status?.active).toBe(true);
    });

    it('should deactivate workflow', async () => {
      await workflowManager.deactivateWorkflow('test-workflow');

      expect(mockN8nClient.deactivateWorkflow).toHaveBeenCalledWith(
        'test-workflow'
      );

      const status = workflowManager.getWorkflowStatus('test-workflow');
      expect(status?.active).toBe(false);
    });

    it('should delete workflow', async () => {
      await workflowManager.deleteWorkflow('test-workflow');

      expect(mockN8nClient.deleteWorkflow).toHaveBeenCalledWith(
        'test-workflow'
      );

      const status = workflowManager.getWorkflowStatus('test-workflow');
      expect(status).toBeUndefined();
    });
  });

  describe('monitoring', () => {
    beforeEach(async () => {
      const mockWorkflows = [
        {
          id: 'monitored-workflow',
          name: 'Monitored Workflow',
          active: true,
          nodes: [],
          connections: {},
        },
      ];

      mockN8nClient.getWorkflows.mockResolvedValue(mockWorkflows);
      mockN8nClient.getWorkflowExecutions.mockResolvedValue([]);
      mockN8nClient.getWorkflowStats.mockResolvedValue({
        totalExecutions: 10,
        successfulExecutions: 8,
        failedExecutions: 2,
        averageExecutionTime: 5000,
        lastExecution: new Date(),
      });

      await workflowManager.initialize();
    });

    it('should start and stop monitoring', async () => {
      await workflowManager.startMonitoring(50); // Short interval for testing

      // Wait for monitoring to run at least once
      await new Promise((resolve) => setTimeout(resolve, 100));

      workflowManager.stopMonitoring();

      // Verify metrics were updated during initialization
      const metrics = workflowManager.getWorkflowMetrics('monitored-workflow');
      expect(metrics).toBeDefined();
      expect(metrics?.totalExecutions).toBe(10);
      expect(metrics?.successfulExecutions).toBe(8);
      expect(metrics?.failedExecutions).toBe(2);
    });

    it('should calculate health status correctly', async () => {
      // Test the health calculation logic directly
      const status = workflowManager.getWorkflowStatus('monitored-workflow');
      expect(status).toBeDefined();

      // Test critical health status by directly updating the status
      if (status) {
        status.successRate = 0.2; // 20% success rate should be critical
        status.executionCount = 20;
        status.active = true;

        // Access the private calculateHealthStatus method
        const health = (workflowManager as any).calculateHealthStatus(status);
        expect(health).toBe('critical');
      }
    });

    it('should generate alerts for high error rate', async () => {
      // Test alert generation logic directly by calling the private method
      const workflowId = 'monitored-workflow';
      const metrics = workflowManager.getWorkflowMetrics(workflowId);

      if (metrics) {
        // Set up high error rate scenario
        metrics.errorRate = 0.8; // 80% error rate
        metrics.totalExecutions = 10;

        // Access the private checkAlertConditions method
        await (workflowManager as any).checkAlertConditions();

        const alerts = workflowManager.getActiveAlerts();
        const errorRateAlert = alerts.find(
          (alert) => alert.type === 'error_rate'
        );

        expect(errorRateAlert).toBeDefined();
        expect(errorRateAlert?.severity).toBe('critical');
        expect(errorRateAlert?.workflowId).toBe(workflowId);
      }
    });

    it('should generate alerts for slow execution time', async () => {
      // Test alert generation for slow execution time
      const workflowId = 'monitored-workflow';
      const metrics = workflowManager.getWorkflowMetrics(workflowId);

      if (metrics) {
        // Set up slow execution time scenario
        metrics.averageExecutionTime = 45000; // 45 seconds (above 30s threshold)
        metrics.totalExecutions = 10;

        // Access the private checkAlertConditions method
        await (workflowManager as any).checkAlertConditions();

        const alerts = workflowManager.getActiveAlerts();
        const executionTimeAlert = alerts.find(
          (alert) => alert.type === 'execution_time'
        );

        expect(executionTimeAlert).toBeDefined();
        expect(executionTimeAlert?.severity).toBe('medium');
        expect(executionTimeAlert?.workflowId).toBe(workflowId);
        expect(executionTimeAlert?.currentValue).toBe(45000);
      }
    });

    it('should acknowledge alerts', async () => {
      // Create an alert first by directly calling the private method
      const workflowId = 'monitored-workflow';
      const alertData = {
        workflowId,
        type: 'error_rate' as const,
        threshold: 0.2,
        currentValue: 0.8,
        severity: 'critical' as const,
        message: 'High error rate: 80%',
      };

      // Access the private createAlert method
      (workflowManager as any).createAlert(alertData);

      const alerts = workflowManager.getActiveAlerts();
      expect(alerts.length).toBe(1);

      const alertId = alerts[0].id;
      workflowManager.acknowledgeAlert(alertId);

      const activeAlerts = workflowManager.getActiveAlerts();
      expect(
        activeAlerts.find((alert) => alert.id === alertId)
      ).toBeUndefined();
    });
  });

  describe('system health summary', () => {
    beforeEach(async () => {
      const mockWorkflows = [
        {
          id: 'healthy-workflow',
          name: 'Healthy Workflow',
          active: true,
          nodes: [],
          connections: {},
        },
        {
          id: 'warning-workflow',
          name: 'Warning Workflow',
          active: true,
          nodes: [],
          connections: {},
        },
        {
          id: 'critical-workflow',
          name: 'Critical Workflow',
          active: false,
          nodes: [],
          connections: {},
        },
      ];

      mockN8nClient.getWorkflows.mockResolvedValue(mockWorkflows);

      // Mock different stats for each workflow
      mockN8nClient.getWorkflowExecutions.mockImplementation((workflowId) => {
        if (workflowId === 'healthy-workflow') {
          return Promise.resolve([]);
        } else if (workflowId === 'warning-workflow') {
          return Promise.resolve([]);
        } else {
          return Promise.resolve([]);
        }
      });

      mockN8nClient.getWorkflowStats.mockImplementation((workflowId) => {
        if (workflowId === 'healthy-workflow') {
          return Promise.resolve({
            totalExecutions: 10,
            successfulExecutions: 10,
            failedExecutions: 0,
            averageExecutionTime: 5000,
            lastExecution: new Date(),
          });
        } else if (workflowId === 'warning-workflow') {
          return Promise.resolve({
            totalExecutions: 10,
            successfulExecutions: 7,
            failedExecutions: 3,
            averageExecutionTime: 35000, // Slow execution
            lastExecution: new Date(),
          });
        } else {
          return Promise.resolve({
            totalExecutions: 0,
            successfulExecutions: 0,
            failedExecutions: 0,
            averageExecutionTime: 0,
          });
        }
      });

      await workflowManager.initialize();
    });

    it('should provide system health summary', () => {
      const summary = workflowManager.getSystemHealthSummary();

      expect(summary.totalWorkflows).toBe(3);
      expect(summary.activeWorkflows).toBe(2);
      expect(summary.totalExecutions).toBe(20);
      expect(summary.overallSuccessRate).toBe(0.85); // 17/20
    });
  });

  describe('performance metrics', () => {
    it('should track performance metrics', async () => {
      const mockWorkflows = [
        {
          id: 'perf-workflow',
          name: 'Performance Workflow',
          active: true,
          nodes: [],
          connections: {},
        },
      ];

      const mockExecutions = [
        {
          id: 'exec-1',
          status: 'success',
          startedAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
          finishedAt: new Date(Date.now() - 29 * 60 * 1000),
        },
        {
          id: 'exec-2',
          status: 'success',
          startedAt: new Date(Date.now() - 20 * 60 * 1000), // 20 minutes ago
          finishedAt: new Date(Date.now() - 19 * 60 * 1000),
        },
      ];

      mockN8nClient.getWorkflows.mockResolvedValue(mockWorkflows);
      mockN8nClient.getWorkflowExecutions.mockResolvedValue(
        mockExecutions as any
      );
      mockN8nClient.getWorkflowStats.mockResolvedValue({
        totalExecutions: 2,
        successfulExecutions: 2,
        failedExecutions: 0,
        averageExecutionTime: 60000,
        lastExecution: new Date(),
      });

      await workflowManager.initialize();

      const metrics = workflowManager.getWorkflowMetrics('perf-workflow');
      expect(metrics).toBeDefined();
      expect(metrics?.totalExecutions).toBe(2);
      expect(metrics?.successfulExecutions).toBe(2);
      expect(metrics?.errorRate).toBe(0);
      expect(metrics?.executionsPerHour).toBe(2); // Both executions within last hour
    });
  });
});
