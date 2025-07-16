import { Lead, LeadModel } from "../types/lead";
import {
  Interaction,
  InteractionModel,
  CreateInteraction,
} from "../types/interaction";
import {
  AgentPerformance,
  AgentPerformanceModel,
} from "../types/agent-performance";
import { generateUUID } from "../types/validation";

// Campaign types and interfaces
export interface Campaign {
  id: string;
  name: string;
  type:
    | "callback_sequence"
    | "appointment_booking"
    | "follow_up"
    | "re_engagement";
  status: "active" | "paused" | "completed" | "cancelled";
  targetAudience: CampaignAudience;
  steps: CampaignStep[];
  performance: CampaignPerformance;
  createdAt: Date;
  updatedAt: Date;
}

export interface CampaignAudience {
  leadTypes: ("hot" | "warm" | "cold")[];
  sources: string[];
  qualificationScoreMin?: number;
  qualificationScoreMax?: number;
  tags?: string[];
}

export interface CampaignStep {
  id: string;
  order: number;
  type: "callback" | "appointment" | "message" | "email" | "wait";
  delayHours: number;
  content?: string;
  conditions?: CampaignCondition[];
}

export interface CampaignCondition {
  field: string;
  operator: "equals" | "not_equals" | "greater_than" | "less_than" | "contains";
  value: any;
}

export interface CampaignPerformance {
  totalLeads: number;
  completedSteps: number;
  appointmentsBooked: number;
  callbacksScheduled: number;
  conversionRate: number;
  averageCompletionTime: number;
}

// Appointment types
export interface Appointment {
  id: string;
  leadId: string;
  campaignId?: string;
  type: "consultation" | "site_visit" | "callback" | "follow_up";
  status:
    | "scheduled"
    | "confirmed"
    | "rescheduled"
    | "cancelled"
    | "completed"
    | "no_show";
  scheduledAt: Date;
  duration: number; // in minutes
  location?: string;
  notes?: string;
  confirmationSent: boolean;
  remindersSent: number;
  createdAt: Date;
  updatedAt: Date;
}

// Callback and reminder types
export interface Callback {
  id: string;
  leadId: string;
  campaignId?: string;
  scheduledAt: Date;
  status: "pending" | "completed" | "failed" | "cancelled";
  attempts: number;
  maxAttempts: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReminderSequence {
  id: string;
  appointmentId: string;
  reminders: Reminder[];
  status: "active" | "completed" | "cancelled";
  createdAt: Date;
}

export interface Reminder {
  id: string;
  type: "email" | "sms" | "call";
  scheduledAt: Date;
  status: "pending" | "sent" | "failed";
  content: string;
  sentAt?: Date;
}

/**
 * AI Appointment & Workflow Coordinator Agent
 *
 * Handles multi-step campaign orchestration, callback scheduling,
 * appointment booking, and campaign performance tracking.
 */
export class AIAppointmentWorkflowCoordinator {
  private agentId: string;
  private campaigns: Map<string, Campaign> = new Map();
  private appointments: Map<string, Appointment> = new Map();
  private callbacks: Map<string, Callback> = new Map();
  private reminderSequences: Map<string, ReminderSequence> = new Map();

  constructor(agentId: string = "ai-appointment-workflow-coordinator") {
    this.agentId = agentId;
  }

