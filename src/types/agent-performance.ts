import { z } from 'zod';
import { ValidationResult, validateData, generateUUID } from './validation';

// Date range schema
export const DateRangeSchema = z
  .object({
    start: z.date(),
    end: z.date(),
  })
  .refine((data) => data.start <= data.end, {
    message: 'Start date must be before or equal to end date',
  });

export type DateRange = z.infer<typeof DateRangeSchema>;

// Script metrics schema
export const ScriptMetricsSchema = z.object({
  scriptId: z.string(),
  scriptName: z.string(),
  usageCount: z.number().min(0),
  successRate: z.number().min(0).max(1),
  averageResponseTime: z.number().min(0),
  conversionRate: z.number().min(0).max(1),
});

export type ScriptMetrics = z.infer<typeof ScriptMetricsSchema>;

// Performance metrics schema
export const PerformanceMetricsSchema = z.object({
  totalInteractions: z.number().min(0),
  conversionRate: z.number().min(0).max(1),
  averageResponseTime: z.number().min(0), // in milliseconds
  appointmentBookingRate: z.number().min(0).max(1),
  customerSatisfactionScore: z.number().min(0).max(5),
});

export type PerformanceMetrics = z.infer<typeof PerformanceMetricsSchema>;

// Agent performance schema
export const AgentPerformanceSchema = z.object({
  id: z.string().uuid(),
  agentId: z.string().min(1, 'Agent ID is required'),
  period: DateRangeSchema,
  metrics: PerformanceMetricsSchema,
  scriptPerformance: z.array(ScriptMetricsSchema),
  optimizationSuggestions: z.array(z.string()),
  createdAt: z.date(),
});

export type AgentPerformance = z.infer<typeof AgentPerformanceSchema>;

// Create Agent Performance input schema
export const CreateAgentPerformanceSchema = AgentPerformanceSchema.omit({
  id: true,
  createdAt: true,
});

export type CreateAgentPerformance = z.infer<
  typeof CreateAgentPerformanceSchema
>;

// Update Agent Performance input schema
export const UpdateAgentPerformanceSchema =
  CreateAgentPerformanceSchema.partial().extend({
    id: z.string().uuid(),
  });

export type UpdateAgentPerformance = z.infer<
  typeof UpdateAgentPerformanceSchema
>;
/**
 * Agent Performance validation functions
 */
export const AgentPerformanceValidation = {
  /**
   * Validate a complete agent performance object
   */
  validateAgentPerformance(data: unknown): ValidationResult<AgentPerformance> {
    return validateData(
      AgentPerformanceSchema,
      data,
      'Agent performance validation'
    );
  },

  /**
   * Validate agent performance creation data
   */
  validateCreateAgentPerformance(
    data: unknown
  ): ValidationResult<CreateAgentPerformance> {
    return validateData(
      CreateAgentPerformanceSchema,
      data,
      'Create agent performance validation'
    );
  },

  /**
   * Validate agent performance update data
   */
  validateUpdateAgentPerformance(
    data: unknown
  ): ValidationResult<UpdateAgentPerformance> {
    return validateData(
      UpdateAgentPerformanceSchema,
      data,
      'Update agent performance validation'
    );
  },

  /**
   * Validate performance metrics
   */
  validatePerformanceMetrics(
    data: unknown
  ): ValidationResult<PerformanceMetrics> {
    return validateData(
      PerformanceMetricsSchema,
      data,
      'Performance metrics validation'
    );
  },

  /**
   * Validate script metrics
   */
  validateScriptMetrics(data: unknown): ValidationResult<ScriptMetrics> {
    return validateData(ScriptMetricsSchema, data, 'Script metrics validation');
  },

  /**
   * Validate date range
   */
  validateDateRange(data: unknown): ValidationResult<DateRange> {
    return validateData(DateRangeSchema, data, 'Date range validation');
  },

  /**
   * Check if performance is above threshold
   */
  isPerformanceAboveThreshold(
    metrics: PerformanceMetrics,
    threshold: number = 0.7
  ): boolean {
    return metrics.conversionRate >= threshold;
  },

  /**
   * Check if response time is within SLA (60 seconds)
   */
  isResponseTimeWithinSLA(
    metrics: PerformanceMetrics,
    slaMs: number = 60000
  ): boolean {
    return metrics.averageResponseTime <= slaMs;
  },

  /**
   * Check if customer satisfaction is good (>= 4.0)
   */
  hasGoodCustomerSatisfaction(metrics: PerformanceMetrics): boolean {
    return metrics.customerSatisfactionScore >= 4.0;
  },

  /**
   * Check if appointment booking rate is acceptable (>= 0.3)
   */
  hasAcceptableBookingRate(metrics: PerformanceMetrics): boolean {
    return metrics.appointmentBookingRate >= 0.3;
  },

  /**
   * Calculate overall performance score (0-1)
   */
  calculateOverallScore(metrics: PerformanceMetrics): number {
    const weights = {
      conversionRate: 0.4,
      appointmentBookingRate: 0.3,
      customerSatisfactionScore: 0.2, // Normalized to 0-1
      responseTime: 0.1, // Inverted and normalized
    };

    const normalizedSatisfaction = metrics.customerSatisfactionScore / 5;
    const normalizedResponseTime = Math.max(
      0,
      1 - metrics.averageResponseTime / 60000
    ); // 60s as baseline

    return (
      metrics.conversionRate * weights.conversionRate +
      metrics.appointmentBookingRate * weights.appointmentBookingRate +
      normalizedSatisfaction * weights.customerSatisfactionScore +
      normalizedResponseTime * weights.responseTime
    );
  },

  /**
   * Get performance grade based on overall score
   */
  getPerformanceGrade(overallScore: number): string {
    if (overallScore >= 0.9) return 'A+';
    if (overallScore >= 0.8) return 'A';
    if (overallScore >= 0.7) return 'B';
    if (overallScore >= 0.6) return 'C';
    if (overallScore >= 0.5) return 'D';
    return 'F';
  },
};

