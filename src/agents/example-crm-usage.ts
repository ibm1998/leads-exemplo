/**
 * Example usage of the AI CRM Management Agent
 *
 * This file demonstrates how to use the AI CRM Management Agent
 * for real-time interaction logging, lead status management,
 * data quality management, and comprehensive audit trails.
 */

import { AICRMManagementAgent } from "./ai-crm-management-agent";
import { DatabaseManager } from "../database/manager";
import { GoHighLevelClient } from "../integrations/gohighlevel/client";
import { Lead, LeadStatus } from "../types/lead";
import { Interaction } from "../types/interaction";
import { logger } from "../utils/logger";

async function demonstrateCRMAgent() {
  // Initialize dependencies
  const dbManager = new DatabaseManager();
  await dbManager.initialize();

  const ghlClient = new GoHighLevelClient({
    apiKey: process.env.GHL_API_KEY || "your-api-key-here",
    baseUrl: "https://rest.gohighlevel.com/v1",
  });

  // Create CRM Management Agent with configuration
  const crmAgent = new AICRMManagementAgent(dbManager, ghlClient, {
    syncTimeoutMs: 5000, // 5-second SLA for real-time sync
    duplicateThreshold: 0.8,
  });

  // Example 1: Real-time Interaction Logging
  console.log("=== Example 1: Real-time Interaction Logging ===");

  const sampleInteraction: Interaction = {
    id: "interaction-demo-001",
    leadId: "lead-demo-001",
    agentId: "virtual-sales-assistant",
    type: "call",
    direction: "outbound",
    content:
      "Qualification call completed. Customer interested in 2-bedroom apartment in downtown area. Budget confirmed at $200k-250k range. Timeline: 3-6 months.",
    outcome: {
      status: "successful",
      appointmentBooked: true,
      qualificationUpdated: true,
      escalationRequired: false,
    },
    duration: 420, // 7 minutes
    sentiment: {
      score: 0.75,
      confidence: 0.9,
    },
    nextAction: {
      action: "Send property listings matching criteria",
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      description:
        "Follow up with curated property listings based on qualification call",
    },
    timestamp: new Date(),
  };

  try {
    const syncResult = await crmAgent.logInteraction(sampleInteraction);
    console.log("Interaction logged successfully:", {
      success: syncResult.success,
      syncTime: `${syncResult.syncTime}ms`,
      contactId: syncResult.contactId,
      slaCompliant: syncResult.syncTime <= 5000,
    });
  } catch (error) {
    console.error("Failed to log interaction:", error);
  }

  // Example 2: Lead Status Management with Pipeline Progression
  console.log("\n=== Example 2: Lead Status Management ===");

  const leadId = "lead-demo-001";
  const statusProgression: Array<{
    status: LeadStatus;
    agent: string;
    reason: string;
  }> = [
    {
      status: "contacted",
      agent: "ai-lead-generation-agent",
      reason: "Initial outreach completed",
    },
    {
      status: "qualified",
      agent: "virtual-sales-assistant",
      reason: "Budget and timeline confirmed",
    },
    {
      status: "appointment_scheduled",
      agent: "virtual-sales-assistant",
      reason: "Property viewing scheduled",
    },
    {
      status: "in_progress",
      agent: "human-agent-001",
      reason: "Viewing completed, negotiation started",
    },
  ];

  for (const { status, agent, reason } of statusProgression) {
    try {
      const updateResult = await crmAgent.updateLeadStatus(
        leadId,
        status,
        agent,
        { reason }
      );
      console.log(`Status updated to ${status}:`, {
        success: updateResult.success,
        syncTime: `${updateResult.syncTime}ms`,
        contactId: updateResult.contactId,
      });

      // Wait a bit between status updates to simulate real workflow
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Failed to update status to ${status}:`, error);
    }
  }

  // Example 3: Data Quality Management
  console.log("\n=== Example 3: Data Quality Management ===");

  try {
    // Detect duplicates
    console.log("Detecting duplicate leads...");
    const duplicateIssues = await crmAgent.detectDuplicates();
    console.log(`Found ${duplicateIssues.length} duplicate issues:`);

    duplicateIssues.forEach((issue, index) => {
      console.log(
        `  ${index + 1}. ${issue.type} (${issue.severity}): ${
          issue.description
        }`
      );
      console.log(`     Affected records: ${issue.affectedRecords.length}`);
      console.log(`     Suggested action: ${issue.suggestedAction}`);
    });

    // Validate data quality
    console.log("\nValidating data quality...");
    const qualityIssues = await crmAgent.validateDataQuality();
    console.log(`Found ${qualityIssues.length} data quality issues:`);

    qualityIssues.forEach((issue, index) => {
      console.log(
        `  ${index + 1}. ${issue.type} (${issue.severity}): ${
          issue.description
        }`
      );
      console.log(`     Affected records: ${issue.affectedRecords.length}`);
      console.log(`     Suggested action: ${issue.suggestedAction}`);
    });
  } catch (error) {
    console.error("Data quality management failed:", error);
  }

  // Example 4: Comprehensive Data Synchronization
  console.log("\n=== Example 4: Comprehensive Data Synchronization ===");

  try {
    console.log("Starting full data synchronization...");
    const syncResults = await crmAgent.syncAllPendingData();

    console.log("Synchronization completed:", {
      leads: {
        successful: syncResults.leads.success,
        failed: syncResults.leads.failed,
        successRate: `${(
          (syncResults.leads.success /
            (syncResults.leads.success + syncResults.leads.failed)) *
          100
        ).toFixed(1)}%`,
      },
      interactions: {
        successful: syncResults.interactions.success,
        failed: syncResults.interactions.failed,
        successRate: `${(
          (syncResults.interactions.success /
            (syncResults.interactions.success +
              syncResults.interactions.failed)) *
          100
        ).toFixed(1)}%`,
      },
    });
  } catch (error) {
    console.error("Data synchronization failed:", error);
  }

  // Example 5: Audit Trail Demonstration
  console.log("\n=== Example 5: Audit Trail ===");

  try {
    // Create a custom audit log entry
    await crmAgent.createAuditLog({
      entityType: "lead",
      entityId: leadId,
      action: "sync",
      changes: {
        syncStatus: { old: "pending", new: "completed" },
        lastSyncTime: { old: null, new: new Date().toISOString() },
      },
      agentId: "ai-crm-management-agent",
      timestamp: new Date(),
      metadata: {
        syncDuration: 1250,
        recordsProcessed: 1,
        apiCalls: 3,
        slaCompliant: true,
      },
    });

    console.log("Custom audit log entry created successfully");
  } catch (error) {
    console.error("Failed to create audit log:", error);
  }

  // Example 6: Performance Monitoring
  console.log("\n=== Example 6: Performance Monitoring ===");

  // Simulate multiple rapid interactions to test SLA compliance
  const rapidInteractions: Interaction[] = Array.from(
    { length: 5 },
    (_, i) => ({
      id: `rapid-interaction-${i + 1}`,
      leadId: `lead-demo-00${i + 1}`,
      agentId: "performance-test-agent",
      type: "sms",
      direction: "outbound",
      content: `Performance test message ${i + 1}`,
      outcome: {
        status: "successful",
        appointmentBooked: false,
        qualificationUpdated: false,
        escalationRequired: false,
      },
      timestamp: new Date(Date.now() + i * 100), // Stagger by 100ms
    })
  );

  console.log("Testing rapid interaction logging for SLA compliance...");
  const startTime = Date.now();

  const rapidResults = await Promise.all(
    rapidInteractions.map((interaction) => crmAgent.logInteraction(interaction))
  );

  const totalTime = Date.now() - startTime;
  const slaCompliantCount = rapidResults.filter(
    (result) => result.syncTime <= 5000
  ).length;

  console.log("Rapid interaction test results:", {
    totalInteractions: rapidResults.length,
    totalTime: `${totalTime}ms`,
    averageTime: `${(totalTime / rapidResults.length).toFixed(1)}ms`,
    slaCompliantCount,
    slaComplianceRate: `${(
      (slaCompliantCount / rapidResults.length) *
      100
    ).toFixed(1)}%`,
    allSuccessful: rapidResults.every((result) => result.success),
  });

  // Clean up
  await dbManager.close();
  console.log("\n=== CRM Agent Demonstration Complete ===");
}

// Run the demonstration if this file is executed directly
if (require.main === module) {
  demonstrateCRMAgent()
    .then(() => {
      console.log("Demonstration completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Demonstration failed:", error);
      process.exit(1);
    });
}

export { demonstrateCRMAgent };
