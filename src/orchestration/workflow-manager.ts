import { N8nClient, WorkflowDefinition } from "./n8n-client";
import {
  WorkflowTemplateGenerator,
  AgentWorkflowType,
} from "./workflow-templates";
import { logger } from "../utils/logger";

/**
 * Workflow status monitoring data
 */
export interface WorkflowStatus {
  id: string;
  name: string;
  type: AgentWorkflowType;
  active: boolean;
  lastExecution?: Date;
  executionCount: number;
  successRate: number;
  averageExecutionTime: number;
  errorCount: number;
  lastError?: string;
  health: "healthy" | "warning" | "critical";
}

/**
 * Workflow performance metrics
 */
export interface WorkflowPerformanceMetrics {
  workflowId: string;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  executionsPerHour: number;
  lastExecutionTime?: Date;
  errorRate: number;
  performanceTrend: "improving" | "stable" | "degrading";
}

/**
 * Workflow deployment configuration
 */
export interface WorkflowDeploymentConfig {
  name: string;
  type: AgentWorkflowType;
  parameters: Record<string, any>;
  autoActivate: boolean;
  monitoring: {
    enabled: boolean;
    alertThresholds: {
      errorRate: number;
      executionTime: number;
      failureCount: number;
    };
  };
}

/**
 * Workflow alert configuration
 */
export interface WorkflowAlert {
  id: string;
  workflowId: string;
  type: "error_rate" | "execution_time" | "failure_count" | "workflow_inactive";
  threshold: number;
  currentValue: number;
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  timestamp: Date;
  acknowledged: boolean;
}

/**
 * n8n workflow management and monitoring system
 */
export class WorkflowManager {
  private n8nClient: N8nClient;
  private workflowStatuses: Map<string, WorkflowStatus> = new Map();
  private performanceMetrics: Map<string, WorkflowPerformanceMetrics> =
    new Map();
  private activeAlerts: Map<string, WorkflowAlert> = new Map();
  private monitoringInterval?: NodeJS.Timeout;
  private isMonitoring = false;

  constructor(n8nClient: N8nClient) {
    this.n8nClient = n8nClient;
  }

  /**
   * Initialize workflow manager
   */
  async initialize(): Promise<void> {
    try {
      logger.info("Initializing workflow manager...");

      // Load existing workflows
      await this.loadExistingWorkflows();

      // Start monitoring
      await this.startMonitoring();

      logger.info("Workflow manager initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize workflow manager:", error);
      throw error;
    }
  }

  /**
   * Load existing workflows from n8n
   */
  private async loadExistingWorkflows(): Promise<void> {
    try {
      const workflows = await this.n8nClient.getWorkflows();

      for (const workflow of workflows) {
        const workflowType = this.determineWorkflowType(workflow.name);
        const status: WorkflowStatus = {
          id: workflow.id,
          name: workflow.name,
          type: workflowType,
          active: workflow.active,
          executionCount: 0,
          successRate: 0,
          averageExecutionTime: 0,
          errorCount: 0,
          health: "healthy",
        };

        this.workflowStatuses.set(workflow.id, status);

        // Initialize performance metrics
        const metrics: WorkflowPerformanceMetrics = {
          workflowId: workflow.id,
          totalExecutions: 0,
          successfulExecutions: 0,
          failedExecutions: 0,
          averageExecutionTime: 0,
          executionsPerHour: 0,
          errorRate: 0,
          performanceTrend: "stable",
        };
        this.performanceMetrics.set(workflow.id, metrics);

        // Load execution history
        await this.updateWorkflowMetrics(workflow.id);
      }

      logger.info(`Loaded ${workflows.length} existing workflows`);
    } catch (error) {
      logger.error("Failed to load existing workflows:", error);
      throw error;
    }
  }

