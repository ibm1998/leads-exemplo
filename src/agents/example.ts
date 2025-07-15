import { AIHeadAgent, PerformanceFeedback } from "./ai-head-agent";
import { Lead } from "../types/lead";

/**
 * Example usage of the AI Head Agent
 * This demonstrates the core functionality of lead analysis and routing
 */
async function demonstrateAIHeadAgent() {
  console.log("🤖 AI Head Agent Demo");
  console.log("====================\n");

  // Initialize the AI Head Agent
  const aiHeadAgent = new AIHeadAgent({
    responseTimeSLA: 60,
    optimizationEnabled: true,
  });

  // Example leads to analyze
  const leads: Lead[] = [
    {
      id: "lead-001",
      source: "website",
      contactInfo: {
        name: "Sarah Johnson",
        email: "sarah@example.com",
        phone: "+1234567890",
        preferredChannel: "email",
        timezone: "America/New_York",
      },
      leadType: "hot",
      urgencyLevel: 9,
      intentSignals: [
        "form_submission",
        "requested_callback",
        "asked_about_pricing",
      ],
      qualificationData: {
        budget: { min: 200000, max: 800000 },
        location: "Manhattan",
        propertyType: "condo",
        timeline: "2 months",
        qualificationScore: 0.85,
      },
      status: "new",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "lead-002",
      source: "meta_ads",
      contactInfo: {
        name: "Mike Chen",
        email: "mike.chen@example.com",
        preferredChannel: "sms",
        timezone: "America/Los_Angeles",
      },
      leadType: "warm",
      urgencyLevel: 5,
      intentSignals: ["downloaded_content", "visited_multiple_pages"],
      qualificationData: {
        location: "San Francisco",
        propertyType: "apartment",
        qualificationScore: 0.4,
      },
      status: "new",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "lead-003",
      source: "gmail",
      contactInfo: {
        name: "Jennifer Smith",
        email: "jennifer.smith@example.com",
        preferredChannel: "email",
        timezone: "UTC",
      },
      leadType: "cold",
      urgencyLevel: 2,
      intentSignals: ["email_opened"],
      qualificationData: {
        qualificationScore: 0.1,
      },
      status: "new",
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day old
      updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    },
  ];

  // Analyze each lead
  console.log("📊 Analyzing Leads:");
  console.log("-------------------");

  for (const lead of leads) {
    try {
      const analysis = await aiHeadAgent.analyzeLead(lead);

      console.log(`\n🔍 Lead: ${lead.contactInfo.name} (${lead.id})`);
      console.log(`   Source: ${lead.source}`);
      console.log(
        `   Original Type: ${lead.leadType} → Evaluated: ${analysis.leadType}`
      );
      console.log(
        `   Urgency: ${lead.urgencyLevel} → Calculated: ${analysis.urgencyLevel}`
      );
      console.log(`   Intent Score: ${analysis.intentScore}`);
      console.log(`   Source Quality: ${analysis.sourceQuality}`);
      console.log(`   Confidence: ${(analysis.confidence * 100).toFixed(1)}%`);
      console.log(`   
   🎯 Routing Decision:`);
      console.log(
        `      Target Agent: ${analysis.routingRecommendation.targetAgent}`
      );
      console.log(`      Priority: ${analysis.routingRecommendation.priority}`);
      console.log(
        `      Est. Response Time: ${analysis.routingRecommendation.estimatedResponseTime}s`
      );
      console.log(
        `      Reasoning: ${analysis.routingRecommendation.reasoning.join(
          ", "
        )}`
      );
      console.log(
        `      Suggested Actions: ${analysis.routingRecommendation.suggestedActions.join(
          ", "
        )}`
      );
    } catch (error) {
      console.error(`❌ Error analyzing lead ${lead.id}:`, error);
    }
  }

  // Simulate performance feedback
  console.log("\n\n📈 Processing Performance Feedback:");
  console.log("------------------------------------");

  const feedbackData: PerformanceFeedback[] = [
    {
      leadId: "lead-001",
      routingDecision: (await aiHeadAgent.analyzeLead(leads[0]))
        .routingRecommendation,
      actualOutcome: {
        conversionSuccessful: true,
        responseTime: 35,
        customerSatisfaction: 4.8,
        appointmentBooked: true,
      },
      timestamp: new Date(),
    },
    {
      leadId: "lead-002",
      routingDecision: (await aiHeadAgent.analyzeLead(leads[1]))
        .routingRecommendation,
      actualOutcome: {
        conversionSuccessful: false,
        responseTime: 180,
        customerSatisfaction: 3.2,
        appointmentBooked: false,
      },
      timestamp: new Date(),
    },
  ];

  for (const feedback of feedbackData) {
    await aiHeadAgent.processPerformanceFeedback(feedback);
    console.log(`✅ Processed feedback for lead ${feedback.leadId}`);
    console.log(
      `   Conversion: ${
        feedback.actualOutcome.conversionSuccessful ? "Success" : "Failed"
      }`
    );
    console.log(`   Response Time: ${feedback.actualOutcome.responseTime}s`);
    console.log(
      `   Satisfaction: ${feedback.actualOutcome.customerSatisfaction || "N/A"}`
    );
  }

  // Show performance metrics
  console.log("\n\n📊 Performance Metrics:");
  console.log("------------------------");

  const metrics = aiHeadAgent.getPerformanceMetrics();
  console.log(`Total Leads Analyzed: ${metrics.totalLeadsAnalyzed}`);
  console.log(
    `Routing Accuracy: ${(metrics.routingAccuracy * 100).toFixed(1)}%`
  );
  console.log(
    `Average Confidence: ${(metrics.averageConfidence * 100).toFixed(1)}%`
  );
  console.log(`Average Analysis Time: ${metrics.averageAnalysisTime}ms`);

  if (metrics.rulePerformance.length > 0) {
    console.log("\nRule Performance:");
    metrics.rulePerformance.forEach((rule) => {
      console.log(
        `  ${rule.ruleId}: ${(rule.successRate * 100).toFixed(1)}% success (${
          rule.usageCount
        } uses)`
      );
    });
  }

  // Demonstrate custom routing rule
  console.log("\n\n⚙️  Adding Custom Routing Rule:");
  console.log("--------------------------------");

  aiHeadAgent.addRoutingRule({
    id: "vip-referral",
    name: "VIP Referral Priority",
    condition: (lead) =>
      lead.source === "referral" &&
      lead.qualificationData.qualificationScore > 0.8,
    action: {
      targetAgent: "inbound",
      priority: "high",
      reasoning: ["VIP referral with high qualification"],
      estimatedResponseTime: 15,
      suggestedActions: [
        "Immediate personal contact",
        "VIP treatment protocol",
      ],
    },
    priority: 1,
    enabled: true,
  });

  console.log("✅ Added VIP Referral Priority rule");

  // Test the new rule with a VIP referral lead
  const vipLead: Lead = {
    id: "lead-vip",
    source: "referral",
    contactInfo: {
      name: "Robert Williams",
      email: "robert@example.com",
      phone: "+1987654321",
      preferredChannel: "voice",
      timezone: "America/New_York",
    },
    leadType: "warm",
    urgencyLevel: 7,
    intentSignals: ["personal_referral", "high_value_inquiry"],
    qualificationData: {
      budget: { min: 1000000, max: 5000000 },
      location: "Upper East Side",
      propertyType: "penthouse",
      timeline: "immediate",
      qualificationScore: 0.95,
    },
    status: "new",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const vipAnalysis = await aiHeadAgent.analyzeLead(vipLead);
  console.log(`\n🌟 VIP Lead Analysis: ${vipLead.contactInfo.name}`);
  console.log(
    `   Routing: ${vipAnalysis.routingRecommendation.targetAgent} (${vipAnalysis.routingRecommendation.priority})`
  );
  console.log(
    `   Response Time: ${vipAnalysis.routingRecommendation.estimatedResponseTime}s`
  );
  console.log(
    `   Reasoning: ${vipAnalysis.routingRecommendation.reasoning.join(", ")}`
  );

  console.log("\n🎉 Demo Complete!");
}

// Run the demo if this file is executed directly
if (require.main === module) {
  demonstrateAIHeadAgent().catch(console.error);
}

export { demonstrateAIHeadAgent };
