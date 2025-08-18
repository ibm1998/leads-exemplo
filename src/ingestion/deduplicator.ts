import { DatabaseManager } from '../database/manager';
import { logger } from '../utils/logger';
import { NormalizedLeadData, DeduplicationResult } from './types';

/**
 * Lead deduplicator that identifies potential duplicate leads
 * based on contact information and other matching criteria
 */
export class LeadDeduplicator {
  constructor(private dbManager: DatabaseManager) {}

  /**
   * Check if a normalized lead is a duplicate of an existing lead
   */
  async checkForDuplicates(
    leadData: NormalizedLeadData
  ): Promise<DeduplicationResult> {
    try {
      logger.info('Checking for duplicate leads');

      // Get potential matches based on different criteria
      const emailMatches = await this.findByEmail(leadData.contactInfo.email);
      const phoneMatches = await this.findByPhone(leadData.contactInfo.phone);
      const nameMatches = await this.findByName(leadData.contactInfo.name);

      // Combine and score matches
      const allMatches = this.combineMatches(
        emailMatches,
        phoneMatches,
        nameMatches
      );

      if (allMatches.length === 0) {
        return {
          isDuplicate: false,
          confidence: 0,
          matchingFields: [],
        };
      }

      // Find the best match
      const bestMatch = this.findBestMatch(leadData, allMatches);

      return bestMatch;
    } catch (error) {
      logger.error('Duplicate check failed:', error);
      throw new Error(`Failed to check for duplicates: ${error}`);
    }
  }

  /**
   * Find leads by email address
   */
  private async findByEmail(email?: string): Promise<any[]> {
    if (!email) return [];

    const result = await this.dbManager.query(
      'SELECT * FROM leads WHERE email = $1',
      [email.toLowerCase()]
    );

    return result.rows;
  }

  /**
   * Find leads by phone number
   */
  private async findByPhone(phone?: string): Promise<any[]> {
    if (!phone) return [];

    // Normalize phone number (remove all non-digits)
    const normalizedPhone = phone.replace(/\D/g, '');

    // Try different phone number formats
    const phoneVariations = [
      normalizedPhone,
      normalizedPhone.slice(-10), // Last 10 digits
      `1${normalizedPhone}`, // With country code
    ];

    const placeholders = phoneVariations.map((_, i) => `$${i + 1}`).join(', ');

    const result = await this.dbManager.query(
      `SELECT * FROM leads WHERE regexp_replace(phone, '[^0-9]', '', 'g') IN (${placeholders})`,
      phoneVariations
    );

    return result.rows;
  }

  /**
   * Find leads by name (fuzzy matching)
   */
  private async findByName(name: string): Promise<any[]> {
    if (!name || name === 'Unknown') return [];

    // Use PostgreSQL's similarity function for fuzzy name matching
    const result = await this.dbManager.query(
      `SELECT *, similarity(name, $1) as name_similarity 
       FROM leads 
       WHERE similarity(name, $1) > 0.6
       ORDER BY name_similarity DESC`,
      [name]
    );

    return result.rows;
  }

  /**
   * Combine matches from different criteria and remove duplicates
   */
  private combineMatches(
    emailMatches: any[],
    phoneMatches: any[],
    nameMatches: any[]
  ): any[] {
    const allMatches = [...emailMatches, ...phoneMatches, ...nameMatches];

    // Remove duplicates based on lead ID
    const uniqueMatches = allMatches.reduce((acc: any[], match: any) => {
      if (!acc.find((m: any) => m.id === match.id)) {
        acc.push(match);
      }
      return acc;
    }, [] as any[]);

    return uniqueMatches;
  }

  /**
   * Find the best match among potential duplicates
   */
  private findBestMatch(
    leadData: NormalizedLeadData,
    matches: any[]
  ): DeduplicationResult {
    let bestMatch: any = null;
    let highestScore = 0;
    let matchingFields: string[] = [];

    for (const match of matches) {
      const score = this.calculateMatchScore(leadData, match);

      if (score.total > highestScore) {
        highestScore = score.total;
        bestMatch = match;
        matchingFields = score.fields;
      }
    }

    // Consider it a duplicate if confidence is above threshold
    const isDuplicate = highestScore >= 0.7;

    return {
      isDuplicate,
      existingLeadId: isDuplicate ? bestMatch.id : undefined,
      confidence: highestScore,
      matchingFields,
    };
  }

