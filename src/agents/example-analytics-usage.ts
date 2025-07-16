import { AICustomerAnalyticsAgent } from "./ai-customer-analytics-agent";
import { DatabaseManager } from "../database/manager";

/**
 * Example usage of the AI Customer Analytics Agent
 *
 * This demonstrates how to use the analytics agent to:
 * 1. Collect performance data
 * 2. Analyze script performance
 * 3. Generate intelligence reports
 * 4. Analyze performance trends
 * 5. Measure optimization impact
 * 6. Get real-time dashboard data
 */
async function demonstrateAnalyticsAgent() {
  console.log("🚀 AI Customer Analytics Agent Demo");
  console.log("=====================================");

  // Initialize the analytics agent
  const dbManager = new DatabaseManager();
  const analyticsAgent = new AICustomerAnalyticsAgent(dbManager);

  try {
    // Define analysis period
    const period = {
      start: new Date("2024-01-01"),
      end: new Date("2024-01-31"),
    };

    console.log("\n📊 Step 1: Collecting Performance Data");
    console.log("--------------------------------------");

    // Collect performance data for multiple agents
    const agents = [
      "virtual-sales-assistant",
      "lead-generation-agent",
      "retention-agent",
    ];

    for (const agentId of agents) {
      const performance = await analyticsAgent.collectPerformanceData(
        agentId,
        period
      );

      console.log(`\n${agentId}:`);
      console.log(
        `  - Total Interactions: ${performance.metrics.totalInteractions}`
      );
      console.log(
        `  - Conversion Rate: ${(
          performance.metrics.conversionRate * 100
        ).toFixed(1)}%`
      );
      console.log(
        `  - Avg Response Time: ${(
          performance.metrics.averageResponseTime / 1000
        ).toFixed(1)}s`
      );
      console.log(
        `  - Customer Satisfaction: ${performance.metrics.customerSatisfactionScore.toFixed(
          1
        )}/5`
      );
      console.log(
        `  - Optimization Suggestions: ${performance.optimizationSuggestions.length}`
      );
    }

    console.log("\n🎯 Step 2: Analyzing Script Performance");
    console.log("---------------------------------------");

    const scriptOptimizations = await analyticsAgent.analyzeScriptPerformance();

    console.log(`Found ${scriptOptimizations.length} scripts to optimize:`);

    scriptOptimizations.forEach((optimization, index) => {
      console.log(`\n${index + 1}. ${optimization.scriptName}:`);
      console.log(
        `   Current Conversion Rate: ${(
          optimization.currentPerformance.conversionRate * 100
        ).toFixed(1)}%`
      );
      console.log(
        `   Estimated Improvement: +${optimization.estimatedImpact.conversionRateImprovement}%`
      );
      console.log(
        `   Top Recommendation: ${optimization.recommendations[0]?.description}`
      );
    });

    console.log("\n🧠 Step 3: Generating Intelligence Report");
    console.log("-----------------------------------------");

    const insights = await analyticsAgent.generateIntelligenceReport();

    console.log(`Generated ${insights.length} actionable insights:`);

    insights.forEach((insight, index) => {
      console.log(
        `\n${index + 1}. ${insight.title} (${insight.impact} impact)`
      );
      console.log(`   Type: ${insight.type}`);
      console.log(`   Description: ${insight.description}`);
      console.log(`   Recommendations: ${insight.recommendations.length}`);
    });

    console.log("\n📈 Step 4: Analyzing Performance Trends");
    console.log("---------------------------------------");

    const trends = await analyticsAgent.analyzePerformanceTrends(period);

    console.log(`Analyzed ${trends.length} performance metrics:`);

    trends.forEach((trend) => {
      const direction =
        trend.trend === "increasing"
          ? "📈"
          : trend.trend === "decreasing"
          ? "📉"
          : "➡️";

      console.log(`\n${direction} ${trend.metric}:`);
      console.log(
        `   Trend: ${trend.trend} (${
          trend.changePercent > 0 ? "+" : ""
        }${trend.changePercent.toFixed(1)}%)`
      );
      console.log(`   Significance: ${trend.significance}`);
      console.log(`   Data Points: ${trend.dataPoints.length}`);
    });

    console.log("\n🎯 Step 5: Setting Baseline and Measuring Impact");
    console.log("------------------------------------------------");

    // Set baseline for the first agent
    const testAgent = agents[0];
    const baselinePeriod = {
      start: new Date("2023-12-01"),
      end: new Date("2023-12-31"),
    };

    await analyticsAgent.setPerformanceBaseline(testAgent, baselinePeriod);
    console.log(`✅ Baseline set for ${testAgent}`);

    // Measure optimization impact
    const impact = await analyticsAgent.measureOptimizationImpact(
      testAgent,
      "script-optimization-v1",
      period
    );

    console.log(`\nOptimization Impact for ${testAgent}:`);
    console.log(
      `  - Conversion Rate: ${
        impact.improvement.conversionRate > 0 ? "+" : ""
      }${impact.improvement.conversionRate.toFixed(1)}%`
    );
    console.log(
      `  - Response Time: ${
        impact.improvement.responseTime > 0 ? "+" : ""
      }${impact.improvement.responseTime.toFixed(1)}%`
    );
    console.log(
      `  - Satisfaction: ${
        impact.improvement.satisfaction > 0 ? "+" : ""
      }${impact.improvement.satisfaction.toFixed(1)}%`
    );
    console.log(
      `  - Overall Score: ${
        impact.improvement.overall > 0 ? "+" : ""
      }${impact.improvement.overall.toFixed(1)}%`
    );
    console.log(`  - Validated: ${impact.validated ? "✅" : "❌"}`);

    console.log("\n📊 Step 6: Real-time Dashboard Data");
    console.log("-----------------------------------");

    const dashboardData = await analyticsAgent.getDashboardData();

    console.log("Dashboard Overview:");
    console.log(
      `  - Total Interactions: ${dashboardData.overview.totalInteractions}`
    );
    console.log(
      `  - Overall Conversion Rate: ${(
        dashboardData.overview.overallConversionRate * 100
      ).toFixed(1)}%`
    );
    console.log(
      `  - Avg Response Time: ${(
        dashboardData.overview.averageResponseTime / 1000
      ).toFixed(1)}s`
    );
    console.log(
      `  - Customer Satisfaction: ${dashboardData.overview.customerSatisfactionScore.toFixed(
        1
      )}/5`
    );
    console.log(`  - Active Leads: ${dashboardData.overview.activeLeads}`);
    console.log(
      `  - Converted Leads: ${dashboardData.overview.convertedLeads}`
    );

    console.log(
      `\nLead Source Analysis (${dashboardData.leadSourceAnalysis.length} sources):`
    );
    dashboardData.leadSourceAnalysis.forEach((source) => {
      console.log(
        `  - ${source.source}: ${(source.conversionRate * 100).toFixed(
          1
        )}% conversion, Quality: ${(source.qualityScore * 100).toFixed(0)}%`
      );
    });

    console.log(`\nRecent Insights: ${dashboardData.recentInsights.length}`);
    console.log(
      `Performance Trends: ${dashboardData.performanceTrends.length}`
    );
    console.log(`Last Updated: ${dashboardData.lastUpdated.toISOString()}`);

    console.log("\n✅ Analytics Agent Demo Complete!");
    console.log("=================================");

    console.log("\nKey Capabilities Demonstrated:");
    console.log("• Performance data collection and analysis");
    console.log("• Script optimization recommendations");
    console.log("• Actionable intelligence generation");
    console.log("• Performance trend analysis");
    console.log("• Optimization impact measurement");
    console.log("• Real-time dashboard data");
    console.log("• Lead source effectiveness analysis");
  } catch (error) {
    console.error("❌ Error during analytics demo:", error);
  } finally {
    await dbManager.close();
  }
}

