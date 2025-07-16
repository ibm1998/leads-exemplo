import { DatabaseManager } from "../database/manager";
import { GoHighLevelSync } from "../integrations/gohighlevel/sync";
import { GoHighLevelClient } from "../integrations/gohighlevel/client";
import { Lead, LeadModel, LeadStatus } from "../types/lead";
import { Interaction } from "../types/interaction";
import { logger } from "../utils/logger";

export interface CRMSyncResult {
  success: boolean;
  contactId?: string;
  error?: string;
  syncTime: number;
}

export interface DataQualityIssue {
  type: "duplicate" | "validation" | "missing_data" | "inconsistency";
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  affectedRecords: string[];
  suggestedAction: string;
}

export interface AuditLogEntry {
  id: string;
  entityType: "lead" | "interaction" | "sync";
  entityId: string;
  action: "create" | "update" | "delete" | "sync";
  changes: Record<string, { old: any; new: any }>;
  userId?: string;
  agentId: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface CRMManagementConfig {
  syncTimeoutMs: number;
  maxRetries: number;
  batchSize: number;
  auditRetentionDays: number;
  duplicateThreshold: number;
}

export class AICRMManagementAgent {
  private dbManager: DatabaseManager;
  private ghlSync: GoHighLevelSync;
  private config: CRMManagementConfig;
  private syncQueue: Map<
    string,
    { data: any; timestamp: Date; retries: number }
  >;

  constructor(
    dbManager: DatabaseManager,
    ghlClient: GoHighLevelClient,
    config: Partial<CRMManagementConfig> = {}
  ) {
    this.dbManager = dbManager;
    this.ghlSync = new GoHighLevelSync(ghlClient);
    this.config = {
      syncTimeoutMs: 5000, // 5-second SLA
      maxRetries: 3,
      batchSize: 50,
      auditRetentionDays: 365,
      duplicateThreshold: 0.8,
      ...config,
    };
    this.syncQueue = new Map();
  }

  /**
   * Log interaction with real-time CRM sync (5-second SLA)
   */
  async logInteraction(interaction: Interaction): Promise<CRMSyncResult> {
    const startTime = Date.now();
    const timeoutPromise = new Promise<CRMSyncResult>((_, reject) => {
      setTimeout(() => {
        reject(
          new Error(`CRM sync timeout after ${this.config.syncTimeoutMs}ms`)
        );
      }, this.config.syncTimeoutMs);
    });

    const syncPromise = this.performInteractionSync(interaction);

    try {
      const result = await Promise.race([syncPromise, timeoutPromise]);
      const syncTime = Date.now() - startTime;

      logger.info(
        `Interaction ${interaction.id} synced successfully in ${syncTime}ms`
      );

      // Log audit entry
      await this.createAuditLog({
        entityType: "interaction",
        entityId: interaction.id,
        action: "create",
        changes: { interaction: { old: null, new: interaction } },
        agentId: "ai-crm-management-agent",
        timestamp: new Date(),
        metadata: {
          syncTime,
          slaCompliant: syncTime <= this.config.syncTimeoutMs,
        },
      });

      return { ...result, syncTime };
    } catch (error: any) {
      const syncTime = Date.now() - startTime;
      logger.error(`Failed to sync interaction ${interaction.id}`, error);

      // Queue for retry if within SLA timeout
      if (syncTime < this.config.syncTimeoutMs) {
        this.queueForRetry("interaction", interaction.id, interaction);
      }

      return {
        success: false,
        error: error.message,
        syncTime,
      };
    }
  }