  /**
   * Calculate match score between new lead and existing lead
   */
  private calculateMatchScore(
    newLead: NormalizedLeadData,
    existingLead: any
  ): { total: number; fields: string[] } {
    let score = 0;
    const fields: string[] = [];

    // Email match (highest weight)
    if (newLead.contactInfo.email && existingLead.email) {
      if (
        newLead.contactInfo.email.toLowerCase() ===
        existingLead.email.toLowerCase()
      ) {
        score += 0.5;
        fields.push('email');
      }
    }

    // Phone match (high weight)
    if (newLead.contactInfo.phone && existingLead.phone) {
      const newPhone = newLead.contactInfo.phone.replace(/\D/g, '');
      const existingPhone = existingLead.phone.replace(/\D/g, '');

      if (
        newPhone === existingPhone ||
        newPhone.slice(-10) === existingPhone.slice(-10)
      ) {
        score += 0.4;
        fields.push('phone');
      }
    }

    // Name match (medium weight)
    if (newLead.contactInfo.name && existingLead.name) {
      const similarity = this.calculateNameSimilarity(
        newLead.contactInfo.name,
        existingLead.name
      );

      if (similarity > 0.8) {
        score += 0.3 * similarity;
        fields.push('name');
      }
    }

    // Source match (low weight, but relevant)
    if (newLead.source === existingLead.source) {
      score += 0.1;
      fields.push('source');
    }

    // Location match (if available)
    if (newLead.qualificationData.location && existingLead.location) {
      if (
        newLead.qualificationData.location.toLowerCase() ===
        existingLead.location.toLowerCase()
      ) {
        score += 0.1;
        fields.push('location');
      }
    }

    // Time proximity (leads created close in time are more likely to be duplicates)
    const timeDiff = Math.abs(
      Date.now() - new Date(existingLead.created_at).getTime()
    );
    const daysDiff = timeDiff / (1000 * 60 * 60 * 24);

    if (daysDiff < 1) {
      score += 0.1; // Same day
      fields.push('timing');
    } else if (daysDiff < 7) {
      score += 0.05; // Same week
    }

    return { total: Math.min(score, 1), fields };
  }

  /**
   * Calculate name similarity using simple string comparison
   */
  private calculateNameSimilarity(name1: string, name2: string): number {
    const n1 = name1.toLowerCase().trim();
    const n2 = name2.toLowerCase().trim();

    if (n1 === n2) return 1;

    // Check if one name is contained in the other
    if (n1.includes(n2) || n2.includes(n1)) return 0.8;

    // Split names and check for common parts
    const parts1 = n1.split(/\s+/);
    const parts2 = n2.split(/\s+/);

    let commonParts = 0;
    for (const part1 of parts1) {
      if (
        parts2.some(
          (part2) =>
            part1 === part2 || part1.includes(part2) || part2.includes(part1)
        )
      ) {
        commonParts++;
      }
    }

    const maxParts = Math.max(parts1.length, parts2.length);
    return commonParts / maxParts;
  }

  /**
   * Merge duplicate lead data (when updating existing lead)
   */
  async mergeDuplicateData(
    existingLeadId: string,
    newLeadData: NormalizedLeadData
  ): Promise<void> {
    try {
      logger.info(`Merging duplicate lead data for lead ${existingLeadId}`);

      // Get existing lead data
      const existingResult = await this.dbManager.query(
        'SELECT * FROM leads WHERE id = $1',
        [existingLeadId]
      );

      if (existingResult.rows.length === 0) {
        throw new Error(`Existing lead ${existingLeadId} not found`);
      }

      const existingLead = existingResult.rows[0];

      // Merge contact information (prefer non-empty values)
      const mergedContactInfo = {
        name:
          newLeadData.contactInfo.name !== 'Unknown'
            ? newLeadData.contactInfo.name
            : existingLead.name,
        email: newLeadData.contactInfo.email || existingLead.email,
        phone: newLeadData.contactInfo.phone || existingLead.phone,
        preferredChannel:
          newLeadData.contactInfo.preferredChannel ||
          existingLead.preferred_channel,
        timezone: newLeadData.contactInfo.timezone || existingLead.timezone,
      };

      // Merge intent signals
      const existingIntentSignals = existingLead.intent_signals || [];
      const mergedIntentSignals = [
        ...new Set([...existingIntentSignals, ...newLeadData.intentSignals]),
      ];

      // Update urgency level if new lead has higher urgency
      const urgencyLevel = Math.max(
        newLeadData.urgencyLevel,
        existingLead.urgency_level
      );

      // Merge qualification data (prefer higher qualification score)
      const mergedQualificationData = {
        budget_min:
          newLeadData.qualificationData.budget?.min || existingLead.budget_min,
        budget_max:
          newLeadData.qualificationData.budget?.max || existingLead.budget_max,
        location:
          newLeadData.qualificationData.location || existingLead.location,
        property_type:
          newLeadData.qualificationData.propertyType ||
          existingLead.property_type,
        timeline:
          newLeadData.qualificationData.timeline || existingLead.timeline,
        qualification_score: Math.max(
          newLeadData.qualificationData.qualificationScore,
          existingLead.qualification_score
        ),
      };

      // Update the existing lead
      await this.dbManager.query(
        `
        UPDATE leads SET
          name = $2,
          email = $3,
          phone = $4,
          preferred_channel = $5,
          timezone = $6,
          urgency_level = $7,
          intent_signals = $8,
          budget_min = $9,
          budget_max = $10,
          location = $11,
          property_type = $12,
          timeline = $13,
          qualification_score = $14,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `,
        [
          existingLeadId,
          mergedContactInfo.name,
          mergedContactInfo.email,
          mergedContactInfo.phone,
          mergedContactInfo.preferredChannel,
          mergedContactInfo.timezone,
          urgencyLevel,
          mergedIntentSignals,
          mergedQualificationData.budget_min,
          mergedQualificationData.budget_max,
          mergedQualificationData.location,
          mergedQualificationData.property_type,
          mergedQualificationData.timeline,
          mergedQualificationData.qualification_score,
        ]
      );

      logger.info(
        `Successfully merged duplicate lead data for lead ${existingLeadId}`
      );
    } catch (error) {
      logger.error('Failed to merge duplicate lead data:', error);
      throw error;
    }
  }
}
