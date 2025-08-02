// Configuration settings for the API

interface Config {
  port: number;
  databaseUrl: string;
  environment: 'development' | 'test' | 'production';
  logLevel: string;
}

const config: Config = {
  port: parseInt(process.env.PORT || '4000', 10),
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/lead_management',
  environment: (process.env.NODE_ENV as 'development' | 'test' | 'production') || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
};

export { config, Config };