  /**
   * Update lead status with pipeline management
   */
  async updateLeadStatus(
    leadId: string,
    newStatus: LeadStatus,
    agentId: string,
    metadata?: Record<string, any>
  ): Promise<CRMSyncResult> {
    const startTime = Date.now();

    try {
      // Get current lead data
      const currentLead = await this.getLeadFromDatabase(leadId);
      if (!currentLead) {
        throw new Error(`Lead ${leadId} not found`);
      }

      const leadModel = new LeadModel(currentLead);
      const oldStatus = leadModel.data.status;

      // Validate status transition
      if (!this.isValidStatusTransition(oldStatus, newStatus)) {
        throw new Error(
          `Invalid status transition from ${oldStatus} to ${newStatus}`
        );
      }

      // Update lead in database
      leadModel.update({ status: newStatus });
      await this.updateLeadInDatabase(leadModel.data);

      // Sync to GoHighLevel
      const contactId = await this.ghlSync.syncLeadToGHL(leadModel.data);

      const syncTime = Date.now() - startTime;

      // Create audit log
      await this.createAuditLog({
        entityType: "lead",
        entityId: leadId,
        action: "update",
        changes: { status: { old: oldStatus, new: newStatus } },
        agentId,
        timestamp: new Date(),
        metadata: { ...metadata, syncTime },
      });

      logger.info(
        `Lead ${leadId} status updated from ${oldStatus} to ${newStatus} in ${syncTime}ms`
      );

      return {
        success: true,
        contactId,
        syncTime,
      };
    } catch (error: any) {
      const syncTime = Date.now() - startTime;
      logger.error(`Failed to update lead status for ${leadId}`, error);

      return {
        success: false,
        error: error.message,
        syncTime,
      };
    }
  }

  /**
   * Detect and resolve duplicate leads
   */
  async detectDuplicates(): Promise<DataQualityIssue[]> {
    try {
      logger.info("Starting duplicate detection process");

      const duplicateIssues: DataQualityIssue[] = [];

      // Find potential duplicates by email
      const emailDuplicates = await this.findDuplicatesByEmail();
      if (emailDuplicates.length > 0) {
        duplicateIssues.push({
          type: "duplicate",
          severity: "high",
          description: `Found ${emailDuplicates.length} sets of leads with duplicate email addresses`,
          affectedRecords: emailDuplicates.flat(),
          suggestedAction: "Merge duplicate leads or mark as separate contacts",
        });
      }

      // Find potential duplicates by phone
      const phoneDuplicates = await this.findDuplicatesByPhone();
      if (phoneDuplicates.length > 0) {
        duplicateIssues.push({
          type: "duplicate",
          severity: "medium",
          description: `Found ${phoneDuplicates.length} sets of leads with duplicate phone numbers`,
          affectedRecords: phoneDuplicates.flat(),
          suggestedAction:
            "Verify if these are the same person or family members",
        });
      }

      // Find fuzzy name matches
      const nameDuplicates = await this.findDuplicatesByName();
      if (nameDuplicates.length > 0) {
        duplicateIssues.push({
          type: "duplicate",
          severity: "low",
          description: `Found ${nameDuplicates.length} sets of leads with similar names`,
          affectedRecords: nameDuplicates.flat(),
          suggestedAction: "Review manually to confirm if these are duplicates",
        });
      }

      logger.info(
        `Duplicate detection completed. Found ${duplicateIssues.length} issues`
      );
      return duplicateIssues;
    } catch (error: any) {
      logger.error("Duplicate detection failed", error);
      throw error;
    }
  }

  /**
   * Validate data quality across all leads
   */
  async validateDataQuality(): Promise<DataQualityIssue[]> {
    try {
      logger.info("Starting data quality validation");

      const issues: DataQualityIssue[] = [];

      // Check for missing contact information
      const missingContactInfo = await this.findLeadsWithMissingContactInfo();
      if (missingContactInfo.length > 0) {
        issues.push({
          type: "missing_data",
          severity: "high",
          description: `${missingContactInfo.length} leads missing essential contact information`,
          affectedRecords: missingContactInfo,
          suggestedAction: "Request missing contact information from leads",
        });
      }

      // Check for invalid email formats
      const invalidEmails = await this.findLeadsWithInvalidEmails();
      if (invalidEmails.length > 0) {
        issues.push({
          type: "validation",
          severity: "medium",
          description: `${invalidEmails.length} leads have invalid email formats`,
          affectedRecords: invalidEmails,
          suggestedAction:
            "Correct email formats or request valid email addresses",
        });
      }

      // Check for inconsistent data
      const inconsistentData = await this.findDataInconsistencies();
      if (inconsistentData.length > 0) {
        issues.push({
          type: "inconsistency",
          severity: "medium",
          description: `${inconsistentData.length} leads have data inconsistencies`,
          affectedRecords: inconsistentData,
          suggestedAction: "Review and standardize data formats",
        });
      }

      logger.info(
        `Data quality validation completed. Found ${issues.length} issues`
      );
      return issues;
    } catch (error: any) {
      logger.error("Data quality validation failed", error);
      throw error;
    }
  }

