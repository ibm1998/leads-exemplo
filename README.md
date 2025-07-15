# Agentic Lead Management System

An autonomous AI team system designed to function as a complete sales, customer service, and marketing organization for real estate businesses.

## Project Structure

```
src/
├── config/           # Environment configuration and validation
├── database/         # Database management, migrations, and seeding
├── types/           # TypeScript type definitions and schemas
├── utils/           # Utility functions (logging, etc.)
└── index.ts         # Main application entry point
```

## Setup

1. **Install Dependencies**

   ```bash
   npm install
   ```

2. **Environment Configuration**

   ```bash
   cp .env.example .env
   # Edit .env with your database and service credentials
   ```

3. **Database Setup**

   - Ensure PostgreSQL is running
   - Ensure Redis is running
   - Run migrations:

   ```bash
   npm run db:migrate
   ```

4. **Seed Sample Data** (optional)
   ```bash
   npm run db:seed
   ```

## Development

- **Build**: `npm run build`
- **Development**: `npm run dev`
- **Test**: `npm test`
- **Test Watch**: `npm run test:watch`

## Database Schema

### Tables Created:

- **leads**: Core lead information with contact details and qualification data
- **interactions**: All agent-lead interactions with outcomes and sentiment
- **agent_performance**: Performance metrics and optimization data
- **migrations**: Database migration tracking

### Key Features:

- UUID primary keys for all entities
- Comprehensive indexing for performance
- Automatic timestamp management
- Data validation constraints
- Foreign key relationships

## Configuration

The system uses environment variables for configuration with validation via Zod schemas:

- Database connection settings
- Redis configuration
- API keys for external services
- System performance parameters
- Logging configuration

## Requirements Addressed

- **Requirement 9.1**: CRM integration foundation with PostgreSQL schema
- **Requirement 12.1**: Basic configuration management and environment setup
- **Requirement 12.4**: Data validation and error handling infrastructure

## Next Steps

This foundation provides:

- ✅ TypeScript project structure
- ✅ Database schema for leads, interactions, and performance data
- ✅ Configuration management with validation
- ✅ Logging infrastructure
- ✅ Basic testing setup
- ✅ Migration and seeding utilities

Ready for implementing core data models and validation (Task 2).
