import { z } from 'zod';
import { LeadSource, ContactInfo, QualificationData } from '../types/lead';

// Raw lead data from different sources
export const RawLeadDataSchema = z.object({
  source: z.string(),
  sourceId: z.string().optional(), // External ID from source system
  rawData: z.record(z.any()), // Original data from source
  timestamp: z.date(),
});

export type RawLeadData = z.infer<typeof RawLeadDataSchema>;

// Normalized lead data after processing
export const NormalizedLeadDataSchema = z.object({
  source: z.enum([
    'gmail',
    'meta_ads',
    'website',
    'slack',
    'third_party',
    'referral',
    'other',
  ]),
  contactInfo: z.object({
    name: z.string(),
    email: z.string().optional(),
    phone: z.string().optional(),
    preferredChannel: z
      .enum(['email', 'sms', 'voice', 'whatsapp'])
      .default('email'),
    timezone: z.string().default('UTC'),
  }),
  leadType: z.enum(['hot', 'warm', 'cold']).default('cold'),
  urgencyLevel: z.number().min(1).max(10).default(1),
  intentSignals: z.array(z.string()).default([]),
  qualificationData: z.object({
    budget: z
      .object({
        min: z.number().optional(),
        max: z.number().optional(),
      })
      .optional(),
    location: z.string().optional(),
    propertyType: z.string().optional(),
    timeline: z.string().optional(),
    qualificationScore: z.number().min(0).max(1).default(0),
  }),
  sourceMetadata: z.record(z.any()).optional(), // Additional source-specific data
});

export type NormalizedLeadData = z.infer<typeof NormalizedLeadDataSchema>;

// Lead deduplication result
export const DeduplicationResultSchema = z.object({
  isDuplicate: z.boolean(),
  existingLeadId: z.string().uuid().optional(),
  confidence: z.number().min(0).max(1), // Confidence score for duplicate detection
  matchingFields: z.array(z.string()).default([]),
});

export type DeduplicationResult = z.infer<typeof DeduplicationResultSchema>;

// Lead ingestion result
export const IngestionResultSchema = z.object({
  success: z.boolean(),
  leadId: z.string().uuid().optional(),
  isDuplicate: z.boolean(),
  existingLeadId: z.string().uuid().optional(),
  errors: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
});

export type IngestionResult = z.infer<typeof IngestionResultSchema>;

// Webhook payload for website forms and 3rd party integrations
export const WebhookPayloadSchema = z.object({
  source: z.string(),
  timestamp: z.string().or(z.date()),
  data: z.record(z.any()),
  signature: z.string().optional(), // For webhook verification
});

export type WebhookPayload = z.infer<typeof WebhookPayloadSchema>;
