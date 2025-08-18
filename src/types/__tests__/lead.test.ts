import { describe, it, expect, beforeEach } from 'vitest';
import {
  Lead,
  LeadModel,
  LeadValidation,
  CreateLead,
  UpdateLead,
  ContactInfo,
  QualificationData,
  LeadSource,
  LeadStatus,
  LeadType,
} from '../lead';
import { ValidationError } from '../validation';

describe('LeadValidation', () => {
  const validContactInfo: ContactInfo = {
    name: 'John Doe',
    email: 'john@example.com',
    phone: '+1234567890',
    preferredChannel: 'email',
    timezone: 'UTC',
  };

  const validQualificationData: QualificationData = {
    budget: { min: 100000, max: 500000 },
    location: 'New York',
    propertyType: 'apartment',
    timeline: '3 months',
    qualificationScore: 0.8,
  };

  const validLead: Lead = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    source: 'website' as LeadSource,
    contactInfo: validContactInfo,
    leadType: 'hot' as LeadType,
    urgencyLevel: 8,
    intentSignals: ['budget_mentioned', 'timeline_urgent'],
    qualificationData: validQualificationData,
    status: 'new' as LeadStatus,
    assignedAgent: 'agent-123',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('validateLead', () => {
    it('should validate correct lead data', () => {
      const result = LeadValidation.validateLead(validLead);
      expect(result.success).toBe(true);
    });

    it('should reject lead with invalid ID', () => {
      const invalidLead = { ...validLead, id: 'invalid-id' };
      const result = LeadValidation.validateLead(invalidLead);
      expect(result.success).toBe(false);
    });

    it('should reject lead with invalid urgency level', () => {
      const invalidLead = { ...validLead, urgencyLevel: 15 };
      const result = LeadValidation.validateLead(invalidLead);
      expect(result.success).toBe(false);
    });

    it('should reject lead with empty name', () => {
      const invalidLead = {
        ...validLead,
        contactInfo: { ...validContactInfo, name: '' },
      };
      const result = LeadValidation.validateLead(invalidLead);
      expect(result.success).toBe(false);
    });
  });

  describe('validateContactInfo', () => {
    it('should validate correct contact info', () => {
      const result = LeadValidation.validateContactInfo(validContactInfo);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const invalidContact = { ...validContactInfo, email: 'invalid-email' };
      const result = LeadValidation.validateContactInfo(invalidContact);
      expect(result.success).toBe(false);
    });

    it('should reject invalid phone', () => {
      const invalidContact = { ...validContactInfo, phone: '123' };
      const result = LeadValidation.validateContactInfo(invalidContact);
      expect(result.success).toBe(false);
    });

    it('should reject invalid timezone', () => {
      const invalidContact = { ...validContactInfo, timezone: 'Invalid/Zone' };
      const result = LeadValidation.validateContactInfo(invalidContact);
      expect(result.success).toBe(false);
    });
  });

  describe('hasMinimumContactInfo', () => {
    it('should return true when email is provided', () => {
      const contact = { ...validContactInfo, phone: undefined };
      expect(LeadValidation.hasMinimumContactInfo(contact)).toBe(true);
    });

    it('should return true when phone is provided', () => {
      const contact = { ...validContactInfo, email: undefined };
      expect(LeadValidation.hasMinimumContactInfo(contact)).toBe(true);
    });

    it('should return false when neither email nor phone is provided', () => {
      const contact = {
        ...validContactInfo,
        email: undefined,
        phone: undefined,
      };
      expect(LeadValidation.hasMinimumContactInfo(contact)).toBe(false);
    });
  });

  describe('isQualified', () => {
    it('should return true for qualified lead', () => {
      expect(LeadValidation.isQualified(validLead)).toBe(true);
    });

    it('should return false for unqualified lead', () => {
      const unqualifiedLead = {
        ...validLead,
        qualificationData: {
          ...validQualificationData,
          qualificationScore: 0.3,
        },
      };
      expect(LeadValidation.isQualified(unqualifiedLead)).toBe(false);
    });
  });

  describe('isHotLead', () => {
    it('should return true for high urgency lead', () => {
      expect(LeadValidation.isHotLead(validLead)).toBe(true);
    });

    it('should return true for hot lead type', () => {
      const hotLead = {
        ...validLead,
        urgencyLevel: 5,
        leadType: 'hot' as LeadType,
      };
      expect(LeadValidation.isHotLead(hotLead)).toBe(true);
    });

    it('should return false for low urgency cold lead', () => {
      const coldLead = {
        ...validLead,
        urgencyLevel: 3,
        leadType: 'cold' as LeadType,
      };
      expect(LeadValidation.isHotLead(coldLead)).toBe(false);
    });
  });

  describe('isValidStatusTransition', () => {
    it('should allow valid transitions', () => {
      expect(LeadValidation.isValidStatusTransition('new', 'contacted')).toBe(
        true
      );
      expect(
        LeadValidation.isValidStatusTransition('contacted', 'qualified')
      ).toBe(true);
      expect(
        LeadValidation.isValidStatusTransition(
          'qualified',
          'appointment_scheduled'
        )
      ).toBe(true);
    });

    it('should reject invalid transitions', () => {
      expect(LeadValidation.isValidStatusTransition('new', 'converted')).toBe(
        false
      );
      expect(LeadValidation.isValidStatusTransition('converted', 'new')).toBe(
        false
      );
    });
  });
});

