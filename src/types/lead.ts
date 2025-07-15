import { z } from "zod";
import {
  ValidationResult,
  validateData,
  validateOrThrow,
  generateUUID,
  isValidEmail,
  isValidPhone,
  isValidTimezone,
  sanitizeString,
} from "./validation";

// Lead source enum
export const LeadSourceSchema = z.enum([
  "gmail",
  "meta_ads",
  "website",
  "slack",
  "third_party",
  "referral",
  "other",
]);

export type LeadSource = z.infer<typeof LeadSourceSchema>;

// Contact information schema with enhanced validation
export const ContactInfoSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be less than 100 characters")
    .transform(sanitizeString),
  email: z
    .string()
    .email("Invalid email format")
    .optional()
    .refine((email) => !email || isValidEmail(email), {
      message: "Invalid email format",
    }),
  phone: z
    .string()
    .optional()
    .refine((phone) => !phone || isValidPhone(phone), {
      message: "Invalid phone number format",
    }),
  preferredChannel: z
    .enum(["email", "sms", "voice", "whatsapp"])
    .default("email"),
  timezone: z.string().default("UTC").refine(isValidTimezone, {
    message: "Invalid timezone",
  }),
});

export type ContactInfo = z.infer<typeof ContactInfoSchema>;

// Budget range schema
export const BudgetRangeSchema = z
  .object({
    min: z.number().min(0).optional(),
    max: z.number().min(0).optional(),
  })
  .refine((data) => !data.min || !data.max || data.min <= data.max, {
    message: "Minimum budget must be less than or equal to maximum budget",
  });

export type BudgetRange = z.infer<typeof BudgetRangeSchema>;

// Qualification data schema
export const QualificationDataSchema = z.object({
  budget: BudgetRangeSchema.optional(),
  location: z.string().optional(),
  propertyType: z.string().optional(),
  timeline: z.string().optional(),
  qualificationScore: z.number().min(0).max(1).default(0),
});

export type QualificationData = z.infer<typeof QualificationDataSchema>;

// Lead status enum
export const LeadStatusSchema = z.enum([
  "new",
  "contacted",
  "qualified",
  "appointment_scheduled",
  "in_progress",
  "converted",
  "lost",
  "dormant",
]);

export type LeadStatus = z.infer<typeof LeadStatusSchema>;

// Lead type enum
export const LeadTypeSchema = z.enum(["hot", "warm", "cold"]);

export type LeadType = z.infer<typeof LeadTypeSchema>;

