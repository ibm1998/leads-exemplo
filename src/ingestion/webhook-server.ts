import express, { Request, Response, NextFunction } from 'express';
import { createServer, Server } from 'http';
import { logger } from '../utils/logger';
import { WebhookPayload, RawLeadData } from './types';
import { MetaClient } from '../integrations/meta/client';

export interface WebhookConfig {
  port: number;
  webhookSecret?: string;
  metaConfig?: {
    accessToken: string;
    appSecret: string;
    verifyToken: string;
  };
}

export interface WebhookHandler {
  source: string;
  handler: (
    payload: any,
    headers: Record<string, string>
  ) => Promise<RawLeadData[]>;
}

/**
 * Webhook server for receiving leads from website forms and 3rd-party integrations
 */
export class WebhookServer {
  private app: express.Application;
  private server: Server | null = null;
  private handlers: Map<string, WebhookHandler> = new Map();
  private metaClient?: MetaClient;

  constructor(private config: WebhookConfig) {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();

    // Initialize Meta client if config provided
    if (config.metaConfig) {
      this.metaClient = new MetaClient(config.metaConfig);
    }
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // Raw body parser for webhook signature verification
    this.app.use('/webhook', express.raw({ type: 'application/json' }));

    // JSON parser for other routes
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // CORS middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, DELETE, OPTIONS'
      );
      res.header(
        'Access-Control-Allow-Headers',
        'Origin, X-Requested-With, Content-Type, Accept, Authorization'
      );

      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });

    // Request logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      logger.info(`${req.method} ${req.path} - ${req.ip}`);
      next();
    });
  }

  /**
   * Setup webhook routes
   */
  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Generic webhook endpoint
    this.app.post('/webhook/:source', this.handleGenericWebhook.bind(this));

    // Meta/Facebook webhook endpoint
    this.app.get('/webhook/meta', this.handleMetaVerification.bind(this));
    this.app.post('/webhook/meta', this.handleMetaWebhook.bind(this));

    // Website form webhook endpoint
    this.app.post('/webhook/website', this.handleWebsiteForm.bind(this));

    // Third-party integration endpoints
    this.app.post('/webhook/zapier', this.handleZapierWebhook.bind(this));
    this.app.post(
      '/webhook/integromat',
      this.handleIntegromatWebhook.bind(this)
    );
    this.app.post('/webhook/generic', this.handleGenericIntegration.bind(this));

    // Error handling middleware
    this.app.use(this.errorHandler.bind(this));
  }

  /**
   * Start the webhook server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = createServer(this.app);

        this.server.listen(this.config.port, () => {
          logger.info(`Webhook server started on port ${this.config.port}`);
          resolve();
        });

        this.server.on('error', (error) => {
          logger.error('Webhook server error:', error);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop the webhook server
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          logger.info('Webhook server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Register a custom webhook handler
   */
  registerHandler(handler: WebhookHandler): void {
    this.handlers.set(handler.source, handler);
    logger.info(`Registered webhook handler for source: ${handler.source}`);
  }

  /**
   * Handle generic webhook requests
   */
  private async handleGenericWebhook(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const source = req.params.source;
      const handler = this.handlers.get(source);

      if (!handler) {
        res
          .status(404)
          .json({ error: `No handler registered for source: ${source}` });
        return;
      }

      const leads = await handler.handler(
        req.body,
        req.headers as Record<string, string>
      );

      // Emit leads for processing
      this.emitLeads(leads);

      res.json({
        success: true,
        message: `Processed ${leads.length} leads from ${source}`,
        count: leads.length,
      });
    } catch (error) {
      logger.error('Generic webhook error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Handle Meta webhook verification
   */
  private handleMetaVerification(req: Request, res: Response): void {
    try {
      if (!this.metaClient) {
        res.status(404).json({ error: 'Meta client not configured' });
        return;
      }

      const mode = req.query['hub.mode'] as string;
      const token = req.query['hub.verify_token'] as string;
      const challenge = req.query['hub.challenge'] as string;

      const result = this.metaClient.verifyWebhookChallenge(
        mode,
        token,
        challenge
      );

      if (result) {
        res.send(result);
      } else {
        res.status(403).json({ error: 'Verification failed' });
      }
    } catch (error) {
      logger.error('Meta verification error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Handle Meta webhook payload
   */
  private async handleMetaWebhook(req: Request, res: Response): Promise<void> {
    try {
      if (!this.metaClient) {
        res.status(404).json({ error: 'Meta client not configured' });
        return;
      }

      // Verify signature
      const signature = req.headers['x-hub-signature-256'] as string;
      const payload = req.body.toString();

      if (!this.metaClient.verifyWebhookSignature(payload, signature)) {
        res.status(403).json({ error: 'Invalid signature' });
        return;
      }

      // Process webhook
      const parsedPayload = JSON.parse(payload);
      const leads = await this.metaClient.processWebhook(parsedPayload);

      // Emit leads for processing
      this.emitLeads(leads);

      res.json({
        success: true,
        message: `Processed ${leads.length} leads from Meta`,
        count: leads.length,
      });
    } catch (error) {
      logger.error('Meta webhook error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Handle website form submissions
   */
  private async handleWebsiteForm(req: Request, res: Response): Promise<void> {
    try {
      const formData = req.body;

      // Create raw lead data from form submission
      const rawLeadData: RawLeadData = {
        source: 'website',
        sourceId: formData.formId || `form_${Date.now()}`,
        rawData: {
          ...formData,
          formName: formData.formName || 'Website Contact Form',
          pageUrl: formData.pageUrl || req.headers.referer,
          userAgent: req.headers['user-agent'],
          ipAddress: req.ip,
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date(),
      };

      // Emit lead for processing
      this.emitLeads([rawLeadData]);

      res.json({
        success: true,
        message: 'Form submission received',
        leadId: rawLeadData.sourceId,
      });
    } catch (error) {
      logger.error('Website form error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Handle Zapier webhook
   */
  private async handleZapierWebhook(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const zapierData = req.body;

      const rawLeadData: RawLeadData = {
        source: 'third_party',
        sourceId: zapierData.id || `zapier_${Date.now()}`,
        rawData: {
          ...zapierData,
          integration: 'zapier',
          receivedAt: new Date().toISOString(),
        },
        timestamp: new Date(),
      };

      this.emitLeads([rawLeadData]);

      res.json({
        success: true,
        message: 'Zapier webhook processed',
        leadId: rawLeadData.sourceId,
      });
    } catch (error) {
      logger.error('Zapier webhook error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Handle Integromat/Make webhook
   */
  private async handleIntegromatWebhook(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const integromatData = req.body;

      const rawLeadData: RawLeadData = {
        source: 'third_party',
        sourceId: integromatData.id || `integromat_${Date.now()}`,
        rawData: {
          ...integromatData,
          integration: 'integromat',
          receivedAt: new Date().toISOString(),
        },
        timestamp: new Date(),
      };

      this.emitLeads([rawLeadData]);

      res.json({
        success: true,
        message: 'Integromat webhook processed',
        leadId: rawLeadData.sourceId,
      });
    } catch (error) {
      logger.error('Integromat webhook error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Handle generic third-party integration
   */
  private async handleGenericIntegration(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const integrationData = req.body;
      const source = (req.headers['x-source'] as string) || 'third_party';

      const rawLeadData: RawLeadData = {
        source: source as any,
        sourceId: integrationData.id || `generic_${Date.now()}`,
        rawData: {
          ...integrationData,
          integration: 'generic',
          receivedAt: new Date().toISOString(),
          headers: req.headers,
        },
        timestamp: new Date(),
      };

      this.emitLeads([rawLeadData]);

      res.json({
        success: true,
        message: 'Generic integration processed',
        leadId: rawLeadData.sourceId,
      });
    } catch (error) {
      logger.error('Generic integration error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Error handling middleware
   */
  private errorHandler(
    error: Error,
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    logger.error('Webhook server error:', error);

    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal server error',
        message: error.message,
      });
    }
  }

  /**
   * Emit leads for processing (to be overridden or use event emitter)
   */
  private emitLeads(leads: RawLeadData[]): void {
    // This method should be overridden to integrate with the lead processing system
    logger.info(`Emitting ${leads.length} leads for processing`);

    // For now, just log the leads
    for (const lead of leads) {
      logger.info(`New lead from ${lead.source}:`, {
        sourceId: lead.sourceId,
        timestamp: lead.timestamp,
      });
    }
  }

  /**
   * Set lead processing callback
   */
  onLeadsReceived(callback: (leads: RawLeadData[]) => Promise<void>): void {
    this.emitLeads = async (leads: RawLeadData[]) => {
      try {
        await callback(leads);
      } catch (error) {
        logger.error('Lead processing callback error:', error);
      }
    };
  }
}