/**
 * Agent Performance class with business logic methods
 */
export class AgentPerformanceModel {
  private _data: AgentPerformance;

  constructor(data: AgentPerformance) {
    const validation =
      AgentPerformanceValidation.validateAgentPerformance(data);
    if (!validation.success) {
      throw validation.error;
    }
    this._data = validation.data;
  }

  /**
   * Create a new agent performance record from input data
   */
  static create(input: CreateAgentPerformance): AgentPerformanceModel {
    const performanceData: AgentPerformance = {
      ...input,
      id: generateUUID(),
      createdAt: new Date(),
    };

    return new AgentPerformanceModel(performanceData);
  }

  /**
   * Create agent performance from unknown data with validation
   */
  static fromData(data: unknown): AgentPerformanceModel {
    const validation =
      AgentPerformanceValidation.validateAgentPerformance(data);
    if (!validation.success) {
      throw validation.error;
    }
    return new AgentPerformanceModel(validation.data);
  }

  /**
   * Get agent performance data
   */
  get data(): AgentPerformance {
    return { ...this._data };
  }

  /**
   * Get performance ID
   */
  get id(): string {
    return this._data.id;
  }

  /**
   * Get agent ID
   */
  get agentId(): string {
    return this._data.agentId;
  }

  /**
   * Get performance metrics
   */
  get metrics(): PerformanceMetrics {
    return { ...this._data.metrics };
  }

  /**
   * Get script performance data
   */
  get scriptPerformance(): ScriptMetrics[] {
    return [...this._data.scriptPerformance];
  }

  /**
   * Get optimization suggestions
   */
  get optimizationSuggestions(): string[] {
    return [...this._data.optimizationSuggestions];
  }

  /**
   * Update performance metrics
   */
  updateMetrics(metrics: Partial<PerformanceMetrics>): void {
    const updatedMetrics = { ...this._data.metrics, ...metrics };
    const validation =
      AgentPerformanceValidation.validatePerformanceMetrics(updatedMetrics);

    if (!validation.success) {
      throw validation.error;
    }

    this._data.metrics = updatedMetrics;
  }

  /**
   * Add script performance data
   */
  addScriptPerformance(scriptMetrics: ScriptMetrics): void {
    const validation =
      AgentPerformanceValidation.validateScriptMetrics(scriptMetrics);
    if (!validation.success) {
      throw validation.error;
    }

    // Remove existing metrics for the same script
    this._data.scriptPerformance = this._data.scriptPerformance.filter(
      (s) => s.scriptId !== scriptMetrics.scriptId
    );

    // Add new metrics
    this._data.scriptPerformance.push(scriptMetrics);
  }

  /**
   * Update script performance data
   */
  updateScriptPerformance(
    scriptId: string,
    updates: Partial<ScriptMetrics>
  ): void {
    const existingIndex = this._data.scriptPerformance.findIndex(
      (s) => s.scriptId === scriptId
    );

    if (existingIndex === -1) {
      throw new Error(
        `Script performance not found for script ID: ${scriptId}`
      );
    }

    const updatedScript = {
      ...this._data.scriptPerformance[existingIndex],
      ...updates,
    };
    const validation =
      AgentPerformanceValidation.validateScriptMetrics(updatedScript);

    if (!validation.success) {
      throw validation.error;
    }

    this._data.scriptPerformance[existingIndex] = updatedScript;
  }

