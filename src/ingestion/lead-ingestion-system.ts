import { EventEmitter } from 'events';
import { DatabaseManager } from '../database/manager';
import { logger } from '../utils/logger';
import { LeadNormalizer } from './normalizer';
import { LeadDeduplicator } from './deduplicator';
import { WebhookServer, WebhookConfig } from './webhook-server';
import { GmailClient, GmailConfig } from '../integrations/gmail/client';
import { OAuth2Client } from 'google-auth-library';
import { MetaClient, MetaConfig } from '../integrations/meta/client';
import { RawLeadData, NormalizedLeadData, IngestionResult } from './types';
import { LeadModel, CreateLead } from '../types/lead';

export interface LeadIngestionConfig {
  database: DatabaseManager;
  webhook?: WebhookConfig;
  gmail?: GmailConfig;
  meta?: MetaConfig;
  polling?: {
    enabled: boolean;
    intervalMinutes: number;
  };
}

/**
 * Main lead ingestion system that orchestrates all lead sources
 */
export class LeadIngestionSystem extends EventEmitter {
  private normalizer: LeadNormalizer;
  private deduplicator: LeadDeduplicator;
  private webhookServer?: WebhookServer;
  private gmailClient?: GmailClient;
  private metaClient?: MetaClient;
  private pollingInterval?: NodeJS.Timeout;
  private isRunning = false;

  constructor(private config: LeadIngestionConfig) {
    super();

    this.normalizer = new LeadNormalizer();
    this.deduplicator = new LeadDeduplicator(config.database);

    // Initialize integrations based on config
    this.initializeIntegrations();
  }

  /**
   * Initialize all configured integrations
   */
  private initializeIntegrations(): void {
    // Initialize webhook server
    if (this.config.webhook) {
      this.webhookServer = new WebhookServer(this.config.webhook);
      this.webhookServer.onLeadsReceived(async (leads: RawLeadData[]) => {
        await this.processRawLeads(leads);
      });
    }

    // Initialize Gmail client
    if (this.config.gmail) {
      const { clientId, clientSecret, redirectUri, refreshToken } = this.config.gmail;
      const oauth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);
      oauth2Client.setCredentials({ refresh_token: refreshToken });
      this.gmailClient = new GmailClient(oauth2Client);
    }

