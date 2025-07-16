import { Pool, PoolClient } from "pg";
import { createClient, RedisClientType } from "redis";
import { config } from "../config/environment";
import { logger } from "../utils/logger";

export class DatabaseManager {
  private pgPool: Pool;
  private redisClient: RedisClientType;

  constructor() {
    // Initialize PostgreSQL connection pool
    this.pgPool = new Pool({
      host: config.DATABASE_HOST,
      port: config.DATABASE_PORT,
      database: config.DATABASE_NAME,
      user: config.DATABASE_USER,
      password: config.DATABASE_PASSWORD,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Initialize Redis client
    this.redisClient = createClient({
      url: config.REDIS_URL,
    });
  }

  async initialize(): Promise<void> {
    try {
      // Test PostgreSQL connection
      const client = await this.pgPool.connect();
      logger.info("PostgreSQL connection established");
      client.release();

      // Connect to Redis
      await this.redisClient.connect();
      logger.info("Redis connection established");

      // Run database migrations
      await this.runMigrations();
    } catch (error) {
      logger.error("Database initialization failed:", error);
      throw error;
    }
  }

  async close(): Promise<void> {
    try {
      await this.pgPool.end();
      await this.redisClient.quit();
      logger.info("Database connections closed");
    } catch (error) {
      logger.error("Error closing database connections:", error);
    }
  }

  getPostgresPool(): Pool {
    return this.pgPool;
  }

  getRedisClient(): RedisClientType {
    return this.redisClient;
  }

  async query(text: string, params?: any[]): Promise<any> {
    const client = await this.pgPool.connect();
    try {
      const result = await client.query(text, params);
      return result;
    } finally {
      client.release();
    }
  }

  private async runMigrations(): Promise<void> {
    try {
      logger.info("Running database migrations...");

      // Create migrations table if it doesn't exist
      await this.query(`
        CREATE TABLE IF NOT EXISTS migrations (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL UNIQUE,
          executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Run initial schema migration
      const migrationName = "001_initial_schema";
      const migrationExists = await this.query(
        "SELECT 1 FROM migrations WHERE name = $1",
        [migrationName]
      );

      if (migrationExists.rows.length === 0) {
        await this.createInitialSchema();
        await this.query("INSERT INTO migrations (name) VALUES ($1)", [
          migrationName,
        ]);
        logger.info("Initial schema migration completed");
      } else {
        logger.info("Database schema is up to date");
      }
    } catch (error) {
      logger.error("Migration failed:", error);
      throw error;
    }
  }

  private async createInitialSchema(): Promise<void> {
    const client = await this.pgPool.connect();
    try {
      await client.query("BEGIN");

      // Create leads table
      await client.query(`
        CREATE TABLE IF NOT EXISTS leads (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          source VARCHAR(50) NOT NULL,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255),
          phone VARCHAR(50),
          preferred_channel VARCHAR(20) DEFAULT 'email',
          timezone VARCHAR(50) DEFAULT 'UTC',
          lead_type VARCHAR(20) NOT NULL CHECK (lead_type IN ('hot', 'warm', 'cold')),
          urgency_level INTEGER DEFAULT 1 CHECK (urgency_level BETWEEN 1 AND 10),
          intent_signals TEXT[],
          budget_min INTEGER,
          budget_max INTEGER,
          location VARCHAR(255),
          property_type VARCHAR(100),
          timeline VARCHAR(100),
          qualification_score DECIMAL(3,2) DEFAULT 0.0,
          status VARCHAR(50) DEFAULT 'new',
          assigned_agent VARCHAR(100),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create interactions table
      await client.query(`
        CREATE TABLE IF NOT EXISTS interactions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
          agent_id VARCHAR(100) NOT NULL,
          type VARCHAR(20) NOT NULL CHECK (type IN ('call', 'sms', 'email', 'whatsapp')),
          direction VARCHAR(10) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
          content TEXT,
          outcome_status VARCHAR(20) DEFAULT 'pending',
          appointment_booked BOOLEAN DEFAULT FALSE,
          qualification_updated BOOLEAN DEFAULT FALSE,
          escalation_required BOOLEAN DEFAULT FALSE,
          duration_seconds INTEGER,
          sentiment_score DECIMAL(3,2),
          next_action TEXT,
          next_action_scheduled_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create agent_performance table
      await client.query(`
        CREATE TABLE IF NOT EXISTS agent_performance (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          agent_id VARCHAR(100) NOT NULL,
          period_start DATE NOT NULL,
          period_end DATE NOT NULL,
          total_interactions INTEGER DEFAULT 0,
          conversion_rate DECIMAL(5,4) DEFAULT 0.0,
          average_response_time_ms INTEGER DEFAULT 0,
          appointment_booking_rate DECIMAL(5,4) DEFAULT 0.0,
          customer_satisfaction_score DECIMAL(3,2) DEFAULT 0.0,
          script_performance JSONB,
          optimization_suggestions TEXT[],
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(agent_id, period_start, period_end)
        )
      `);

      // Create audit_logs table for comprehensive audit trail
      await client.query(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('lead', 'interaction', 'sync')),
          entity_id VARCHAR(255) NOT NULL,
          action VARCHAR(50) NOT NULL CHECK (action IN ('create', 'update', 'delete', 'sync')),
          changes JSONB NOT NULL,
          user_id VARCHAR(100),
          agent_id VARCHAR(100) NOT NULL,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          metadata JSONB DEFAULT '{}'::jsonb
        )
      `);

      // Create indexes for better performance
      await client.query(
        "CREATE INDEX IF NOT EXISTS idx_leads_source ON leads(source)"
      );
      await client.query(
        "CREATE INDEX IF NOT EXISTS idx_leads_type ON leads(lead_type)"
      );
      await client.query(
        "CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status)"
      );
      await client.query(
        "CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at)"
      );
      await client.query(
        "CREATE INDEX IF NOT EXISTS idx_interactions_lead_id ON interactions(lead_id)"
      );
      await client.query(
        "CREATE INDEX IF NOT EXISTS idx_interactions_agent_id ON interactions(agent_id)"
      );
      await client.query(
        "CREATE INDEX IF NOT EXISTS idx_interactions_created_at ON interactions(created_at)"
      );
      await client.query(
        "CREATE INDEX IF NOT EXISTS idx_agent_performance_agent_id ON agent_performance(agent_id)"
      );
      await client.query(
        "CREATE INDEX IF NOT EXISTS idx_agent_performance_period ON agent_performance(period_start, period_end)"
      );
      await client.query(
        "CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id)"
      );
      await client.query(
        "CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp)"
      );
      await client.query(
        "CREATE INDEX IF NOT EXISTS idx_audit_logs_agent_id ON audit_logs(agent_id)"
      );

      // Create updated_at trigger function
      await client.query(`
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
        END;
        $$ language 'plpgsql'
      `);

      // Create trigger for leads table
      await client.query(`
        DROP TRIGGER IF EXISTS update_leads_updated_at ON leads;
        CREATE TRIGGER update_leads_updated_at
          BEFORE UPDATE ON leads
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column()
      `);

      await client.query("COMMIT");
      logger.info("Database schema created successfully");
    } catch (error) {
      await client.query("ROLLBACK");
      logger.error("Schema creation failed:", error);
      throw error;
    } finally {
      client.release();
    }
  }
}