  /**
   * Create comprehensive audit log entry
   */
  async createAuditLog(entry: Omit<AuditLogEntry, "id">): Promise<void> {
    try {
      const auditEntry: AuditLogEntry = {
        ...entry,
        id: this.generateUUID(),
      };

      await this.dbManager.query(
        `INSERT INTO audit_logs (
          id, entity_type, entity_id, action, changes, user_id, agent_id, 
          timestamp, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          auditEntry.id,
          auditEntry.entityType,
          auditEntry.entityId,
          auditEntry.action,
          JSON.stringify(auditEntry.changes),
          auditEntry.userId,
          auditEntry.agentId,
          auditEntry.timestamp,
          JSON.stringify(auditEntry.metadata || {}),
        ]
      );

      logger.debug(
        `Audit log created for ${entry.entityType} ${entry.entityId}`
      );
    } catch (error: any) {
      logger.error("Failed to create audit log", error);
      // Don't throw here to avoid breaking main operations
    }
  }

  /**
   * Synchronize all pending data with GoHighLevel
   */
  async syncAllPendingData(): Promise<{
    leads: { success: number; failed: number };
    interactions: { success: number; failed: number };
  }> {
    try {
      logger.info("Starting full data synchronization");

      // Get all leads that need syncing
      const pendingLeads = await this.getPendingLeadsForSync();
      const leadSyncResults = await this.ghlSync.batchSyncLeads(pendingLeads);

      // Get all interactions that need syncing
      const pendingInteractions = await this.getPendingInteractionsForSync();
      const interactionSyncResults = await this.ghlSync.batchSyncInteractions(
        pendingInteractions
      );

      const results = {
        leads: {
          success: leadSyncResults.success.length,
          failed: leadSyncResults.failed.length,
        },
        interactions: {
          success: interactionSyncResults.success,
          failed: interactionSyncResults.failed.length,
        },
      };

      logger.info("Full data synchronization completed", results);
      return results;
    } catch (error: any) {
      logger.error("Full data synchronization failed", error);
      throw error;
    }
  }

  // Private helper methods

  private async performInteractionSync(
    interaction: Interaction
  ): Promise<CRMSyncResult> {
    const syncStartTime = Date.now();

    // Store interaction in database
    await this.storeInteractionInDatabase(interaction);

    // Get associated lead to find contact ID
    const lead = await this.getLeadFromDatabase(interaction.leadId);
    if (!lead) {
      throw new Error(
        `Lead ${interaction.leadId} not found for interaction sync`
      );
    }

    // Sync lead first if needed
    const contactId = await this.ghlSync.syncLeadToGHL(lead);

    // Sync interaction to GoHighLevel
    await this.ghlSync.syncInteractionToGHL(interaction, contactId);

    const syncTime = Date.now() - syncStartTime;

    return {
      success: true,
      contactId,
      syncTime,
    };
  }

  private async storeInteractionInDatabase(
    interaction: Interaction
  ): Promise<void> {
    await this.dbManager.query(
      `INSERT INTO interactions (
        id, lead_id, agent_id, type, direction, content, outcome_status,
        appointment_booked, qualification_updated, escalation_required,
        duration_seconds, sentiment_score, next_action, next_action_scheduled_at,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        interaction.id,
        interaction.leadId,
        interaction.agentId,
        interaction.type,
        interaction.direction,
        interaction.content,
        interaction.outcome.status,
        interaction.outcome.appointmentBooked,
        interaction.outcome.qualificationUpdated,
        interaction.outcome.escalationRequired,
        interaction.duration,
        interaction.sentiment?.score,
        interaction.nextAction?.action,
        interaction.nextAction?.scheduledAt,
        interaction.timestamp,
      ]
    );
  }

  private async getLeadFromDatabase(leadId: string): Promise<Lead | null> {
    const result = await this.dbManager.query(
      "SELECT * FROM leads WHERE id = $1",
      [leadId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return this.mapDatabaseRowToLead(row);
  }

  private async updateLeadInDatabase(lead: Lead): Promise<void> {
    await this.dbManager.query(
      `UPDATE leads SET 
        source = $2, name = $3, email = $4, phone = $5, preferred_channel = $6,
        timezone = $7, lead_type = $8, urgency_level = $9, intent_signals = $10,
        budget_min = $11, budget_max = $12, location = $13, property_type = $14,
        timeline = $15, qualification_score = $16, status = $17, assigned_agent = $18,
        updated_at = $19
      WHERE id = $1`,
      [
        lead.id,
        lead.source,
        lead.contactInfo.name,
        lead.contactInfo.email,
        lead.contactInfo.phone,
        lead.contactInfo.preferredChannel,
        lead.contactInfo.timezone,
        lead.leadType,
        lead.urgencyLevel,
        lead.intentSignals,
        lead.qualificationData.budget?.min,
        lead.qualificationData.budget?.max,
        lead.qualificationData.location,
        lead.qualificationData.propertyType,
        lead.qualificationData.timeline,
        lead.qualificationData.qualificationScore,
        lead.status,
        lead.assignedAgent,
        lead.updatedAt,
      ]
    );
  }

  private mapDatabaseRowToLead(row: any): Lead {
    return {
      id: row.id,
      source: row.source,
      contactInfo: {
        name: row.name,
        email: row.email,
        phone: row.phone,
        preferredChannel: row.preferred_channel,
        timezone: row.timezone,
      },
      leadType: row.lead_type,
      urgencyLevel: row.urgency_level,
      intentSignals: row.intent_signals || [],
      qualificationData: {
        budget:
          row.budget_min || row.budget_max
            ? {
                min: row.budget_min,
                max: row.budget_max,
              }
            : undefined,
        location: row.location,
        propertyType: row.property_type,
        timeline: row.timeline,
        qualificationScore: row.qualification_score,
      },
      status: row.status,
      assignedAgent: row.assigned_agent,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private isValidStatusTransition(
    currentStatus: LeadStatus,
    newStatus: LeadStatus
  ): boolean {
    const validTransitions: Record<LeadStatus, LeadStatus[]> = {
      new: ["contacted", "lost"],
      contacted: ["qualified", "lost", "dormant"],
      qualified: ["appointment_scheduled", "lost", "dormant"],
      appointment_scheduled: ["in_progress", "lost", "dormant"],
      in_progress: ["converted", "lost", "dormant"],
      converted: ["dormant"],
      lost: ["contacted"],
      dormant: ["contacted"],
    };

    return validTransitions[currentStatus]?.includes(newStatus) ?? false;
  }

  private async findDuplicatesByEmail(): Promise<string[][]> {
    const result = await this.dbManager.query(`
      SELECT email, array_agg(id) as lead_ids
      FROM leads 
      WHERE email IS NOT NULL AND email != ''
      GROUP BY email 
      HAVING COUNT(*) > 1
    `);

    return result.rows.map((row: any) => row.lead_ids);
  }

  private async findDuplicatesByPhone(): Promise<string[][]> {
    const result = await this.dbManager.query(`
      SELECT phone, array_agg(id) as lead_ids
      FROM leads 
      WHERE phone IS NOT NULL AND phone != ''
      GROUP BY phone 
      HAVING COUNT(*) > 1
    `);

    return result.rows.map((row: any) => row.lead_ids);
  }

  private async findDuplicatesByName(): Promise<string[][]> {
    // This is a simplified implementation - in production you'd use more sophisticated fuzzy matching
    const result = await this.dbManager.query(`
      SELECT LOWER(TRIM(name)) as normalized_name, array_agg(id) as lead_ids
      FROM leads 
      GROUP BY LOWER(TRIM(name))
      HAVING COUNT(*) > 1
    `);

    return result.rows.map((row: any) => row.lead_ids);
  }

  private async findLeadsWithMissingContactInfo(): Promise<string[]> {
    const result = await this.dbManager.query(`
      SELECT id FROM leads 
      WHERE (email IS NULL OR email = '') AND (phone IS NULL OR phone = '')
    `);

    return result.rows.map((row: any) => row.id);
  }

  private async findLeadsWithInvalidEmails(): Promise<string[]> {
    const result = await this.dbManager.query(`
      SELECT id FROM leads 
      WHERE email IS NOT NULL 
      AND email != '' 
      AND email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    `);

    return result.rows.map((row: any) => row.id);
  }

  private async findDataInconsistencies(): Promise<string[]> {
    // Check for leads with qualification score but no qualification data
    const result = await this.dbManager.query(`
      SELECT id FROM leads 
      WHERE qualification_score > 0 
      AND (budget_min IS NULL AND budget_max IS NULL)
      AND location IS NULL 
      AND property_type IS NULL 
      AND timeline IS NULL
    `);

    return result.rows.map((row: any) => row.id);
  }

  private async getPendingLeadsForSync(): Promise<Lead[]> {
    const result = await this.dbManager.query(
      `
      SELECT * FROM leads 
      WHERE updated_at > NOW() - INTERVAL '1 hour'
      ORDER BY updated_at DESC
      LIMIT $1
    `,
      [this.config.batchSize]
    );

    return result.rows.map((row: any) => this.mapDatabaseRowToLead(row));
  }

  private async getPendingInteractionsForSync(): Promise<
    { interaction: Interaction; contactId: string }[]
  > {
    // This is a simplified implementation - in production you'd track sync status
    const result = await this.dbManager.query(
      `
      SELECT i.*, l.id as lead_id FROM interactions i
      JOIN leads l ON i.lead_id = l.id
      WHERE i.created_at > NOW() - INTERVAL '1 hour'
      ORDER BY i.created_at DESC
      LIMIT $1
    `,
      [this.config.batchSize]
    );

    return result.rows.map((row: any) => ({
      interaction: this.mapDatabaseRowToInteraction(row),
      contactId: row.lead_id, // Simplified - would need actual GHL contact ID mapping
    }));
  }

  private mapDatabaseRowToInteraction(row: any): Interaction {
    return {
      id: row.id,
      leadId: row.lead_id,
      agentId: row.agent_id,
      type: row.type,
      direction: row.direction,
      content: row.content,
      outcome: {
        status: row.outcome_status,
        appointmentBooked: row.appointment_booked,
        qualificationUpdated: row.qualification_updated,
        escalationRequired: row.escalation_required,
      },
      duration: row.duration_seconds,
      sentiment: row.sentiment_score
        ? {
            score: row.sentiment_score,
            confidence: 0.8, // Simplified
          }
        : undefined,
      nextAction: row.next_action
        ? {
            action: row.next_action,
            scheduledAt: row.next_action_scheduled_at,
          }
        : undefined,
      timestamp: row.created_at,
    };
  }

  private queueForRetry(type: string, id: string, data: any): void {
    const existing = this.syncQueue.get(id);
    const retries = existing ? existing.retries + 1 : 1;

    if (retries <= this.config.maxRetries) {
      this.syncQueue.set(id, {
        data,
        timestamp: new Date(),
        retries,
      });

      logger.info(
        `Queued ${type} ${id} for retry (attempt ${retries}/${this.config.maxRetries})`
      );
    } else {
      logger.error(`Max retries exceeded for ${type} ${id}`);
    }
  }

  private generateUUID(): string {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c == "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      }
    );
  }
}
