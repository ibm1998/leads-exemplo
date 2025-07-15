# 🤖 Agentic Lead Management System

> An autonomous AI team system that functions as a complete sales, customer service, and marketing organization for real estate businesses.

## 🎯 Overview

This system creates an **autonomous AI team** with specialized agents that manage the entire customer journey - from lead capture to post-sale retention - while continuously optimizing performance through machine learning feedback loops.

### Key Capabilities

- **⚡ 60-Second Response Time** - Virtual Sales Assistant calls hot leads within 60 seconds
- **🧠 Intelligent Routing** - AI Head Agent analyzes and routes leads to specialized workflows
- **🔄 Continuous Optimization** - System learns and improves conversion rates automatically
- **📞 Multi-Channel Communication** - Voice, SMS, Email, WhatsApp integration
- **📊 Deep CRM Integration** - Real-time GoHighLevel synchronization
- **🎯 Specialized AI Agents** - Each agent handles specific aspects of the customer journey

## 🏗️ System Architecture

### Command Structure

- **Chief Agent** - System overseer and human interface
- **AI Head Agent** - Operational manager and lead dispatcher

### Specialized Agents

- **Virtual Sales Assistant** - Voice qualification and appointment booking
- **Customer Retention Agent** - Re-engagement of inactive customers
- **Review & Feedback Collector** - Post-sale feedback and reputation management
- **Lead Generation Agent** - Cold/warm lead outreach
- **Appointment Coordinator** - Complex workflow and booking management
- **CRM Management Agent** - Data synchronization and pipeline management
- **Customer Analytics Agent** - Performance tracking and optimization insights

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis 6+
- GoHighLevel API access

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd agentic-lead-management

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys and configuration

# Set up database
npm run db:migrate
npm run db:seed

# Start development server
npm run dev
```

## 🛠️ Tech Stack

| Component         | Technology                          |
| ----------------- | ----------------------------------- |
| **Runtime**       | Node.js + TypeScript                |
| **Database**      | PostgreSQL + Redis                  |
| **CRM**           | GoHighLevel API                     |
| **Orchestration** | n8n Workflows                       |
| **Voice AI**      | ElevenLabs                          |
| **Communication** | Twilio, SendGrid, WhatsApp Business |
| **Testing**       | Vitest                              |
| **Deployment**    | Docker + CI/CD                      |

## 📁 Project Structure

```
src/
├── config/              # Environment configuration
├── database/            # Database management & migrations
├── integrations/        # External service integrations
│   └── gohighlevel/    # GoHighLevel CRM integration
├── types/              # TypeScript definitions
├── utils/              # Shared utilities
└── index.ts            # Application entry point

.kiro/specs/agentic-lead-management/
├── requirements.md     # Detailed system requirements
├── design.md          # Technical architecture design
└── tasks.md           # Implementation task breakdown
```

## 🔧 Development Commands

```bash
npm run dev          # Start development server with hot reload
npm run build        # Build for production
npm run test         # Run test suite
npm run test:watch   # Run tests in watch mode
npm run db:migrate   # Run database migrations
npm run db:seed      # Seed initial data
```

## 🎯 Implementation Roadmap

The system is built through 20 carefully sequenced tasks:

1. **Foundation** (Tasks 1-6) - Core infrastructure and AI Head Agent
2. **Specialized Agents** (Tasks 7-11) - Voice AI, retention, outbound processing
3. **Support Systems** (Tasks 12-14) - CRM management and analytics
4. **Integration** (Tasks 15-20) - Communication channels and deployment

See [tasks.md](.kiro/specs/agentic-lead-management/tasks.md) for detailed implementation plan.

## 🔐 Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/agentic_leads
REDIS_URL=redis://localhost:6379

# GoHighLevel CRM
GHL_API_KEY=your_ghl_api_key
GHL_BASE_URL=https://rest.gohighlevel.com/v1

# Voice AI
ELEVENLABS_API_KEY=your_elevenlabs_key

# Communication
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
SENDGRID_API_KEY=your_sendgrid_key
WHATSAPP_TOKEN=your_whatsapp_token

# n8n Orchestration
N8N_WEBHOOK_URL=your_n8n_webhook_url
```

## 📊 Key Features

### Inbound Workflows

- **Hot Lead Processing** - Immediate voice qualification within 60 seconds
- **Customer Re-engagement** - Automated outreach to inactive customers (60+ days)
- **Post-Sale Feedback** - Review collection and issue escalation

### Outbound Workflows

- **Cold Lead Follow-up** - Personalized sequences for non-responsive leads
- **Campaign Outreach** - Automated promotion and event marketing
- **Warm Lead Re-engagement** - Context-aware follow-ups based on history

### Optimization Engine

- **Performance Analytics** - Conversion rates, script effectiveness, timing optimization
- **Automatic Adjustments** - Self-improving routing rules and agent scripts
- **A/B Testing** - Continuous optimization of messaging and timing

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific test suites
npm test -- --grep "GoHighLevel"
npm test -- --grep "Lead Processing"

# Run tests with coverage
npm test -- --coverage
```

## 🚀 Deployment

The system supports containerized deployment:

```bash
# Build Docker image
docker build -t agentic-lead-management .

# Run with docker-compose
docker-compose up -d
```

## 📈 Monitoring

- **Real-time Dashboards** - Agent performance and system health
- **Automated Alerts** - Critical failure notifications
- **Performance Metrics** - Conversion tracking and optimization insights

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For questions about implementation or deployment, please refer to:

- [Requirements Document](.kiro/specs/agentic-lead-management/requirements.md)
- [Design Document](.kiro/specs/agentic-lead-management/design.md)
- [Implementation Tasks](.kiro/specs/agentic-lead-management/tasks.md)

---

**Built with ❤️ for autonomous AI-driven business growth**
