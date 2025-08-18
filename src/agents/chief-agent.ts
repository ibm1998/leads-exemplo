import {
  AIHeadAgent,
  LeadAnalysisResult,
  PerformanceFeedback,
} from './ai-head-agent';
import {
  AgentPerformance,
  PerformanceMetrics,
} from '../types/agent-performance';
import { Lead } from '../types/lead';
import { Interaction } from '../types/interaction';

/**
 * System status enumeration
 */
export enum SystemStatus {
  OPERATIONAL = 'operational',
  DEGRADED = 'degraded',
  MAINTENANCE = 'maintenance',
  CRITICAL = 'critical',
}

/**
 * Agent status information
 */
export interface AgentStatus {
  agentId: string;
  agentType: 'ai_head' | 'inbound' | 'outbound' | 'crm' | 'analytics';
  status: 'active' | 'idle' | 'busy' | 'error' | 'offline';
  lastActivity: Date;
  currentLoad: number; // 0-1 scale
  errorCount: number;
  uptime: number; // in milliseconds
  performance: PerformanceMetrics;
}

/**
 * System override command
 */
export interface SystemOverride {
  id: string;
  type:
    | 'pause_agent'
    | 'resume_agent'
    | 'redirect_leads'
    | 'emergency_stop'
    | 'priority_boost';
  targetAgent?: string;
  parameters?: Record<string, any>;
  reason: string;
  issuedBy: string;
  timestamp: Date;
  expiresAt?: Date;
  isActive: boolean;
}

/**
 * Strategic directive for system-wide changes
 */
export interface StrategicDirective {
  id: string;
  title: string;
  description: string;
  type: 'campaign' | 'routing_change' | 'performance_target' | 'process_update';
  priority: 'low' | 'medium' | 'high' | 'critical';
  targetAgents: string[];
  parameters: Record<string, any>;
  startDate: Date;
  endDate?: Date;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  createdBy: string;
  createdAt: Date;
}

/**
 * Executive report data
 */
export interface ExecutiveReport {
  id: string;
  reportType: 'daily' | 'weekly' | 'monthly' | 'custom';
  period: {
    start: Date;
    end: Date;
  };
  summary: {
    totalLeads: number;
    conversionRate: number;
    averageResponseTime: number;
    appointmentsBooked: number;
    revenue: number;
    customerSatisfaction: number;
  };
  agentPerformance: AgentPerformance[];
  keyInsights: string[];
  recommendations: string[];
  alerts: SystemAlert[];
  generatedAt: Date;
}

/**
 * System alert
 */
export interface SystemAlert {
  id: string;
  level: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  source: string;
  timestamp: Date;
  acknowledged: boolean;
  resolvedAt?: Date;
}

/**
 * Dashboard metrics for real-time monitoring
 */
export interface DashboardMetrics {
  systemStatus: SystemStatus;
  activeAgents: number;
  totalAgents: number;
  currentLoad: number;
  leadsProcessedToday: number;
  averageResponseTime: number;
  conversionRateToday: number;
  appointmentsBookedToday: number;
  activeAlerts: number;
  criticalAlerts: number;
  lastUpdated: Date;
}

/**
 * Chief Agent - Highest-level system overseer and human interface
 *
 * Responsibilities:
 * - Monitor all subordinate agent performance
 * - Serve as primary human contact point
 * - Execute strategic directives and system overrides
 * - Generate executive-level reports and insights
 */
export class ChiefAgent {
  private aiHeadAgent: AIHeadAgent;
  private agentStatuses: Map<string, AgentStatus> = new Map();
  private systemOverrides: Map<string, SystemOverride> = new Map();
  private strategicDirectives: Map<string, StrategicDirective> = new Map();
  private systemAlerts: Map<string, SystemAlert> = new Map();
  private performanceHistory: AgentPerformance[] = [];
  private systemStartTime: Date;

  constructor(aiHeadAgent: AIHeadAgent) {
    this.aiHeadAgent = aiHeadAgent;
    this.systemStartTime = new Date();
    this.initializeAgentStatuses();
    this.startMonitoring();
  }

