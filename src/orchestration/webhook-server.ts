import express, { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";
import { N8nClient, WebhookTriggerData } from "./n8n-client";
import { Lead } from "../types/lead";
import { LeadAnalysisResult } from "../agents/ai-head-agent";

/**
 * Webhook event types
 */
export type WebhookEventType =
  | "lead_created"
  | "lead_updated"
  | "lead_routed"
  | "interaction_completed"
  | "appointment_scheduled"
  | "feedback_received"
  | "optimization_triggered";

/**
 * Webhook payload structure
 */
export interface WebhookPayload {
  eventType: WebhookEventType;
  timestamp: Date;
  data: any;
  source: string;
  correlationId?: string;
}

/**
 * Webhook endpoint configuration
 */
export interface WebhookEndpointConfig {
  path: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  workflowId?: string;
  authentication?: {
    type: "none" | "basic" | "bearer" | "api_key";
    credentials?: Record<string, string>;
  };
  validation?: {
    required: boolean;
    schema?: any;
  };
}

/**
 * Webhook processing result
 */
export interface WebhookProcessingResult {
  success: boolean;
  workflowExecutionId?: string;
  error?: string;
  processingTime: number;
}

/**
 * n8n webhook server for workflow orchestration
 */
export class N8nWebhookServer {
  private app: express.Application;
  private n8nClient: N8nClient;
  private endpoints: Map<string, WebhookEndpointConfig> = new Map();
  private processingStats: Map<
    string,
    {
      totalRequests: number;
      successfulRequests: number;
      averageProcessingTime: number;
      lastProcessed: Date;
    }
  > = new Map();

  constructor(n8nClient: N8nClient) {
    this.app = express();
    this.n8nClient = n8nClient;
    this.setupMiddleware();
    this.setupDefaultEndpoints();
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // Body parsing middleware
    this.app.use(express.json({ limit: "10mb" }));
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();

      res.on("finish", () => {
        const processingTime = Date.now() - startTime;
        logger.info(
          `Webhook ${req.method} ${req.path} - ${res.statusCode} (${processingTime}ms)`
        );
      });

      next();
    });

    // Error handling middleware
    this.app.use(
      (error: Error, req: Request, res: Response, next: NextFunction) => {
        logger.error("Webhook error:", error);
        res.status(500).json({
          error: "Internal server error",
          message: error.message,
        });
      }
    );
  }

  /**
   * Setup default webhook endpoints
   */
  private setupDefaultEndpoints(): void {
    // Lead routing webhook
    this.registerEndpoint({
      path: "/webhooks/lead-routing",
      method: "POST",
      validation: {
        required: true,
      },
    });

    // Inbound processing webhook
    this.registerEndpoint({
      path: "/webhooks/inbound-processing",
      method: "POST",
      validation: {
        required: true,
      },
    });

    // Outbound processing webhook
    this.registerEndpoint({
      path: "/webhooks/outbound-processing",
      method: "POST",
      validation: {
        required: true,
      },
    });

    // Optimization trigger webhook
    this.registerEndpoint({
      path: "/webhooks/optimization-trigger",
      method: "POST",
      validation: {
        required: false,
      },
    });

    // Generic workflow trigger webhook
    this.registerEndpoint({
      path: "/webhooks/workflow/:workflowId",
      method: "POST",
      validation: {
        required: false,
      },
    });

    // Health check endpoint
    this.app.get("/webhooks/health", (req: Request, res: Response) => {
      res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        endpoints: Array.from(this.endpoints.keys()),
        stats: Object.fromEntries(this.processingStats),
      });
    });
  }

  /**
   * Register a new webhook endpoint
   */
  registerEndpoint(config: WebhookEndpointConfig): void {
    this.endpoints.set(config.path, config);

    // Create Express route handler
    const handler = async (req: Request, res: Response): Promise<void> => {
      const startTime = Date.now();

      try {
        // Validate request if required
        if (config.validation?.required && !this.validateRequest(req, config)) {
          res.status(400).json({
            error: "Invalid request",
            message: "Request validation failed",
          });
          return;
        }

        // Authenticate request if required
        if (config.authentication && !this.authenticateRequest(req, config)) {
          res.status(401).json({
            error: "Unauthorized",
            message: "Authentication failed",
          });
          return;
        }

        // Process webhook
        const result = await this.processWebhook(req, config);

        // Update processing stats
        this.updateProcessingStats(config.path, result);

        if (result.success) {
          res.json({
            success: true,
            workflowExecutionId: result.workflowExecutionId,
            processingTime: result.processingTime,
          });
        } else {
          res.status(500).json({
            success: false,
            error: result.error,
            processingTime: result.processingTime,
          });
        }
      } catch (error) {
        const processingTime = Date.now() - startTime;
        logger.error(`Webhook processing error for ${config.path}:`, error);

        this.updateProcessingStats(config.path, {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          processingTime,
        });

        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          processingTime,
        });
      }
    };

    // Register route with Express
    switch (config.method) {
      case "GET":
        this.app.get(config.path, handler);
        break;
      case "POST":
        this.app.post(config.path, handler);
        break;
      case "PUT":
        this.app.put(config.path, handler);
        break;
      case "DELETE":
        this.app.delete(config.path, handler);
        break;
    }

    logger.info(`Registered webhook endpoint: ${config.method} ${config.path}`);
  }

  /**
   * Process webhook request
   */
  private async processWebhook(
    req: Request,
    config: WebhookEndpointConfig
  ): Promise<WebhookProcessingResult> {
    const startTime = Date.now();

    try {
      // Determine workflow ID
      let workflowId = config.workflowId;
      if (!workflowId && req.params.workflowId) {
        workflowId = req.params.workflowId;
      }

      // Create webhook payload
      const payload: WebhookPayload = {
        eventType: this.determineEventType(req.path, req.body),
        timestamp: new Date(),
        data: req.body,
        source: req.get("User-Agent") || "unknown",
        correlationId: req.get("X-Correlation-ID") || undefined,
      };

      // Process based on endpoint type
      let executionResult;

      if (workflowId) {
        // Execute specific workflow
        executionResult = await this.n8nClient.executeWorkflow(
          workflowId,
          payload
        );
      } else {
        // Route to appropriate workflow based on path
        executionResult = await this.routeToWorkflow(req.path, payload);
      }

      const processingTime = Date.now() - startTime;

      return {
        success: true,
        workflowExecutionId: executionResult.id,
        processingTime,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        processingTime,
      };
    }
  }

  /**
   * Route webhook to appropriate workflow
   */
  private async routeToWorkflow(
    path: string,
    payload: WebhookPayload
  ): Promise<any> {
    // Get all workflows and find matching ones
    const workflows = await this.n8nClient.getWorkflows();

    let targetWorkflow;

    if (path.includes("lead-routing")) {
      targetWorkflow = workflows.find((w) => w.name.includes("Lead Routing"));
    } else if (path.includes("inbound-processing")) {
      targetWorkflow = workflows.find((w) =>
        w.name.includes("Inbound Processing")
      );
    } else if (path.includes("outbound-processing")) {
      targetWorkflow = workflows.find((w) =>
        w.name.includes("Outbound Processing")
      );
    } else if (path.includes("optimization-trigger")) {
      targetWorkflow = workflows.find((w) =>
        w.name.includes("Optimization Loop")
      );
    }

    if (!targetWorkflow) {
      throw new Error(`No workflow found for path: ${path}`);
    }

    return await this.n8nClient.executeWorkflow(targetWorkflow.id, payload);
  }

  /**
   * Determine event type from request
   */
  private determineEventType(path: string, body: any): WebhookEventType {
    if (path.includes("lead-routing")) {
      return "lead_routed";
    } else if (path.includes("inbound-processing")) {
      return "interaction_completed";
    } else if (path.includes("outbound-processing")) {
      return "interaction_completed";
    } else if (path.includes("optimization-trigger")) {
      return "optimization_triggered";
    } else if (body.eventType) {
      return body.eventType;
    }

    return "lead_created"; // Default
  }

  /**
   * Validate webhook request
   */
  private validateRequest(
    req: Request,
    config: WebhookEndpointConfig
  ): boolean {
    // Basic validation - check if body exists for POST requests
    if (
      config.method === "POST" &&
      (!req.body || Object.keys(req.body).length === 0)
    ) {
      return false;
    }

    // Additional schema validation could be added here
    if (config.validation?.schema) {
      // Implement schema validation logic
      return true; // Placeholder
    }

    return true;
  }

  /**
   * Authenticate webhook request
   */
  private authenticateRequest(
    req: Request,
    config: WebhookEndpointConfig
  ): boolean {
    if (!config.authentication || config.authentication.type === "none") {
      return true;
    }

    const auth = config.authentication;

    switch (auth.type) {
      case "basic":
        const authHeader = req.get("Authorization");
        if (!authHeader || !authHeader.startsWith("Basic ")) {
          return false;
        }
        // Validate basic auth credentials
        return true; // Placeholder

      case "bearer":
        const bearerHeader = req.get("Authorization");
        if (!bearerHeader || !bearerHeader.startsWith("Bearer ")) {
          return false;
        }
        // Validate bearer token
        return true; // Placeholder

      case "api_key":
        const apiKey = req.get("X-API-Key");
        if (!apiKey) {
          return false;
        }
        // Validate API key
        return true; // Placeholder

      default:
        return false;
    }
  }

  /**
   * Update processing statistics
   */
  private updateProcessingStats(
    path: string,
    result: WebhookProcessingResult
  ): void {
    const stats = this.processingStats.get(path) || {
      totalRequests: 0,
      successfulRequests: 0,
      averageProcessingTime: 0,
      lastProcessed: new Date(),
    };

    stats.totalRequests += 1;
    if (result.success) {
      stats.successfulRequests += 1;
    }

    // Update average processing time
    stats.averageProcessingTime =
      (stats.averageProcessingTime * (stats.totalRequests - 1) +
        result.processingTime) /
      stats.totalRequests;

    stats.lastProcessed = new Date();

    this.processingStats.set(path, stats);
  }

  /**
   * Trigger lead routing workflow
   */
  async triggerLeadRouting(
    lead: Lead,
    analysis?: LeadAnalysisResult
  ): Promise<WebhookProcessingResult> {
    const payload: WebhookPayload = {
      eventType: "lead_routed",
      timestamp: new Date(),
      data: { lead, analysis },
      source: "system",
    };

    try {
      const workflows = await this.n8nClient.getWorkflows();
      const routingWorkflow = workflows.find((w) =>
        w.name.includes("Lead Routing")
      );

      if (!routingWorkflow) {
        throw new Error("Lead routing workflow not found");
      }

      const execution = await this.n8nClient.executeWorkflow(
        routingWorkflow.id,
        payload
      );

      return {
        success: true,
        workflowExecutionId: execution.id,
        processingTime: 0, // Will be updated by actual processing
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        processingTime: 0,
      };
    }
  }

  /**
   * Trigger inbound processing workflow
   */
  async triggerInboundProcessing(
    lead: Lead,
    analysis: LeadAnalysisResult
  ): Promise<WebhookProcessingResult> {
    const payload: WebhookPayload = {
      eventType: "interaction_completed",
      timestamp: new Date(),
      data: { lead, analysis },
      source: "system",
    };

    try {
      const workflows = await this.n8nClient.getWorkflows();
      const inboundWorkflow = workflows.find((w) =>
        w.name.includes("Inbound Processing")
      );

      if (!inboundWorkflow) {
        throw new Error("Inbound processing workflow not found");
      }

      const execution = await this.n8nClient.executeWorkflow(
        inboundWorkflow.id,
        payload
      );

      return {
        success: true,
        workflowExecutionId: execution.id,
        processingTime: 0,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        processingTime: 0,
      };
    }
  }

  /**
   * Trigger outbound processing workflow
   */
  async triggerOutboundProcessing(
    lead: Lead,
    analysis: LeadAnalysisResult
  ): Promise<WebhookProcessingResult> {
    const payload: WebhookPayload = {
      eventType: "interaction_completed",
      timestamp: new Date(),
      data: { lead, analysis },
      source: "system",
    };

    try {
      const workflows = await this.n8nClient.getWorkflows();
      const outboundWorkflow = workflows.find((w) =>
        w.name.includes("Outbound Processing")
      );

      if (!outboundWorkflow) {
        throw new Error("Outbound processing workflow not found");
      }

      const execution = await this.n8nClient.executeWorkflow(
        outboundWorkflow.id,
        payload
      );

      return {
        success: true,
        workflowExecutionId: execution.id,
        processingTime: 0,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        processingTime: 0,
      };
    }
  }

  /**
   * Trigger optimization loop workflow
   */
  async triggerOptimizationLoop(): Promise<WebhookProcessingResult> {
    const payload: WebhookPayload = {
      eventType: "optimization_triggered",
      timestamp: new Date(),
      data: {},
      source: "system",
    };

    try {
      const workflows = await this.n8nClient.getWorkflows();
      const optimizationWorkflow = workflows.find((w) =>
        w.name.includes("Optimization Loop")
      );

      if (!optimizationWorkflow) {
        throw new Error("Optimization loop workflow not found");
      }

      const execution = await this.n8nClient.executeWorkflow(
        optimizationWorkflow.id,
        payload
      );

      return {
        success: true,
        workflowExecutionId: execution.id,
        processingTime: 0,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        processingTime: 0,
      };
    }
  }

  /**
   * Get webhook processing statistics
   */
  getProcessingStats(): Record<string, any> {
    return Object.fromEntries(this.processingStats);
  }

  /**
   * Get registered endpoints
   */
  getRegisteredEndpoints(): WebhookEndpointConfig[] {
    return Array.from(this.endpoints.values());
  }

  /**
   * Start the webhook server
   */
  start(port: number = 3001): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(port, () => {
        logger.info(`n8n webhook server started on port ${port}`);
        resolve();
      });
    });
  }

  /**
   * Get Express app instance
   */
  getApp(): express.Application {
    return this.app;
  }
}
