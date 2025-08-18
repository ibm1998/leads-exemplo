import { GoHighLevelClient } from './client';
import { Lead } from '../../types/lead';
import { Interaction } from '../../types/interaction';
import { logger } from '../../utils/logger';

export interface GHLContact {
  id?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  phone?: string;
  address1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  website?: string;
  timezone?: string;
  dnd?: boolean;
  tags?: string[];
  customFields?: Record<string, any>;
  source?: string;
  dateAdded?: string;
  dateUpdated?: string;
}

export interface GHLOpportunity {
  id?: string;
  title?: string;
  status?: string;
  stage?: string;
  value?: number;
  contactId?: string;
  pipelineId?: string;
  assignedTo?: string;
  dateCreated?: string;
  dateUpdated?: string;
  customFields?: Record<string, any>;
}

export interface GHLNote {
  id?: string;
  contactId?: string;
  userId?: string;
  body?: string;
  dateAdded?: string;
}

export class GoHighLevelSync {
  constructor(private client: GoHighLevelClient) {}

  // Lead synchronization methods
  async syncLeadToGHL(lead: Lead): Promise<string> {
    try {
      logger.info(`Syncing lead ${lead.id} to GoHighLevel`);

      const ghlContact: GHLContact = this.mapLeadToGHLContact(lead);

      // Check if contact already exists
      const existingContact = await this.findContactByEmail(
        lead.contactInfo.email
      );

      let contactId: string;
      if (existingContact) {
        // Update existing contact
        contactId = existingContact.id!;
        await this.updateContact(contactId, ghlContact);
        logger.info(`Updated existing contact ${contactId} in GoHighLevel`);
      } else {
        // Create new contact
        const response = await this.createContact(ghlContact);
        contactId = response.id!;
        logger.info(`Created new contact ${contactId} in GoHighLevel`);
      }

      // Create or update opportunity if lead is qualified
      if (
        lead.qualificationData &&
        lead.qualificationData.qualificationScore > 0
      ) {
        await this.syncLeadOpportunity(lead, contactId);
      }

      return contactId;
    } catch (error: any) {
      logger.error(`Failed to sync lead ${lead.id} to GoHighLevel`, error);
      throw error;
    }
  }

  async syncInteractionToGHL(
    interaction: Interaction,
    contactId: string
  ): Promise<void> {
    try {
      logger.info(`Syncing interaction ${interaction.id} to GoHighLevel`);

      const note: GHLNote = {
        contactId,
        body: this.formatInteractionNote(interaction),
        dateAdded: interaction.timestamp.toISOString(),
      };

      await this.createNote(note);
      logger.info(
        `Created note for interaction ${interaction.id} in GoHighLevel`
      );
    } catch (error: any) {
      logger.error(
        `Failed to sync interaction ${interaction.id} to GoHighLevel`,
        error
      );
      throw error;
    }
  }

  // Contact management methods
  async createContact(contact: GHLContact): Promise<GHLContact> {
    const response = await this.client.post<GHLContact>('/contacts', contact);
    return response.data;
  }

  async updateContact(
    contactId: string,
    contact: Partial<GHLContact>
  ): Promise<GHLContact> {
    const response = await this.client.put<GHLContact>(
      `/contacts/${contactId}`,
      contact
    );
    return response.data;
  }

  async getContact(contactId: string): Promise<GHLContact> {
    const response = await this.client.get<GHLContact>(
      `/contacts/${contactId}`
    );
    return response.data;
  }