  /**
   * Determine workflow type from name
   */
  private determineWorkflowType(name: string): AgentWorkflowType {
    const lowerName = name.toLowerCase();

    if (lowerName.includes("lead routing")) return "lead_routing";
    if (lowerName.includes("inbound")) return "inbound_processing";
    if (lowerName.includes("outbound")) return "outbound_processing";
    if (lowerName.includes("retention")) return "customer_retention";
    if (lowerName.includes("feedback")) return "feedback_collection";
    if (lowerName.includes("appointment")) return "appointment_coordination";
    if (lowerName.includes("crm")) return "crm_management";
    if (lowerName.includes("analytics")) return "analytics_processing";
    if (lowerName.includes("optimization")) return "optimization_loop";

    return "lead_routing"; // Default
  }

  /**
   * Deploy workflow from template
   */
  async deployWorkflow(config: WorkflowDeploymentConfig): Promise<string> {
    try {
      logger.info(`Deploying workflow: ${config.name}`);

      // Generate workflow from template
      let workflowDefinition: WorkflowDefinition;

      switch (config.type) {
        case "lead_routing":
          workflowDefinition =
            WorkflowTemplateGenerator.generateLeadRoutingWorkflow(
              config.parameters as {
                webhookPath?: string;
                aiHeadAgentEndpoint: string;
                inboundAgentEndpoint: string;
                outboundAgentEndpoint: string;
              }
            );
          break;
        case "inbound_processing":
          workflowDefinition =
            WorkflowTemplateGenerator.generateInboundProcessingWorkflow(
              config.parameters as {
                virtualSalesAssistantEndpoint: string;
                customerRetentionEndpoint: string;
                feedbackCollectorEndpoint: string;
                crmManagementEndpoint: string;
              }
            );
          break;
        case "outbound_processing":
          workflowDefinition =
            WorkflowTemplateGenerator.generateOutboundProcessingWorkflow(
              config.parameters as {
                leadGenerationEndpoint: string;
                appointmentCoordinatorEndpoint: string;
                crmManagementEndpoint: string;
              }
            );
          break;
        case "optimization_loop":
          workflowDefinition =
            WorkflowTemplateGenerator.generateOptimizationLoopWorkflow(
              config.parameters as {
                analyticsAgentEndpoint: string;
                aiHeadAgentEndpoint: string;
                scheduleInterval: string;
              }
            );
          break;
        default:
          throw new Error(`Unsupported workflow type: ${config.type}`);
      }

      // Set workflow name
      workflowDefinition.name = config.name;
      workflowDefinition.active = config.autoActivate;

      // Create workflow in n8n
      const createdWorkflow = await this.n8nClient.createWorkflow(
        workflowDefinition
      );

      // Initialize status tracking
      const status: WorkflowStatus = {
        id: createdWorkflow.id,
        name: createdWorkflow.name,
        type: config.type,
        active: createdWorkflow.active,
        executionCount: 0,
        successRate: 0,
        averageExecutionTime: 0,
        errorCount: 0,
        health: "healthy",
      };

      this.workflowStatuses.set(createdWorkflow.id, status);

      // Initialize performance metrics
      const metrics: WorkflowPerformanceMetrics = {
        workflowId: createdWorkflow.id,
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        averageExecutionTime: 0,
        executionsPerHour: 0,
        errorRate: 0,
        performanceTrend: "stable",
      };

      this.performanceMetrics.set(createdWorkflow.id, metrics);

      logger.info(
        `Successfully deployed workflow: ${config.name} (ID: ${createdWorkflow.id})`
      );

      return createdWorkflow.id;
    } catch (error) {
      logger.error(`Failed to deploy workflow ${config.name}:`, error);
      throw error;
    }
  }