    // Initialize Meta client
    if (this.config.meta) {
      this.metaClient = new MetaClient(this.config.meta);
    }
  }

  /**
   * Start the lead ingestion system
   */
  async start(): Promise<void> {
    try {
      logger.info('Starting lead ingestion system...');

      // Initialize clients
      if (this.gmailClient) {
        await this.gmailClient.initialize();
      }

      if (this.metaClient) {
        await this.metaClient.initialize();
      }

      // Start webhook server
      if (this.webhookServer) {
        await this.webhookServer.start();
      }

      // Start polling if enabled
      if (this.config.polling?.enabled) {
        this.startPolling();
      }

      this.isRunning = true;
      logger.info('Lead ingestion system started successfully');
      this.emit('started');
    } catch (error) {
      logger.error('Failed to start lead ingestion system:', error);
      throw error;
    }
  }

  /**
   * Stop the lead ingestion system
   */
  async stop(): Promise<void> {
    try {
      logger.info('Stopping lead ingestion system...');

      this.isRunning = false;

      // Stop polling
      if (this.pollingInterval) {
        clearInterval(this.pollingInterval);
        this.pollingInterval = undefined;
      }

      // Stop webhook server
      if (this.webhookServer) {
        await this.webhookServer.stop();
      }

      logger.info('Lead ingestion system stopped');
      this.emit('stopped');
    } catch (error) {
      logger.error('Error stopping lead ingestion system:', error);
      throw error;
    }
  }

  /**
   * Start polling for leads from email and social media
   */
  private startPolling(): void {
    const intervalMs = (this.config.polling?.intervalMinutes || 5) * 60 * 1000;

    logger.info(
      `Starting lead polling every ${
        this.config.polling?.intervalMinutes || 5
      } minutes`
    );

    this.pollingInterval = setInterval(async () => {
      if (!this.isRunning) return;

      try {
        await this.pollForLeads();
      } catch (error) {
        logger.error('Polling error:', error);
        this.emit('error', error);
      }
    }, intervalMs);

    // Run initial poll
    setTimeout(() => this.pollForLeads(), 1000);
  }

  /**
   * Poll for new leads from all sources
   */
  private async pollForLeads(): Promise<void> {
    logger.info('Polling for new leads...');

    const rawLeads: RawLeadData[] = [];

    // Poll Gmail
    if (this.gmailClient) {
      try {
        const emails = await this.gmailClient.getRecentEmails({
          maxResults: 20,
          since: new Date(Date.now() - 60 * 60 * 1000), // Last hour
        });

        for (const email of emails) {
          rawLeads.push(this.gmailClient.emailToRawLeadData(email));

          // Mark email as processed
          await this.gmailClient.addLabel(email.messageId, 'Lead Processed');
        }

        logger.info(`Found ${emails.length} potential leads from Gmail`);
      } catch (error) {
        logger.error('Gmail polling error:', error);
      }
    }

    // Poll Meta (if configured with page IDs)
    if (this.metaClient) {
      try {
        // This would require page IDs to be configured
        // For now, Meta leads are primarily handled via webhooks
        logger.debug('Meta polling not implemented - using webhooks');
      } catch (error) {
        logger.error('Meta polling error:', error);
      }
    }

    // Process all collected leads
    if (rawLeads.length > 0) {
      await this.processRawLeads(rawLeads);
    }
  }

  /**
   * Process raw lead data through normalization and deduplication
   */
  async processRawLeads(rawLeads: RawLeadData[]): Promise<IngestionResult[]> {
    const results: IngestionResult[] = [];

    logger.info(`Processing ${rawLeads.length} raw leads`);

    for (const rawLead of rawLeads) {
      try {
        const result = await this.processRawLead(rawLead);
        results.push(result);

        // Emit events for successful processing
        if (result.success) {
          this.emit('leadProcessed', result);
        } else {
          this.emit('leadFailed', result);
        }
      } catch (error) {
        logger.error(`Failed to process lead from ${rawLead.source}:`, error);
        results.push({
          success: false,
          isDuplicate: false,
          errors: [error instanceof Error ? error.message : String(error)],
          warnings: [],
        });
      }
    }

    logger.info(
      `Processed ${results.length} leads: ${
        results.filter((r) => r.success).length
      } successful, ${results.filter((r) => !r.success).length} failed`
    );

    return results;
  }

  /**
   * Process a single raw lead
   */
  private async processRawLead(rawLead: RawLeadData): Promise<IngestionResult> {
    try {
      // Step 1: Normalize the lead data
      const normalizedLead = await this.normalizer.normalize(rawLead);

      // Step 2: Check for duplicates
      const duplicationResult = await this.deduplicator.checkForDuplicates(
        normalizedLead
      );

      if (duplicationResult.isDuplicate && duplicationResult.existingLeadId) {
        // Handle duplicate lead
        await this.deduplicator.mergeDuplicateData(
          duplicationResult.existingLeadId,
          normalizedLead
        );

        logger.info(
          `Merged duplicate lead: ${duplicationResult.existingLeadId}`
        );

        return {
          success: true,
          leadId: duplicationResult.existingLeadId,
          isDuplicate: true,
          existingLeadId: duplicationResult.existingLeadId,
          errors: [],
          warnings: [
            `Lead merged with existing lead (confidence: ${duplicationResult.confidence.toFixed(
              2
            )})`,
          ],
        };
      }

      // Step 3: Create new lead
      const leadId = await this.createNewLead(normalizedLead);

      logger.info(`Created new lead: ${leadId}`);

      return {
        success: true,
        leadId,
        isDuplicate: false,
        errors: [],
        warnings: [],
      };
    } catch (error) {
      logger.error('Lead processing error:', error);
      return {
        success: false,
        isDuplicate: false,
        errors: [error instanceof Error ? error.message : String(error)],
        warnings: [],
      };
    }
  }

  /**
   * Create a new lead in the database
   */
  private async createNewLead(
    normalizedLead: NormalizedLeadData
  ): Promise<string> {
    const createLeadData: CreateLead = {
      source: normalizedLead.source,
      contactInfo: normalizedLead.contactInfo,
      leadType: normalizedLead.leadType,
      urgencyLevel: normalizedLead.urgencyLevel,
      intentSignals: normalizedLead.intentSignals,
      qualificationData: normalizedLead.qualificationData,
      status: 'new',
    };

    // Create lead model and validate
    const leadModel = LeadModel.create(createLeadData);
    const leadData = leadModel.data;

    // Insert into database
    const result = await this.config.database.query(
      `
      INSERT INTO leads (
        id, source, name, email, phone, preferred_channel, timezone,
        lead_type, urgency_level, intent_signals, budget_min, budget_max,
        location, property_type, timeline, qualification_score, status,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
      ) RETURNING id
    `,
      [
        leadData.id,
        leadData.source,
        leadData.contactInfo.name,
        leadData.contactInfo.email,
        leadData.contactInfo.phone,
        leadData.contactInfo.preferredChannel,
        leadData.contactInfo.timezone,
        leadData.leadType,
        leadData.urgencyLevel,
        leadData.intentSignals,
        leadData.qualificationData.budget?.min,
        leadData.qualificationData.budget?.max,
        leadData.qualificationData.location,
        leadData.qualificationData.propertyType,
        leadData.qualificationData.timeline,
        leadData.qualificationData.qualificationScore,
        leadData.status,
        leadData.createdAt,
        leadData.updatedAt,
      ]
    );

    return result.rows[0].id;
  }

  /**
   * Get ingestion statistics
   */
  async getStats(period: 'hour' | 'day' | 'week' = 'day'): Promise<any> {
    let interval: string;
    switch (period) {
      case 'hour':
        interval = '1 hour';
        break;
      case 'week':
        interval = '7 days';
        break;
      default:
        interval = '1 day';
    }

    const result = await this.config.database.query(`
      SELECT 
        source,
        COUNT(*) as total_leads,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '${interval}' THEN 1 END) as recent_leads,
        AVG(qualification_score) as avg_qualification_score
      FROM leads 
      GROUP BY source
      ORDER BY total_leads DESC
    `);

    return {
      period,
      sources: result.rows,
      totalLeads: result.rows.reduce(
        (sum: number, row: any) => sum + parseInt(row.total_leads),
        0
      ),
      recentLeads: result.rows.reduce(
        (sum: number, row: any) => sum + parseInt(row.recent_leads),
        0
      ),
    };
  }

  /**
   * Manually trigger lead ingestion from a specific source
   */
  async triggerIngestion(
    source: 'gmail' | 'meta',
    options: any = {}
  ): Promise<IngestionResult[]> {
    logger.info(`Manually triggering ingestion from ${source}`);

    const rawLeads: RawLeadData[] = [];

    switch (source) {
      case 'gmail':
        if (!this.gmailClient) {
          throw new Error('Gmail client not configured');
        }

        const emails = await this.gmailClient.getRecentEmails(options);
        for (const email of emails) {
          rawLeads.push(this.gmailClient.emailToRawLeadData(email));
        }
        break;

      case 'meta':
        if (!this.metaClient) {
          throw new Error('Meta client not configured');
        }

        // Would need page ID or form ID in options
        if (options.pageId) {
          const leads = await this.metaClient.getPageLeads(
            options.pageId,
            options
          );
          for (const lead of leads) {
            rawLeads.push(this.metaClient.metaLeadToRawLeadData(lead));
          }
        }
        break;

      default:
        throw new Error(`Unknown source: ${source}`);
    }

    return this.processRawLeads(rawLeads);
  }

  /**
   * Check if the system is running
   */
  isSystemRunning(): boolean {
    return this.isRunning;
  }
}
