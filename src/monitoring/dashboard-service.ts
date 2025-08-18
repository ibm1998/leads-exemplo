import {
  ChiefAgent,
  DashboardMetrics,
  AgentStatus,
  SystemAlert,
  ExecutiveReport,
  SystemOverride,
  StrategicDirective,
} from '../agents/chief-agent';
import { Express, Request, Response } from 'express';

/**
 * Dashboard configuration
 */
export interface DashboardConfig {
  refreshInterval: number; // in milliseconds
  alertRetentionDays: number;
  maxRecentAlerts: number;
  enableRealTimeUpdates: boolean;
}

/**
 * Dashboard filter options
 */
export interface DashboardFilters {
  agentTypes?: string[];
  alertLevels?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  status?: string[];
}

/**
 * Real-time dashboard data
 */
export interface DashboardData {
  metrics: DashboardMetrics;
  agentStatuses: AgentStatus[];
  recentAlerts: SystemAlert[];
  activeOverrides: SystemOverride[];
  activeDirectives: StrategicDirective[];
  systemHealth: {
    score: number;
    uptime: number;
    status: string;
  };
  lastUpdated: Date;
}

/**
 * Dashboard Service - Provides human interface for monitoring and control
 *
 * Responsibilities:
 * - Serve real-time dashboard data
 * - Handle system override requests
 * - Manage strategic directives
 * - Generate and serve executive reports
 * - Provide alert management interface
 */
export class DashboardService {
  private chiefAgent: ChiefAgent;
  private config: DashboardConfig;
  private dashboardClients: Set<Response> = new Set();

  constructor(chiefAgent: ChiefAgent, config: Partial<DashboardConfig> = {}) {
    this.chiefAgent = chiefAgent;
    this.config = {
      refreshInterval: 5000, // 5 seconds
      alertRetentionDays: 30,
      maxRecentAlerts: 50,
      enableRealTimeUpdates: true,
      ...config,
    };
  }

  /**
   * Setup dashboard routes
   */
  setupRoutes(app: Express): void {
    // Dashboard data endpoint
    app.get('/api/dashboard', this.getDashboardData.bind(this));

    // Real-time updates via Server-Sent Events
    app.get('/api/dashboard/stream', this.streamDashboardUpdates.bind(this));

    // Agent status endpoints
    app.get('/api/agents', this.getAgentStatuses.bind(this));
    app.get('/api/agents/:agentId', this.getAgentStatus.bind(this));
    app.put('/api/agents/:agentId/status', this.updateAgentStatus.bind(this));

    // System override endpoints
    app.post('/api/overrides', this.createSystemOverride.bind(this));
    app.get('/api/overrides', this.getSystemOverrides.bind(this));
    app.delete(
      '/api/overrides/:overrideId',
      this.cancelSystemOverride.bind(this)
    );

    // Strategic directive endpoints
    app.post('/api/directives', this.createStrategicDirective.bind(this));
    app.get('/api/directives', this.getStrategicDirectives.bind(this));
    app.put(
      '/api/directives/:directiveId/activate',
      this.activateStrategicDirective.bind(this)
    );

    // Alert management endpoints
    app.get('/api/alerts', this.getSystemAlerts.bind(this));
    app.put(
      '/api/alerts/:alertId/acknowledge',
      this.acknowledgeAlert.bind(this)
    );

    // Executive reports endpoints
    app.get(
      '/api/reports/:reportType',
      this.generateExecutiveReport.bind(this)
    );
    app.get('/api/reports', this.getAvailableReports.bind(this));

    // System health endpoint
    app.get('/api/health', this.getSystemHealth.bind(this));
  }