  /**
   * Create a new multi-step campaign
   */
  async createCampaign(
    name: string,
    type: Campaign["type"],
    targetAudience: CampaignAudience,
    steps: Omit<CampaignStep, "id">[]
  ): Promise<Campaign> {
    const campaign: Campaign = {
      id: generateUUID(),
      name,
      type,
      status: "active",
      targetAudience,
      steps: steps.map((step, index) => ({
        ...step,
        id: generateUUID(),
        order: index + 1,
      })),
      performance: {
        totalLeads: 0,
        completedSteps: 0,
        appointmentsBooked: 0,
        callbacksScheduled: 0,
        conversionRate: 0,
        averageCompletionTime: 0,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.campaigns.set(campaign.id, campaign);
    return campaign;
  }

  /**
   * Schedule a callback for a lead
   */
  async scheduleCallback(
    leadId: string,
    scheduledAt: Date,
    campaignId?: string,
    maxAttempts: number = 3
  ): Promise<Callback> {
    const callback: Callback = {
      id: generateUUID(),
      leadId,
      campaignId,
      scheduledAt,
      status: "pending",
      attempts: 0,
      maxAttempts,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.callbacks.set(callback.id, callback);

    // Update campaign performance if part of a campaign
    if (campaignId && this.campaigns.has(campaignId)) {
      const campaign = this.campaigns.get(campaignId)!;
      campaign.performance.callbacksScheduled++;
      campaign.updatedAt = new Date();
    }

    return callback;
  }

  /**
   * Book an appointment for a lead
   */
  async bookAppointment(
    leadId: string,
    type: Appointment["type"],
    scheduledAt: Date,
    duration: number = 60,
    location?: string,
    campaignId?: string
  ): Promise<Appointment> {
    const appointment: Appointment = {
      id: generateUUID(),
      leadId,
      campaignId,
      type,
      status: "scheduled",
      scheduledAt,
      duration,
      location,
      confirmationSent: false,
      remindersSent: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.appointments.set(appointment.id, appointment);

    // Create reminder sequence
    await this.createReminderSequence(appointment.id);

    // Update campaign performance if part of a campaign
    if (campaignId && this.campaigns.has(campaignId)) {
      const campaign = this.campaigns.get(campaignId)!;
      campaign.performance.appointmentsBooked++;
      campaign.updatedAt = new Date();
    }

    return appointment;
  }

  /**
   * Create reminder sequence for an appointment
   */
  private async createReminderSequence(
    appointmentId: string
  ): Promise<ReminderSequence> {
    const appointment = this.appointments.get(appointmentId);
    if (!appointment) {
      throw new Error(`Appointment not found: ${appointmentId}`);
    }

    const reminderSequence: ReminderSequence = {
      id: generateUUID(),
      appointmentId,
      status: "active",
      reminders: [
        // 24 hours before
        {
          id: generateUUID(),
          type: "email",
          scheduledAt: new Date(
            appointment.scheduledAt.getTime() - 24 * 60 * 60 * 1000
          ),
          status: "pending",
          content: `Reminder: You have an appointment scheduled for ${appointment.scheduledAt.toLocaleString()}`,
        },
        // 2 hours before
        {
          id: generateUUID(),
          type: "sms",
          scheduledAt: new Date(
            appointment.scheduledAt.getTime() - 2 * 60 * 60 * 1000
          ),
          status: "pending",
          content: `Reminder: Your appointment is in 2 hours at ${appointment.scheduledAt.toLocaleString()}`,
        },
      ],
      createdAt: new Date(),
    };

    this.reminderSequences.set(reminderSequence.id, reminderSequence);
    return reminderSequence;
  }

  /**
   * Reschedule an appointment
   */
  async rescheduleAppointment(
    appointmentId: string,
    newScheduledAt: Date,
    reason?: string
  ): Promise<Appointment> {
    const appointment = this.appointments.get(appointmentId);
    if (!appointment) {
      throw new Error(`Appointment not found: ${appointmentId}`);
    }

    appointment.scheduledAt = newScheduledAt;
    appointment.status = "rescheduled";
    appointment.notes = reason ? `Rescheduled: ${reason}` : "Rescheduled";
    appointment.updatedAt = new Date();

    // Update reminder sequence
    const reminderSequence = Array.from(this.reminderSequences.values()).find(
      (rs) => rs.appointmentId === appointmentId
    );

    if (reminderSequence) {
      // Cancel existing reminders
      reminderSequence.status = "cancelled";

      // Create new reminder sequence
      await this.createReminderSequence(appointmentId);
    }

    return appointment;
  }

  /**
   * Confirm an appointment
   */
  async confirmAppointment(appointmentId: string): Promise<Appointment> {
    const appointment = this.appointments.get(appointmentId);
    if (!appointment) {
      throw new Error(`Appointment not found: ${appointmentId}`);
    }

    appointment.status = "confirmed";
    appointment.confirmationSent = true;
    appointment.updatedAt = new Date();

    return appointment;
  }

  /**
   * Cancel an appointment
   */
  async cancelAppointment(
    appointmentId: string,
    reason?: string
  ): Promise<Appointment> {
    const appointment = this.appointments.get(appointmentId);
    if (!appointment) {
      throw new Error(`Appointment not found: ${appointmentId}`);
    }

    appointment.status = "cancelled";
    appointment.notes = reason ? `Cancelled: ${reason}` : "Cancelled";
    appointment.updatedAt = new Date();

    // Cancel reminder sequence
    const reminderSequence = Array.from(this.reminderSequences.values()).find(
      (rs) => rs.appointmentId === appointmentId
    );

    if (reminderSequence) {
      reminderSequence.status = "cancelled";
    }

    return appointment;
  }

  /**
   * Execute a campaign step for a lead
   */
  async executeCampaignStep(
    campaignId: string,
    leadId: string,
    stepId: string
  ): Promise<boolean> {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) {
      throw new Error(`Campaign not found: ${campaignId}`);
    }

    const step = campaign.steps.find((s) => s.id === stepId);
    if (!step) {
      throw new Error(`Campaign step not found: ${stepId}`);
    }

    try {
      switch (step.type) {
        case "callback":
          const callbackTime = new Date(
            Date.now() + step.delayHours * 60 * 60 * 1000
          );
          await this.scheduleCallback(leadId, callbackTime, campaignId);
          break;

        case "appointment":
          // For appointment steps, we schedule a consultation
          const appointmentTime = new Date(
            Date.now() + step.delayHours * 60 * 60 * 1000
          );
          await this.bookAppointment(
            leadId,
            "consultation",
            appointmentTime,
            60,
            undefined,
            campaignId
          );
          break;

        case "message":
        case "email":
          // These would integrate with communication systems
          // For now, we'll log the action
          console.log(
            `Sending ${step.type} to lead ${leadId}: ${step.content}`
          );
          break;

        case "wait":
          // Wait steps are handled by the scheduler
          console.log(
            `Wait step executed for lead ${leadId}, waiting ${step.delayHours} hours`
          );
          break;
      }

      // Update campaign performance
      campaign.performance.completedSteps++;
      campaign.updatedAt = new Date();

      return true;
    } catch (error) {
      console.error(
        `Failed to execute campaign step ${stepId} for lead ${leadId}:`,
        error
      );
      return false;
    }
  }

  /**
   * Process pending callbacks
   */
  async processPendingCallbacks(): Promise<void> {
    const now = new Date();
    const pendingCallbacks = Array.from(this.callbacks.values()).filter(
      (callback) =>
        callback.status === "pending" &&
        callback.scheduledAt <= now &&
        callback.attempts < callback.maxAttempts
    );

    for (const callback of pendingCallbacks) {
      try {
        // Attempt the callback
        callback.attempts++;

        // In a real implementation, this would make an actual call
        const success = await this.attemptCallback(callback);

        if (success) {
          callback.status = "completed";
        } else if (callback.attempts >= callback.maxAttempts) {
          callback.status = "failed";
        }

        callback.updatedAt = new Date();
      } catch (error) {
        console.error(`Failed to process callback ${callback.id}:`, error);
        callback.status = "failed";
        callback.updatedAt = new Date();
      }
    }
  }

  /**
   * Attempt a callback (placeholder for actual implementation)
   */
  private async attemptCallback(callback: Callback): Promise<boolean> {
    // This would integrate with actual calling systems
    // For now, simulate success/failure
    console.log(`Attempting callback for lead ${callback.leadId}`);
    return Math.random() > 0.3; // 70% success rate simulation
  }

  /**
   * Process pending reminders
   */
  async processPendingReminders(): Promise<void> {
    const now = new Date();

    for (const reminderSequence of this.reminderSequences.values()) {
      if (reminderSequence.status !== "active") continue;

      const pendingReminders = reminderSequence.reminders.filter(
        (reminder) =>
          reminder.status === "pending" && reminder.scheduledAt <= now
      );

      for (const reminder of pendingReminders) {
        try {
          // Send the reminder
          await this.sendReminder(reminder);
          reminder.status = "sent";
          reminder.sentAt = new Date();

          // Update appointment reminder count
          const appointment = this.appointments.get(
            reminderSequence.appointmentId
          );
          if (appointment) {
            appointment.remindersSent++;
          }
        } catch (error) {
          console.error(`Failed to send reminder ${reminder.id}:`, error);
          reminder.status = "failed";
        }
      }

      // Check if all reminders are processed
      const allProcessed = reminderSequence.reminders.every(
        (reminder) => reminder.status !== "pending"
      );

      if (allProcessed) {
        reminderSequence.status = "completed";
      }
    }
  }

  /**
   * Send a reminder (placeholder for actual implementation)
   */
  private async sendReminder(reminder: Reminder): Promise<void> {
    // This would integrate with actual communication systems
    console.log(`Sending ${reminder.type} reminder: ${reminder.content}`);
  }

  /**
   * Get campaign performance metrics
   */
  getCampaignPerformance(campaignId: string): CampaignPerformance | null {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) return null;

    // Calculate conversion rate
    if (campaign.performance.totalLeads > 0) {
      campaign.performance.conversionRate =
        campaign.performance.appointmentsBooked /
        campaign.performance.totalLeads;
    }

    return campaign.performance;
  }

  /**
   * Get all active campaigns
   */
  getActiveCampaigns(): Campaign[] {
    return Array.from(this.campaigns.values()).filter(
      (campaign) => campaign.status === "active"
    );
  }

  /**
   * Get appointments for a lead
   */
  getLeadAppointments(leadId: string): Appointment[] {
    return Array.from(this.appointments.values()).filter(
      (appointment) => appointment.leadId === leadId
    );
  }

  /**
   * Get upcoming appointments
   */
  getUpcomingAppointments(hours: number = 24): Appointment[] {
    const cutoff = new Date(Date.now() + hours * 60 * 60 * 1000);
    return Array.from(this.appointments.values())
      .filter(
        (appointment) =>
          appointment.status === "scheduled" ||
          appointment.status === "confirmed"
      )
      .filter((appointment) => appointment.scheduledAt <= cutoff)
      .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  }

  /**
   * Get agent performance data
   */
  getAgentPerformance(period: { start: Date; end: Date }): AgentPerformance {
    const appointments = Array.from(this.appointments.values()).filter(
      (apt) => apt.createdAt >= period.start && apt.createdAt <= period.end
    );

    const callbacks = Array.from(this.callbacks.values()).filter(
      (cb) => cb.createdAt >= period.start && cb.createdAt <= period.end
    );

    const totalInteractions = appointments.length + callbacks.length;
    const successfulAppointments = appointments.filter(
      (apt) => apt.status === "completed" || apt.status === "confirmed"
    ).length;
    const successfulCallbacks = callbacks.filter(
      (cb) => cb.status === "completed"
    ).length;

    const conversionRate =
      totalInteractions > 0
        ? (successfulAppointments + successfulCallbacks) / totalInteractions
        : 0;

    const appointmentBookingRate =
      appointments.length > 0
        ? successfulAppointments / appointments.length
        : 0;

    return AgentPerformanceModel.create({
      agentId: this.agentId,
      period,
      metrics: {
        totalInteractions,
        conversionRate,
        averageResponseTime: 30000, // 30 seconds average
        appointmentBookingRate,
        customerSatisfactionScore: 4.2, // Would be calculated from feedback
      },
      scriptPerformance: [],
      optimizationSuggestions: this.generateOptimizationSuggestions(),
    }).data;
  }

  /**
   * Generate optimization suggestions based on performance
   */
  private generateOptimizationSuggestions(): string[] {
    const suggestions: string[] = [];

    const campaigns = Array.from(this.campaigns.values());
    const totalAppointments = Array.from(this.appointments.values()).length;
    const completedAppointments = Array.from(this.appointments.values()).filter(
      (apt) => apt.status === "completed"
    ).length;

    if (totalAppointments > 0) {
      const completionRate = completedAppointments / totalAppointments;
      if (completionRate < 0.7) {
        suggestions.push(
          "Consider improving appointment confirmation process to reduce no-shows"
        );
      }
    }

    const failedCallbacks = Array.from(this.callbacks.values()).filter(
      (cb) => cb.status === "failed"
    ).length;
    const totalCallbacks = Array.from(this.callbacks.values()).length;

    if (totalCallbacks > 0 && failedCallbacks / totalCallbacks > 0.3) {
      suggestions.push(
        "High callback failure rate - consider adjusting timing or contact methods"
      );
    }

    if (campaigns.length > 0) {
      const avgConversionRate =
        campaigns.reduce((sum, c) => sum + c.performance.conversionRate, 0) /
        campaigns.length;
      if (avgConversionRate < 0.2) {
        suggestions.push(
          "Campaign conversion rates are low - consider A/B testing different messaging"
        );
      }
    }

    return suggestions;
  }
}
