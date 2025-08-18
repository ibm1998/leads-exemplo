// src/index.ts
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response } from 'express';
import cors from 'cors';

import { config } from './config/environment';
import { logger } from './utils/logger';
import { DatabaseManager } from './database/manager';

async function main() {
  logger.info('Starting Agentic Lead Management System');

  // Inicializa o banco
  const dbManager = new DatabaseManager();
  await dbManager.initialize();
  logger.info('Database initialized successfully');

  // Sobe o Express
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Health-check
  app.get('/health', (_req: Request, res: Response) => {
    res.send('OK');
  });

  // Rota de leads
  app.post('/api/leads', async (req: Request, res: Response) => {
    try {
      logger.info('Received payload:', req.body);
      const lead = await dbManager.createLead(req.body);
      return res.status(201).json({ success: true, id: lead.id });
    } catch (err) {
      logger.error('Error saving lead', err as Error);
      return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  });

  const port = config.API_PORT || parseInt(process.env.PORT || '4000', 10);
  app.listen(port, () => {
    logger.info(`API listening on http://localhost:${port}`);
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    logger.info('Shutting down gracefully...');
    await dbManager.close();
    process.exit(0);
  });
}

main().catch(err => {
  console.error('Fatal error on startup:', err);
  process.exit(1);
});
