import axios, { AxiosInstance, AxiosResponse } from "axios";
import { logger } from "../utils/logger";

/**
 * n8n workflow execution status
 */
export type WorkflowExecutionStatus =
  | "new"
  | "running"
  | "success"
  | "error"
  | "canceled"
  | "waiting";

/**
 * n8n workflow execution data
 */
export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: WorkflowExecutionStatus;
  startedAt: Date;
  finishedAt?: Date;
  data?: any;
  error?: string;
}

/**
 * n8n workflow definition
 */
export interface WorkflowDefinition {
  id: string;
  name: string;
  active: boolean;
  nodes: WorkflowNode[];
  connections: WorkflowConnections;
  settings?: WorkflowSettings;
}

/**
 * n8n workflow node
 */
export interface WorkflowNode {
  id: string;
  name: string;
  type: string;
  typeVersion: number;
  position: [number, number];
  parameters: Record<string, any>;
  credentials?: Record<string, string>;
}

/**
 * n8n workflow connections
 */
export interface WorkflowConnections {
  [key: string]: {
    main?: Array<Array<{ node: string; type: string; index: number }>>;
  };
}

/**
 * n8n workflow settings
 */
export interface WorkflowSettings {
  executionOrder?: "v0" | "v1";
  saveManualExecutions?: boolean;
  callerPolicy?: "workflowsFromSameOwner" | "workflowsFromAList" | "any";
  errorWorkflow?: string;
}

/**
 * n8n webhook trigger data
 */
export interface WebhookTriggerData {
  workflowId: string;
  executionId: string;
  data: any;
  headers: Record<string, string>;
  query: Record<string, string>;
  body: any;
}

/**
 * n8n client configuration
 */
export interface N8nClientConfig {
  baseUrl: string;
  apiKey?: string;
  username?: string;
  password?: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

/**
 * n8n API client for workflow orchestration
 */
export class N8nClient {
  private client: AxiosInstance;
  private config: N8nClientConfig;

