import { DatabaseManager } from "./manager";
import { logger } from "../utils/logger";

async function seedDatabase() {
  const dbManager = new DatabaseManager();

  try {
    logger.info("Starting database seeding...");
    await dbManager.initialize();

    // Insert sample leads for testing
    await dbManager.query(`
      INSERT INTO leads (
        source, name, email, phone, lead_type, urgency_level, 
        location, property_type, timeline, status
      ) VALUES 
      ('website', 'John Doe', 'john.doe@example.com', '+1234567890', 'hot', 8, 
       'New York', 'Apartment', '1-3 months', 'new'),
      ('meta_ads', 'Jane Smith', 'jane.smith@example.com', '+1234567891', 'warm', 5, 
       'Los Angeles', 'House', '3-6 months', 'new'),
      ('gmail', 'Bob Johnson', 'bob.johnson@example.com', '+1234567892', 'cold', 3, 
       'Chicago', 'Condo', '6+ months', 'new')
      ON CONFLICT DO NOTHING
    `);

    logger.info("Sample data inserted successfully");
    logger.info("Database seeding completed successfully");
  } catch (error) {
    logger.error("Seeding failed:", error);
    process.exit(1);
  } finally {
    await dbManager.close();
  }
}

if (require.main === module) {
  seedDatabase();
}
