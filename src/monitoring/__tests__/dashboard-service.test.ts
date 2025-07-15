import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import express, { Express } from "express";
import request from "supertest";
import { DashboardService } from "../dashboard-service";
import { ChiefAgent } from "../../agents/chief-agent";
import { AIHeadAgent } from "../../agents/ai-head-agent";

describe("DashboardService", () => {
  let app: Express;
  let dashboardService: DashboardService;
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
    dashboardService = new DashboardService(chiefAgent);

    app = express();
    app.use(express.json());
    dashboardService.setupRoutes(app);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Dashboard Data Endpoints", () => {
    it("should provide dashboard data", async () => {
      const response = await request(app).get("/api/dashboard").expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("metrics");
      expect(response.body.data).toHaveProperty("agentStatuses");
      expect(response.body.data).toHaveProperty("recentAlerts");
      expect(response.body.data).toHaveProperty("systemHealth");
    });

    it("should handle dashboard data errors gracefully", async () => {
      // Mock an error in the chief agent
      vi.spyOn(chiefAgent, "getDashboardMetrics").mockImplementation(() => {
        throw new Error("Test error");
      });

      const response = await request(app).get("/api/dashboard").expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Test error");
    });

    it("should provide system health data", async () => {
      const response = await request(app).get("/api/health").expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("status");
      expect(response.body.data).toHaveProperty("healthScore");
      expect(response.body.data).toHaveProperty("uptime");
      expect(response.body.data).toHaveProperty("metrics");
    });
  });

  describe("Agent Management Endpoints", () => {
    it("should get all agent statuses", async () => {
      const response = await request(app).get("/api/agents").expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBe(5); // Default agents
    });

    it("should get specific agent status", async () => {
      const response = await request(app)
        .get("/api/agents/ai-head-001")
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("agentId", "ai-head-001");
      expect(response.body.data).toHaveProperty("agentType");
      expect(response.body.data).toHaveProperty("status");
    });

    it("should return 404 for non-existent agent", async () => {
      const response = await request(app)
        .get("/api/agents/non-existent")
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Agent not found");
    });

    it("should update agent status", async () => {
      const updateData = {
        status: "busy",
        currentLoad: 0.8,
      };

      const response = await request(app)
        .put("/api/agents/ai-head-001/status")
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("Agent status updated successfully");
    });
  });

  describe("System Override Endpoints", () => {
    it("should create system override", async () => {
      const overrideData = {
        type: "pause_agent",
        targetAgent: "inbound-001",
        reason: "Maintenance required",
        issuedBy: "admin",
      };

      const response = await request(app)
        .post("/api/overrides")
        .send(overrideData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("overrideId");
      expect(response.body.message).toBe(
        "System override created successfully"
      );
    });

    it("should validate required fields for system override", async () => {
      const incompleteData = {
        type: "pause_agent",
        // Missing required fields
      };

      const response = await request(app)
        .post("/api/overrides")
        .send(incompleteData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("Missing required fields");
    });

    it("should get system overrides", async () => {
      // First create an override
      const overrideData = {
        type: "pause_agent",
        targetAgent: "inbound-001",
        reason: "Test",
        issuedBy: "admin",
      };

      await request(app).post("/api/overrides").send(overrideData);

      const response = await request(app).get("/api/overrides").expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
    });

    it("should cancel system override", async () => {
      // First create an override
      const overrideData = {
        type: "pause_agent",
        targetAgent: "inbound-001",
        reason: "Test",
        issuedBy: "admin",
      };

      const createResponse = await request(app)
        .post("/api/overrides")
        .send(overrideData);
      const overrideId = createResponse.body.data.overrideId;

      const cancelData = { reason: "Test completed" };
      const response = await request(app)
        .delete(`/api/overrides/${overrideId}`)
        .send(cancelData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe(
        "System override cancelled successfully"
      );
    });

    it("should require reason for cancelling override", async () => {
      const response = await request(app)
        .delete("/api/overrides/test-id")
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Cancellation reason is required");
    });
  });

  describe("Strategic Directive Endpoints", () => {
    it("should create strategic directive", async () => {
      const directiveData = {
        title: "Q4 Sales Push",
        description: "Increase outbound activity",
        type: "campaign",
        priority: "high",
        targetAgents: ["outbound-001"],
        parameters: { intensity: "high" },
        startDate: new Date().toISOString(),
        createdBy: "manager",
      };

      const response = await request(app)
        .post("/api/directives")
        .send(directiveData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("directiveId");
      expect(response.body.message).toBe(
        "Strategic directive created successfully"
      );
    });

    it("should validate required fields for strategic directive", async () => {
      const incompleteData = {
        title: "Test Directive",
        // Missing required fields
      };

      const response = await request(app)
        .post("/api/directives")
        .send(incompleteData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("Missing required fields");
    });

    it("should get strategic directives", async () => {
      const response = await request(app).get("/api/directives").expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
    });

    it("should filter directives by status", async () => {
      const response = await request(app)
        .get("/api/directives?status=active")
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
    });

    it("should activate strategic directive", async () => {
      // First create a directive
      const directiveData = {
        title: "Test Campaign",
        description: "Test directive",
        type: "campaign",
        priority: "medium",
        targetAgents: ["outbound-001"],
        parameters: {},
        startDate: new Date().toISOString(),
        createdBy: "admin",
      };

      const createResponse = await request(app)
        .post("/api/directives")
        .send(directiveData);
      const directiveId = createResponse.body.data.directiveId;

      const response = await request(app)
        .put(`/api/directives/${directiveId}/activate`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe(
        "Strategic directive activated successfully"
      );
    });
  });

  describe("Alert Management Endpoints", () => {
    it("should get system alerts", async () => {
      // Generate some alerts
      chiefAgent.updateAgentStatus("ai-head-001", { errorCount: 15 });

      const response = await request(app).get("/api/alerts").expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
    });

    it("should include acknowledged alerts when requested", async () => {
      const response = await request(app)
        .get("/api/alerts?includeAcknowledged=true")
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
    });

    it("should acknowledge alert", async () => {
      // Generate an alert
      chiefAgent.updateAgentStatus("ai-head-001", { errorCount: 15 });
      const alerts = chiefAgent.getSystemAlerts();
      const alertId = alerts[0]?.id;

      if (alertId) {
        const response = await request(app)
          .put(`/api/alerts/${alertId}/acknowledge`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe("Alert acknowledged successfully");
      }
    });
  });

  describe("Executive Report Endpoints", () => {
    it("should generate daily report", async () => {
      const response = await request(app).get("/api/reports/daily").expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("reportType", "daily");
      expect(response.body.data).toHaveProperty("summary");
      expect(response.body.data).toHaveProperty("agentPerformance");
      expect(response.body.data).toHaveProperty("keyInsights");
      expect(response.body.data).toHaveProperty("recommendations");
    });

    it("should generate custom period report", async () => {
      const startDate = "2024-01-01";
      const endDate = "2024-01-31";

      const response = await request(app)
        .get(`/api/reports/custom?startDate=${startDate}&endDate=${endDate}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.reportType).toBe("custom");
    });

    it("should get available report types", async () => {
      const response = await request(app).get("/api/reports").expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("reportTypes");
      expect(response.body.data).toHaveProperty("description");
      expect(response.body.data.reportTypes).toContain("daily");
      expect(response.body.data.reportTypes).toContain("weekly");
      expect(response.body.data.reportTypes).toContain("monthly");
    });
  });

  describe("Real-time Updates", () => {
    it("should setup server-sent events endpoint", async () => {
      // Test the SSE endpoint properly by checking initial response and data stream
      return new Promise<void>((resolve, reject) => {
        const req = request(app)
          .get("/api/dashboard/stream")
          .expect(200)
          .expect("Content-Type", "text/event-stream")
          .expect("Cache-Control", "no-cache")
          .expect("Connection", "keep-alive");

        let dataReceived = false;
        let timeoutId: NodeJS.Timeout;

        req.on("response", (res) => {
          // Verify SSE headers are set correctly
          expect(res.headers["content-type"]).toBe("text/event-stream");
          expect(res.headers["cache-control"]).toBe("no-cache");
          expect(res.headers["connection"]).toBe("keep-alive");
        });

        // Listen for data events (SSE messages)
        req.on("data", (chunk) => {
          const data = chunk.toString();
          console.log("Received data:", data); // Debug logging

          // Verify we receive SSE-formatted data
          if (data.startsWith("data: ")) {
            dataReceived = true;

            // Parse the JSON data
            try {
              const jsonData = JSON.parse(data.substring(6)); // Remove 'data: ' prefix
              expect(jsonData).toHaveProperty("metrics");
              expect(jsonData).toHaveProperty("agentStatuses");
              expect(jsonData).toHaveProperty("systemHealth");

              // Clean up and resolve
              clearTimeout(timeoutId);
              req.abort();
              resolve();
            } catch (error) {
              clearTimeout(timeoutId);
              req.abort();
              reject(new Error(`Invalid SSE data format: ${error}`));
            }
          }
        });

        req.on("error", (err) => {
          // Ignore connection reset errors from abort()
          if (err.code !== "ECONNRESET" && err.code !== "ECONNABORTED") {
            clearTimeout(timeoutId);
            reject(err);
          }
        });

        // Set a reasonable timeout for receiving first data
        timeoutId = setTimeout(() => {
          req.abort();
          if (!dataReceived) {
            reject(new Error("No SSE data received within timeout period"));
          } else {
            resolve();
          }
        }, 5000); // 5 second timeout - increased for async operations
      });
    });

    it("should track dashboard statistics", () => {
      const stats = dashboardService.getDashboardStats();

      expect(stats).toHaveProperty("connectedClients");
      expect(stats).toHaveProperty("totalAlerts");
      expect(stats).toHaveProperty("activeOverrides");
      expect(stats).toHaveProperty("activeDirectives");

      expect(typeof stats.connectedClients).toBe("number");
      expect(typeof stats.totalAlerts).toBe("number");
      expect(typeof stats.activeOverrides).toBe("number");
      expect(typeof stats.activeDirectives).toBe("number");
    });
  });

  describe("Error Handling", () => {
    it("should handle internal server errors gracefully", async () => {
      // Mock a method to throw an error
      vi.spyOn(chiefAgent, "getAllAgentStatuses").mockImplementation(() => {
        throw new Error("Database connection failed");
      });

      const response = await request(app).get("/api/agents").expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Database connection failed");
    });
  });

  describe("Filtering and Querying", () => {
    it("should filter agents by type", async () => {
      const response = await request(app)
        .get("/api/agents?agentTypes=inbound,outbound")
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
    });

    it("should filter alerts by level", async () => {
      // Generate alerts of different levels
      chiefAgent.updateAgentStatus("ai-head-001", { errorCount: 15 }); // warning
      chiefAgent.updateAgentStatus("inbound-001", { status: "offline" }); // error

      const response = await request(app)
        .get("/api/alerts?alertLevels=warning")
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
    });

    it("should filter by date range", async () => {
      const startDate = new Date().toISOString();
      const endDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      const response = await request(app)
        .get(`/api/alerts?startDate=${startDate}&endDate=${endDate}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
    });
  });

  describe("Integration with Chief Agent", () => {
    it("should reflect chief agent state changes", async () => {
      // Update agent status through chief agent
      chiefAgent.updateAgentStatus("ai-head-001", {
        status: "busy",
        currentLoad: 0.9,
      });

      const response = await request(app)
        .get("/api/agents/ai-head-001")
        .expect(200);

      expect(response.body.data.status).toBe("busy");
      expect(response.body.data.currentLoad).toBe(0.9);
    });

    it("should show system overrides in dashboard data", async () => {
      // Create an override through the API
      const overrideData = {
        type: "pause_agent",
        targetAgent: "inbound-001",
        reason: "Test integration",
        issuedBy: "test",
      };

      await request(app).post("/api/overrides").send(overrideData);

      const response = await request(app).get("/api/dashboard").expect(200);

      expect(response.body.data.activeOverrides).toBeInstanceOf(Array);
      expect(response.body.data.activeOverrides.length).toBeGreaterThan(0);
    });

    it("should show strategic directives in dashboard data", async () => {
      // Create a directive and activate it
      const directiveData = {
        title: "Integration Test",
        description: "Test directive",
        type: "campaign",
        priority: "medium",
        targetAgents: ["outbound-001"],
        parameters: {},
        startDate: new Date().toISOString(),
        createdBy: "test",
      };

      const createResponse = await request(app)
        .post("/api/directives")
        .send(directiveData);
      const directiveId = createResponse.body.data.directiveId;

      await request(app).put(`/api/directives/${directiveId}/activate`);

      const response = await request(app).get("/api/dashboard").expect(200);

      expect(response.body.data.activeDirectives).toBeInstanceOf(Array);
      expect(response.body.data.activeDirectives.length).toBeGreaterThan(0);
    });
  });
});
