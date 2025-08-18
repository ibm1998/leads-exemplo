import axios, { AxiosInstance } from 'axios';
import { logger } from '../../utils/logger';
import { RawLeadData } from '../../ingestion/types';

export interface MetaConfig {
  accessToken: string;
  appSecret: string;
  verifyToken: string;
  apiVersion?: string;
}

export interface MetaLead {
  id: string;
  created_time: string;
  ad_id?: string;
  ad_name?: string;
  adset_id?: string;
  adset_name?: string;
  campaign_id?: string;
  campaign_name?: string;
  form_id?: string;
  form_name?: string;
  is_organic?: boolean;
  platform?: string;
  field_data: MetaFieldData[];
}

export interface MetaFieldData {
  name: string;
  values: string[];
}

export interface WebhookEntry {
  id: string;
  time: number;
  changes: WebhookChange[];
}

export interface WebhookChange {
  field: string;
  value: {
    ad_id?: string;
    form_id?: string;
    leadgen_id: string;
    created_time: number;
    page_id: string;
    adgroup_id?: string;
    campaign_id?: string;
  };
}

/**
 * Meta Business API client for lead capture from Facebook and Instagram ads
 */
export class MetaClient {
  private api: AxiosInstance;
  private readonly baseUrl: string;

  constructor(private config: MetaConfig) {
    const apiVersion = config.apiVersion || 'v18.0';
    this.baseUrl = `https://graph.facebook.com/${apiVersion}`;

    this.api = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor to include access token
    this.api.interceptors.request.use((config) => {
      config.params = {
        ...config.params,
        access_token: this.config.accessToken,
      };
      return config;
    });

    // Add response interceptor for error handling
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        logger.error('Meta API error:', error.response?.data || error.message);
        throw error;
      }
    );
  }

  /**
   * Initialize the Meta client and verify access token
   */
  async initialize(): Promise<void> {
    try {
      // Test the connection by getting user info
      const response = await this.api.get('/me', {
        params: { fields: 'id,name' },
      });

      logger.info(`Meta client initialized for ${response.data.name}`);
    } catch (error) {
      logger.error('Meta client initialization failed:', error);
      throw new Error(`Failed to initialize Meta client: ${error}`);
    }
  }

  /**
   * Get lead data by lead ID
   */
  async getLead(leadId: string): Promise<MetaLead | null> {
    try {
      const response = await this.api.get(`/${leadId}`, {
        params: {
          fields:
            'id,created_time,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id,form_name,is_organic,platform,field_data',
        },
      });

      return response.data;
    } catch (error) {
      logger.error(`Failed to get lead ${leadId}:`, error);
      return null;
    }
  }

  /**
   * Get leads from a specific form
   */
  async getFormLeads(
    formId: string,
    options: {
      limit?: number;
      since?: Date;
      until?: Date;
    } = {}
  ): Promise<MetaLead[]> {
    try {
      const { limit = 100, since, until } = options;

      const params: any = {
        fields:
          'id,created_time,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id,form_name,is_organic,platform,field_data',
        limit,
      };

      if (since) {
        params.since = Math.floor(since.getTime() / 1000);
      }

      if (until) {
        params.until = Math.floor(until.getTime() / 1000);
      }

      const response = await this.api.get(`/${formId}/leads`, { params });

      return response.data.data || [];
    } catch (error) {
      logger.error(`Failed to get leads for form ${formId}:`, error);
      return [];
    }
  }

  /**
   * Get leads from a specific page
   */
  async getPageLeads(
    pageId: string,
    options: {
      limit?: number;
      since?: Date;
      until?: Date;
    } = {}
  ): Promise<MetaLead[]> {
    try {
      const { limit = 100, since, until } = options;

      const params: any = {
        fields:
          'id,created_time,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id,form_name,is_organic,platform,field_data',
        limit,
      };

      if (since) {
        params.since = Math.floor(since.getTime() / 1000);
      }

      if (until) {
        params.until = Math.floor(until.getTime() / 1000);
      }

      const response = await this.api.get(`/${pageId}/leadgen_forms`, {
        params,
      });

      const forms = response.data.data || [];
      const allLeads: MetaLead[] = [];

      // Get leads from each form
      for (const form of forms) {
        const formLeads = await this.getFormLeads(form.id, options);
        allLeads.push(...formLeads);
      }

      return allLeads;
    } catch (error) {
      logger.error(`Failed to get leads for page ${pageId}:`, error);
      return [];
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    try {
      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', this.config.appSecret)
        .update(payload)
        .digest('hex');

      return signature === `sha256=${expectedSignature}`;
    } catch (error) {
      logger.error('Failed to verify webhook signature:', error);
      return false;
    }
  }

  /**
   * Process webhook payload
   */
  async processWebhook(payload: any): Promise<RawLeadData[]> {
    try {
      const leads: RawLeadData[] = [];

      if (payload.object === 'page') {
        for (const entry of payload.entry || []) {
          for (const change of entry.changes || []) {
            if (change.field === 'leadgen') {
              const leadData = await this.processLeadgenChange(change.value);
              if (leadData) {
                leads.push(leadData);
              }
            }
          }
        }
      }

      return leads;
    } catch (error) {
      logger.error('Failed to process webhook:', error);
      return [];
    }
  }

  /**
   * Process leadgen webhook change
   */
  private async processLeadgenChange(
    changeValue: any
  ): Promise<RawLeadData | null> {
    try {
      const leadId = changeValue.leadgen_id;
      const lead = await this.getLead(leadId);

      if (!lead) {
        logger.warn(`Could not fetch lead data for ${leadId}`);
        return null;
      }

      return this.metaLeadToRawLeadData(lead);
    } catch (error) {
      logger.error('Failed to process leadgen change:', error);
      return null;
    }
  }

  /**
   * Convert Meta lead to raw lead data
   */
  metaLeadToRawLeadData(lead: MetaLead): RawLeadData {
    // Convert field data array to object
    const fieldData: Record<string, any> = {};
    for (const field of lead.field_data || []) {
      fieldData[field.name] =
        field.values.length === 1 ? field.values[0] : field.values;
    }

    return {
      source: 'meta_ads',
      sourceId: lead.id,
      rawData: {
        id: lead.id,
        created_time: lead.created_time,
        ad_id: lead.ad_id,
        ad_name: lead.ad_name,
        adset_id: lead.adset_id,
        adset_name: lead.adset_name,
        campaign_id: lead.campaign_id,
        campaign_name: lead.campaign_name,
        form_id: lead.form_id,
        form_name: lead.form_name,
        is_organic: lead.is_organic,
        platform: lead.platform || 'facebook',
        ...fieldData, // Spread the field data
      },
      timestamp: new Date(lead.created_time),
    };
  }

  /**
   * Get available lead forms for a page
   */
  async getLeadForms(pageId: string): Promise<any[]> {
    try {
      const response = await this.api.get(`/${pageId}/leadgen_forms`, {
        params: {
          fields: 'id,name,status,leads_count,created_time',
        },
      });

      return response.data.data || [];
    } catch (error) {
      logger.error(`Failed to get lead forms for page ${pageId}:`, error);
      return [];
    }
  }

  /**
   * Subscribe to webhook for a page
   */
  async subscribeToWebhook(pageId: string): Promise<boolean> {
    try {
      await this.api.post(`/${pageId}/subscribed_apps`, {
        subscribed_fields: ['leadgen'],
      });

      logger.info(`Successfully subscribed to webhooks for page ${pageId}`);
      return true;
    } catch (error) {
      logger.error(
        `Failed to subscribe to webhooks for page ${pageId}:`,
        error
      );
      return false;
    }
  }

  /**
   * Test webhook endpoint
   */
  verifyWebhookChallenge(
    mode: string,
    token: string,
    challenge: string
  ): string | null {
    if (mode === 'subscribe' && token === this.config.verifyToken) {
      logger.info('Webhook verification successful');
      return challenge;
    }

    logger.warn('Webhook verification failed');
    return null;
  }
}