  constructor(config: N8nClientConfig) {
    this.config = {
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      ...config,
    };

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        "Content-Type": "application/json",
      },
    });

    this.setupAuthentication();
    this.setupInterceptors();
  }

  /**
   * Setup authentication for n8n API
   */
  private setupAuthentication(): void {
    if (this.config.apiKey) {
      this.client.defaults.headers.common["X-N8N-API-KEY"] = this.config.apiKey;
    } else if (this.config.username && this.config.password) {
      const auth = Buffer.from(
        `${this.config.username}:${this.config.password}`
      ).toString("base64");
      this.client.defaults.headers.common["Authorization"] = `Basic ${auth}`;
    }
  }

  /**
   * Setup request/response interceptors
   */
  private setupInterceptors(): void {
    // Request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.debug(
          `n8n API Request: ${config.method?.toUpperCase()} ${config.url}`
        );
        return config;
      },
      (error) => {
        logger.error("n8n API Request Error:", error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for logging and error handling
    this.client.interceptors.response.use(
      (response) => {
        logger.debug(
          `n8n API Response: ${response.status} ${response.config.url}`
        );
        return response;
      },
      async (error) => {
        logger.error(
          "n8n API Response Error:",
          error.response?.data || error.message
        );

        // Retry logic for transient errors
        if (
          this.shouldRetry(error) &&
          error.config &&
          !error.config.__retryCount
        ) {
          return this.retryRequest(error);
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * Check if request should be retried
   */
  private shouldRetry(error: any): boolean {
    return (
      error.code === "ECONNRESET" ||
      error.code === "ETIMEDOUT" ||
      (error.response && error.response.status >= 500)
    );
  }

  /**
   * Retry failed request with exponential backoff
   */
  private async retryRequest(error: any): Promise<AxiosResponse> {
    const config = error.config;
    config.__retryCount = config.__retryCount || 0;

    if (config.__retryCount >= this.config.retryAttempts!) {
      return Promise.reject(error);
    }

    config.__retryCount += 1;
    const delay =
      this.config.retryDelay! * Math.pow(2, config.__retryCount - 1);

    logger.warn(
      `Retrying n8n API request (attempt ${config.__retryCount}/${this.config.retryAttempts}) after ${delay}ms`
    );

    await new Promise((resolve) => setTimeout(resolve, delay));
    return this.client(config);
  }

  /**
   * Get all workflows
   */
  async getWorkflows(): Promise<WorkflowDefinition[]> {
    try {
      const response = await this.client.get("/workflows");
      return response.data.data || response.data;
    } catch (error) {
      logger.error("Failed to get workflows:", error);
      throw new Error(
        `Failed to get workflows: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get workflow by ID
   */
  async getWorkflow(workflowId: string): Promise<WorkflowDefinition> {
    try {
      const response = await this.client.get(`/workflows/${workflowId}`);
      return response.data.data || response.data;
    } catch (error) {
      logger.error(`Failed to get workflow ${workflowId}:`, error);
      throw new Error(
        `Failed to get workflow: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Create new workflow
   */
  async createWorkflow(
    workflow: Omit<WorkflowDefinition, "id">
  ): Promise<WorkflowDefinition> {
    try {
      const response = await this.client.post("/workflows", workflow);
      return response.data.data || response.data;
    } catch (error) {
      logger.error("Failed to create workflow:", error);
      throw new Error(
        `Failed to create workflow: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Update existing workflow
   */
  async updateWorkflow(
    workflowId: string,
    workflow: Partial<WorkflowDefinition>
  ): Promise<WorkflowDefinition> {
    try {
      const response = await this.client.patch(
        `/workflows/${workflowId}`,
        workflow
      );
      return response.data.data || response.data;
    } catch (error) {
      logger.error(`Failed to update workflow ${workflowId}:`, error);
      throw new Error(
        `Failed to update workflow: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Delete workflow
   */
  async deleteWorkflow(workflowId: string): Promise<void> {
    try {
      await this.client.delete(`/workflows/${workflowId}`);
    } catch (error) {
      logger.error(`Failed to delete workflow ${workflowId}:`, error);
      throw new Error(
        `Failed to delete workflow: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Activate workflow
   */
  async activateWorkflow(workflowId: string): Promise<void> {
    try {
      await this.client.patch(`/workflows/${workflowId}/activate`);
    } catch (error) {
      logger.error(`Failed to activate workflow ${workflowId}:`, error);
      throw new Error(
        `Failed to activate workflow: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Deactivate workflow
   */
  async deactivateWorkflow(workflowId: string): Promise<void> {
    try {
      await this.client.patch(`/workflows/${workflowId}/deactivate`);
    } catch (error) {
      logger.error(`Failed to deactivate workflow ${workflowId}:`, error);
      throw new Error(
        `Failed to deactivate workflow: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Execute workflow manually
   */
  async executeWorkflow(
    workflowId: string,
    data?: any
  ): Promise<WorkflowExecution> {
    try {
      const response = await this.client.post(
        `/workflows/${workflowId}/execute`,
        {
          data: data || {},
        }
      );

      const executionData = response.data.data || response.data;
      return {
        id: executionData.id,
        workflowId,
        status: executionData.finished ? "success" : "running",
        startedAt: new Date(executionData.startedAt),
        finishedAt: executionData.stoppedAt
          ? new Date(executionData.stoppedAt)
          : undefined,
        data: executionData.data,
        error: executionData.error,
      };
    } catch (error) {
      logger.error(`Failed to execute workflow ${workflowId}:`, error);
      throw new Error(
        `Failed to execute workflow: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get workflow executions
   */
  async getWorkflowExecutions(
    workflowId: string,
    limit = 20
  ): Promise<WorkflowExecution[]> {
    try {
      const response = await this.client.get(`/executions`, {
        params: {
          filter: JSON.stringify({ workflowId }),
          limit,
        },
      });

      const executions = response.data.data || response.data;
      return executions.map((exec: any) => ({
        id: exec.id,
        workflowId: exec.workflowId,
        status: exec.finished ? (exec.error ? "error" : "success") : "running",
        startedAt: new Date(exec.startedAt),
        finishedAt: exec.stoppedAt ? new Date(exec.stoppedAt) : undefined,
        data: exec.data,
        error: exec.error,
      }));
    } catch (error) {
      logger.error(
        `Failed to get executions for workflow ${workflowId}:`,
        error
      );
      throw new Error(
        `Failed to get workflow executions: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get execution by ID
   */
  async getExecution(executionId: string): Promise<WorkflowExecution> {
    try {
      const response = await this.client.get(`/executions/${executionId}`);
      const exec = response.data.data || response.data;

      return {
        id: exec.id,
        workflowId: exec.workflowId,
        status: exec.finished ? (exec.error ? "error" : "success") : "running",
        startedAt: new Date(exec.startedAt),
        finishedAt: exec.stoppedAt ? new Date(exec.stoppedAt) : undefined,
        data: exec.data,
        error: exec.error,
      };
    } catch (error) {
      logger.error(`Failed to get execution ${executionId}:`, error);
      throw new Error(
        `Failed to get execution: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Stop workflow execution
   */
  async stopExecution(executionId: string): Promise<void> {
    try {
      await this.client.post(`/executions/${executionId}/stop`);
    } catch (error) {
      logger.error(`Failed to stop execution ${executionId}:`, error);
      throw new Error(
        `Failed to stop execution: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Test webhook endpoint
   */
  async testWebhook(workflowId: string, data: any): Promise<any> {
    try {
      const response = await this.client.post(
        `/webhook-test/${workflowId}`,
        data
      );
      return response.data;
    } catch (error) {
      logger.error(`Failed to test webhook for workflow ${workflowId}:`, error);
      throw new Error(
        `Failed to test webhook: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get workflow statistics
   */
  async getWorkflowStats(workflowId: string): Promise<{
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    averageExecutionTime: number;
    lastExecution?: Date;
  }> {
    try {
      const executions = await this.getWorkflowExecutions(workflowId, 100);

      const totalExecutions = executions.length;
      const successfulExecutions = executions.filter(
        (e) => e.status === "success"
      ).length;
      const failedExecutions = executions.filter(
        (e) => e.status === "error"
      ).length;

      const completedExecutions = executions.filter((e) => e.finishedAt);
      const totalExecutionTime = completedExecutions.reduce((sum, exec) => {
        if (exec.finishedAt) {
          return sum + (exec.finishedAt.getTime() - exec.startedAt.getTime());
        }
        return sum;
      }, 0);

      const averageExecutionTime =
        completedExecutions.length > 0
          ? totalExecutionTime / completedExecutions.length
          : 0;

      const lastExecution =
        executions.length > 0 ? executions[0].startedAt : undefined;

      return {
        totalExecutions,
        successfulExecutions,
        failedExecutions,
        averageExecutionTime,
        lastExecution,
      };
    } catch (error) {
      logger.error(`Failed to get stats for workflow ${workflowId}:`, error);
      throw new Error(
        `Failed to get workflow stats: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Health check for n8n instance
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get("/healthz");
      return response.status === 200;
    } catch (error) {
      logger.error("n8n health check failed:", error);
      return false;
    }
  }
}