  /**
   * Initialize agent status tracking
   */
  private initializeAgentStatuses(): void {
    const agents: Array<{ id: string; type: AgentStatus['agentType'] }> = [
      { id: 'ai-head-001', type: 'ai_head' },
      { id: 'inbound-001', type: 'inbound' },
      { id: 'outbound-001', type: 'outbound' },
      { id: 'crm-001', type: 'crm' },
      { id: 'analytics-001', type: 'analytics' },
    ];

    agents.forEach((agent) => {
      this.agentStatuses.set(agent.id, {
        agentId: agent.id,
        agentType: agent.type,
        status: 'active',
        lastActivity: new Date(),
        currentLoad: 0,
        errorCount: 0,
        uptime: 0,
        performance: {
          totalInteractions: 0,
          conversionRate: 0,
          averageResponseTime: 0,
          appointmentBookingRate: 0,
          customerSatisfactionScore: 0,
        },
      });
    });
  }

  /**
   * Start system monitoring
   */
  private startMonitoring(): void {
    // In a real implementation, this would set up periodic monitoring
    // For now, we'll simulate the monitoring setup
    this.addSystemAlert({
      level: 'info',
      title: 'System Monitoring Started',
      message: 'Chief Agent monitoring system is now active',
      source: 'chief-agent',
    });
  }

  /**
   * Get real-time dashboard metrics
   */
  getDashboardMetrics(): DashboardMetrics {
    const activeAgents = Array.from(this.agentStatuses.values()).filter(
      (agent) => agent.status === 'active' || agent.status === 'busy'
    ).length;

    const totalLoad = Array.from(this.agentStatuses.values()).reduce(
      (sum, agent) => sum + agent.currentLoad,
      0
    );
    const averageLoad =
      this.agentStatuses.size > 0 ? totalLoad / this.agentStatuses.size : 0;

    const alerts = Array.from(this.systemAlerts.values()).filter(
      (alert) => !alert.acknowledged
    );
    const criticalAlerts = alerts.filter(
      (alert) => alert.level === 'critical'
    ).length;

    // Get today's metrics (simulated for now)
    const today = new Date();
    const todayStart = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );

