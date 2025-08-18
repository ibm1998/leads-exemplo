import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  AIAppointmentWorkflowCoordinator,
  Campaign,
  Appointment,
  Callback,
  CampaignAudience,
  CampaignStep,
} from '../ai-appointment-workflow-coordinator';

describe('AIAppointmentWorkflowCoordinator', () => {
  let coordinator: AIAppointmentWorkflowCoordinator;
  const mockLeadId = 'lead-123';
  const mockCampaignId = 'campaign-456';

  beforeEach(() => {
    coordinator = new AIAppointmentWorkflowCoordinator();
    vi.clearAllMocks();
  });

  describe('Campaign Management', () => {
    it('should create a new campaign successfully', async () => {
      const targetAudience: CampaignAudience = {
        leadTypes: ['hot', 'warm'],
        sources: ['website', 'meta_ads'],
        qualificationScoreMin: 0.5,
      };

      const steps: Omit<CampaignStep, 'id'>[] = [
        {
          order: 1,
          type: 'callback',
          delayHours: 1,
          content: 'Initial callback',
        },
        {
          order: 2,
          type: 'appointment',
          delayHours: 24,
          content: 'Schedule consultation',
        },
      ];

      const campaign = await coordinator.createCampaign(
        'Hot Lead Follow-up',
        'callback_sequence',
        targetAudience,
        steps
      );

      expect(campaign).toBeDefined();
      expect(campaign.name).toBe('Hot Lead Follow-up');
      expect(campaign.type).toBe('callback_sequence');
      expect(campaign.status).toBe('active');
      expect(campaign.steps).toHaveLength(2);
      expect(campaign.steps[0].order).toBe(1);
      expect(campaign.steps[1].order).toBe(2);
      expect(campaign.performance.totalLeads).toBe(0);
    });

    it('should get active campaigns', async () => {
      const targetAudience: CampaignAudience = {
        leadTypes: ['hot'],
        sources: ['website'],
      };

      await coordinator.createCampaign(
        'Campaign 1',
        'callback_sequence',
        targetAudience,
        []
      );

      await coordinator.createCampaign(
        'Campaign 2',
        'appointment_booking',
        targetAudience,
        []
      );

      const activeCampaigns = coordinator.getActiveCampaigns();
      expect(activeCampaigns).toHaveLength(2);
      expect(activeCampaigns.every((c) => c.status === 'active')).toBe(true);
    });

    it('should get campaign performance metrics', async () => {
      const targetAudience: CampaignAudience = {
        leadTypes: ['warm'],
        sources: ['meta_ads'],
      };

      const campaign = await coordinator.createCampaign(
        'Test Campaign',
        'follow_up',
        targetAudience,
        []
      );

      const performance = coordinator.getCampaignPerformance(campaign.id);
      expect(performance).toBeDefined();
      expect(performance?.totalLeads).toBe(0);
      expect(performance?.conversionRate).toBe(0);
    });
  });

  describe('Callback Management', () => {
    it('should schedule a callback successfully', async () => {
      const scheduledAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

      const callback = await coordinator.scheduleCallback(
        mockLeadId,
        scheduledAt,
        mockCampaignId,
        3
      );

      expect(callback).toBeDefined();
      expect(callback.leadId).toBe(mockLeadId);
      expect(callback.campaignId).toBe(mockCampaignId);
      expect(callback.scheduledAt).toEqual(scheduledAt);
      expect(callback.status).toBe('pending');
      expect(callback.attempts).toBe(0);
      expect(callback.maxAttempts).toBe(3);
    });

    it('should process pending callbacks', async () => {
      // Schedule a callback in the past (should be processed)
      const pastTime = new Date(Date.now() - 60 * 1000); // 1 minute ago
      await coordinator.scheduleCallback(mockLeadId, pastTime);

      // Mock the attemptCallback method to return success
      const attemptCallbackSpy = vi
        .spyOn(coordinator as any, 'attemptCallback')
        .mockResolvedValue(true);

      await coordinator.processPendingCallbacks();

      expect(attemptCallbackSpy).toHaveBeenCalled();
    });

    it('should handle callback failures and retry logic', async () => {
      const pastTime = new Date(Date.now() - 60 * 1000);
      const callback = await coordinator.scheduleCallback(
        mockLeadId,
        pastTime,
        undefined,
        2
      );

      // Mock attemptCallback to fail
      vi.spyOn(coordinator as any, 'attemptCallback').mockResolvedValue(false);

      // Process callbacks twice to exceed max attempts
      await coordinator.processPendingCallbacks();
      await coordinator.processPendingCallbacks();

      // The callback should now be marked as failed
      const callbacks = (coordinator as any).callbacks;
      const updatedCallback = callbacks.get(callback.id);
      expect(updatedCallback.status).toBe('failed');
      expect(updatedCallback.attempts).toBe(2);
    });
  });

  describe('Appointment Management', () => {
    it('should book an appointment successfully', async () => {
      const scheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

      const appointment = await coordinator.bookAppointment(
        mockLeadId,
        'consultation',
        scheduledAt,
        60,
        'Office Location',
        mockCampaignId
      );

      expect(appointment).toBeDefined();
      expect(appointment.leadId).toBe(mockLeadId);
      expect(appointment.campaignId).toBe(mockCampaignId);
      expect(appointment.type).toBe('consultation');
      expect(appointment.status).toBe('scheduled');
      expect(appointment.scheduledAt).toEqual(scheduledAt);
      expect(appointment.duration).toBe(60);
      expect(appointment.location).toBe('Office Location');
      expect(appointment.confirmationSent).toBe(false);
      expect(appointment.remindersSent).toBe(0);
    });

    it('should reschedule an appointment', async () => {
      const originalTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const newTime = new Date(Date.now() + 48 * 60 * 60 * 1000);

      const appointment = await coordinator.bookAppointment(
        mockLeadId,
        'consultation',
        originalTime
      );

      const rescheduled = await coordinator.rescheduleAppointment(
        appointment.id,
        newTime,
        'Client requested change'
      );

      expect(rescheduled.scheduledAt).toEqual(newTime);
      expect(rescheduled.status).toBe('rescheduled');
      expect(rescheduled.notes).toContain('Client requested change');
    });

    it('should confirm an appointment', async () => {
      const scheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const appointment = await coordinator.bookAppointment(
        mockLeadId,
        'consultation',
        scheduledAt
      );

      const confirmed = await coordinator.confirmAppointment(appointment.id);

      expect(confirmed.status).toBe('confirmed');
      expect(confirmed.confirmationSent).toBe(true);
    });

    it('should cancel an appointment', async () => {
      const scheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const appointment = await coordinator.bookAppointment(
        mockLeadId,
        'consultation',
        scheduledAt
      );

      const cancelled = await coordinator.cancelAppointment(
        appointment.id,
        'Client no longer interested'
      );

      expect(cancelled.status).toBe('cancelled');
      expect(cancelled.notes).toContain('Client no longer interested');
    });

    it('should get appointments for a lead', async () => {
      const scheduledAt1 = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const scheduledAt2 = new Date(Date.now() + 48 * 60 * 60 * 1000);

      await coordinator.bookAppointment(
        mockLeadId,
        'consultation',
        scheduledAt1
      );
      await coordinator.bookAppointment(mockLeadId, 'site_visit', scheduledAt2);
      await coordinator.bookAppointment(
        'other-lead',
        'consultation',
        scheduledAt1
      );

      const leadAppointments = coordinator.getLeadAppointments(mockLeadId);

      expect(leadAppointments).toHaveLength(2);
      expect(leadAppointments.every((apt) => apt.leadId === mockLeadId)).toBe(
        true
      );
    });

    it('should get upcoming appointments', async () => {
      const now = new Date();
      const in12Hours = new Date(now.getTime() + 12 * 60 * 60 * 1000);
      const in36Hours = new Date(now.getTime() + 36 * 60 * 60 * 1000);
      const in48Hours = new Date(now.getTime() + 48 * 60 * 60 * 1000);

      await coordinator.bookAppointment(mockLeadId, 'consultation', in12Hours);
      await coordinator.bookAppointment(mockLeadId, 'site_visit', in36Hours);
      await coordinator.bookAppointment(mockLeadId, 'follow_up', in48Hours);

      const upcoming = coordinator.getUpcomingAppointments(24); // Next 24 hours

      expect(upcoming).toHaveLength(1);
      expect(upcoming[0].scheduledAt).toEqual(in12Hours);
    });

    it('should throw error when rescheduling non-existent appointment', async () => {
      const newTime = new Date(Date.now() + 48 * 60 * 60 * 1000);

      await expect(
        coordinator.rescheduleAppointment('non-existent', newTime)
      ).rejects.toThrow('Appointment not found: non-existent');
    });

    it('should throw error when confirming non-existent appointment', async () => {
      await expect(
        coordinator.confirmAppointment('non-existent')
      ).rejects.toThrow('Appointment not found: non-existent');
    });

    it('should throw error when cancelling non-existent appointment', async () => {
      await expect(
        coordinator.cancelAppointment('non-existent')
      ).rejects.toThrow('Appointment not found: non-existent');
    });
  });

  describe('Campaign Execution', () => {
    it('should execute callback campaign step', async () => {
      const targetAudience: CampaignAudience = {
        leadTypes: ['hot'],
        sources: ['website'],
      };

      const steps: Omit<CampaignStep, 'id'>[] = [
        {
          order: 1,
          type: 'callback',
          delayHours: 2,
          content: 'Follow-up call',
        },
      ];

      const campaign = await coordinator.createCampaign(
        'Callback Campaign',
        'callback_sequence',
        targetAudience,
        steps
      );

      const success = await coordinator.executeCampaignStep(
        campaign.id,
        mockLeadId,
        campaign.steps[0].id
      );

      expect(success).toBe(true);

      // Check that campaign performance was updated
      const performance = coordinator.getCampaignPerformance(campaign.id);
      expect(performance?.completedSteps).toBe(1);
      expect(performance?.callbacksScheduled).toBe(1);
    });

    it('should execute appointment campaign step', async () => {
      const targetAudience: CampaignAudience = {
        leadTypes: ['warm'],
        sources: ['meta_ads'],
      };

      const steps: Omit<CampaignStep, 'id'>[] = [
        {
          order: 1,
          type: 'appointment',
          delayHours: 24,
          content: 'Schedule consultation',
        },
      ];

      const campaign = await coordinator.createCampaign(
        'Appointment Campaign',
        'appointment_booking',
        targetAudience,
        steps
      );

      const success = await coordinator.executeCampaignStep(
        campaign.id,
        mockLeadId,
        campaign.steps[0].id
      );

      expect(success).toBe(true);

      // Check that campaign performance was updated
      const performance = coordinator.getCampaignPerformance(campaign.id);
      expect(performance?.completedSteps).toBe(1);
      expect(performance?.appointmentsBooked).toBe(1);
    });

    it('should handle message and email campaign steps', async () => {
      const targetAudience: CampaignAudience = {
        leadTypes: ['cold'],
        sources: ['third_party'],
      };

      const steps: Omit<CampaignStep, 'id'>[] = [
        {
          order: 1,
          type: 'message',
          delayHours: 0,
          content: 'Welcome message',
        },
        {
          order: 2,
          type: 'email',
          delayHours: 1,
          content: 'Follow-up email',
        },
      ];

      const campaign = await coordinator.createCampaign(
        'Message Campaign',
        'follow_up',
        targetAudience,
        steps
      );

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const success1 = await coordinator.executeCampaignStep(
        campaign.id,
        mockLeadId,
        campaign.steps[0].id
      );

      const success2 = await coordinator.executeCampaignStep(
        campaign.id,
        mockLeadId,
        campaign.steps[1].id
      );

      expect(success1).toBe(true);
      expect(success2).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Sending message to lead')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Sending email to lead')
      );

      consoleSpy.mockRestore();
    });

    it('should throw error for non-existent campaign', async () => {
      await expect(
        coordinator.executeCampaignStep('non-existent', mockLeadId, 'step-id')
      ).rejects.toThrow('Campaign not found: non-existent');
    });

    it('should throw error for non-existent campaign step', async () => {
      const targetAudience: CampaignAudience = {
        leadTypes: ['hot'],
        sources: ['website'],
      };

      const campaign = await coordinator.createCampaign(
        'Test Campaign',
        'callback_sequence',
        targetAudience,
        []
      );

      await expect(
        coordinator.executeCampaignStep(
          campaign.id,
          mockLeadId,
          'non-existent-step'
        )
      ).rejects.toThrow('Campaign step not found: non-existent-step');
    });
  });

  describe('Reminder Management', () => {
    it('should create reminder sequence when booking appointment', async () => {
      const scheduledAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours from now

      const appointment = await coordinator.bookAppointment(
        mockLeadId,
        'consultation',
        scheduledAt
      );

      // Check that reminder sequence was created
      const reminderSequences = (coordinator as any).reminderSequences;
      const sequence = Array.from(reminderSequences.values()).find(
        (rs: any) => rs.appointmentId === appointment.id
      ) as any;

      expect(sequence).toBeDefined();
      expect(sequence.status).toBe('active');
      expect(sequence.reminders).toHaveLength(2); // 24h and 2h reminders
    });

    it('should process pending reminders', async () => {
      // Create appointment 1 hour from now (so 2h reminder is due)
      const scheduledAt = new Date(Date.now() + 1 * 60 * 60 * 1000);
      const appointment = await coordinator.bookAppointment(
        mockLeadId,
        'consultation',
        scheduledAt
      );

      // Mock sendReminder method
      const sendReminderSpy = vi
        .spyOn(coordinator as any, 'sendReminder')
        .mockResolvedValue(undefined);

      await coordinator.processPendingReminders();

      expect(sendReminderSpy).toHaveBeenCalled();

      // Check that appointment reminder count was updated
      const appointments = (coordinator as any).appointments;
      const updatedAppointment = appointments.get(appointment.id);
      expect(updatedAppointment.remindersSent).toBeGreaterThan(0);
    });

    it('should handle reminder sending failures', async () => {
      const scheduledAt = new Date(Date.now() + 1 * 60 * 60 * 1000);
      await coordinator.bookAppointment(
        mockLeadId,
        'consultation',
        scheduledAt
      );

      // Mock sendReminder to throw error
      vi.spyOn(coordinator as any, 'sendReminder').mockRejectedValue(
        new Error('Send failed')
      );

      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      await coordinator.processPendingReminders();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send reminder'),
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Performance Tracking', () => {
    it('should generate agent performance data', async () => {
      const period = {
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        end: new Date(),
      };

      // Create some test data
      const scheduledAt = new Date();
      await coordinator.bookAppointment(
        mockLeadId,
        'consultation',
        scheduledAt
      );
      await coordinator.scheduleCallback(mockLeadId, scheduledAt);

      const performance = coordinator.getAgentPerformance(period);

      expect(performance).toBeDefined();
      expect(performance.agentId).toBe('ai-appointment-workflow-coordinator');
      expect(performance.metrics.totalInteractions).toBeGreaterThan(0);
      expect(performance.metrics.conversionRate).toBeGreaterThanOrEqual(0);
      expect(performance.metrics.appointmentBookingRate).toBeGreaterThanOrEqual(
        0
      );
    });

    it('should generate optimization suggestions', async () => {
      // Create some appointments and mark some as completed
      const scheduledAt = new Date();
      const apt1 = await coordinator.bookAppointment(
        mockLeadId,
        'consultation',
        scheduledAt
      );
      const apt2 = await coordinator.bookAppointment(
        'lead2',
        'site_visit',
        scheduledAt
      );

      // Manually update appointment statuses to simulate low completion rate
      const appointments = (coordinator as any).appointments;
      appointments.get(apt1.id).status = 'no_show';
      appointments.get(apt2.id).status = 'cancelled';

      const period = {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000),
        end: new Date(),
      };

      const performance = coordinator.getAgentPerformance(period);

      expect(performance.optimizationSuggestions).toContain(
        'Consider improving appointment confirmation process to reduce no-shows'
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle campaign execution errors gracefully', async () => {
      const targetAudience: CampaignAudience = {
        leadTypes: ['hot'],
        sources: ['website'],
      };

      const steps: Omit<CampaignStep, 'id'>[] = [
        {
          order: 1,
          type: 'callback',
          delayHours: 1,
          content: 'Test callback',
        },
      ];

      const campaign = await coordinator.createCampaign(
        'Error Test Campaign',
        'callback_sequence',
        targetAudience,
        steps
      );

      // Mock scheduleCallback to throw error
      vi.spyOn(coordinator, 'scheduleCallback').mockRejectedValue(
        new Error('Scheduling failed')
      );

      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const success = await coordinator.executeCampaignStep(
        campaign.id,
        mockLeadId,
        campaign.steps[0].id
      );

      expect(success).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to execute campaign step'),
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('should handle callback processing errors gracefully', async () => {
      const pastTime = new Date(Date.now() - 60 * 1000);
      await coordinator.scheduleCallback(mockLeadId, pastTime);

      // Mock attemptCallback to throw error
      vi.spyOn(coordinator as any, 'attemptCallback').mockRejectedValue(
        new Error('Callback failed')
      );

      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      await coordinator.processPendingCallbacks();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to process callback'),
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });
});
