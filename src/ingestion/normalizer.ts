import { logger } from '../utils/logger';
import { RawLeadData, NormalizedLeadData } from './types';
import { LeadSource } from '../types/lead';

/**
 * Lead normalizer that converts raw lead data from different sources
 * into a standardized format
 */
export class LeadNormalizer {
  /**
   * Normalize raw lead data based on source
   */
  async normalize(rawData: RawLeadData): Promise<NormalizedLeadData> {
    try {
      logger.info(`Normalizing lead data from source: ${rawData.source}`);

      switch (rawData.source.toLowerCase()) {
        case 'gmail':
          return this.normalizeGmailLead(rawData);
        case 'meta_ads':
        case 'facebook':
        case 'instagram':
          return this.normalizeMetaLead(rawData);
        case 'website':
        case 'web_form':
          return this.normalizeWebsiteLead(rawData);
        case 'slack':
          return this.normalizeSlackLead(rawData);
        case 'third_party':
        default:
          return this.normalizeGenericLead(rawData);
      }
    } catch (error) {
      logger.error('Lead normalization failed:', error);
      throw new Error(
        `Failed to normalize lead from ${rawData.source}: ${error}`
      );
    }
  }

  /**
   * Normalize Gmail lead data
   */
  private normalizeGmailLead(rawData: RawLeadData): NormalizedLeadData {
    const data = rawData.rawData;

    // Extract name from email sender or subject
    const name = this.extractName(
      data.from?.name ||
        data.sender?.name ||
        data.from?.email?.split('@')[0] ||
        'Unknown'
    );

    // Extract email
    const email = data.from?.email || data.sender?.email || data.replyTo;

    // Extract phone from email content if available
    const phone = this.extractPhoneFromText(data.body || data.snippet || '');

    // Analyze urgency from subject and content
    const urgencyLevel = this.analyzeUrgency(data.subject, data.body);

    // Extract intent signals
    const intentSignals = this.extractIntentSignals(data.subject, data.body);

    // Extract qualification data from email content
    const qualificationData = this.extractQualificationFromText(
      data.body || data.snippet || ''
    );

    return {
      source: 'gmail' as LeadSource,
      contactInfo: {
        name,
        email,
        phone,
        preferredChannel: 'email',
        timezone: this.extractTimezone(data) || 'UTC',
      },
      leadType: urgencyLevel >= 7 ? 'hot' : urgencyLevel >= 4 ? 'warm' : 'cold',
      urgencyLevel,
      intentSignals,
      qualificationData,
      sourceMetadata: {
        messageId: data.messageId,
        threadId: data.threadId,
        subject: data.subject,
        receivedAt: data.receivedAt,
      },
    };
  }

  /**
   * Normalize Meta (Facebook/Instagram) lead data
   */
  private normalizeMetaLead(rawData: RawLeadData): NormalizedLeadData {
    const data = rawData.rawData;

    const name =
      data.full_name ||
      data.name ||
      `${data.first_name || ''} ${data.last_name || ''}`.trim() ||
      'Unknown';
    const email = data.email;
    const phone = data.phone_number || data.phone;

    // Meta leads are typically warm since they came from ads
    const leadType = 'warm';
    const urgencyLevel = 5; // Default for ad leads

    // Extract intent signals from form responses
    const intentSignals = this.extractMetaIntentSignals(data);

    // Extract qualification data from form fields
    const qualificationData = this.extractMetaQualificationData(data);

    return {
      source: 'meta_ads' as LeadSource,
      contactInfo: {
        name,
        email,
        phone,
        preferredChannel: phone ? 'sms' : 'email',
        timezone: 'UTC', // Meta doesn't provide timezone info
      },
      leadType,
      urgencyLevel,
      intentSignals,
      qualificationData,
      sourceMetadata: {
        adId: data.ad_id,
        campaignId: data.campaign_id,
        formId: data.form_id,
        platform: data.platform || 'facebook',
        createdTime: data.created_time,
      },
    };
  }

  /**
   * Normalize website form lead data
   */
  private normalizeWebsiteLead(rawData: RawLeadData): NormalizedLeadData {
    const data = rawData.rawData;

    const name =
      data.name ||
      data.full_name ||
      (data.firstName && data.lastName
        ? `${data.firstName} ${data.lastName}`
        : null) ||
      'Unknown';
    const email = data.email;
    const phone = data.phone || data.phoneNumber;

    // Website forms are typically hot leads
    const leadType = 'hot';
    const urgencyLevel = this.analyzeWebsiteUrgency(data);

    // Extract intent signals from form data
    const intentSignals = this.extractWebsiteIntentSignals(data);

    // Extract qualification data
    const qualificationData = this.extractWebsiteQualificationData(data);

    return {
      source: 'website' as LeadSource,
      contactInfo: {
        name,
        email,
        phone,
        preferredChannel: phone ? 'sms' : 'email',
        timezone: data.timezone || 'UTC',
      },
      leadType,
      urgencyLevel,
      intentSignals,
      qualificationData,
      sourceMetadata: {
        formName: data.formName,
        pageUrl: data.pageUrl,
        referrer: data.referrer,
        userAgent: data.userAgent,
        ipAddress: data.ipAddress,
      },
    };
  }