/**
 * Example of continuous optimization loop
 */
async function demonstrateOptimizationLoop() {
  console.log("\n🔄 Continuous Optimization Loop Demo");
  console.log("====================================");

  const dbManager = new DatabaseManager();
  const analyticsAgent = new AICustomerAnalyticsAgent(dbManager);

  try {
    const agentId = "optimization-demo-agent";
    const currentPeriod = {
      start: new Date("2024-01-01"),
      end: new Date("2024-01-31"),
    };

    // Step 1: Collect current performance
    console.log("1. Collecting current performance data...");
    const performance = await analyticsAgent.collectPerformanceData(
      agentId,
      currentPeriod
    );

    // Step 2: Generate optimization recommendations
    console.log("2. Generating optimization recommendations...");
    const scriptOptimizations = await analyticsAgent.analyzeScriptPerformance();

    // Step 3: Generate insights
    console.log("3. Generating actionable insights...");
    const insights = await analyticsAgent.generateIntelligenceReport();

    // Step 4: Analyze trends
    console.log("4. Analyzing performance trends...");
    const trends = await analyticsAgent.analyzePerformanceTrends(currentPeriod);

    console.log("\n📋 Optimization Recommendations Summary:");
    console.log("---------------------------------------");

    // High-impact recommendations
    const highImpactInsights = insights.filter(
      (insight) => insight.impact === "high"
    );
    console.log(
      `\n🔥 High Impact Opportunities (${highImpactInsights.length}):`
    );
    highImpactInsights.forEach((insight) => {
      console.log(`  • ${insight.title}`);
      console.log(`    ${insight.description}`);
    });

    // Script optimizations
    const highPriorityOptimizations = scriptOptimizations
      .flatMap((opt) => opt.recommendations)
      .filter((rec) => rec.priority === "high");

    console.log(
      `\n⚡ High Priority Script Optimizations (${highPriorityOptimizations.length}):`
    );
    highPriorityOptimizations.forEach((rec) => {
      console.log(`  • ${rec.description} (Expected: +${rec.expectedImpact}%)`);
    });

    // Trending issues
    const negativeeTrends = trends.filter(
      (trend) => trend.trend === "decreasing" && trend.significance !== "low"
    );

    console.log(`\n📉 Areas Needing Attention (${negativeeTrends.length}):`);
    negativeeTrends.forEach((trend) => {
      console.log(
        `  • ${trend.metric}: ${trend.changePercent.toFixed(1)}% decrease`
      );
    });

    console.log("\n✅ Optimization loop complete - Ready for implementation!");
  } catch (error) {
    console.error("❌ Error during optimization loop:", error);
  } finally {
    await dbManager.close();
  }
}

// Run the demos if this file is executed directly
if (require.main === module) {
  demonstrateAnalyticsAgent()
    .then(() => demonstrateOptimizationLoop())
    .catch(console.error);
}

export { demonstrateAnalyticsAgent, demonstrateOptimizationLoop };