// Main Lead schema
export const LeadSchema = z.object({
  id: z.string().uuid(),
  source: LeadSourceSchema,
  contactInfo: ContactInfoSchema,
  leadType: LeadTypeSchema,
  urgencyLevel: z.number().min(1).max(10).default(1),
  intentSignals: z.array(z.string()).default([]),
  qualificationData: QualificationDataSchema,
  status: LeadStatusSchema.default("new"),
  assignedAgent: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Lead = z.infer<typeof LeadSchema>;

// Create Lead input schema (for new leads)
export const CreateLeadSchema = LeadSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateLead = z.infer<typeof CreateLeadSchema>;

// Update Lead input schema
export const UpdateLeadSchema = CreateLeadSchema.partial();

export type UpdateLead = z.infer<typeof UpdateLeadSchema>;
/**
 * Lead validation functions
 */
export const LeadValidation = {
  /**
   * Validate a complete lead object
   */
  validateLead(data: unknown): ValidationResult<Lead> {
    return validateData(LeadSchema, data, "Lead validation");
  },

  /**
   * Validate lead creation data
   */
  validateCreateLead(data: unknown): ValidationResult<CreateLead> {
    return validateData(CreateLeadSchema, data, "Create lead validation");
  },

  /**
   * Validate lead update data
   */
  validateUpdateLead(data: unknown): ValidationResult<UpdateLead> {
    return validateData(UpdateLeadSchema, data, "Update lead validation");
  },

  /**
   * Validate contact information
   */
  validateContactInfo(data: unknown): ValidationResult<ContactInfo> {
    return validateData(ContactInfoSchema, data, "Contact info validation");
  },

  /**
   * Validate qualification data
   */
  validateQualificationData(
    data: unknown
  ): ValidationResult<QualificationData> {
    return validateData(
      QualificationDataSchema,
      data,
      "Qualification data validation"
    );
  },

  /**
   * Check if lead has minimum required contact information
   */
  hasMinimumContactInfo(contactInfo: ContactInfo): boolean {
    return !!(contactInfo.email || contactInfo.phone);
  },

  /**
   * Check if lead is qualified (has qualification score > 0.5)
   */
  isQualified(lead: Lead): boolean {
    return lead.qualificationData.qualificationScore > 0.5;
  },

  /**
   * Check if lead is hot (urgency level >= 8)
   */
  isHotLead(lead: Lead): boolean {
    return lead.urgencyLevel >= 8 || lead.leadType === "hot";
  },

  /**
   * Validate lead status transition
   */
  isValidStatusTransition(
    currentStatus: LeadStatus,
    newStatus: LeadStatus
  ): boolean {
    const validTransitions: Record<LeadStatus, LeadStatus[]> = {
      new: ["contacted", "lost"],
      contacted: ["qualified", "lost", "dormant"],
      qualified: ["appointment_scheduled", "lost", "dormant"],
      appointment_scheduled: ["in_progress", "lost", "dormant"],
      in_progress: ["converted", "lost", "dormant"],
      converted: ["dormant"], // Can become dormant for re-engagement
      lost: ["contacted"], // Can be re-contacted
      dormant: ["contacted"], // Can be re-activated
    };

    return validTransitions[currentStatus]?.includes(newStatus) ?? false;
  },
};

/**
 * Lead class with business logic methods
 */
export class LeadModel {
  private _data: Lead;

  constructor(data: Lead) {
    const validation = LeadValidation.validateLead(data);
    if (!validation.success) {
      throw validation.error;
    }
    this._data = validation.data;
  }

  /**
   * Create a new lead from input data
   */
  static create(input: CreateLead): LeadModel {
    const leadData: Lead = {
      ...input,
      id: generateUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return new LeadModel(leadData);
  }

  /**
   * Create lead from unknown data with validation
   */
  static fromData(data: unknown): LeadModel {
    const validation = LeadValidation.validateLead(data);
    if (!validation.success) {
      throw validation.error;
    }
    return new LeadModel(validation.data);
  }

  /**
   * Get lead data
   */
  get data(): Lead {
    return { ...this._data };
  }

  /**
   * Get lead ID
   */
  get id(): string {
    return this._data.id;
  }

  /**
   * Get contact information
   */
  get contactInfo(): ContactInfo {
    return { ...this._data.contactInfo };
  }

  /**
   * Get qualification data
   */
  get qualificationData(): QualificationData {
    return { ...this._data.qualificationData };
  }

  /**
   * Update lead with validation
   */
  update(updates: UpdateLead): void {
    const validation = LeadValidation.validateUpdateLead(updates);
    if (!validation.success) {
      throw validation.error;
    }

    // Validate status transition if status is being updated
    if (
      updates.status &&
      !LeadValidation.isValidStatusTransition(this._data.status, updates.status)
    ) {
      throw new Error(
        `Invalid status transition from ${this._data.status} to ${updates.status}`
      );
    }

    this._data = {
      ...this._data,
      ...updates,
      updatedAt: new Date(),
    };
  }

  /**
   * Update qualification score
   */
  updateQualificationScore(score: number): void {
    if (score < 0 || score > 1) {
      throw new Error("Qualification score must be between 0 and 1");
    }

    this._data.qualificationData.qualificationScore = score;
    this._data.updatedAt = new Date();
  }

  /**
   * Add intent signal
   */
  addIntentSignal(signal: string): void {
    if (!signal.trim()) {
      throw new Error("Intent signal cannot be empty");
    }

    if (!this._data.intentSignals.includes(signal)) {
      this._data.intentSignals.push(signal);
      this._data.updatedAt = new Date();
    }
  }

  /**
   * Remove intent signal
   */
  removeIntentSignal(signal: string): void {
    const index = this._data.intentSignals.indexOf(signal);
    if (index > -1) {
      this._data.intentSignals.splice(index, 1);
      this._data.updatedAt = new Date();
    }
  }

  /**
   * Assign agent to lead
   */
  assignAgent(agentId: string): void {
    if (!agentId.trim()) {
      throw new Error("Agent ID cannot be empty");
    }

    this._data.assignedAgent = agentId;
    this._data.updatedAt = new Date();
  }

  /**
   * Check if lead has minimum contact information
   */
  hasMinimumContactInfo(): boolean {
    return LeadValidation.hasMinimumContactInfo(this._data.contactInfo);
  }

  /**
   * Check if lead is qualified
   */
  isQualified(): boolean {
    return LeadValidation.isQualified(this._data);
  }

  /**
   * Check if lead is hot
   */
  isHot(): boolean {
    return LeadValidation.isHotLead(this._data);
  }

  /**
   * Get lead age in days
   */
  getAgeInDays(): number {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - this._data.createdAt.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Get days since last update
   */
  getDaysSinceUpdate(): number {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - this._data.updatedAt.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Check if lead should be marked as dormant (no updates for 60+ days)
   */
  shouldBeDormant(): boolean {
    return this.getDaysSinceUpdate() >= 60 && this._data.status !== "dormant";
  }

  /**
   * Get preferred contact method
   */
  getPreferredContactMethod(): string {
    return this._data.contactInfo.preferredChannel;
  }

  /**
   * Convert to JSON
   */
  toJSON(): Lead {
    return this.data;
  }

  /**
   * Convert to string representation
   */
  toString(): string {
    return `Lead(${this._data.id}, ${this._data.contactInfo.name}, ${this._data.status})`;
  }
}
