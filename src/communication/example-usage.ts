import { MultiChannelCommunicationManager } from './multi-channel-manager';
import {
  CommunicationChannel,
  ChannelSelectionCriteria,
} from '../types/communication';
import { generateUUID } from '../types/validation';

/**
 * Example usage of the MultiChannelCommunicationManager
 * This demonstrates the key features of the multi-channel communication system
 */
async function demonstrateMultiChannelCommunication() {
  const manager = new MultiChannelCommunicationManager();
  const leadId = generateUUID();

  console.log('=== Multi-Channel Communication Manager Demo ===\n');

  // 1. Set up communication preferences for a lead
  console.log('1. Setting up communication preferences...');
  await manager.setCommunicationPreferences({
    leadId,
    preferredChannels: ['email', 'sms', 'whatsapp'],
    optedOutChannels: [],
    bestTimeToContact: {
      startHour: 9,
      endHour: 17,
      timezone: 'UTC',
    },
    frequencyLimits: {
      maxDailyContacts: 3,
      maxWeeklyContacts: 10,
      cooldownPeriodHours: 4,
    },
  });

  const preferences = await manager.getCommunicationPreferences(leadId);
  console.log('✓ Preferences set:', {
    preferredChannels: preferences?.preferredChannels,
    frequencyLimits: preferences?.frequencyLimits,
  });

  // 2. Demonstrate channel selection based on criteria
  console.log('\n2. Selecting optimal communication channels...');

  const urgentCriteria: ChannelSelectionCriteria = {
    urgency: 'high',
    messageType: 'urgent',
    leadProfile: {
      leadType: 'hot',
      responseHistory: ['voice', 'sms'],
      preferredChannel: 'voice',
    },
    contextualFactors: {
      timeOfDay: 14, // 2 PM
      dayOfWeek: 2, // Tuesday
      previousFailures: [],
    },
  };

  const urgentChannel = await manager.selectOptimalChannel(
    leadId,
    urgentCriteria
  );
  console.log('✓ Urgent message channel:', urgentChannel);

  const promotionalCriteria: ChannelSelectionCriteria = {
    urgency: 'low',
    messageType: 'promotional',
    leadProfile: {
      leadType: 'warm',
      responseHistory: ['email'],
      preferredChannel: 'email',
    },
    contextualFactors: {
      timeOfDay: 10,
      dayOfWeek: 1,
      previousFailures: [],
    },
  };

  const promotionalChannel = await manager.selectOptimalChannel(
    leadId,
    promotionalCriteria
  );
  console.log('✓ Promotional message channel:', promotionalChannel);

  // 3. Check communication frequency limits
  console.log('\n3. Checking communication frequency limits...');

  let canCommunicate = await manager.canCommunicate(leadId, 'email');
  console.log('✓ Can send email:', canCommunicate.allowed);

  // Record some communication attempts
  await manager.recordCommunicationAttempt(
    leadId,
    'email',
    true,
    undefined,
    generateUUID()
  );
  await manager.recordCommunicationAttempt(
    leadId,
    'sms',
    true,
    undefined,
    generateUUID()
  );

  canCommunicate = await manager.canCommunicate(leadId, 'email');
  console.log(
    '✓ Can send another email (after cooldown):',
    canCommunicate.allowed
  );
  if (!canCommunicate.allowed) {
    console.log('  Reason:', canCommunicate.reason);
    console.log('  Next allowed time:', canCommunicate.nextAllowedTime);
  }

  // 4. Demonstrate opt-out functionality
  console.log('\n4. Demonstrating opt-out functionality...');

  await manager.optOutFromChannel(leadId, 'sms');
  console.log('✓ Opted out from SMS');

  const smsCheck = await manager.canCommunicate(leadId, 'sms');
  console.log('✓ Can send SMS after opt-out:', smsCheck.allowed);
  console.log('  Reason:', smsCheck.reason);

  // Opt back in
  await manager.optInToChannel(leadId, 'sms');
  const smsCheckAfterOptIn = await manager.canCommunicate(leadId, 'sms');
  console.log('✓ Can send SMS after opt-in:', smsCheckAfterOptIn.allowed);

  // 5. Demonstrate conversation continuity
  console.log('\n5. Demonstrating conversation continuity...');

  const interactionId1 = generateUUID();
  const interactionId2 = generateUUID();

  await manager.updateConversationContext(
    leadId,
    'property_inquiry',
    'email',
    {
      propertyType: 'apartment',
      budget: '500k',
      location: 'downtown',
    },
    interactionId1
  );

  await manager.updateConversationContext(
    leadId,
    'property_inquiry',
    'sms',
    {
      preferredViewingTime: 'weekend',
      urgency: 'high',
    },
    interactionId2
  );

  const context = await manager.getConversationContext(
    leadId,
    'property_inquiry'
  );
  console.log('✓ Conversation context:', {
    topic: context?.topic,
    lastChannel: context?.lastChannel,
    context: context?.context,
    interactionCount: context?.interactionIds.length,
  });

  // 6. Get communication history
  console.log('\n6. Communication history...');

  const attempts = await manager.getCommunicationAttempts(leadId);
  console.log('✓ Total communication attempts:', attempts.length);
  console.log(
    '✓ Successful attempts:',
    attempts.filter((a) => a.successful).length
  );
  console.log(
    '✓ Failed attempts:',
    attempts.filter((a) => !a.successful).length
  );

  const failedChannels = await manager.getRecentFailedChannels(leadId, 24);
  console.log('✓ Recently failed channels:', failedChannels);

  // 7. Demonstrate channel selection with failures
  console.log('\n7. Channel selection avoiding recent failures...');

  // Record a failed attempt
  await manager.recordCommunicationAttempt(
    leadId,
    'whatsapp',
    false,
    'Service unavailable'
  );

  const criteriaWithFailures: ChannelSelectionCriteria = {
    urgency: 'medium',
    messageType: 'follow_up',
    leadProfile: {
      leadType: 'warm',
      responseHistory: ['whatsapp', 'email'],
      preferredChannel: 'whatsapp',
    },
    contextualFactors: {
      timeOfDay: 15,
      dayOfWeek: 3,
      previousFailures: await manager.getRecentFailedChannels(leadId, 24),
    },
  };

  const alternativeChannel = await manager.selectOptimalChannel(
    leadId,
    criteriaWithFailures
  );
  console.log(
    '✓ Alternative channel (avoiding WhatsApp failure):',
    alternativeChannel
  );

  console.log('\n=== Demo Complete ===');
}

// Run the demonstration
if (require.main === module) {
  demonstrateMultiChannelCommunication().catch(console.error);
}

export { demonstrateMultiChannelCommunication };
