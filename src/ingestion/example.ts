/**
 * Example usage of the Lead Ingestion System
 * This demonstrates how to use the multi-source lead ingestion system
 */

import { LeadIngestionSystem } from './lead-ingestion-system';
import { DatabaseManager } from '../database/manager';
import { RawLeadData } from './types';

// Example configuration
const config = {
  database: new DatabaseManager(), // Your database instance
  webhook: {
    port: 3000,
    webhookSecret: 'your-webhook-secret',
    metaConfig: {
      accessToken: 'your-meta-access-token',
      appSecret: 'your-meta-app-secret',
      verifyToken: 'your-meta-verify-token',
    },
  },
  gmail: {
    clientId: 'your-gmail-client-id',
    clientSecret: 'your-gmail-client-secret',
    redirectUri: 'your-redirect-uri',
    refreshToken: 'your-refresh-token',
  },
  meta: {
    accessToken: 'your-meta-access-token',
    appSecret: 'your-meta-app-secret',
    verifyToken: 'your-meta-verify-token',
  },
  polling: {
    enabled: true,
    intervalMinutes: 5,
  },
};

async function exampleUsage() {
  // Initialize the lead ingestion system
  const ingestionSystem = new LeadIngestionSystem(config);

  // Set up event listeners
  ingestionSystem.on('leadProcessed', (result) => {
    console.log('New lead processed:', result.leadId);
  });

  ingestionSystem.on('leadFailed', (result) => {
    console.log('Lead processing failed:', result.errors);
  });

  // Start the system
  await ingestionSystem.start();

  // Example: Process raw leads manually
  const rawLeads: RawLeadData[] = [
    {
      source: 'gmail',
      sourceId: 'email_123',
      rawData: {
        from: {
          name: 'John Doe',
          email: 'john.doe@example.com',
        },
        subject: 'Looking for a house',
        body: "Hi, I'm interested in buying a house in downtown. My budget is $400,000 - $600,000. Please contact me at 555-123-4567.",
      },
      timestamp: new Date(),
    },
    {
      source: 'website',
      sourceId: 'form_456',
      rawData: {
        name: 'Jane Smith',
        email: 'jane.smith@example.com',
        phone: '555-987-6543',
        formName: 'Contact Form',
        message: 'I want to sell my property quickly',
        service: 'sell',
      },
      timestamp: new Date(),
    },
    {
      source: 'meta_ads',
      sourceId: 'lead_789',
      rawData: {
        full_name: 'Alice Johnson',
        email: 'alice.johnson@example.com',
        phone_number: '555-555-5555',
        budget_min: '300000',
        budget_max: '500000',
        looking_to_buy: true,
        preferred_location: 'Suburbs',
      },
      timestamp: new Date(),
    },
  ];

  // Process the leads
  const results = await ingestionSystem.processRawLeads(rawLeads);

  console.log('Processing results:', results);

  // Get ingestion statistics
  const stats = await ingestionSystem.getStats('day');
  console.log('Ingestion stats:', stats);

  // Manually trigger ingestion from Gmail
  try {
    const gmailResults = await ingestionSystem.triggerIngestion('gmail', {
      maxResults: 10,
      since: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
    });
    console.log('Gmail ingestion results:', gmailResults);
  } catch (error) {
    console.log('Gmail not configured or error:', error);
  }

  // Stop the system when done
  await ingestionSystem.stop();
}

// Webhook endpoint examples:

// Website form submission:
// POST /webhook/website
// {
//   "name": "Customer Name",
//   "email": "customer@example.com",
//   "phone": "555-123-4567",
//   "formName": "Contact Form",
//   "message": "I'm interested in your services"
// }

// Zapier integration:
// POST /webhook/zapier
// {
//   "id": "zapier_lead_123",
//   "name": "Lead Name",
//   "email": "lead@example.com",
//   "source": "CRM System"
// }

// Meta webhook (automatic):
// POST /webhook/meta
// (Meta will send lead data automatically when configured)

export { exampleUsage };