  /**
   * Get dashboard data
   */
  private async getDashboardData(req: Request, res: Response): Promise<void> {
    try {
      const filters = this.parseFilters(req.query);
      const dashboardData = await this.compileDashboardData(filters);

      res.json({
        success: true,
        data: dashboardData,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Stream real-time dashboard updates
   */
  private streamDashboardUpdates(req: Request, res: Response): void {
    if (!this.config.enableRealTimeUpdates) {
      res.status(404).json({ error: 'Real-time updates disabled' });
      return;
    }

    // Setup Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    // Add client to active connections
    this.dashboardClients.add(res);

    // Send initial data
    this.sendDashboardUpdate(res).catch(console.error);

    // Setup periodic updates
    const updateInterval = setInterval(async () => {
      if (res.destroyed) {
        clearInterval(updateInterval);
        this.dashboardClients.delete(res);
        return;
      }

      await this.sendDashboardUpdate(res);
    }, this.config.refreshInterval);

    // Handle client disconnect
    req.on('close', () => {
      clearInterval(updateInterval);
      this.dashboardClients.delete(res);
    });
  }

  /**
   * Send dashboard update to client
   */
  private async sendDashboardUpdate(res: Response): Promise<void> {
    try {
      const dashboardData = await this.compileDashboardData();
      const data = JSON.stringify(dashboardData);

      res.write(`data: ${data}\n\n`);
    } catch (error) {
      console.error('Error sending dashboard update:', error);
    }
  }

  /**
   * Compile dashboard data
   */
  private async compileDashboardData(
    filters?: DashboardFilters
  ): Promise<DashboardData> {
    const metrics = this.chiefAgent.getDashboardMetrics();
    const agentStatuses = this.filterAgentStatuses(
      this.chiefAgent.getAllAgentStatuses(),
      filters
    );
    const recentAlerts = this.filterAlerts(
      this.chiefAgent.getSystemAlerts().slice(0, this.config.maxRecentAlerts),
      filters
    );

    // Get active overrides and directives
    const activeOverrides = Array.from(
      this.chiefAgent['systemOverrides'].values()
    ).filter((override) => override.isActive);
    const activeDirectives = this.chiefAgent.getActiveStrategicDirectives();

    return {
      metrics,
      agentStatuses,
      recentAlerts,
      activeOverrides,
      activeDirectives,
      systemHealth: {
        score: this.chiefAgent.getSystemHealthScore(),
        uptime: this.chiefAgent.getSystemUptime(),
        status: metrics.systemStatus,
      },
      lastUpdated: new Date(),
    };
  }

  /**
   * Get agent statuses
   */
  private async getAgentStatuses(req: Request, res: Response): Promise<void> {
    try {
      const filters = this.parseFilters(req.query);
      const agentStatuses = this.filterAgentStatuses(
        this.chiefAgent.getAllAgentStatuses(),
        filters
      );

      res.json({
        success: true,
        data: agentStatuses,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get specific agent status
   */
  private async getAgentStatus(req: Request, res: Response): Promise<void> {
    try {
      const { agentId } = req.params;
      const agentStatus = this.chiefAgent.getAgentStatus(agentId);

      if (!agentStatus) {
        res.status(404).json({
          success: false,
          error: 'Agent not found',
        });
        return;
      }

      res.json({
        success: true,
        data: agentStatus,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Update agent status
   */
  private async updateAgentStatus(req: Request, res: Response): Promise<void> {
    try {
      const { agentId } = req.params;
      const updates = req.body;

      this.chiefAgent.updateAgentStatus(agentId, updates);

      res.json({
        success: true,
        message: 'Agent status updated successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Create system override
   */
  private async createSystemOverride(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const overrideData = req.body;

      // Validate required fields
      if (
        !overrideData.type ||
        !overrideData.reason ||
        !overrideData.issuedBy
      ) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: type, reason, issuedBy',
        });
        return;
      }

      const overrideId = this.chiefAgent.issueSystemOverride(overrideData);

      res.json({
        success: true,
        data: { overrideId },
        message: 'System override created successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get system overrides
   */
  private async getSystemOverrides(req: Request, res: Response): Promise<void> {
    try {
      const overrides = Array.from(this.chiefAgent['systemOverrides'].values());

      res.json({
        success: true,
        data: overrides,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Cancel system override
   */
  private async cancelSystemOverride(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { overrideId } = req.params;
      const { reason } = req.body;

      if (!reason) {
        res.status(400).json({
          success: false,
          error: 'Cancellation reason is required',
        });
        return;
      }

      this.chiefAgent.cancelSystemOverride(overrideId, reason);

      res.json({
        success: true,
        message: 'System override cancelled successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Create strategic directive
   */
  private async createStrategicDirective(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const directiveData = req.body;

      // Validate required fields
      const requiredFields = [
        'title',
        'description',
        'type',
        'priority',
        'targetAgents',
        'createdBy',
      ];
      const missingFields = requiredFields.filter(
        (field) => !directiveData[field]
      );

      if (missingFields.length > 0) {
        res.status(400).json({
          success: false,
          error: `Missing required fields: ${missingFields.join(', ')}`,
        });
        return;
      }

      const directiveId =
        this.chiefAgent.createStrategicDirective(directiveData);

      res.json({
        success: true,
        data: { directiveId },
        message: 'Strategic directive created successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get strategic directives
   */
  private async getStrategicDirectives(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { status } = req.query;
      let directives = this.chiefAgent.getStrategicDirectives();

      if (status) {
        directives = directives.filter(
          (directive) => directive.status === status
        );
      }

      res.json({
        success: true,
        data: directives,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Activate strategic directive
   */
  private async activateStrategicDirective(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { directiveId } = req.params;

      this.chiefAgent.activateStrategicDirective(directiveId);

      res.json({
        success: true,
        message: 'Strategic directive activated successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get system alerts
   */
  private async getSystemAlerts(req: Request, res: Response): Promise<void> {
    try {
      const { includeAcknowledged } = req.query;
      const filters = this.parseFilters(req.query);

      const alerts = this.filterAlerts(
        this.chiefAgent.getSystemAlerts(includeAcknowledged === 'true'),
        filters
      );

      res.json({
        success: true,
        data: alerts,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Acknowledge alert
   */
  private async acknowledgeAlert(req: Request, res: Response): Promise<void> {
    try {
      const { alertId } = req.params;

      this.chiefAgent.acknowledgeAlert(alertId);

      res.json({
        success: true,
        message: 'Alert acknowledged successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Generate executive report
   */
  private async generateExecutiveReport(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { reportType } = req.params;
      const { startDate, endDate } = req.query;

      let period: { start: Date; end: Date } | undefined;
      if (startDate && endDate) {
        period = {
          start: new Date(startDate as string),
          end: new Date(endDate as string),
        };
      }

      const report = this.chiefAgent.generateExecutiveReport(
        reportType as ExecutiveReport['reportType'],
        period
      );

      res.json({
        success: true,
        data: report,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get available reports
   */
  private async getAvailableReports(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const reportTypes = ['daily', 'weekly', 'monthly', 'custom'];

      res.json({
        success: true,
        data: {
          reportTypes,
          description: {
            daily: 'Daily performance and activity summary',
            weekly: 'Weekly trends and performance analysis',
            monthly: 'Monthly executive summary with insights',
            custom: 'Custom date range report',
          },
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get system health
   */
  private async getSystemHealth(req: Request, res: Response): Promise<void> {
    try {
      const metrics = this.chiefAgent.getDashboardMetrics();
      const healthScore = this.chiefAgent.getSystemHealthScore();
      const uptime = this.chiefAgent.getSystemUptime();

      res.json({
        success: true,
        data: {
          status: metrics.systemStatus,
          healthScore,
          uptime,
          metrics: {
            activeAgents: metrics.activeAgents,
            totalAgents: metrics.totalAgents,
            currentLoad: metrics.currentLoad,
            activeAlerts: metrics.activeAlerts,
            criticalAlerts: metrics.criticalAlerts,
          },
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Parse filters from query parameters
   */
  private parseFilters(query: any): DashboardFilters {
    const filters: DashboardFilters = {};

    if (query.agentTypes) {
      filters.agentTypes = Array.isArray(query.agentTypes)
        ? query.agentTypes
        : [query.agentTypes];
    }

    if (query.alertLevels) {
      filters.alertLevels = Array.isArray(query.alertLevels)
        ? query.alertLevels
        : [query.alertLevels];
    }

    if (query.status) {
      filters.status = Array.isArray(query.status)
        ? query.status
        : [query.status];
    }

    if (query.startDate && query.endDate) {
      filters.dateRange = {
        start: new Date(query.startDate),
        end: new Date(query.endDate),
      };
    }

    return filters;
  }

  /**
   * Filter agent statuses based on criteria
   */
  private filterAgentStatuses(
    statuses: AgentStatus[],
    filters?: DashboardFilters
  ): AgentStatus[] {
    if (!filters) return statuses;

    return statuses.filter((status) => {
      if (
        filters.agentTypes &&
        !filters.agentTypes.includes(status.agentType)
      ) {
        return false;
      }

      if (filters.status && !filters.status.includes(status.status)) {
        return false;
      }

      return true;
    });
  }

  /**
   * Filter alerts based on criteria
   */
  private filterAlerts(
    alerts: SystemAlert[],
    filters?: DashboardFilters
  ): SystemAlert[] {
    if (!filters) return alerts;

    return alerts.filter((alert) => {
      if (filters.alertLevels && !filters.alertLevels.includes(alert.level)) {
        return false;
      }

      if (filters.dateRange) {
        if (
          alert.timestamp < filters.dateRange.start ||
          alert.timestamp > filters.dateRange.end
        ) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Broadcast update to all connected dashboard clients
   */
  async broadcastUpdate(): Promise<void> {
    if (
      !this.config.enableRealTimeUpdates ||
      this.dashboardClients.size === 0
    ) {
      return;
    }

    const dashboardData = await this.compileDashboardData();
    const data = JSON.stringify(dashboardData);

    // Send to all connected clients
    for (const client of this.dashboardClients) {
      try {
        if (!client.destroyed) {
          client.write(`data: ${data}\n\n`);
        } else {
          this.dashboardClients.delete(client);
        }
      } catch (error) {
        console.error('Error broadcasting to client:', error);
        this.dashboardClients.delete(client);
      }
    }
  }

  /**
   * Get dashboard statistics
   */
  getDashboardStats(): {
    connectedClients: number;
    totalAlerts: number;
    activeOverrides: number;
    activeDirectives: number;
  } {
    const activeOverrides = Array.from(
      this.chiefAgent['systemOverrides'].values()
    ).filter((override) => override.isActive).length;
    const activeDirectives =
      this.chiefAgent.getActiveStrategicDirectives().length;
    const totalAlerts = this.chiefAgent.getSystemAlerts(true).length;

    return {
      connectedClients: this.dashboardClients.size,
      totalAlerts,
      activeOverrides,
      activeDirectives,
    };
  }
}