    return {
      systemStatus: this.calculateSystemStatus(),
      activeAgents,
      totalAgents: this.agentStatuses.size,
      currentLoad: averageLoad,
      leadsProcessedToday: this.getLeadsProcessedSince(todayStart),
      averageResponseTime: this.calculateAverageResponseTime(),
      conversionRateToday: this.calculateConversionRateToday(),
      appointmentsBookedToday: this.getAppointmentsBookedToday(),
      activeAlerts: alerts.length,
      criticalAlerts,
      lastUpdated: new Date(),
    };
  }

  /**
   * Calculate overall system status
   */
  private calculateSystemStatus(): SystemStatus {
    const agents = Array.from(this.agentStatuses.values());
    const criticalAlerts = Array.from(this.systemAlerts.values()).filter(
      (alert) => alert.level === 'critical' && !alert.acknowledged
    );

    if (criticalAlerts.length > 0) {
      return SystemStatus.CRITICAL;
    }

    const errorAgents = agents.filter(
      (agent) => agent.status === 'error'
    ).length;
    const offlineAgents = agents.filter(
      (agent) => agent.status === 'offline'
    ).length;

    if (errorAgents > 0 || offlineAgents > agents.length * 0.3) {
      return SystemStatus.DEGRADED;
    }

    const activeOverrides = Array.from(this.systemOverrides.values()).filter(
      (override) => override.isActive && override.type === 'emergency_stop'
    );

    if (activeOverrides.length > 0) {
      return SystemStatus.MAINTENANCE;
    }

    return SystemStatus.OPERATIONAL;
  }

  /**
   * Update agent status
   */
  updateAgentStatus(agentId: string, updates: Partial<AgentStatus>): void {
    const currentStatus = this.agentStatuses.get(agentId);
    if (!currentStatus) {
      throw new Error(`Agent ${agentId} not found`);
    }

    const updatedStatus: AgentStatus = {
      ...currentStatus,
      ...updates,
      lastActivity: new Date(),
    };

    this.agentStatuses.set(agentId, updatedStatus);

    // Check for alerts based on status changes
    this.checkAgentAlerts(agentId, updatedStatus);
  }

  /**
   * Check for agent-related alerts
   */
  private checkAgentAlerts(agentId: string, status: AgentStatus): void {
    // High error count alert
    if (status.errorCount > 10) {
      this.addSystemAlert({
        level: 'warning',
        title: 'High Error Count',
        message: `Agent ${agentId} has ${status.errorCount} errors`,
        source: agentId,
      });
    }

    // Agent offline alert
    if (status.status === 'offline') {
      this.addSystemAlert({
        level: 'error',
        title: 'Agent Offline',
        message: `Agent ${agentId} is offline`,
        source: agentId,
      });
    }

    // High load alert
    if (status.currentLoad > 0.9) {
      this.addSystemAlert({
        level: 'warning',
        title: 'High Agent Load',
        message: `Agent ${agentId} is at ${Math.round(
          status.currentLoad * 100
        )}% capacity`,
        source: agentId,
      });
    }
  }

  /**
   * Get all agent statuses
   */
  getAllAgentStatuses(): AgentStatus[] {
    return Array.from(this.agentStatuses.values());
  }

  /**
   * Get specific agent status
   */
  getAgentStatus(agentId: string): AgentStatus | undefined {
    return this.agentStatuses.get(agentId);
  }

  /**
   * Issue system override
   */
  issueSystemOverride(
    override: Omit<SystemOverride, 'id' | 'timestamp' | 'isActive'>
  ): string {
    const overrideId = this.generateId();
    const systemOverride: SystemOverride = {
      ...override,
      id: overrideId,
      timestamp: new Date(),
      isActive: true,
    };

    this.systemOverrides.set(overrideId, systemOverride);

    // Execute the override
    this.executeSystemOverride(systemOverride);

    // Log the override
    this.addSystemAlert({
      level: 'info',
      title: 'System Override Issued',
      message: `Override ${override.type} issued by ${override.issuedBy}: ${override.reason}`,
      source: 'chief-agent',
    });

    return overrideId;
  }

  /**
   * Execute system override
   */
  private executeSystemOverride(override: SystemOverride): void {
    switch (override.type) {
      case 'pause_agent':
        if (override.targetAgent) {
          this.pauseAgent(override.targetAgent);
        }
        break;
      case 'resume_agent':
        if (override.targetAgent) {
          this.resumeAgent(override.targetAgent);
        }
        break;
      case 'emergency_stop':
        this.emergencyStop();
        break;
      case 'priority_boost':
        if (override.targetAgent) {
          this.boostAgentPriority(override.targetAgent);
        }
        break;
      case 'redirect_leads':
        this.redirectLeads(override.parameters);
        break;
    }
  }

  /**
   * Pause an agent
   */
  private pauseAgent(agentId: string): void {
    const status = this.agentStatuses.get(agentId);
    if (status) {
      this.updateAgentStatus(agentId, { status: 'offline' });
    }
  }

  /**
   * Resume an agent
   */
  private resumeAgent(agentId: string): void {
    const status = this.agentStatuses.get(agentId);
    if (status) {
      this.updateAgentStatus(agentId, { status: 'active' });
    }
  }

  /**
   * Emergency stop all agents
   */
  private emergencyStop(): void {
    this.agentStatuses.forEach((status, agentId) => {
      this.updateAgentStatus(agentId, { status: 'offline' });
    });

    this.addSystemAlert({
      level: 'critical',
      title: 'Emergency Stop Activated',
      message: 'All agents have been stopped due to emergency override',
      source: 'chief-agent',
    });
  }

  /**
   * Boost agent priority
   */
  private boostAgentPriority(agentId: string): void {
    // Implementation would depend on specific agent architecture
    this.addSystemAlert({
      level: 'info',
      title: 'Agent Priority Boosted',
      message: `Priority boost applied to agent ${agentId}`,
      source: 'chief-agent',
    });
  }

  /**
   * Redirect leads based on parameters
   */
  private redirectLeads(parameters?: Record<string, any>): void {
    // Implementation would integrate with AI Head Agent routing
    this.addSystemAlert({
      level: 'info',
      title: 'Lead Redirection Active',
      message: 'Lead routing has been modified by system override',
      source: 'chief-agent',
    });
  }

  /**
   * Cancel system override
   */
  cancelSystemOverride(overrideId: string, reason: string): void {
    const override = this.systemOverrides.get(overrideId);
    if (!override) {
      throw new Error(`Override ${overrideId} not found`);
    }

    override.isActive = false;
    this.systemOverrides.set(overrideId, override);

    this.addSystemAlert({
      level: 'info',
      title: 'System Override Cancelled',
      message: `Override ${override.type} cancelled: ${reason}`,
      source: 'chief-agent',
    });
  }

  /**
   * Create strategic directive
   */
  createStrategicDirective(
    directive: Omit<StrategicDirective, 'id' | 'createdAt' | 'status'>
  ): string {
    const directiveId = this.generateId();
    const strategicDirective: StrategicDirective = {
      ...directive,
      id: directiveId,
      status: 'pending',
      createdAt: new Date(),
    };

    this.strategicDirectives.set(directiveId, strategicDirective);

    this.addSystemAlert({
      level: 'info',
      title: 'Strategic Directive Created',
      message: `New directive: ${directive.title}`,
      source: 'chief-agent',
    });

    return directiveId;
  }

  /**
   * Activate strategic directive
   */
  activateStrategicDirective(directiveId: string): void {
    const directive = this.strategicDirectives.get(directiveId);
    if (!directive) {
      throw new Error(`Directive ${directiveId} not found`);
    }

    directive.status = 'active';
    this.strategicDirectives.set(directiveId, directive);

    // Execute the directive
    this.executeStrategicDirective(directive);

    this.addSystemAlert({
      level: 'info',
      title: 'Strategic Directive Activated',
      message: `Directive activated: ${directive.title}`,
      source: 'chief-agent',
    });
  }

  /**
   * Execute strategic directive
   */
  private executeStrategicDirective(directive: StrategicDirective): void {
    // Implementation would depend on directive type and target agents
    switch (directive.type) {
      case 'campaign':
        this.executeCampaignDirective(directive);
        break;
      case 'routing_change':
        this.executeRoutingChangeDirective(directive);
        break;
      case 'performance_target':
        this.executePerformanceTargetDirective(directive);
        break;
      case 'process_update':
        this.executeProcessUpdateDirective(directive);
        break;
    }
  }

  /**
   * Execute campaign directive
   */
  private executeCampaignDirective(directive: StrategicDirective): void {
    // Would integrate with outbound agents for campaign execution
    this.addSystemAlert({
      level: 'info',
      title: 'Campaign Directive Executing',
      message: `Campaign "${directive.title}" is now active`,
      source: 'chief-agent',
    });
  }

  /**
   * Execute routing change directive
   */
  private executeRoutingChangeDirective(directive: StrategicDirective): void {
    // Would update AI Head Agent routing rules
    this.addSystemAlert({
      level: 'info',
      title: 'Routing Changes Applied',
      message: `Routing updated per directive: ${directive.title}`,
      source: 'chief-agent',
    });
  }

  /**
   * Execute performance target directive
   */
  private executePerformanceTargetDirective(
    directive: StrategicDirective
  ): void {
    // Would update performance targets for specified agents
    this.addSystemAlert({
      level: 'info',
      title: 'Performance Targets Updated',
      message: `New performance targets set: ${directive.title}`,
      source: 'chief-agent',
    });
  }

  /**
   * Execute process update directive
   */
  private executeProcessUpdateDirective(directive: StrategicDirective): void {
    // Would update agent processes and workflows
    this.addSystemAlert({
      level: 'info',
      title: 'Process Updates Applied',
      message: `Process changes implemented: ${directive.title}`,
      source: 'chief-agent',
    });
  }

  /**
   * Get all strategic directives
   */
  getStrategicDirectives(): StrategicDirective[] {
    return Array.from(this.strategicDirectives.values());
  }

  /**
   * Get active strategic directives
   */
  getActiveStrategicDirectives(): StrategicDirective[] {
    return Array.from(this.strategicDirectives.values()).filter(
      (directive) => directive.status === 'active'
    );
  }

  /**
   * Add system alert
   */
  private addSystemAlert(
    alert: Omit<SystemAlert, 'id' | 'timestamp' | 'acknowledged'>
  ): void {
    const alertId = this.generateId();
    const systemAlert: SystemAlert = {
      ...alert,
      id: alertId,
      timestamp: new Date(),
      acknowledged: false,
    };

    this.systemAlerts.set(alertId, systemAlert);
  }

  /**
   * Get system alerts
   */
  getSystemAlerts(includeAcknowledged: boolean = false): SystemAlert[] {
    const alerts = Array.from(this.systemAlerts.values());
    return includeAcknowledged
      ? alerts
      : alerts.filter((alert) => !alert.acknowledged);
  }

  /**
   * Acknowledge system alert
   */
  acknowledgeAlert(alertId: string): void {
    const alert = this.systemAlerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      this.systemAlerts.set(alertId, alert);
    }
  }

  /**
   * Generate executive report
   */
  generateExecutiveReport(
    reportType: ExecutiveReport['reportType'],
    period?: { start: Date; end: Date }
  ): ExecutiveReport {
    const reportPeriod = period || this.getDefaultReportPeriod(reportType);

    const report: ExecutiveReport = {
      id: this.generateId(),
      reportType,
      period: reportPeriod,
      summary: this.generateReportSummary(reportPeriod),
      agentPerformance: this.getAgentPerformanceForPeriod(reportPeriod),
      keyInsights: this.generateKeyInsights(reportPeriod),
      recommendations: this.generateRecommendations(),
      alerts: this.getCriticalAlertsForPeriod(reportPeriod),
      generatedAt: new Date(),
    };

    return report;
  }

  /**
   * Get default report period based on type
   */
  private getDefaultReportPeriod(reportType: ExecutiveReport['reportType']): {
    start: Date;
    end: Date;
  } {
    const now = new Date();
    const end = new Date(now);
    let start: Date;

    switch (reportType) {
      case 'daily':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'weekly':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default:
        start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    return { start, end };
  }

  /**
   * Generate report summary
   */
  private generateReportSummary(period: {
    start: Date;
    end: Date;
  }): ExecutiveReport['summary'] {
    // In a real implementation, this would query actual data
    return {
      totalLeads: this.getLeadsProcessedInPeriod(period),
      conversionRate: this.getConversionRateForPeriod(period),
      averageResponseTime: this.calculateAverageResponseTime(),
      appointmentsBooked: this.getAppointmentsBookedInPeriod(period),
      revenue: this.getRevenueForPeriod(period),
      customerSatisfaction: this.getAverageCustomerSatisfaction(),
    };
  }

  /**
   * Generate key insights
   */
  private generateKeyInsights(period: { start: Date; end: Date }): string[] {
    const insights: string[] = [];

    const metrics = this.getDashboardMetrics();

    if (metrics.conversionRateToday > 0.8) {
      insights.push('Conversion rates are performing exceptionally well today');
    }

    if (metrics.averageResponseTime < 30000) {
      // 30 seconds in milliseconds
      insights.push('Response times are well within SLA targets');
    }

    if (metrics.activeAlerts > 5) {
      insights.push('Higher than normal alert activity detected');
    }

    const aiHeadMetrics = this.aiHeadAgent.getPerformanceMetrics();
    if (aiHeadMetrics.routingAccuracy > 0.9) {
      insights.push('AI Head Agent routing accuracy is excellent');
    }

    // Always include at least one insight
    if (insights.length === 0) {
      insights.push('System is operating within normal parameters');
    }

    return insights;
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const metrics = this.getDashboardMetrics();

    if (metrics.currentLoad > 0.8) {
      recommendations.push(
        'Consider scaling up agent capacity due to high system load'
      );
    }

    if (metrics.averageResponseTime > 45000) {
      // 45 seconds in milliseconds
      recommendations.push(
        'Investigate response time delays and optimize agent workflows'
      );
    }

    if (metrics.criticalAlerts > 0) {
      recommendations.push('Address critical system alerts immediately');
    }

    const aiHeadMetrics = this.aiHeadAgent.getPerformanceMetrics();
    if (aiHeadMetrics.routingAccuracy < 0.7) {
      recommendations.push('Review and optimize lead routing rules');
    }

    // Always include at least one recommendation
    if (recommendations.length === 0) {
      recommendations.push('System is performing well - continue monitoring');
    }

    return recommendations;
  }

  // Helper methods for metrics calculation (simplified implementations)
  private getLeadsProcessedSince(date: Date): number {
    // Simulated data - in real implementation would query database
    return Math.floor(Math.random() * 100) + 50;
  }

  private calculateAverageResponseTime(): number {
    const agents = Array.from(this.agentStatuses.values());
    const totalResponseTime = agents.reduce(
      (sum, agent) => sum + agent.performance.averageResponseTime,
      0
    );
    return agents.length > 0 ? totalResponseTime / agents.length : 0;
  }

  private calculateConversionRateToday(): number {
    const agents = Array.from(this.agentStatuses.values());
    const totalConversionRate = agents.reduce(
      (sum, agent) => sum + agent.performance.conversionRate,
      0
    );
    return agents.length > 0 ? totalConversionRate / agents.length : 0;
  }

  private getAppointmentsBookedToday(): number {
    // Simulated data
    return Math.floor(Math.random() * 20) + 10;
  }

  private getLeadsProcessedInPeriod(period: {
    start: Date;
    end: Date;
  }): number {
    // Simulated data
    const days = Math.ceil(
      (period.end.getTime() - period.start.getTime()) / (1000 * 60 * 60 * 24)
    );
    return Math.floor(Math.random() * 50 * days) + 25 * days;
  }

  private getConversionRateForPeriod(period: {
    start: Date;
    end: Date;
  }): number {
    return this.calculateConversionRateToday();
  }

  private getAppointmentsBookedInPeriod(period: {
    start: Date;
    end: Date;
  }): number {
    const days = Math.ceil(
      (period.end.getTime() - period.start.getTime()) / (1000 * 60 * 60 * 24)
    );
    return Math.floor(Math.random() * 10 * days) + 5 * days;
  }

  private getRevenueForPeriod(period: { start: Date; end: Date }): number {
    // Simulated data
    const days = Math.ceil(
      (period.end.getTime() - period.start.getTime()) / (1000 * 60 * 60 * 24)
    );
    return Math.floor(Math.random() * 10000 * days) + 5000 * days;
  }

  private getAverageCustomerSatisfaction(): number {
    const agents = Array.from(this.agentStatuses.values());
    const totalSatisfaction = agents.reduce(
      (sum, agent) => sum + agent.performance.customerSatisfactionScore,
      0
    );
    return agents.length > 0 ? totalSatisfaction / agents.length : 0;
  }

  private getAgentPerformanceForPeriod(period: {
    start: Date;
    end: Date;
  }): AgentPerformance[] {
    // In real implementation, would filter performance history by period
    return this.performanceHistory.slice(0, 10); // Return recent performance data
  }

  private getCriticalAlertsForPeriod(period: {
    start: Date;
    end: Date;
  }): SystemAlert[] {
    return Array.from(this.systemAlerts.values()).filter(
      (alert) =>
        alert.level === 'critical' &&
        alert.timestamp >= period.start &&
        alert.timestamp <= period.end
    );
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get system uptime in milliseconds
   */
  getSystemUptime(): number {
    return Date.now() - this.systemStartTime.getTime();
  }

  /**
   * Get system health score (0-1)
   */
  getSystemHealthScore(): number {
    const metrics = this.getDashboardMetrics();
    const agents = Array.from(this.agentStatuses.values());

    let score = 1.0;

    // Deduct for offline agents
    const offlineAgents = agents.filter(
      (agent) => agent.status === 'offline'
    ).length;
    score -= (offlineAgents / agents.length) * 0.3;

    // Deduct for high load
    if (metrics.currentLoad > 0.9) score -= 0.2;
    else if (metrics.currentLoad > 0.7) score -= 0.1;

    // Deduct for alerts
    score -= Math.min(metrics.criticalAlerts * 0.1, 0.3);
    score -= Math.min(metrics.activeAlerts * 0.02, 0.2);

    // Deduct for poor response times
    if (metrics.averageResponseTime > 60) score -= 0.2;
    else if (metrics.averageResponseTime > 45) score -= 0.1;

    return Math.max(0, score);
  }
}