  /**
   * Update workflow configuration
   */
  async updateWorkflow(
    workflowId: string,
    updates: Partial<WorkflowDefinition>
  ): Promise<void> {
    try {
      await this.n8nClient.updateWorkflow(workflowId, updates);

      // Update local status
      const status = this.workflowStatuses.get(workflowId);
      if (status && updates.name) {
        status.name = updates.name;
      }
      if (status && updates.active !== undefined) {
        status.active = updates.active;
      }

      logger.info(`Updated workflow: ${workflowId}`);
    } catch (error) {
      logger.error(`Failed to update workflow ${workflowId}:`, error);
      throw error;
    }
  }

  /**
   * Activate workflow
   */
  async activateWorkflow(workflowId: string): Promise<void> {
    try {
      await this.n8nClient.activateWorkflow(workflowId);

      const status = this.workflowStatuses.get(workflowId);
      if (status) {
        status.active = true;
      }

      logger.info(`Activated workflow: ${workflowId}`);
    } catch (error) {
      logger.error(`Failed to activate workflow ${workflowId}:`, error);
      throw error;
    }
  }

  /**
   * Deactivate workflow
   */
  async deactivateWorkflow(workflowId: string): Promise<void> {
    try {
      await this.n8nClient.deactivateWorkflow(workflowId);

      const status = this.workflowStatuses.get(workflowId);
      if (status) {
        status.active = false;
      }

      logger.info(`Deactivated workflow: ${workflowId}`);
    } catch (error) {
      logger.error(`Failed to deactivate workflow ${workflowId}:`, error);
      throw error;
    }
  }

  /**
   * Delete workflow
   */
  async deleteWorkflow(workflowId: string): Promise<void> {
    try {
      await this.n8nClient.deleteWorkflow(workflowId);

      // Remove from local tracking
      this.workflowStatuses.delete(workflowId);
      this.performanceMetrics.delete(workflowId);

      // Remove related alerts
      for (const [alertId, alert] of this.activeAlerts) {
        if (alert.workflowId === workflowId) {
          this.activeAlerts.delete(alertId);
        }
      }

      logger.info(`Deleted workflow: ${workflowId}`);
    } catch (error) {
      logger.error(`Failed to delete workflow ${workflowId}:`, error);
      throw error;
    }
  }

  /**
   * Start monitoring workflows
   */
  async startMonitoring(intervalMs: number = 60000): Promise<void> {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;

    this.monitoringInterval = setInterval(async () => {
      try {
        await this.updateAllWorkflowMetrics();
        await this.checkAlertConditions();
      } catch (error) {
        logger.error("Error during workflow monitoring:", error);
      }
    }, intervalMs);

    logger.info(`Started workflow monitoring (interval: ${intervalMs}ms)`);
  }

  /**
   * Stop monitoring workflows
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    this.isMonitoring = false;
    logger.info("Stopped workflow monitoring");
  }

  /**
   * Update metrics for all workflows
   */
  private async updateAllWorkflowMetrics(): Promise<void> {
    const workflowIds = Array.from(this.workflowStatuses.keys());

    await Promise.all(
      workflowIds.map((workflowId) => this.updateWorkflowMetrics(workflowId))
    );
  }

