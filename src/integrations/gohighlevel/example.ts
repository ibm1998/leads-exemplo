/**
 * Example usage of GoHighLevel CRM integration
 * This file demonstrates how to use the GoHighLevel client and sync utilities
 */

import { GoHighLevelClient } from './client';
import { GoHighLevelSync } from './sync';
import { Lead } from '../../types/lead';
import { Interaction } from '../../types/interaction';
import { logger } from '../../utils/logger';

// Example configuration
const config = {
  apiKey: process.env.GOHIGHLEVEL_API_KEY || 'your-api-key-here',
  baseUrl:
    process.env.GOHIGHLEVEL_BASE_URL || 'https://rest.gohighlevel.com/v1',
  timeout: 30000,
  maxRetries: 3,
};

// Initialize client and sync
const client = new GoHighLevelClient(config);
const sync = new GoHighLevelSync(client);

/**
 * Example: Sync a new lead to GoHighLevel
 */
export async function syncNewLead(lead: Lead): Promise<string> {
  try {
    logger.info(`Starting sync for lead: ${lead.id}`);

    // Check API health before syncing
    const isHealthy = await client.healthCheck();
    if (!isHealthy) {
      throw new Error('GoHighLevel API is not available');
    }

    // Sync the lead
    const contactId = await sync.syncLeadToGHL(lead);

    logger.info(`Successfully synced lead ${lead.id} to contact ${contactId}`);
    return contactId;
  } catch (error) {
    logger.error(`Failed to sync lead ${lead.id}:`, error);
    throw error;
  }
}

/**
 * Example: Sync an interaction to GoHighLevel
 */
export async function syncInteraction(
  interaction: Interaction,
  contactId: string
): Promise<void> {
  try {
    logger.info(`Starting sync for interaction: ${interaction.id}`);

    await sync.syncInteractionToGHL(interaction, contactId);

    logger.info(`Successfully synced interaction ${interaction.id}`);
  } catch (error) {
    logger.error(`Failed to sync interaction ${interaction.id}:`, error);
    throw error;
  }
}

/**
 * Example: Batch sync multiple leads
 */
export async function batchSyncLeads(leads: Lead[]): Promise<void> {
  try {
    logger.info(`Starting batch sync for ${leads.length} leads`);

    const results = await sync.batchSyncLeads(leads);

    logger.info(
      `Batch sync completed: ${results.success.length} successful, ${results.failed.length} failed`
    );

    if (results.failed.length > 0) {
      logger.warn('Failed syncs:', results.failed);
    }
  } catch (error) {
    logger.error('Batch sync failed:', error);
    throw error;
  }
}

/**
 * Example: Monitor rate limit status
 */
export function checkRateLimit(): void {
  const status = client.getRateLimitStatus();
  logger.info(
    `Rate limit status: ${status.remainingPoints} requests remaining, next in ${status.resetTime.getTime() - Date.now()} ms`
  );

  if (status.remainingPoints < 10) {
    logger.warn('Rate limit is low, consider throttling requests');
  }
}

/**
 * Example: Find existing contact by email
 */
export async function findExistingContact(email: string): Promise<any> {
  try {
    const contact = await sync.findContactByEmail(email);

    if (contact) {
      logger.info(`Found existing contact: ${contact.id} for email: ${email}`);
      return contact;
    } else {
      logger.info(`No existing contact found for email: ${email}`);
      return null;
    }
  } catch (error) {
    logger.error(`Error finding contact by email ${email}:`, error);
    throw error;
  }
}

/**
 * Example: Complete lead lifecycle sync
 */
export async function syncLeadLifecycle(
  lead: Lead,
  interactions: Interaction[]
): Promise<void> {
  try {
    logger.info(`Starting complete lifecycle sync for lead: ${lead.id}`);

    // 1. Sync the lead first
    const contactId = await syncNewLead(lead);

    // 2. Sync all interactions for this lead
    for (const interaction of interactions) {
      await syncInteraction(interaction, contactId);

      // Check rate limit between requests
      const rateLimitStatus = client.getRateLimitStatus();
      if (rateLimitStatus.remainingPoints < 5) {
        logger.info('Rate limit low, waiting before next request...');
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    logger.info(`Complete lifecycle sync completed for lead: ${lead.id}`);
  } catch (error) {
    logger.error(`Lifecycle sync failed for lead ${lead.id}:`, error);
    throw error;
  }
}

// Export the configured instances for use in other modules
export { client, sync };