describe('LeadModel', () => {
  let validCreateLead: CreateLead;

  beforeEach(() => {
    validCreateLead = {
      source: 'website' as LeadSource,
      contactInfo: {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+1234567890',
        preferredChannel: 'email',
        timezone: 'UTC',
      },
      leadType: 'hot' as LeadType,
      urgencyLevel: 8,
      intentSignals: ['budget_mentioned'],
      qualificationData: {
        budget: { min: 100000, max: 500000 },
        location: 'New York',
        propertyType: 'apartment',
        timeline: '3 months',
        qualificationScore: 0.8,
      },
      status: 'new' as LeadStatus,
      assignedAgent: 'agent-123',
    };
  });

  describe('create', () => {
    it('should create a new lead with generated ID and timestamps', () => {
      const lead = LeadModel.create(validCreateLead);

      expect(lead.id).toBeDefined();
      expect(lead.data.createdAt).toBeInstanceOf(Date);
      expect(lead.data.updatedAt).toBeInstanceOf(Date);
      expect(lead.data.contactInfo.name).toBe('John Doe');
    });

    it('should throw ValidationError for invalid data', () => {
      const invalidData = { ...validCreateLead, urgencyLevel: 15 };
      expect(() => LeadModel.create(invalidData)).toThrow(ValidationError);
    });
  });

  describe('fromData', () => {
    it('should create lead from valid data', () => {
      const leadData = {
        ...validCreateLead,
        id: '123e4567-e89b-12d3-a456-426614174000',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const lead = LeadModel.fromData(leadData);
      expect(lead.id).toBe(leadData.id);
    });

    it('should throw ValidationError for invalid data', () => {
      const invalidData = { invalid: 'data' };
      expect(() => LeadModel.fromData(invalidData)).toThrow(ValidationError);
    });
  });

  describe('update', () => {
    let lead: LeadModel;

    beforeEach(() => {
      lead = LeadModel.create(validCreateLead);
    });

    it('should update lead with valid data', () => {
      const updates: UpdateLead = {
        urgencyLevel: 9,
        status: 'contacted',
      };

      lead.update(updates);
      expect(lead.data.urgencyLevel).toBe(9);
      expect(lead.data.status).toBe('contacted');
    });

    it('should throw error for invalid status transition', () => {
      expect(() => {
        lead.update({ status: 'converted' });
      }).toThrow('Invalid status transition');
    });

    it('should throw ValidationError for invalid update data', () => {
      expect(() => {
        lead.update({ urgencyLevel: 15 });
      }).toThrow(ValidationError);
    });
  });

  describe('updateQualificationScore', () => {
    let lead: LeadModel;

    beforeEach(() => {
      lead = LeadModel.create(validCreateLead);
    });

    it('should update qualification score', () => {
      lead.updateQualificationScore(0.9);
      expect(lead.data.qualificationData.qualificationScore).toBe(0.9);
    });

    it('should throw error for invalid score', () => {
      expect(() => lead.updateQualificationScore(1.5)).toThrow();
      expect(() => lead.updateQualificationScore(-0.1)).toThrow();
    });
  });

  describe('addIntentSignal', () => {
    let lead: LeadModel;

    beforeEach(() => {
      lead = LeadModel.create(validCreateLead);
    });

    it('should add new intent signal', () => {
      lead.addIntentSignal('timeline_urgent');
      expect(lead.data.intentSignals).toContain('timeline_urgent');
    });

    it('should not add duplicate intent signal', () => {
      lead.addIntentSignal('budget_mentioned');
      const count = lead.data.intentSignals.filter(
        (s) => s === 'budget_mentioned'
      ).length;
      expect(count).toBe(1);
    });

    it('should throw error for empty signal', () => {
      expect(() => lead.addIntentSignal('')).toThrow();
    });
  });

  describe('removeIntentSignal', () => {
    let lead: LeadModel;

    beforeEach(() => {
      lead = LeadModel.create(validCreateLead);
    });

    it('should remove existing intent signal', () => {
      lead.removeIntentSignal('budget_mentioned');
      expect(lead.data.intentSignals).not.toContain('budget_mentioned');
    });

    it('should handle removing non-existent signal', () => {
      lead.removeIntentSignal('non_existent');
      // Should not throw error
    });
  });

  describe('business logic methods', () => {
    let lead: LeadModel;

    beforeEach(() => {
      lead = LeadModel.create(validCreateLead);
    });

    it('should check if lead has minimum contact info', () => {
      expect(lead.hasMinimumContactInfo()).toBe(true);
    });

    it('should check if lead is qualified', () => {
      expect(lead.isQualified()).toBe(true);
    });

    it('should check if lead is hot', () => {
      expect(lead.isHot()).toBe(true);
    });

    it('should calculate age in days', () => {
      const age = lead.getAgeInDays();
      expect(age).toBeGreaterThanOrEqual(0);
    });

    it('should check if lead should be dormant', () => {
      // For a new lead, should not be dormant
      expect(lead.shouldBeDormant()).toBe(false);
    });

    it('should get preferred contact method', () => {
      expect(lead.getPreferredContactMethod()).toBe('email');
    });
  });

  describe('toString and toJSON', () => {
    let lead: LeadModel;

    beforeEach(() => {
      lead = LeadModel.create(validCreateLead);
    });

    it('should convert to string', () => {
      const str = lead.toString();
      expect(str).toContain('Lead(');
      expect(str).toContain('John Doe');
      expect(str).toContain('new');
    });

    it('should convert to JSON', () => {
      const json = lead.toJSON();
      expect(json).toEqual(lead.data);
    });
  });
});
