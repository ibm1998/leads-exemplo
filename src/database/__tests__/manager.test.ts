import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { DatabaseManager } from "../manager";

// Mock the config and logger
vi.mock("../../config/environment", () => ({
  config: {
    DATABASE_HOST: "localhost",
    DATABASE_PORT: 5432,
    DATABASE_NAME: "test_db",
    DATABASE_USER: "test_user",
    DATABASE_PASSWORD: "test_password",
    REDIS_URL: "redis://localhost:6379",
  },
}));

vi.mock("../../utils/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock pg and redis
vi.mock("pg", () => ({
  Pool: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue({
      query: vi.fn().mockResolvedValue({ rows: [] }),
      release: vi.fn(),
    }),
    end: vi.fn().mockResolvedValue(undefined),
    query: vi.fn().mockResolvedValue({ rows: [] }),
  })),
}));

vi.mock("redis", () => ({
  createClient: vi.fn().mockReturnValue({
    connect: vi.fn().mockResolvedValue(undefined),
    quit: vi.fn().mockResolvedValue(undefined),
  }),
}));

describe("DatabaseManager", () => {
  let dbManager: DatabaseManager;

  beforeAll(() => {
    dbManager = new DatabaseManager();
  });

  describe("Schema Creation", () => {
    it("should create all required tables including audit_logs", async () => {
      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
        release: vi.fn(),
      };

      const mockPool = {
        connect: vi.fn().mockResolvedValue(mockClient),
        end: vi.fn(),
      };

      (dbManager as any).pgPool = mockPool;

      // Mock the migration check to trigger schema creation
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // Create migrations table
        .mockResolvedValueOnce({ rows: [] }) // Check if migration exists
        .mockResolvedValueOnce(undefined) // BEGIN transaction
        .mockResolvedValueOnce(undefined) // Create leads table
        .mockResolvedValueOnce(undefined) // Create interactions table
        .mockResolvedValueOnce(undefined) // Create agent_performance table
        .mockResolvedValueOnce(undefined) // Create audit_logs table
        .mockResolvedValueOnce(undefined) // Create indexes
        .mockResolvedValueOnce(undefined) // Create trigger function
        .mockResolvedValueOnce(undefined) // Create trigger
        .mockResolvedValueOnce(undefined) // COMMIT transaction
        .mockResolvedValueOnce({ rows: [] }); // Insert migration record

      await dbManager.initialize();

      // Verify that audit_logs table creation was called
      const auditLogsTableCall = mockClient.query.mock.calls.find((call) =>
        call[0].includes("CREATE TABLE IF NOT EXISTS audit_logs")
      );

      expect(auditLogsTableCall).toBeDefined();
      expect(auditLogsTableCall[0]).toContain(
        "entity_type VARCHAR(50) NOT NULL"
      );
      expect(auditLogsTableCall[0]).toContain(
        "entity_id VARCHAR(255) NOT NULL"
      );
      expect(auditLogsTableCall[0]).toContain("action VARCHAR(50) NOT NULL");
      expect(auditLogsTableCall[0]).toContain("changes JSONB NOT NULL");
      expect(auditLogsTableCall[0]).toContain("agent_id VARCHAR(100) NOT NULL");

      // Verify audit_logs indexes were created
      const auditLogsIndexCalls = mockClient.query.mock.calls.filter((call) =>
        call[0].includes("idx_audit_logs")
      );

      expect(auditLogsIndexCalls.length).toBe(3); // Three audit_logs indexes
    });

    it("should create proper constraints for audit_logs table", async () => {
      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
        release: vi.fn(),
      };

      const mockPool = {
        connect: vi.fn().mockResolvedValue(mockClient),
        end: vi.fn(),
      };

      (dbManager as any).pgPool = mockPool;

      // Mock the migration to trigger schema creation
      mockClient.query.mockResolvedValue({ rows: [] });

      await dbManager.initialize();

      // Find the audit_logs table creation call
      const auditLogsTableCall = mockClient.query.mock.calls.find((call) =>
        call[0].includes("CREATE TABLE IF NOT EXISTS audit_logs")
      );

      expect(auditLogsTableCall).toBeDefined();

      // Verify CHECK constraints
      expect(auditLogsTableCall[0]).toContain(
        "CHECK (entity_type IN ('lead', 'interaction', 'sync'))"
      );
      expect(auditLogsTableCall[0]).toContain(
        "CHECK (action IN ('create', 'update', 'delete', 'sync'))"
      );

      // Verify JSONB columns
      expect(auditLogsTableCall[0]).toContain("changes JSONB NOT NULL");
      expect(auditLogsTableCall[0]).toContain(
        "metadata JSONB DEFAULT '{}'::jsonb"
      );
    });
  });

  describe("Database Operations", () => {
    it("should provide query method", () => {
      expect(typeof dbManager.query).toBe("function");
    });

    it("should provide connection getters", () => {
      expect(typeof dbManager.getPostgresPool).toBe("function");
      expect(typeof dbManager.getRedisClient).toBe("function");
    });

    it("should provide close method", () => {
      expect(typeof dbManager.close).toBe("function");
    });
  });
});
