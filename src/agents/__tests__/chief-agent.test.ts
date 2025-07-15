import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  ChiefAgent,
  SystemStatus,
  AgentStatus,
  SystemOverride,
  StrategicDirective,
} from "../chief-agent";
import { AIHeadAgent } from "../ai-head-agent";

describe("ChiefAgent", () => {
  let chiefAgent: ChiefAgent;
  let mockAIHeadAgent: AIHeadAgent;

  beforeEach(() => {
    // Create mock AI Head Agent
    mockAIHeadAgent = {
      getPerformanceMetrics: vi.fn().mockReturnValue({
        totalLeadsAnalyzed: 100,
        averageAnalysisTime: 150,
        routingAccuracy: 0.85,
        averageConfidence: 0.78,
        rulePerformance: [],
      }),
    } as any;

    chiefAgent = new ChiefAgent(mockAIHeadAgent);
  });

  describe("Dashboard Metrics", () => {
    it("should provide real-time dashboard metrics", () => {
      const metrics = chiefAgent.getDashboardMetrics();

      expect(metrics).toHaveProperty("systemStatus");
      expect(metrics).toHaveProperty("activeAgents");
      expect(metrics).toHaveProperty("totalAgents");
      expect(metrics).toHaveProperty("currentLoad");
      expect(metrics).toHaveProperty("leadsProcessedToday");
      expect(metrics).toHaveProperty("averageResponseTime");
      expect(metrics).toHaveProperty("conversionRateToday");
      expect(metrics).toHaveProperty("appointmentsBookedToday");
      expect(metrics).toHaveProperty("activeAlerts");
      expect(metrics).toHaveProperty("criticalAlerts");
      expect(metrics).toHaveProperty("lastUpdated");

      expect(metrics.totalAgents).toBe(5); // Default initialized agents
      expect(metrics.systemStatus).toBe(SystemStatus.OPERATIONAL);
    });

    it("should calculate system status correctly", () => {
      const metrics = chiefAgent.getDashboardMetrics();
      expect(metrics.systemStatus).toBe(SystemStatus.OPERATIONAL);

      // Update an agent to error status
      chiefAgent.updateAgentStatus("ai-head-001", { status: "error" });
      const updatedMetrics = chiefAgent.getDashboardMetrics();
      expect(updatedMetrics.systemStatus).toBe(SystemStatus.DEGRADED);
    });

    it("should track active agents correctly", () => {
      const initialMetrics = chiefAgent.getDashboardMetrics();
      expect(initialMetrics.activeAgents).toBe(5);

      // Set one agent offline
      chiefAgent.updateAgentStatus("inbound-001", { status: "offline" });
      const updatedMetrics = chiefAgent.getDashboardMetrics();
      expect(updatedMetrics.activeAgents).toBe(4);
    });
  });

  describe("Agent Status Management", () => {
    it("should initialize agent statuses correctly", () => {
      const statuses = chiefAgent.getAllAgentStatuses();
      expect(statuses).toHaveLength(5);

      const agentTypes = statuses.map((s) => s.agentType);
      expect(agentTypes).toContain("ai_head");
      expect(agentTypes).toContain("inbound");
      expect(agentTypes).toContain("outbound");
      expect(agentTypes).toContain("crm");
      expect(agentTypes).toContain("analytics");
    });

    it("should update agent status correctly", () => {
      const agentId = "ai-head-001";
      const updates: Partial<AgentStatus> = {
        status: "busy",
        currentLoad: 0.8,
        errorCount: 2,
      };

      chiefAgent.updateAgentStatus(agentId, updates);
      const updatedStatus = chiefAgent.getAgentStatus(agentId);

      expect(updatedStatus?.status).toBe("busy");
      expect(updatedStatus?.currentLoad).toBe(0.8);
      expect(updatedStatus?.errorCount).toBe(2);
      expect(updatedStatus?.lastActivity).toBeInstanceOf(Date);
    });

    it("should throw error for non-existent agent", () => {
      expect(() => {
        chiefAgent.updateAgentStatus("non-existent", { status: "active" });
      }).toThrow("Agent non-existent not found");
    });

    it("should generate alerts for high error counts", () => {
      chiefAgent.updateAgentStatus("ai-head-001", { errorCount: 15 });

      const alerts = chiefAgent.getSystemAlerts();
      const errorAlert = alerts.find(
        (alert) =>
          alert.title === "High Error Count" && alert.source === "ai-head-001"
      );

      expect(errorAlert).toBeDefined();
      expect(errorAlert?.level).toBe("warning");
    });

    it("should generate alerts for offline agents", () => {
      chiefAgent.updateAgentStatus("inbound-001", { status: "offline" });

      const alerts = chiefAgent.getSystemAlerts();
      const offlineAlert = alerts.find(
        (alert) =>
          alert.title === "Agent Offline" && alert.source === "inbound-001"
      );

      expect(offlineAlert).toBeDefined();
      expect(offlineAlert?.level).toBe("error");
    });

    it("should generate alerts for high load", () => {
      chiefAgent.updateAgentStatus("outbound-001", { currentLoad: 0.95 });

      const alerts = chiefAgent.getSystemAlerts();
      const loadAlert = alerts.find(
        (alert) =>
          alert.title === "High Agent Load" && alert.source === "outbound-001"
      );

      expect(loadAlert).toBeDefined();
      expect(loadAlert?.level).toBe("warning");
    });
  });

  describe("System Overrides", () => {
    it("should issue system override correctly", () => {
      const overrideData = {
        type: "pause_agent" as const,
        targetAgent: "inbound-001",
        reason: "Maintenance required",
        issuedBy: "admin",
      };

      const overrideId = chiefAgent.issueSystemOverride(overrideData);
      expect(overrideId).toBeDefined();
      expect(typeof overrideId).toBe("string");

      // Check that agent was paused
      const agentStatus = chiefAgent.getAgentStatus("inbound-001");
      expect(agentStatus?.status).toBe("offline");
    });

    it("should handle emergency stop override", () => {
      const overrideData = {
        type: "emergency_stop" as const,
        reason: "Critical system issue",
        issuedBy: "admin",
      };

      chiefAgent.issueSystemOverride(overrideData);

      // All agents should be offline
      const statuses = chiefAgent.getAllAgentStatuses();
      statuses.forEach((status) => {
        expect(status.status).toBe("offline");
      });

      // Should have critical alert
      const alerts = chiefAgent.getSystemAlerts();
      const emergencyAlert = alerts.find(
        (alert) => alert.title === "Emergency Stop Activated"
      );
      expect(emergencyAlert).toBeDefined();
      expect(emergencyAlert?.level).toBe("critical");
    });

    it("should cancel system override", () => {
      const overrideData = {
        type: "pause_agent" as const,
        targetAgent: "inbound-001",
        reason: "Testing",
        issuedBy: "admin",
      };

      const overrideId = chiefAgent.issueSystemOverride(overrideData);
      chiefAgent.cancelSystemOverride(overrideId, "Test completed");

      const alerts = chiefAgent.getSystemAlerts();
      const cancelAlert = alerts.find(
        (alert) => alert.title === "System Override Cancelled"
      );
      expect(cancelAlert).toBeDefined();
    });

    it("should throw error for non-existent override", () => {
      expect(() => {
        chiefAgent.cancelSystemOverride("non-existent", "Test");
      }).toThrow("Override non-existent not found");
    });
  });

  describe("Strategic Directives", () => {
    it("should create strategic directive correctly", () => {
      const directiveData = {
        title: "Q4 Sales Push",
        description: "Increase outbound activity for Q4",
        type: "campaign" as const,
        priority: "high" as const,
        targetAgents: ["outbound-001"],
        parameters: { intensity: "high" },
        startDate: new Date(),
        createdBy: "manager",
      };

      const directiveId = chiefAgent.createStrategicDirective(directiveData);
      expect(directiveId).toBeDefined();

      const directives = chiefAgent.getStrategicDirectives();
      const createdDirective = directives.find((d) => d.id === directiveId);
      expect(createdDirective).toBeDefined();
      expect(createdDirective?.status).toBe("pending");
    });

    it("should activate strategic directive", () => {
      const directiveData = {
        title: "Test Campaign",
        description: "Test directive",
        type: "campaign" as const,
        priority: "medium" as const,
        targetAgents: ["outbound-001"],
        parameters: {},
        startDate: new Date(),
        createdBy: "admin",
      };

      const directiveId = chiefAgent.createStrategicDirective(directiveData);
      chiefAgent.activateStrategicDirective(directiveId);

      const activeDirectives = chiefAgent.getActiveStrategicDirectives();
      const activatedDirective = activeDirectives.find(
        (d) => d.id === directiveId
      );
      expect(activatedDirective).toBeDefined();
      expect(activatedDirective?.status).toBe("active");
    });

    it("should throw error for non-existent directive", () => {
      expect(() => {
        chiefAgent.activateStrategicDirective("non-existent");
      }).toThrow("Directive non-existent not found");
    });
  });

  describe("Alert Management", () => {
    it("should get system alerts correctly", () => {
      // Generate some alerts by updating agent status
      chiefAgent.updateAgentStatus("ai-head-001", { errorCount: 15 });
      chiefAgent.updateAgentStatus("inbound-001", { status: "offline" });

      const alerts = chiefAgent.getSystemAlerts();
      expect(alerts.length).toBeGreaterThan(0);

      // Should not include acknowledged alerts by default
      const acknowledgedAlerts = chiefAgent.getSystemAlerts(true);
      expect(acknowledgedAlerts.length).toBeGreaterThanOrEqual(alerts.length);
    });

    it("should acknowledge alerts", () => {
      chiefAgent.updateAgentStatus("ai-head-001", { errorCount: 15 });

      const alerts = chiefAgent.getSystemAlerts();
      const alertToAck = alerts[0];

      chiefAgent.acknowledgeAlert(alertToAck.id);

      const unacknowledgedAlerts = chiefAgent.getSystemAlerts();
      const acknowledgedAlert = unacknowledgedAlerts.find(
        (a) => a.id === alertToAck.id
      );
      expect(acknowledgedAlert).toBeUndefined();
    });
  });

  describe("Executive Reports", () => {
    it("should generate daily executive report", () => {
      const report = chiefAgent.generateExecutiveReport("daily");

      expect(report).toHaveProperty("id");
      expect(report).toHaveProperty("reportType", "daily");
      expect(report).toHaveProperty("period");
      expect(report).toHaveProperty("summary");
      expect(report).toHaveProperty("agentPerformance");
      expect(report).toHaveProperty("keyInsights");
      expect(report).toHaveProperty("recommendations");
      expect(report).toHaveProperty("alerts");
      expect(report).toHaveProperty("generatedAt");

      expect(report.summary).toHaveProperty("totalLeads");
      expect(report.summary).toHaveProperty("conversionRate");
      expect(report.summary).toHaveProperty("averageResponseTime");
      expect(report.summary).toHaveProperty("appointmentsBooked");
      expect(report.summary).toHaveProperty("revenue");
      expect(report.summary).toHaveProperty("customerSatisfaction");
    });

    it("should generate weekly executive report", () => {
      const report = chiefAgent.generateExecutiveReport("weekly");
      expect(report.reportType).toBe("weekly");

      // Check that period is approximately 7 days
      const periodDays = Math.ceil(
        (report.period.end.getTime() - report.period.start.getTime()) /
          (1000 * 60 * 60 * 24)
      );
      expect(periodDays).toBeGreaterThanOrEqual(7);
    });

    it("should generate custom period report", () => {
      const customPeriod = {
        start: new Date("2024-01-01"),
        end: new Date("2024-01-31"),
      };

      const report = chiefAgent.generateExecutiveReport("custom", customPeriod);
      expect(report.period.start).toEqual(customPeriod.start);
      expect(report.period.end).toEqual(customPeriod.end);
    });

    it("should include key insights in reports", () => {
      // Set up conditions for insights
      chiefAgent.updateAgentStatus("ai-head-001", {
        performance: {
          totalInteractions: 100,
          conversionRate: 0.85,
          averageResponseTime: 25000, // 25 seconds
          appointmentBookingRate: 0.7,
          customerSatisfactionScore: 4.5,
        },
      });

      const report = chiefAgent.generateExecutiveReport("daily");
      expect(report.keyInsights).toBeInstanceOf(Array);
      expect(report.keyInsights.length).toBeGreaterThan(0);
    });

    it("should include recommendations in reports", () => {
      // Create conditions that should generate recommendations
      chiefAgent.updateAgentStatus("ai-head-001", { currentLoad: 0.9 });

      const report = chiefAgent.generateExecutiveReport("daily");
      expect(report.recommendations).toBeInstanceOf(Array);
      expect(report.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe("System Health", () => {
    it("should calculate system health score correctly", () => {
      const healthScore = chiefAgent.getSystemHealthScore();
      expect(healthScore).toBeGreaterThanOrEqual(0);
      expect(healthScore).toBeLessThanOrEqual(1);
    });

    it("should reduce health score for offline agents", () => {
      const initialHealth = chiefAgent.getSystemHealthScore();

      chiefAgent.updateAgentStatus("ai-head-001", { status: "offline" });
      chiefAgent.updateAgentStatus("inbound-001", { status: "offline" });

      const reducedHealth = chiefAgent.getSystemHealthScore();
      expect(reducedHealth).toBeLessThan(initialHealth);
    });

    it("should reduce health score for high load", () => {
      const initialHealth = chiefAgent.getSystemHealthScore();

      chiefAgent.updateAgentStatus("ai-head-001", { currentLoad: 0.95 });

      const reducedHealth = chiefAgent.getSystemHealthScore();
      expect(reducedHealth).toBeLessThan(initialHealth);
    });

    it("should reduce health score for critical alerts", () => {
      const initialHealth = chiefAgent.getSystemHealthScore();

      // Generate critical alert through emergency stop
      chiefAgent.issueSystemOverride({
        type: "emergency_stop",
        reason: "Test critical alert",
        issuedBy: "test",
      });

      const reducedHealth = chiefAgent.getSystemHealthScore();
      expect(reducedHealth).toBeLessThan(initialHealth);
    });

    it("should track system uptime", async () => {
      // Wait a small amount to ensure uptime is greater than 0
      await new Promise((resolve) => setTimeout(resolve, 10));
      const uptime = chiefAgent.getSystemUptime();
      expect(uptime).toBeGreaterThanOrEqual(0);
      expect(typeof uptime).toBe("number");
    });
  });

  describe("Performance Integration", () => {
    it("should integrate with AI Head Agent performance metrics", () => {
      // Mock excellent routing accuracy to trigger the insight
      mockAIHeadAgent.getPerformanceMetrics = vi.fn().mockReturnValue({
        totalLeadsAnalyzed: 100,
        averageAnalysisTime: 150,
        routingAccuracy: 0.95, // Excellent accuracy
        averageConfidence: 0.78,
        rulePerformance: [],
      });

      const report = chiefAgent.generateExecutiveReport("daily");

      // Should include insights based on AI Head Agent performance
      expect(mockAIHeadAgent.getPerformanceMetrics).toHaveBeenCalled();

      // Check if routing accuracy insight is included when performance is good
      const routingInsight = report.keyInsights.find((insight) =>
        insight.includes("routing accuracy")
      );
      expect(routingInsight).toBeDefined();
    });

    it("should generate recommendations based on AI Head Agent performance", () => {
      // Mock poor routing accuracy
      mockAIHeadAgent.getPerformanceMetrics = vi.fn().mockReturnValue({
        totalLeadsAnalyzed: 100,
        averageAnalysisTime: 150,
        routingAccuracy: 0.6, // Poor accuracy
        averageConfidence: 0.78,
        rulePerformance: [],
      });

      const report = chiefAgent.generateExecutiveReport("daily");

      const routingRecommendation = report.recommendations.find((rec) =>
        rec.includes("routing rules")
      );
      expect(routingRecommendation).toBeDefined();
    });
  });
});
