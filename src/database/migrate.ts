import { DatabaseManager } from './manager';
import { logger } from '../utils/logger';

async function runMigrations() {
  const dbManager = new DatabaseManager();

  try {
    logger.info('Starting database migrations...');
    await dbManager.initialize();
    logger.info('Database migrations completed successfully');
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await dbManager.close();
  }
}

if (require.main === module) {
  runMigrations();
}