  /**
   * Add optimization suggestion
   */
  addOptimizationSuggestion(suggestion: string): void {
    if (!suggestion.trim()) {
      throw new Error('Optimization suggestion cannot be empty');
    }

    if (!this._data.optimizationSuggestions.includes(suggestion)) {
      this._data.optimizationSuggestions.push(suggestion);
    }
  }

  /**
   * Remove optimization suggestion
   */
  removeOptimizationSuggestion(suggestion: string): void {
    const index = this._data.optimizationSuggestions.indexOf(suggestion);
    if (index > -1) {
      this._data.optimizationSuggestions.splice(index, 1);
    }
  }

  /**
   * Clear all optimization suggestions
   */
  clearOptimizationSuggestions(): void {
    this._data.optimizationSuggestions = [];
  }

  /**
   * Check if performance is above threshold
   */
  isPerformanceAboveThreshold(threshold: number = 0.7): boolean {
    return AgentPerformanceValidation.isPerformanceAboveThreshold(
      this._data.metrics,
      threshold
    );
  }

  /**
   * Check if response time is within SLA
   */
  isResponseTimeWithinSLA(slaMs: number = 60000): boolean {
    return AgentPerformanceValidation.isResponseTimeWithinSLA(
      this._data.metrics,
      slaMs
    );
  }

  /**
   * Check if customer satisfaction is good
   */
  hasGoodCustomerSatisfaction(): boolean {
    return AgentPerformanceValidation.hasGoodCustomerSatisfaction(
      this._data.metrics
    );
  }

  /**
   * Check if appointment booking rate is acceptable
   */
  hasAcceptableBookingRate(): boolean {
    return AgentPerformanceValidation.hasAcceptableBookingRate(
      this._data.metrics
    );
  }

  /**
   * Calculate overall performance score
   */
  calculateOverallScore(): number {
    return AgentPerformanceValidation.calculateOverallScore(this._data.metrics);
  }

  /**
   * Get performance grade
   */
  getPerformanceGrade(): string {
    const score = this.calculateOverallScore();
    return AgentPerformanceValidation.getPerformanceGrade(score);
  }

  /**
   * Get best performing script
   */
  getBestPerformingScript(): ScriptMetrics | null {
    if (this._data.scriptPerformance.length === 0) return null;

    return this._data.scriptPerformance.reduce((best, current) => {
      const bestScore = best.conversionRate * 0.6 + best.successRate * 0.4;
      const currentScore =
        current.conversionRate * 0.6 + current.successRate * 0.4;
      return currentScore > bestScore ? current : best;
    });
  }

  /**
   * Get worst performing script
   */
  getWorstPerformingScript(): ScriptMetrics | null {
    if (this._data.scriptPerformance.length === 0) return null;

    return this._data.scriptPerformance.reduce((worst, current) => {
      const worstScore = worst.conversionRate * 0.6 + worst.successRate * 0.4;
      const currentScore =
        current.conversionRate * 0.6 + current.successRate * 0.4;
      return currentScore < worstScore ? current : worst;
    });
  }

  /**
   * Get period duration in days
   */
  getPeriodDurationInDays(): number {
    const diffTime = Math.abs(
      this._data.period.end.getTime() - this._data.period.start.getTime()
    );
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Check if performance period is current (includes today)
   */
  isCurrentPeriod(): boolean {
    const now = new Date();
    return now >= this._data.period.start && now <= this._data.period.end;
  }

  /**
   * Get interactions per day average
   */
  getInteractionsPerDay(): number {
    const days = this.getPeriodDurationInDays();
    return days > 0 ? this._data.metrics.totalInteractions / days : 0;
  }

  /**
   * Generate performance summary
   */
  getPerformanceSummary(): string {
    const grade = this.getPerformanceGrade();
    const score = this.calculateOverallScore();
    const days = this.getPeriodDurationInDays();

    return `Agent ${this._data.agentId} - Grade: ${grade} (${(
      score * 100
    ).toFixed(1)}%) over ${days} days`;
  }

  /**
   * Get areas needing improvement
   */
  getAreasNeedingImprovement(): string[] {
    const areas: string[] = [];

    if (!this.isResponseTimeWithinSLA()) {
      areas.push('Response time exceeds SLA');
    }

    if (!this.hasGoodCustomerSatisfaction()) {
      areas.push('Customer satisfaction below target');
    }

    if (!this.hasAcceptableBookingRate()) {
      areas.push('Appointment booking rate too low');
    }

    if (!this.isPerformanceAboveThreshold()) {
      areas.push('Overall conversion rate below threshold');
    }

    return areas;
  }

  /**
   * Convert to JSON
   */
  toJSON(): AgentPerformance {
    return this.data;
  }

  /**
   * Convert to string representation
   */
  toString(): string {
    const grade = this.getPerformanceGrade();
    return `AgentPerformance(${this._data.id}, ${this._data.agentId}, Grade: ${grade})`;
  }
}