  /**
   * Update metrics for a specific workflow
   */
  private async updateWorkflowMetrics(workflowId: string): Promise<void> {
    try {
      const executions = await this.n8nClient.getWorkflowExecutions(
        workflowId,
        100
      );
      const stats = await this.n8nClient.getWorkflowStats(workflowId);

      // Update workflow status
      const status = this.workflowStatuses.get(workflowId);
      if (status) {
        status.executionCount = stats.totalExecutions;
        status.successRate =
          stats.totalExecutions > 0
            ? stats.successfulExecutions / stats.totalExecutions
            : 0;
        status.averageExecutionTime = stats.averageExecutionTime;
        status.errorCount = stats.failedExecutions;
        status.lastExecution = stats.lastExecution;

        // Determine health status
        status.health = this.calculateHealthStatus(status);

        // Set last error if any recent failures
        const recentFailures = executions
          .filter((e) => e.status === "error")
          .slice(0, 1);
        if (recentFailures.length > 0) {
          status.lastError = recentFailures[0].error;
        }
      }

      // Update performance metrics
      const metrics = this.performanceMetrics.get(workflowId);
      if (metrics) {
        const previousTotal = metrics.totalExecutions;

        metrics.totalExecutions = stats.totalExecutions;
        metrics.successfulExecutions = stats.successfulExecutions;
        metrics.failedExecutions = stats.failedExecutions;
        metrics.averageExecutionTime = stats.averageExecutionTime;
        metrics.lastExecutionTime = stats.lastExecution;
        metrics.errorRate =
          stats.totalExecutions > 0
            ? stats.failedExecutions / stats.totalExecutions
            : 0;

        // Calculate executions per hour (based on recent activity)
        const recentExecutions = executions.filter((e) => {
          const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
          return e.startedAt > hourAgo;
        });
        metrics.executionsPerHour = recentExecutions.length;

        // Determine performance trend
        if (stats.totalExecutions > previousTotal) {
          const recentSuccessRate =
            recentExecutions.length > 0
              ? recentExecutions.filter((e) => e.status === "success").length /
                recentExecutions.length
              : 0;

          if (
            recentSuccessRate >
            metrics.successfulExecutions / metrics.totalExecutions
          ) {
            metrics.performanceTrend = "improving";
          } else if (
            recentSuccessRate <
            metrics.successfulExecutions / metrics.totalExecutions
          ) {
            metrics.performanceTrend = "degrading";
          } else {
            metrics.performanceTrend = "stable";
          }
        }
      }
    } catch (error) {
      logger.error(
        `Failed to update metrics for workflow ${workflowId}:`,
        error
      );
    }
  }

  /**
   * Calculate health status based on metrics
   */
  private calculateHealthStatus(
    status: WorkflowStatus
  ): "healthy" | "warning" | "critical" {
    // Critical conditions
    if (!status.active) {
      return "critical";
    }

    if (status.successRate < 0.5 && status.executionCount > 10) {
      return "critical";
    }

    if (
      status.errorCount > 10 &&
      status.lastExecution &&
      Date.now() - status.lastExecution.getTime() < 60 * 60 * 1000
    ) {
      return "critical";
    }

    // Warning conditions
    if (status.successRate < 0.8 && status.executionCount > 5) {
      return "warning";
    }

    if (status.averageExecutionTime > 30000) {
      // 30 seconds
      return "warning";
    }

    if (
      status.lastExecution &&
      Date.now() - status.lastExecution.getTime() > 24 * 60 * 60 * 1000
    ) {
      return "warning";
    }

    return "healthy";
  }

  /**
   * Check alert conditions and generate alerts
   */
  private async checkAlertConditions(): Promise<void> {
    for (const [workflowId, status] of this.workflowStatuses) {
      const metrics = this.performanceMetrics.get(workflowId);
      if (!metrics) continue;

      // Check error rate alert
      if (metrics.errorRate > 0.2 && metrics.totalExecutions > 5) {
        this.createAlert({
          workflowId,
          type: "error_rate",
          threshold: 0.2,
          currentValue: metrics.errorRate,
          severity: metrics.errorRate > 0.5 ? "critical" : "high",
          message: `High error rate: ${Math.round(metrics.errorRate * 100)}%`,
        });
      }

      // Check execution time alert
      if (metrics.averageExecutionTime > 30000) {
        this.createAlert({
          workflowId,
          type: "execution_time",
          threshold: 30000,
          currentValue: metrics.averageExecutionTime,
          severity: metrics.averageExecutionTime > 60000 ? "high" : "medium",
          message: `Slow execution time: ${Math.round(
            metrics.averageExecutionTime / 1000
          )}s`,
        });
      }

      // Check failure count alert
      if (metrics.failedExecutions > 5 && metrics.totalExecutions > 0) {
        this.createAlert({
          workflowId,
          type: "failure_count",
          threshold: 5,
          currentValue: metrics.failedExecutions,
          severity: metrics.failedExecutions > 20 ? "critical" : "medium",
          message: `High failure count: ${metrics.failedExecutions} failures`,
        });
      }

      // Check inactive workflow alert
      if (
        status.active &&
        status.lastExecution &&
        Date.now() - status.lastExecution.getTime() > 24 * 60 * 60 * 1000
      ) {
        this.createAlert({
          workflowId,
          type: "workflow_inactive",
          threshold: 24,
          currentValue: Math.round(
            (Date.now() - status.lastExecution.getTime()) / (60 * 60 * 1000)
          ),
          severity: "medium",
          message: `Workflow inactive for ${Math.round(
            (Date.now() - status.lastExecution.getTime()) / (60 * 60 * 1000)
          )} hours`,
        });
      }
    }
  }