  /**
   * Normalize Slack lead data
   */
  private normalizeSlackLead(rawData: RawLeadData): NormalizedLeadData {
    const data = rawData.rawData;

    const name =
      data.user?.real_name ||
      data.user?.display_name ||
      data.user?.name ||
      'Unknown';
    const email = data.user?.profile?.email;

    // Slack leads are typically referrals, so warm
    const leadType = 'warm';
    const urgencyLevel = 4;

    // Extract intent signals from message content
    const intentSignals = this.extractIntentSignals(
      '',
      data.text || data.message
    );

    const qualificationData = this.extractQualificationFromText(
      data.text || data.message || ''
    );

    return {
      source: 'slack' as LeadSource,
      contactInfo: {
        name,
        email,
        preferredChannel: 'email',
        timezone: data.user?.tz || 'UTC',
      },
      leadType,
      urgencyLevel,
      intentSignals,
      qualificationData,
      sourceMetadata: {
        userId: data.user?.id,
        channelId: data.channel,
        messageTs: data.ts,
        teamId: data.team_id,
      },
    };
  }

  /**
   * Normalize generic/third-party lead data
   */
  private normalizeGenericLead(rawData: RawLeadData): NormalizedLeadData {
    const data = rawData.rawData;

    const name = data.name || data.full_name || data.contact_name || 'Unknown';
    const email = data.email || data.email_address;
    const phone = data.phone || data.phone_number || data.mobile;

    // Default to cold for unknown sources
    const leadType = 'cold';
    const urgencyLevel = 2;

    const intentSignals = data.intent_signals || [];
    const qualificationData = {
      budget:
        data.budget_min || data.budget_max
          ? { min: data.budget_min, max: data.budget_max }
          : undefined,
      location: data.location,
      propertyType: data.property_type,
      timeline: data.timeline,
      qualificationScore: data.qualification_score || 0,
    };

    return {
      source: 'third_party' as LeadSource,
      contactInfo: {
        name,
        email,
        phone,
        preferredChannel: phone ? 'sms' : 'email',
        timezone: data.timezone || 'UTC',
      },
      leadType,
      urgencyLevel,
      intentSignals,
      qualificationData,
      sourceMetadata: data,
    };
  }

  /**
   * Extract name from various text formats
   */
  private extractName(text: string): string {
    if (!text) return 'Unknown';

    // Clean up common email prefixes and suffixes
    let name = text.replace(/^(re:|fwd:|fw:)/i, '').trim();

    // If it looks like an email, extract the part before @
    if (name.includes('@')) {
      name = name.split('@')[0];
    }

    // Convert underscores and dots to spaces
    name = name.replace(/[._]/g, ' ');

    // Capitalize first letter of each word
    name = name.replace(/\b\w/g, (l) => l.toUpperCase());

    return name || 'Unknown';
  }

