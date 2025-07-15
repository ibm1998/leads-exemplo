# GoHighLevel CRM Integration

This module provides a comprehensive integration with GoHighLevel CRM for the Agentic Lead Management system. It includes API client functionality, data synchronization utilities, and comprehensive error handling.

## Features

- **API Client**: Full-featured GoHighLevel API client with authentication and rate limiting
- **Data Synchronization**: Utilities to sync leads and interactions to GoHighLevel CRM
- **Rate Limiting**: Built-in rate limiting to respect GoHighLevel API limits (100 requests/minute)
- **Error Handling**: Comprehensive error handling with automatic retries and exponential backoff
- **Batch Operations**: Support for batch synchronization of multiple leads and interactions
- **Data Validation**: Robust data validation and transformation for CRM compatibility

## Components

### GoHighLevelClient

The main API client for interacting with GoHighLevel's REST API.

```typescript
import { GoHighLevelClient } from "./client";

const client = new GoHighLevelClient({
  apiKey: "your-api-key",
  baseUrl: "https://rest.gohighlevel.com/v1", // optional
  timeout: 30000, // optional
  maxRetries: 3, // optional
});

// Health check
const isHealthy = await client.healthCheck();

// Make API calls
const response = await client.get("/contacts");
```

### GoHighLevelSync

Utilities for synchronizing lead and interaction data with GoHighLevel CRM.

```typescript
import { GoHighLevelSync } from "./sync";

const sync = new GoHighLevelSync(client);

// Sync a lead to GoHighLevel
const contactId = await sync.syncLeadToGHL(lead);

// Sync an interaction
await sync.syncInteractionToGHL(interaction, contactId);

// Batch sync multiple leads
const results = await sync.batchSyncLeads(leads);
```

## Configuration

Set the following environment variables:

```bash
GOHIGHLEVEL_API_KEY=your-api-key-here
GOHIGHLEVEL_BASE_URL=https://rest.gohighlevel.com/v1  # optional
```

## Data Mapping

### Lead to GoHighLevel Contact

The system automatically maps lead data to GoHighLevel contact format:

- **Name**: Parsed into firstName and lastName
- **Contact Info**: Email, phone, timezone
- **Custom Fields**: Lead ID, type, urgency, qualification data
- **Tags**: Lead type, source, and intent signals
- **Source**: Original lead source

### Interaction to GoHighLevel Note

Interactions are converted to detailed notes in GoHighLevel:

- **Interaction Type**: Call, SMS, Email, WhatsApp
- **Direction**: Inbound or Outbound
- **Content**: Full interaction content
- **Outcome**: Success status, appointments, escalations
- **Sentiment**: Analyzed sentiment score
- **Duration**: Call duration (if applicable)
- **Next Actions**: Scheduled follow-up actions

## Rate Limiting

The client automatically handles GoHighLevel's rate limits:

- **Limit**: 100 requests per minute
- **Behavior**: Automatic queuing and retry with exponential backoff
- **Monitoring**: Built-in rate limit status checking

```typescript
// Check current rate limit status
const status = client.getRateLimitStatus();
console.log(`${status.remaining} requests remaining`);
```

## Error Handling

The integration includes comprehensive error handling:

- **Automatic Retries**: Failed requests are automatically retried with exponential backoff
- **Graceful Degradation**: System continues operating even if some requests fail
- **Error Classification**: Different handling for different types of errors
- **Logging**: Detailed error logging for troubleshooting

## Testing

The integration includes comprehensive tests:

```bash
# Run all GoHighLevel integration tests
npm test -- src/integrations/gohighlevel

# Run specific test files
npm test -- src/integrations/gohighlevel/__tests__/client.test.ts
npm test -- src/integrations/gohighlevel/__tests__/sync.test.ts
npm test -- src/integrations/gohighlevel/__tests__/integration.test.ts
```

## Usage Examples

### Basic Lead Sync

```typescript
import { GoHighLevelClient, GoHighLevelSync } from "./integrations/gohighlevel";

const client = new GoHighLevelClient({
  apiKey: process.env.GOHIGHLEVEL_API_KEY!,
});

const sync = new GoHighLevelSync(client);

// Sync a new lead
const lead = {
  id: "lead-123",
  source: "website",
  contactInfo: {
    name: "John Doe",
    email: "john@example.com",
    phone: "+1234567890",
    preferredChannel: "email",
    timezone: "America/New_York",
  },
  leadType: "hot",
  urgencyLevel: 8,
  // ... other lead properties
};

const contactId = await sync.syncLeadToGHL(lead);
console.log(`Lead synced to contact: ${contactId}`);
```

### Interaction Sync

```typescript
const interaction = {
  id: "interaction-123",
  leadId: "lead-123",
  agentId: "agent-1",
  type: "call",
  direction: "outbound",
  content: "Qualification call completed successfully",
  outcome: {
    status: "successful",
    appointmentBooked: true,
    qualificationUpdated: true,
    escalationRequired: false,
  },
  duration: 900, // 15 minutes
  timestamp: new Date(),
};

await sync.syncInteractionToGHL(interaction, contactId);
```

### Batch Operations

```typescript
// Batch sync multiple leads
const leads = [lead1, lead2, lead3];
const results = await sync.batchSyncLeads(leads);

console.log(`Successfully synced: ${results.success.length}`);
console.log(`Failed to sync: ${results.failed.length}`);

// Handle failures
results.failed.forEach((failure) => {
  console.error(`Failed to sync ${failure.leadId}: ${failure.error}`);
});
```

## API Reference

### GoHighLevelClient Methods

- `healthCheck()`: Check API connectivity
- `get(url, config?)`: GET request
- `post(url, data?, config?)`: POST request
- `put(url, data?, config?)`: PUT request
- `patch(url, data?, config?)`: PATCH request
- `delete(url, config?)`: DELETE request
- `getRateLimitStatus()`: Get current rate limit status

### GoHighLevelSync Methods

- `syncLeadToGHL(lead)`: Sync a lead to GoHighLevel
- `syncInteractionToGHL(interaction, contactId)`: Sync an interaction
- `findContactByEmail(email)`: Find existing contact by email
- `findContactByPhone(phone)`: Find existing contact by phone
- `batchSyncLeads(leads)`: Batch sync multiple leads
- `batchSyncInteractions(interactions)`: Batch sync multiple interactions

## Requirements Satisfied

This implementation satisfies the following requirements from the specification:

- **9.1**: Real-time interaction logging with 5-second SLA
- **9.2**: Lead status updates and pipeline management
- **12.3**: Retry logic with exponential backoff for external integrations

## Dependencies

- `axios`: HTTP client for API requests
- `rate-limiter-flexible`: Rate limiting functionality
- `winston`: Logging (via shared logger utility)

## License

This integration is part of the Agentic Lead Management system and follows the same license terms.