  async findContactByEmail(email?: string): Promise<GHLContact | null> {
    if (!email) return null;

    try {
      const response = await this.client.get<{ contacts: GHLContact[] }>(
        '/contacts',
        {
          params: { email },
        }
      );

      return response.data.contacts?.[0] || null;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async findContactByPhone(phone?: string): Promise<GHLContact | null> {
    if (!phone) return null;

    try {
      const response = await this.client.get<{ contacts: GHLContact[] }>(
        '/contacts',
        {
          params: { phone },
        }
      );

      return response.data.contacts?.[0] || null;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  // Opportunity management methods
  async createOpportunity(
    opportunity: GHLOpportunity
  ): Promise<GHLOpportunity> {
    const response = await this.client.post<GHLOpportunity>(
      '/opportunities',
      opportunity
    );
    return response.data;
  }

  async updateOpportunity(
    opportunityId: string,
    opportunity: Partial<GHLOpportunity>
  ): Promise<GHLOpportunity> {
    const response = await this.client.put<GHLOpportunity>(
      `/opportunities/${opportunityId}`,
      opportunity
    );
    return response.data;
  }

  // Note management methods
  async createNote(note: GHLNote): Promise<GHLNote> {
    const response = await this.client.post<GHLNote>('/contacts/notes', note);
    return response.data;
  }

  // Utility methods
  private mapLeadToGHLContact(lead: Lead): GHLContact {
    const nameParts = lead.contactInfo.name.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    return {
      firstName,
      lastName,
      name: lead.contactInfo.name,
      email: lead.contactInfo.email,
      phone: lead.contactInfo.phone,
      timezone: lead.contactInfo.timezone,
      tags: [lead.leadType, lead.source, ...lead.intentSignals],
      customFields: {
        leadId: lead.id,
        leadType: lead.leadType,
        urgencyLevel: lead.urgencyLevel,
        qualificationScore: lead.qualificationData?.qualificationScore || 0,
        budget: lead.qualificationData?.budget,
        location: lead.qualificationData?.location,
        propertyType: lead.qualificationData?.propertyType,
        timeline: lead.qualificationData?.timeline,
        assignedAgent: lead.assignedAgent,
        preferredChannel: lead.contactInfo.preferredChannel,
      },
      source: lead.source,
      dateAdded: lead.createdAt.toISOString(),
    };
  }

  private async syncLeadOpportunity(
    lead: Lead,
    contactId: string
  ): Promise<void> {
    const opportunity: GHLOpportunity = {
      title: `${lead.contactInfo.name} - ${
        lead.qualificationData?.propertyType || 'Real Estate'
      } Opportunity`,
      status: 'open',
      stage: this.mapLeadStatusToStage(lead.status),
      value: this.estimateOpportunityValue(lead.qualificationData?.budget),
      contactId,
      customFields: {
        leadId: lead.id,
        urgencyLevel: lead.urgencyLevel,
        qualificationScore: lead.qualificationData?.qualificationScore,
      },
      dateCreated: lead.createdAt.toISOString(),
    };

    await this.createOpportunity(opportunity);
  }

  private mapLeadStatusToStage(status: string): string {
    const stageMap: Record<string, string> = {
      new: 'New Lead',
      contacted: 'Contacted',
      qualified: 'Qualified',
      appointment_scheduled: 'Appointment Scheduled',
      proposal_sent: 'Proposal Sent',
      closed_won: 'Closed Won',
      closed_lost: 'Closed Lost',
      nurturing: 'Nurturing',
    };

    return stageMap[status] || 'New Lead';
  }

  private estimateOpportunityValue(budget?: {
    min?: number;
    max?: number;
  }): number {
    if (!budget) return 0;

    // Use the max value if available, otherwise use min, otherwise return 0
    return budget.max || budget.min || 0;
  }

  private formatInteractionNote(interaction: Interaction): string {
    const lines = [
      `Interaction Type: ${interaction.type.toUpperCase()}`,
      `Direction: ${interaction.direction}`,
      `Agent: ${interaction.agentId}`,
      `Timestamp: ${interaction.timestamp.toISOString()}`,
      '',
    ];

    if (interaction.duration) {
      lines.push(`Duration: ${interaction.duration} seconds`);
    }

    if (interaction.sentiment) {
      const sentimentLabel =
        interaction.sentiment.score > 0
          ? 'positive'
          : interaction.sentiment.score < 0
          ? 'negative'
          : 'neutral';
      lines.push(
        `Sentiment: ${sentimentLabel} (${interaction.sentiment.score})`
      );
    }

    lines.push('', 'Content:', interaction.content);

    if (interaction.outcome) {
      lines.push('', 'Outcome:', `Status: ${interaction.outcome.status}`);

      if (interaction.outcome.appointmentBooked) {
        lines.push('✓ Appointment booked');
      }

      if (interaction.outcome.qualificationUpdated) {
        lines.push('✓ Qualification updated');
      }

      if (interaction.outcome.escalationRequired) {
        lines.push('⚠️ Escalation required');
      }
    }

    if (interaction.nextAction) {
      lines.push(
        '',
        'Next Action:',
        `${
          interaction.nextAction.action
        } scheduled for ${interaction.nextAction.scheduledAt.toISOString()}`
      );
    }

    return lines.join('\n');
  }

  // Batch synchronization methods
  async batchSyncLeads(leads: Lead[]): Promise<{
    success: string[];
    failed: { leadId: string; error: string }[];
  }> {
    const results: {
      success: string[];
      failed: { leadId: string; error: string }[];
    } = {
      success: [],
      failed: [],
    };

    for (const lead of leads) {
      try {
        const contactId = await this.syncLeadToGHL(lead);
        results.success.push(contactId);
      } catch (error: any) {
        results.failed.push({
          leadId: lead.id,
          error: error.message || 'Unknown error',
        });
      }
    }

    logger.info(
      `Batch sync completed: ${results.success.length} successful, ${results.failed.length} failed`
    );
    return results;
  }

  async batchSyncInteractions(
    interactions: { interaction: Interaction; contactId: string }[]
  ): Promise<{
    success: number;
    failed: { interactionId: string; error: string }[];
  }> {
    const results: {
      success: number;
      failed: { interactionId: string; error: string }[];
    } = {
      success: 0,
      failed: [],
    };

    for (const { interaction, contactId } of interactions) {
      try {
        await this.syncInteractionToGHL(interaction, contactId);
        results.success++;
      } catch (error: any) {
        results.failed.push({
          interactionId: interaction.id,
          error: error.message || 'Unknown error',
        });
      }
    }

    logger.info(
      `Batch interaction sync completed: ${results.success} successful, ${results.failed.length} failed`
    );
    return results;
  }
}
