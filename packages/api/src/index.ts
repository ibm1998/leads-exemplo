// src/index.ts

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config } from './config';

const app = express();
const PORT = config.port;

// ---------------------------
// Middlewares
// ---------------------------
app.use(
  cors({
    origin: [
      'http://localhost:5678',              // n8n UI
      'http://host.docker.internal:5678',   // n8n Docker container
    ],
  })
);
app.use(express.json());
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// ---------------------------
// Healthcheck / Root
// ---------------------------
app.get('/', (_req: Request, res: Response) => {
  res.json({ message: 'Agentic Lead Management API está no ar!' });
});

// ---------------------------
// Mock de Leads em memória
// ---------------------------
interface Lead {
  id: number
  name: string
  email: string
  status: 'new' | 'contacted' | 'qualified'
}

let leads: Lead[] = [
  { id: 1, name: 'João Silva',    email: 'joao.silva@example.com',    status: 'new' },
  { id: 2, name: 'Maria Oliveira', email: 'maria.oliveira@example.com', status: 'contacted' },
];

// ---------------------------
// Rotas de Leads
// ---------------------------

// Listar todos os leads
app.get(['/api/leads', '/leads'], (_req: Request, res: Response) => {
  res.json({ leads });
});

// Criar um novo lead (compatível com HTTP Request do n8n)
app.post(['/api/leads', '/leads'], (req: Request, res: Response) => {
  const { name, email } = req.body;

  if (typeof name !== 'string' || typeof email !== 'string') {
    return res
      .status(400)
      .json({ error: 'Campos "name" e "email" são obrigatórios e devem ser strings.' });
  }

  const newLead: Lead = {
    id: Date.now(),
    name,
    email,
    status: 'new',
  };
  leads.push(newLead);

  console.log('Lead criado via n8n:', newLead);
  return res.status(201).json({ message: 'Lead criado com sucesso', lead: newLead });
});

// ---------------------------
// 404 Handler
// ---------------------------
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

// ---------------------------
// Start Server
// ---------------------------
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 API rodando em http://0.0.0.0:${PORT}`);
});
