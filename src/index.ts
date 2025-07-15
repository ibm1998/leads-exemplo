import { config } from "./config/environment";
import { logger } from "./utils/logger";
import { DatabaseManager } from "./database/manager";

async function main() {
  try {
    logger.info("Starting Agentic Lead Management System");

    // Initialize database connection
    const dbManager = new DatabaseManager();
    await dbManager.initialize();

    logger.info("System initialized successfully");

    // Keep the process running
    process.on("SIGINT", async () => {
      logger.info("Shutting down gracefully...");
      await dbManager.close();
      process.exit(0);
    });
  } catch (error) {
    logger.error("Failed to start system:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
