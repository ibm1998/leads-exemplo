import { describe, it, expect } from 'vitest';
import { config } from './environment';

describe('Environment Configuration', () => {
  it('should load default configuration values', () => {
    expect(config.NODE_ENV).toBeDefined();
    expect(config.PORT).toBe(3000);
    expect(config.DATABASE_HOST).toBe('localhost');
    expect(config.DATABASE_PORT).toBe(5432);
    expect(config.LOG_LEVEL).toBe('info');
    expect(config.MAX_RETRY_ATTEMPTS).toBe(3);
    expect(config.RESPONSE_TIMEOUT_MS).toBe(60000);
  });

  it('should have valid database configuration', () => {
    expect(config.DATABASE_NAME).toBe('agentic_leads');
    expect(config.DATABASE_USER).toBe('postgres');
    expect(config.REDIS_HOST).toBe('localhost');
    expect(config.REDIS_PORT).toBe(6379);
  });
});
