import { describe, it, expect, beforeEach } from "vitest";
import {
  AgentPerformance,
  AgentPerformanceModel,
  AgentPerformanceValidation,
  CreateAgentPerformance,
  PerformanceMetrics,
  ScriptMetrics,
  DateRange,
} from "../agent-performance";
import { ValidationError } from "../validation";

describe("AgentPerformanceValidation", () => {
  const validDateRange: DateRange = {
    start: new Date("2024-01-01"),
    end: new Date("2024-01-31"),
  };

  const validPerformanceMetrics: PerformanceMetrics = {
    totalInteractions: 100,
    conversionRate: 0.75,
    averageResponseTime: 45000, // 45 seconds
    appointmentBookingRate: 0.6,
    customerSatisfactionScore: 4.2,
  };

  const validScriptMetrics: ScriptMetrics = {
    scriptId: "script-123",
    scriptName: "Qualification Script v1",
    usageCount: 50,
    successRate: 0.8,
    averageResponseTime: 30000,
    conversionRate: 0.7,
  };

  const validAgentPerformance: AgentPerformance = {
    id: "123e4567-e89b-12d3-a456-426614174000",
    agentId: "agent-123",
    period: validDateRange,
    metrics: validPerformanceMetrics,
    scriptPerformance: [validScriptMetrics],
    optimizationSuggestions: [
      "Improve response time",
      "Use more empathetic language",
    ],
    createdAt: new Date(),
  };

  describe("validateAgentPerformance", () => {
    it("should validate correct agent performance data", () => {
      const result = AgentPerformanceValidation.validateAgentPerformance(
        validAgentPerformance
      );
      expect(result.success).toBe(true);
    });

    it("should reject performance with invalid ID", () => {
      const invalidPerformance = { ...validAgentPerformance, id: "invalid-id" };
      const result =
        AgentPerformanceValidation.validateAgentPerformance(invalidPerformance);
      expect(result.success).toBe(false);
    });

    it("should reject performance with negative total interactions", () => {
      const invalidPerformance = {
        ...validAgentPerformance,
        metrics: { ...validPerformanceMetrics, totalInteractions: -1 },
      };
      const result =
        AgentPerformanceValidation.validateAgentPerformance(invalidPerformance);
      expect(result.success).toBe(false);
    });

    it("should reject performance with conversion rate > 1", () => {
      const invalidPerformance = {
        ...validAgentPerformance,
        metrics: { ...validPerformanceMetrics, conversionRate: 1.5 },
      };
      const result =
        AgentPerformanceValidation.validateAgentPerformance(invalidPerformance);
      expect(result.success).toBe(false);
    });
  });

  describe("validateDateRange", () => {
    it("should validate correct date range", () => {
      const result =
        AgentPerformanceValidation.validateDateRange(validDateRange);
      expect(result.success).toBe(true);
    });

    it("should reject date range where start > end", () => {
      const invalidRange = {
        start: new Date("2024-01-31"),
        end: new Date("2024-01-01"),
      };
      const result = AgentPerformanceValidation.validateDateRange(invalidRange);
      expect(result.success).toBe(false);
    });
  });

  describe("business logic validation", () => {
    it("should identify performance above threshold", () => {
      expect(
        AgentPerformanceValidation.isPerformanceAboveThreshold(
          validPerformanceMetrics
        )
      ).toBe(true);
      expect(
        AgentPerformanceValidation.isPerformanceAboveThreshold(
          validPerformanceMetrics,
          0.8
        )
      ).toBe(false);
    });

    it("should check response time within SLA", () => {
      expect(
        AgentPerformanceValidation.isResponseTimeWithinSLA(
          validPerformanceMetrics
        )
      ).toBe(true);
      expect(
        AgentPerformanceValidation.isResponseTimeWithinSLA(
          validPerformanceMetrics,
          30000
        )
      ).toBe(false);
    });

    it("should check good customer satisfaction", () => {
      expect(
        AgentPerformanceValidation.hasGoodCustomerSatisfaction(
          validPerformanceMetrics
        )
      ).toBe(true);

      const poorSatisfaction = {
        ...validPerformanceMetrics,
        customerSatisfactionScore: 3.5,
      };
      expect(
        AgentPerformanceValidation.hasGoodCustomerSatisfaction(poorSatisfaction)
      ).toBe(false);
    });

    it("should check acceptable booking rate", () => {
      expect(
        AgentPerformanceValidation.hasAcceptableBookingRate(
          validPerformanceMetrics
        )
      ).toBe(true);

      const lowBookingRate = {
        ...validPerformanceMetrics,
        appointmentBookingRate: 0.2,
      };
      expect(
        AgentPerformanceValidation.hasAcceptableBookingRate(lowBookingRate)
      ).toBe(false);
    });

    it("should calculate overall performance score", () => {
      const score = AgentPerformanceValidation.calculateOverallScore(
        validPerformanceMetrics
      );
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it("should get performance grade", () => {
      expect(AgentPerformanceValidation.getPerformanceGrade(0.95)).toBe("A+");
      expect(AgentPerformanceValidation.getPerformanceGrade(0.85)).toBe("A");
      expect(AgentPerformanceValidation.getPerformanceGrade(0.75)).toBe("B");
      expect(AgentPerformanceValidation.getPerformanceGrade(0.65)).toBe("C");
      expect(AgentPerformanceValidation.getPerformanceGrade(0.55)).toBe("D");
      expect(AgentPerformanceValidation.getPerformanceGrade(0.45)).toBe("F");
    });
  });
});

describe("AgentPerformanceModel", () => {
  let validCreatePerformance: CreateAgentPerformance;

  beforeEach(() => {
    validCreatePerformance = {
      agentId: "agent-123",
      period: {
        start: new Date("2024-01-01"),
        end: new Date("2024-01-31"),
      },
      metrics: {
        totalInteractions: 100,
        conversionRate: 0.75,
        averageResponseTime: 45000,
        appointmentBookingRate: 0.6,
        customerSatisfactionScore: 4.2,
      },
      scriptPerformance: [
        {
          scriptId: "script-123",
          scriptName: "Qualification Script v1",
          usageCount: 50,
          successRate: 0.8,
          averageResponseTime: 30000,
          conversionRate: 0.7,
        },
      ],
      optimizationSuggestions: ["Improve response time"],
    };
  });

  describe("create", () => {
    it("should create a new agent performance with generated ID and timestamp", () => {
      const performance = AgentPerformanceModel.create(validCreatePerformance);

      expect(performance.id).toBeDefined();
      expect(performance.data.createdAt).toBeInstanceOf(Date);
      expect(performance.data.agentId).toBe("agent-123");
    });

    it("should throw ValidationError for invalid data", () => {
      const invalidData = { ...validCreatePerformance, agentId: "" };
      expect(() => AgentPerformanceModel.create(invalidData)).toThrow(
        ValidationError
      );
    });
  });

  describe("fromData", () => {
    it("should create performance from valid data", () => {
      const performanceData = {
        ...validCreatePerformance,
        id: "123e4567-e89b-12d3-a456-426614174000",
        createdAt: new Date(),
      };

      const performance = AgentPerformanceModel.fromData(performanceData);
      expect(performance.id).toBe(performanceData.id);
    });

    it("should throw ValidationError for invalid data", () => {
      const invalidData = { invalid: "data" };
      expect(() => AgentPerformanceModel.fromData(invalidData)).toThrow(
        ValidationError
      );
    });
  });

  describe("updateMetrics", () => {
    let performance: AgentPerformanceModel;

    beforeEach(() => {
      performance = AgentPerformanceModel.create(validCreatePerformance);
    });

    it("should update metrics with valid data", () => {
      performance.updateMetrics({ conversionRate: 0.8 });
      expect(performance.data.metrics.conversionRate).toBe(0.8);
    });

    it("should throw ValidationError for invalid metrics", () => {
      expect(() => {
        performance.updateMetrics({ conversionRate: 1.5 });
      }).toThrow(ValidationError);
    });
  });

  describe("script performance management", () => {
    let performance: AgentPerformanceModel;

    beforeEach(() => {
      performance = AgentPerformanceModel.create(validCreatePerformance);
    });

    it("should add script performance", () => {
      const newScript: ScriptMetrics = {
        scriptId: "script-456",
        scriptName: "Follow-up Script v1",
        usageCount: 25,
        successRate: 0.9,
        averageResponseTime: 20000,
        conversionRate: 0.8,
      };

      performance.addScriptPerformance(newScript);
      expect(performance.data.scriptPerformance).toHaveLength(2);
      expect(
        performance.data.scriptPerformance.find(
          (s) => s.scriptId === "script-456"
        )
      ).toEqual(newScript);
    });

    it("should replace existing script performance", () => {
      const updatedScript: ScriptMetrics = {
        scriptId: "script-123",
        scriptName: "Qualification Script v2",
        usageCount: 75,
        successRate: 0.85,
        averageResponseTime: 25000,
        conversionRate: 0.75,
      };

      performance.addScriptPerformance(updatedScript);
      expect(performance.data.scriptPerformance).toHaveLength(1);
      expect(performance.data.scriptPerformance[0]).toEqual(updatedScript);
    });

    it("should update existing script performance", () => {
      performance.updateScriptPerformance("script-123", { successRate: 0.9 });
      expect(performance.data.scriptPerformance[0].successRate).toBe(0.9);
    });

    it("should throw error when updating non-existent script", () => {
      expect(() => {
        performance.updateScriptPerformance("non-existent", {
          successRate: 0.9,
        });
      }).toThrow("Script performance not found");
    });
  });

  describe("optimization suggestions management", () => {
    let performance: AgentPerformanceModel;

    beforeEach(() => {
      performance = AgentPerformanceModel.create(validCreatePerformance);
    });

    it("should add optimization suggestion", () => {
      performance.addOptimizationSuggestion("Use more personalized greetings");
      expect(performance.data.optimizationSuggestions).toContain(
        "Use more personalized greetings"
      );
    });

    it("should not add duplicate suggestions", () => {
      performance.addOptimizationSuggestion("Improve response time");
      const count = performance.data.optimizationSuggestions.filter(
        (s) => s === "Improve response time"
      ).length;
      expect(count).toBe(1);
    });

    it("should throw error for empty suggestion", () => {
      expect(() => {
        performance.addOptimizationSuggestion("");
      }).toThrow("Optimization suggestion cannot be empty");
    });

    it("should remove optimization suggestion", () => {
      performance.removeOptimizationSuggestion("Improve response time");
      expect(performance.data.optimizationSuggestions).not.toContain(
        "Improve response time"
      );
    });

    it("should clear all optimization suggestions", () => {
      performance.clearOptimizationSuggestions();
      expect(performance.data.optimizationSuggestions).toHaveLength(0);
    });
  });

  describe("business logic methods", () => {
    let performance: AgentPerformanceModel;

    beforeEach(() => {
      performance = AgentPerformanceModel.create(validCreatePerformance);
    });

    it("should check if performance is above threshold", () => {
      expect(performance.isPerformanceAboveThreshold()).toBe(true);
      expect(performance.isPerformanceAboveThreshold(0.8)).toBe(false);
    });

    it("should check if response time is within SLA", () => {
      expect(performance.isResponseTimeWithinSLA()).toBe(true);
    });

    it("should check if customer satisfaction is good", () => {
      expect(performance.hasGoodCustomerSatisfaction()).toBe(true);
    });

    it("should check if booking rate is acceptable", () => {
      expect(performance.hasAcceptableBookingRate()).toBe(true);
    });

    it("should calculate overall score", () => {
      const score = performance.calculateOverallScore();
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it("should get performance grade", () => {
      const grade = performance.getPerformanceGrade();
      expect(["A+", "A", "B", "C", "D", "F"]).toContain(grade);
    });

    it("should get best performing script", () => {
      const bestScript = performance.getBestPerformingScript();
      expect(bestScript).toBeDefined();
      expect(bestScript?.scriptId).toBe("script-123");
    });

    it("should return null for best script when no scripts exist", () => {
      const emptyPerformance = AgentPerformanceModel.create({
        ...validCreatePerformance,
        scriptPerformance: [],
      });
      expect(emptyPerformance.getBestPerformingScript()).toBeNull();
    });

    it("should get worst performing script", () => {
      const worstScript = performance.getWorstPerformingScript();
      expect(worstScript).toBeDefined();
    });

    it("should calculate period duration in days", () => {
      const days = performance.getPeriodDurationInDays();
      expect(days).toBe(30); // January 1-31 is 30 days difference
    });

    it("should check if period is current", () => {
      // This will be false since we're using January 2024 dates
      expect(performance.isCurrentPeriod()).toBe(false);
    });

    it("should calculate interactions per day", () => {
      const perDay = performance.getInteractionsPerDay();
      expect(perDay).toBeCloseTo(100 / 30, 2);
    });

    it("should generate performance summary", () => {
      const summary = performance.getPerformanceSummary();
      expect(summary).toContain("agent-123");
      expect(summary).toContain("Grade:");
      expect(summary).toContain("30 days");
    });

    it("should identify areas needing improvement", () => {
      const areas = performance.getAreasNeedingImprovement();
      expect(Array.isArray(areas)).toBe(true);
      // With good performance metrics, should have no areas needing improvement
      expect(areas).toHaveLength(0);
    });

    it("should identify areas needing improvement for poor performance", () => {
      const poorPerformance = AgentPerformanceModel.create({
        ...validCreatePerformance,
        metrics: {
          totalInteractions: 10,
          conversionRate: 0.3, // Below threshold
          averageResponseTime: 120000, // Above SLA
          appointmentBookingRate: 0.2, // Below acceptable
          customerSatisfactionScore: 3.0, // Below good
        },
      });

      const areas = poorPerformance.getAreasNeedingImprovement();
      expect(areas.length).toBeGreaterThan(0);
      expect(areas).toContain("Response time exceeds SLA");
      expect(areas).toContain("Customer satisfaction below target");
      expect(areas).toContain("Appointment booking rate too low");
      expect(areas).toContain("Overall conversion rate below threshold");
    });
  });

  describe("toString and toJSON", () => {
    let performance: AgentPerformanceModel;

    beforeEach(() => {
      performance = AgentPerformanceModel.create(validCreatePerformance);
    });

    it("should convert to string", () => {
      const str = performance.toString();
      expect(str).toContain("AgentPerformance(");
      expect(str).toContain("agent-123");
      expect(str).toContain("Grade:");
    });

    it("should convert to JSON", () => {
      const json = performance.toJSON();
      expect(json).toEqual(performance.data);
    });
  });
});
