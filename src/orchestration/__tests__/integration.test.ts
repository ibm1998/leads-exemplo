import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import { N8nClient } from "../n8n-client";
import { N8nWebhookServer } from "../webhook-server";
import { WorkflowManager } from "../workflow-manager";
import { WorkflowTemplateGenerator } from "../workflow-templates";
import { Lead, LeadType, LeadSource } from "../../types/lead";
import { LeadAnalysisResult } from "../../agents/ai-head-agent";

// Mock N8nClient
vi.mock("../n8n-client");
const MockedN8nClient = vi.mocked(N8nClient);

describe("n8n Orchestration Integration", () => {
  let n8nClient: any;
  let webhookServer: N8nWebhookServer;
  let workflowManager: WorkflowManager;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock N8nClient
    n8nClient = {
      getWorkflows: vi.fn(),
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

    MockedN8nClient.mockImplementation(() => n8nClient);

    webhookServer = new N8nWebhookServer(n8nClient);
    workflowManager = new WorkflowManager(n8nClient);
  });

  afterEach(async () => {
    await workflowManager.cleanup();
  });

  describe("Workflow Template Generation", () => {
    it("should generate lead routing workflow template", () => {
      const config = {
        aiHeadAgentEndpoint: "http://localhost:3000/api/agents/ai-head",
        inboundAgentEndpoint: "http://localhost:3000/api/agents/inbound",
        outboundAgentEndpoint: "http://localhost:3000/api/agents/outbound",
      };

      const workflow =
        WorkflowTemplateGenerator.generateLeadRoutingWorkflow(config);

      expect(workflow.name).toBe("Lead Routing Workflow");
      expect(workflow.active).toBe(true);
      expect(workflow.nodes).toHaveLength(6);

      // Check for required nodes
      const nodeTypes = workflow.nodes.map((node) => node.type);
      expect(nodeTypes).toContain("n8n-nodes-base.webhook");
      expect(nodeTypes).toContain("n8n-nodes-base.httpRequest");
      expect(nodeTypes).toContain("n8n-nodes-base.switch");
      expect(nodeTypes).toContain("n8n-nodes-base.respondToWebhook");

      // Check webhook configuration
      const webhookNode = workflow.nodes.find(
        (node) => node.type === "n8n-nodes-base.webhook"
      );
      expect(webhookNode?.parameters.path).toBe("lead-routing");
      expect(webhookNode?.parameters.httpMethod).toBe("POST");

      // Check AI Head Agent node
      const aiHeadNode = workflow.nodes.find(
        (node) => node.name === "AI Head Agent Analysis"
      );
      expect(aiHeadNode?.parameters.url).toBe(config.aiHeadAgentEndpoint);
    });

    it("should generate inbound processing workflow template", () => {
      const config = {
        virtualSalesAssistantEndpoint:
          "http://localhost:3000/api/agents/virtual-sales",
        customerRetentionEndpoint:
          "http://localhost:3000/api/agents/customer-retention",
        feedbackCollectorEndpoint:
          "http://localhost:3000/api/agents/feedback-collector",
        crmManagementEndpoint:
          "http://localhost:3000/api/agents/crm-management",
      };

      const workflow =
        WorkflowTemplateGenerator.generateInboundProcessingWorkflow(config);

      expect(workflow.name).toBe("Inbound Processing Workflow");
      expect(workflow.nodes).toHaveLength(6);

      // Check for agent-specific nodes
      const nodeNames = workflow.nodes.map((node) => node.name);
      expect(nodeNames).toContain("Virtual Sales Assistant");
      expect(nodeNames).toContain("Customer Retention Agent");
      expect(nodeNames).toContain("Review & Feedback Collector");
      expect(nodeNames).toContain("CRM Management Update");
    });

    it("should generate outbound processing workflow template", () => {
      const config = {
        leadGenerationEndpoint:
          "http://localhost:3000/api/agents/lead-generation",
        appointmentCoordinatorEndpoint:
          "http://localhost:3000/api/agents/appointment-coordinator",
        crmManagementEndpoint:
          "http://localhost:3000/api/agents/crm-management",
      };

      const workflow =
        WorkflowTemplateGenerator.generateOutboundProcessingWorkflow(config);

      expect(workflow.name).toBe("Outbound Processing Workflow");
      expect(workflow.nodes).toHaveLength(5);

      // Check for outbound-specific nodes
      const nodeNames = workflow.nodes.map((node) => node.name);
      expect(nodeNames).toContain("AI Lead Generation Agent");
      expect(nodeNames).toContain("Appointment & Workflow Coordinator");
    });

    it("should generate optimization loop workflow template", () => {
      const config = {
        analyticsAgentEndpoint: "http://localhost:3000/api/agents/analytics",
        aiHeadAgentEndpoint: "http://localhost:3000/api/agents/ai-head",
        scheduleInterval: "hour",
      };

      const workflow =
        WorkflowTemplateGenerator.generateOptimizationLoopWorkflow(config);

      expect(workflow.name).toBe("Optimization Loop Workflow");
      expect(workflow.nodes).toHaveLength(4);

      // Check for schedule trigger
      const scheduleNode = workflow.nodes.find(
        (node) => node.type === "n8n-nodes-base.cron"
      );
      expect(scheduleNode).toBeDefined();
      expect(scheduleNode?.parameters.rule.interval[0].field).toBe("hour");
    });
  });

  describe("Webhook Server Integration", () => {
    it("should handle lead routing webhook", async () => {
      const mockLead: Lead = {
        id: "test-lead-1",
        source: "website" as LeadSource,
        contactInfo: {
          name: "John Doe",
          email: "john@example.com",
          preferredChannel: "email",
          timezone: "UTC",
        },
        leadType: "hot" as LeadType,
        urgencyLevel: 8,
        intentSignals: ["requested_callback"],
        qualificationData: {
          qualificationScore: 0.8,
        },
        status: "new",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockAnalysis: LeadAnalysisResult = {
        leadId: "test-lead-1",
        leadType: "hot",
        urgencyLevel: 8,
        intentScore: 0.8,
        sourceQuality: 0.9,
        routingRecommendation: {
          targetAgent: "inbound",
          priority: "high",
          reasoning: ["Hot lead requires immediate attention"],
          estimatedResponseTime: 30,
          suggestedActions: ["Activate Virtual Sales Assistant"],
        },
        analysisTimestamp: new Date(),
        confidence: 0.9,
      };

      // Mock workflow execution
      const mockExecution = {
        id: "exec-123",
        workflowId: "workflow-123",
        status: "success" as const,
        startedAt: new Date(),
        data: { result: "routed" },
      };

      n8nClient.getWorkflows.mockResolvedValue([
        {
          id: "workflow-123",
          name: "Lead Routing Workflow",
          active: true,
        },
      ]);

      n8nClient.executeWorkflow.mockResolvedValue(mockExecution);

      const result = await webhookServer.triggerLeadRouting(
        mockLead,
        mockAnalysis
      );

      expect(result.success).toBe(true);
      expect(result.workflowExecutionId).toBe("exec-123");
      expect(n8nClient.executeWorkflow).toHaveBeenCalledWith(
        "workflow-123",
        expect.objectContaining({
          eventType: "lead_routed",
          data: { lead: mockLead, analysis: mockAnalysis },
        })
      );
    });

    it("should handle inbound processing webhook", async () => {
      const mockLead: Lead = {
        id: "test-lead-2",
        source: "gmail" as LeadSource,
        contactInfo: {
          name: "Jane Smith",
          email: "jane@example.com",
          preferredChannel: "email",
          timezone: "UTC",
        },
        leadType: "warm" as LeadType,
        urgencyLevel: 6,
        intentSignals: ["email_opened"],
        qualificationData: {
          qualificationScore: 0.6,
        },
        status: "contacted",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockAnalysis: LeadAnalysisResult = {
        leadId: "test-lead-2",
        leadType: "warm",
        urgencyLevel: 6,
        intentScore: 0.6,
        sourceQuality: 0.8,
        routingRecommendation: {
          targetAgent: "inbound",
          priority: "medium",
          reasoning: ["Warm lead needs nurturing"],
          estimatedResponseTime: 120,
          suggestedActions: ["Customer retention sequence"],
        },
        analysisTimestamp: new Date(),
        confidence: 0.8,
      };

      const mockExecution = {
        id: "exec-456",
        workflowId: "workflow-456",
        status: "success" as const,
        startedAt: new Date(),
        data: { result: "processed" },
      };

      n8nClient.getWorkflows.mockResolvedValue([
        {
          id: "workflow-456",
          name: "Inbound Processing Workflow",
          active: true,
        },
      ]);

      n8nClient.executeWorkflow.mockResolvedValue(mockExecution);

      const result = await webhookServer.triggerInboundProcessing(
        mockLead,
        mockAnalysis
      );

      expect(result.success).toBe(true);
      expect(result.workflowExecutionId).toBe("exec-456");
    });

    it("should handle outbound processing webhook", async () => {
      const mockLead: Lead = {
        id: "test-lead-3",
        source: "meta_ads" as LeadSource,
        contactInfo: {
          name: "Bob Johnson",
          phone: "+1234567890",
          preferredChannel: "sms",
          timezone: "UTC",
        },
        leadType: "cold" as LeadType,
        urgencyLevel: 3,
        intentSignals: [],
        qualificationData: {
          qualificationScore: 0.2,
        },
        status: "new",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockAnalysis: LeadAnalysisResult = {
        leadId: "test-lead-3",
        leadType: "cold",
        urgencyLevel: 3,
        intentScore: 0.2,
        sourceQuality: 0.9,
        routingRecommendation: {
          targetAgent: "outbound",
          priority: "low",
          reasoning: ["Cold lead requires outbound approach"],
          estimatedResponseTime: 300,
          suggestedActions: ["Cold outreach sequence"],
        },
        analysisTimestamp: new Date(),
        confidence: 0.7,
      };

      const mockExecution = {
        id: "exec-789",
        workflowId: "workflow-789",
        status: "success" as const,
        startedAt: new Date(),
        data: { result: "processed" },
      };

      n8nClient.getWorkflows.mockResolvedValue([
        {
          id: "workflow-789",
          name: "Outbound Processing Workflow",
          active: true,
        },
      ]);

      n8nClient.executeWorkflow.mockResolvedValue(mockExecution);

      const result = await webhookServer.triggerOutboundProcessing(
        mockLead,
        mockAnalysis
      );

      expect(result.success).toBe(true);
      expect(result.workflowExecutionId).toBe("exec-789");
    });

    it("should handle optimization loop trigger", async () => {
      const mockExecution = {
        id: "exec-opt",
        workflowId: "workflow-opt",
        status: "success" as const,
        startedAt: new Date(),
        data: { result: "optimized" },
      };

      n8nClient.getWorkflows.mockResolvedValue([
        {
          id: "workflow-opt",
          name: "Optimization Loop Workflow",
          active: true,
        },
      ]);

      n8nClient.executeWorkflow.mockResolvedValue(mockExecution);

      const result = await webhookServer.triggerOptimizationLoop();

      expect(result.success).toBe(true);
      expect(result.workflowExecutionId).toBe("exec-opt");
      expect(n8nClient.executeWorkflow).toHaveBeenCalledWith(
        "workflow-opt",
        expect.objectContaining({
          eventType: "optimization_triggered",
          data: {},
        })
      );
    });

    it("should handle webhook server HTTP endpoints", async () => {
      const app = webhookServer.getApp();

      // Test health endpoint
      const healthResponse = await request(app)
        .get("/webhooks/health")
        .expect(200);

      expect(healthResponse.body.status).toBe("healthy");
      expect(healthResponse.body.endpoints).toBeInstanceOf(Array);

      // Test lead routing webhook endpoint
      n8nClient.getWorkflows.mockResolvedValue([
        {
          id: "workflow-123",
          name: "Lead Routing Workflow",
          active: true,
        },
      ]);

      n8nClient.executeWorkflow.mockResolvedValue({
        id: "exec-123",
        workflowId: "workflow-123",
        status: "success",
        startedAt: new Date(),
      });

      const webhookResponse = await request(app)
        .post("/webhooks/lead-routing")
        .send({
          lead: {
            id: "test-lead",
            source: "website",
            contactInfo: { name: "Test User" },
          },
        })
        .expect(200);

      expect(webhookResponse.body.success).toBe(true);
      expect(webhookResponse.body.workflowExecutionId).toBe("exec-123");
    });
  });

  describe("Workflow Manager Integration", () => {
    it("should deploy and manage complete workflow lifecycle", async () => {
      // Mock n8n responses
      n8nClient.getWorkflows.mockResolvedValue([]);
      n8nClient.getWorkflowExecutions.mockResolvedValue([]);
      n8nClient.getWorkflowStats.mockResolvedValue({
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        averageExecutionTime: 0,
      });

      // Initialize workflow manager
      await workflowManager.initialize();

      // Deploy lead routing workflow
      const deployConfig = {
        name: "Integration Test Lead Routing",
        type: "lead_routing" as const,
        parameters: {
          aiHeadAgentEndpoint: "http://localhost:3000/api/agents/ai-head",
          inboundAgentEndpoint: "http://localhost:3000/api/agents/inbound",
          outboundAgentEndpoint: "http://localhost:3000/api/agents/outbound",
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
        id: "integration-workflow-id",
        name: "Integration Test Lead Routing",
        active: true,
        nodes: [],
        connections: {},
      };

      n8nClient.createWorkflow.mockResolvedValue(createdWorkflow);

      const workflowId = await workflowManager.deployWorkflow(deployConfig);

      expect(workflowId).toBe("integration-workflow-id");
      expect(n8nClient.createWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Integration Test Lead Routing",
          active: true,
        })
      );

      // Verify workflow status
      const status = workflowManager.getWorkflowStatus(workflowId);
      expect(status).toBeDefined();
      expect(status?.name).toBe("Integration Test Lead Routing");
      expect(status?.type).toBe("lead_routing");
      expect(status?.active).toBe(true);

      // Test workflow activation/deactivation
      await workflowManager.deactivateWorkflow(workflowId);
      expect(n8nClient.deactivateWorkflow).toHaveBeenCalledWith(workflowId);

      await workflowManager.activateWorkflow(workflowId);
      expect(n8nClient.activateWorkflow).toHaveBeenCalledWith(workflowId);

      // Test workflow update
      await workflowManager.updateWorkflow(workflowId, {
        name: "Updated Workflow",
      });
      expect(n8nClient.updateWorkflow).toHaveBeenCalledWith(workflowId, {
        name: "Updated Workflow",
      });

      // Test workflow deletion
      await workflowManager.deleteWorkflow(workflowId);
      expect(n8nClient.deleteWorkflow).toHaveBeenCalledWith(workflowId);

      const deletedStatus = workflowManager.getWorkflowStatus(workflowId);
      expect(deletedStatus).toBeUndefined();
    });

    it("should monitor workflow performance and generate alerts", async () => {
      // Setup workflow with poor performance
      const mockWorkflows = [
        {
          id: "failing-workflow",
          name: "Failing Workflow",
          active: true,
          nodes: [],
          connections: {},
        },
      ];

      n8nClient.getWorkflows.mockResolvedValue(mockWorkflows);
      n8nClient.getWorkflowExecutions.mockResolvedValue([]);

      // Mock poor performance stats
      n8nClient.getWorkflowStats.mockResolvedValue({
        totalExecutions: 20,
        successfulExecutions: 5,
        failedExecutions: 15,
        averageExecutionTime: 45000, // 45 seconds
        lastExecution: new Date(),
      });

      await workflowManager.initialize();

      // Test that the workflow was loaded with the correct metrics
      const status = workflowManager.getWorkflowStatus("failing-workflow");
      expect(status).toBeDefined();
      expect(status?.name).toBe("Failing Workflow");

      const metrics = workflowManager.getWorkflowMetrics("failing-workflow");
      expect(metrics).toBeDefined();
      expect(metrics?.totalExecutions).toBe(20);
      expect(metrics?.successfulExecutions).toBe(5);
      expect(metrics?.failedExecutions).toBe(15);
      expect(metrics?.errorRate).toBe(0.75); // 15/20 = 0.75

      // Test alert generation by directly calling the alert check method
      await (workflowManager as any).checkAlertConditions();

      const alerts = workflowManager.getActiveAlerts();
      expect(alerts.length).toBeGreaterThan(0);

      // Should have error rate alert
      const errorRateAlert = alerts.find(
        (alert) => alert.type === "error_rate"
      );
      expect(errorRateAlert).toBeDefined();
      expect(errorRateAlert?.severity).toBe("critical");

      // Should have execution time alert
      const executionTimeAlert = alerts.find(
        (alert) => alert.type === "execution_time"
      );
      expect(executionTimeAlert).toBeDefined();
      expect(executionTimeAlert?.severity).toBe("medium");

      // Test alert acknowledgment
      if (errorRateAlert) {
        workflowManager.acknowledgeAlert(errorRateAlert.id);
        const activeAlerts = workflowManager.getActiveAlerts();
        expect(
          activeAlerts.find((alert) => alert.id === errorRateAlert.id)
        ).toBeUndefined();
      }
    });

    it("should provide comprehensive system health summary", async () => {
      const mockWorkflows = [
        {
          id: "healthy-workflow",
          name: "Healthy Workflow",
          active: true,
          nodes: [],
          connections: {},
        },
        {
          id: "warning-workflow",
          name: "Warning Workflow",
          active: true,
          nodes: [],
          connections: {},
        },
        {
          id: "critical-workflow",
          name: "Critical Workflow",
          active: false,
          nodes: [],
          connections: {},
        },
      ];

      n8nClient.getWorkflows.mockResolvedValue(mockWorkflows);
      n8nClient.getWorkflowExecutions.mockResolvedValue([]);

      // Mock different performance for each workflow
      n8nClient.getWorkflowStats.mockImplementation((workflowId) => {
        if (workflowId === "healthy-workflow") {
          return Promise.resolve({
            totalExecutions: 100,
            successfulExecutions: 98,
            failedExecutions: 2,
            averageExecutionTime: 5000,
            lastExecution: new Date(),
          });
        } else if (workflowId === "warning-workflow") {
          return Promise.resolve({
            totalExecutions: 50,
            successfulExecutions: 40,
            failedExecutions: 10,
            averageExecutionTime: 35000,
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

      const summary = workflowManager.getSystemHealthSummary();

      expect(summary.totalWorkflows).toBe(3);
      expect(summary.activeWorkflows).toBe(2);
      expect(summary.totalExecutions).toBe(150);
      expect(summary.overallSuccessRate).toBeCloseTo(0.92); // 138/150
      expect(summary.healthyWorkflows).toBe(1);
      expect(summary.warningWorkflows).toBe(1);
      expect(summary.criticalWorkflows).toBe(1);
    });
  });

  describe("End-to-End Workflow Orchestration", () => {
    it("should orchestrate complete lead processing workflow", async () => {
      // Setup all required workflows
      const mockWorkflows = [
        {
          id: "lead-routing-wf",
          name: "Lead Routing Workflow",
          active: true,
        },
        {
          id: "inbound-processing-wf",
          name: "Inbound Processing Workflow",
          active: true,
        },
        {
          id: "outbound-processing-wf",
          name: "Outbound Processing Workflow",
          active: true,
        },
      ];

      n8nClient.getWorkflows.mockResolvedValue(mockWorkflows);
      n8nClient.getWorkflowExecutions.mockResolvedValue([]);
      n8nClient.getWorkflowStats.mockResolvedValue({
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        averageExecutionTime: 0,
      });

      await workflowManager.initialize();

      // Simulate lead processing flow
      const testLead: Lead = {
        id: "e2e-test-lead",
        source: "website" as LeadSource,
        contactInfo: {
          name: "E2E Test User",
          email: "e2e@example.com",
          preferredChannel: "email",
          timezone: "UTC",
        },
        leadType: "hot" as LeadType,
        urgencyLevel: 9,
        intentSignals: ["requested_callback", "asked_about_pricing"],
        qualificationData: {
          qualificationScore: 0.9,
        },
        status: "new",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const testAnalysis: LeadAnalysisResult = {
        leadId: "e2e-test-lead",
        leadType: "hot",
        urgencyLevel: 9,
        intentScore: 0.9,
        sourceQuality: 0.95,
        routingRecommendation: {
          targetAgent: "inbound",
          priority: "high",
          reasoning: [
            "Hot lead with high intent",
            "Immediate response required",
          ],
          estimatedResponseTime: 30,
          suggestedActions: [
            "Activate Virtual Sales Assistant",
            "Schedule immediate callback",
          ],
        },
        analysisTimestamp: new Date(),
        confidence: 0.95,
      };

      // Mock successful workflow executions
      n8nClient.executeWorkflow.mockImplementation((workflowId, data) => {
        return Promise.resolve({
          id: `exec-${workflowId}`,
          workflowId,
          status: "success" as const,
          startedAt: new Date(),
          data: { result: "processed", input: data },
        });
      });

      // Step 1: Lead routing
      const routingResult = await webhookServer.triggerLeadRouting(
        testLead,
        testAnalysis
      );
      expect(routingResult.success).toBe(true);
      expect(n8nClient.executeWorkflow).toHaveBeenCalledWith(
        "lead-routing-wf",
        expect.objectContaining({
          eventType: "lead_routed",
          data: { lead: testLead, analysis: testAnalysis },
        })
      );

      // Step 2: Inbound processing (based on routing decision)
      const inboundResult = await webhookServer.triggerInboundProcessing(
        testLead,
        testAnalysis
      );
      expect(inboundResult.success).toBe(true);
      expect(n8nClient.executeWorkflow).toHaveBeenCalledWith(
        "inbound-processing-wf",
        expect.objectContaining({
          eventType: "interaction_completed",
          data: { lead: testLead, analysis: testAnalysis },
        })
      );

      // Verify all workflow executions were successful
      expect(n8nClient.executeWorkflow).toHaveBeenCalledTimes(2);
    });
  });
});