  /**
   * Create or update alert
   */
  private createAlert(
    alertData: Omit<WorkflowAlert, "id" | "timestamp" | "acknowledged">
  ): void {
    const alertId = `${alertData.workflowId}-${alertData.type}`;

    const alert: WorkflowAlert = {
      id: alertId,
      timestamp: new Date(),
      acknowledged: false,
      ...alertData,
    };

    this.activeAlerts.set(alertId, alert);

    logger.warn(
      `Workflow alert: ${alert.message} (Workflow: ${alertData.workflowId})`
    );
  }

  /**
   * Get all workflow statuses
   */
  getWorkflowStatuses(): WorkflowStatus[] {
    return Array.from(this.workflowStatuses.values());
  }

  /**
   * Get workflow status by ID
   */
  getWorkflowStatus(workflowId: string): WorkflowStatus | undefined {
    return this.workflowStatuses.get(workflowId);
  }

  /**
   * Get performance metrics for all workflows
   */
  getPerformanceMetrics(): WorkflowPerformanceMetrics[] {
    return Array.from(this.performanceMetrics.values());
  }

  /**
   * Get performance metrics for specific workflow
   */
  getWorkflowMetrics(
    workflowId: string
  ): WorkflowPerformanceMetrics | undefined {
    return this.performanceMetrics.get(workflowId);
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): WorkflowAlert[] {
    return Array.from(this.activeAlerts.values()).filter(
      (alert) => !alert.acknowledged
    );
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(alertId: string): void {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      logger.info(`Alert acknowledged: ${alertId}`);
    }
  }

  /**
   * Get system health summary
   */
  getSystemHealthSummary(): {
    totalWorkflows: number;
    activeWorkflows: number;
    healthyWorkflows: number;
    warningWorkflows: number;
    criticalWorkflows: number;
    totalExecutions: number;
    overallSuccessRate: number;
    activeAlerts: number;
  } {
    const statuses = Array.from(this.workflowStatuses.values());
    const metrics = Array.from(this.performanceMetrics.values());

    const totalExecutions = metrics.reduce(
      (sum, m) => sum + m.totalExecutions,
      0
    );
    const totalSuccessful = metrics.reduce(
      (sum, m) => sum + m.successfulExecutions,
      0
    );

    return {
      totalWorkflows: statuses.length,
      activeWorkflows: statuses.filter((s) => s.active).length,
      healthyWorkflows: statuses.filter((s) => s.health === "healthy").length,
      warningWorkflows: statuses.filter((s) => s.health === "warning").length,
      criticalWorkflows: statuses.filter((s) => s.health === "critical").length,
      totalExecutions,
      overallSuccessRate:
        totalExecutions > 0 ? totalSuccessful / totalExecutions : 0,
      activeAlerts: this.getActiveAlerts().length,
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    this.stopMonitoring();
    this.workflowStatuses.clear();
    this.performanceMetrics.clear();
    this.activeAlerts.clear();

    logger.info("Workflow manager cleaned up");
  }
}