  /**
   * Extract phone number from text using regex
   */
  private extractPhoneFromText(text: string): string | undefined {
    const phoneRegex =
      /(\+?1?[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/;
    const match = text.match(phoneRegex);
    return match ? match[0].replace(/\D/g, '') : undefined;
  }

  /**
   * Analyze urgency level from text content
   */
  private analyzeUrgency(subject?: string, body?: string): number {
    const text = `${subject || ''} ${body || ''}`.toLowerCase();

    // High urgency keywords
    if (text.match(/urgent|asap|immediately|emergency|today|now|quick/)) {
      return 9;
    }

    // Medium-high urgency
    if (text.match(/soon|this week|deadline|time sensitive/)) {
      return 7;
    }

    // Medium urgency
    if (text.match(/interested|looking for|need|want|inquiry/)) {
      return 5;
    }

    // Low urgency
    return 3;
  }

  /**
   * Extract intent signals from text
   */
  private extractIntentSignals(subject?: string, body?: string): string[] {
    const text = `${subject || ''} ${body || ''}`.toLowerCase();
    const signals: string[] = [];

    // Real estate specific intent signals
    if (text.match(/buy|purchase|looking to buy/))
      signals.push('buying_intent');
    if (text.match(/sell|selling|list my/)) signals.push('selling_intent');
    if (text.match(/rent|rental|lease/)) signals.push('rental_intent');
    if (text.match(/invest|investment|roi/)) signals.push('investment_intent');
    if (text.match(/mortgage|financing|loan/)) signals.push('financing_need');
    if (text.match(/agent|realtor|help/)) signals.push('agent_request');
    if (text.match(/valuation|appraisal|worth/))
      signals.push('valuation_request');
    if (text.match(/market|price|cost/)) signals.push('market_research');

    return signals;
  }

  /**
   * Extract qualification data from text
   */
  private extractQualificationFromText(text: string): any {
    const lowerText = text.toLowerCase();

    // Extract budget information - improved regex to handle various formats
    const budgetMatch = text.match(/\$?([\d,]+)(?:\s*[-–—]\s*\$?([\d,]+))?/);
    let budget;
    if (budgetMatch) {
      const min = parseInt(budgetMatch[1].replace(/,/g, ''));
      const max = budgetMatch[2]
        ? parseInt(budgetMatch[2].replace(/,/g, ''))
        : undefined;
      budget = { min, max };
    }

    // Extract location
    const locationMatch = text.match(/in\s+([A-Za-z\s,]+?)(?:\s|$|\.)/);
    const location = locationMatch ? locationMatch[1].trim() : undefined;

    // Extract property type
    let propertyType;
    if (lowerText.includes('house') || lowerText.includes('home'))
      propertyType = 'house';
    else if (lowerText.includes('condo') || lowerText.includes('condominium'))
      propertyType = 'condo';
    else if (lowerText.includes('apartment')) propertyType = 'apartment';
    else if (lowerText.includes('commercial')) propertyType = 'commercial';

    // Extract timeline
    let timeline;
    if (lowerText.match(/this month|30 days/)) timeline = 'immediate';
    else if (lowerText.match(/next month|60 days/)) timeline = '1-2 months';
    else if (lowerText.match(/3 months|quarter/)) timeline = '3 months';
    else if (lowerText.match(/6 months|half year/)) timeline = '6 months';
    else if (lowerText.match(/year|12 months/)) timeline = '1 year';

    return {
      budget,
      location,
      propertyType,
      timeline,
      qualificationScore: budget ? 0.7 : location ? 0.5 : 0.3,
    };
  }

  /**
   * Extract timezone from email headers or content
   */
  private extractTimezone(data: any): string | undefined {
    // Try to extract from email headers
    if (data.headers?.date) {
      const dateMatch = data.headers.date.match(/([+-]\d{4})/);
      if (dateMatch) {
        // Convert offset to timezone (simplified)
        return 'UTC'; // For now, default to UTC
      }
    }
    return undefined;
  }

  /**
   * Extract intent signals from Meta form data
   */
  private extractMetaIntentSignals(data: any): string[] {
    const signals: string[] = [];

    // Check form fields for intent
    if (data.looking_to_buy) signals.push('buying_intent');
    if (data.looking_to_sell) signals.push('selling_intent');
    if (data.interested_in_renting) signals.push('rental_intent');
    if (data.investment_property) signals.push('investment_intent');
    if (data.need_financing) signals.push('financing_need');

    return signals;
  }

  /**
   * Extract qualification data from Meta form
   */
  private extractMetaQualificationData(data: any): any {
    return {
      budget:
        data.budget_min || data.budget_max
          ? {
              min: data.budget_min ? parseInt(data.budget_min) : undefined,
              max: data.budget_max ? parseInt(data.budget_max) : undefined,
            }
          : undefined,
      location: data.preferred_location || data.city,
      propertyType: data.property_type,
      timeline: data.timeline || data.when_looking_to_buy,
      qualificationScore: data.budget_min
        ? 0.8
        : data.preferred_location
        ? 0.6
        : 0.4,
    };
  }

  /**
   * Analyze urgency for website leads
   */
  private analyzeWebsiteUrgency(data: any): number {
    // Contact form submissions are typically high urgency
    if (data.formName?.toLowerCase().includes('contact')) return 8;

    // Quote requests are very high urgency
    if (data.formName?.toLowerCase().includes('quote')) return 9;

    // General inquiries are medium urgency
    return 6;
  }

  /**
   * Extract intent signals from website form data
   */
  private extractWebsiteIntentSignals(data: any): string[] {
    const signals: string[] = [];

    if (data.service?.includes('buy')) signals.push('buying_intent');
    if (data.service?.includes('sell')) signals.push('selling_intent');
    if (data.service?.includes('rent')) signals.push('rental_intent');
    if (data.inquiry_type === 'valuation') signals.push('valuation_request');
    if (data.need_agent) signals.push('agent_request');

    return signals;
  }

  /**
   * Extract qualification data from website form
   */
  private extractWebsiteQualificationData(data: any): any {
    return {
      budget:
        data.budget_min || data.budget_max
          ? {
              min: data.budget_min ? parseInt(data.budget_min) : undefined,
              max: data.budget_max ? parseInt(data.budget_max) : undefined,
            }
          : undefined,
      location: data.location || data.city || data.area,
      propertyType: data.property_type || data.propertyType,
      timeline: data.timeline || data.timeframe,
      qualificationScore: data.budget_min ? 0.9 : data.location ? 0.7 : 0.5,
    };
  }
}
