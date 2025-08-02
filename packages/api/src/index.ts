import express from 'express';
import cors from 'cors';
import { config } from './config';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Agentic Lead Management API' });
});

// Lead routes
app.get('/api/leads', (req, res) => {
  // This would normally fetch from database
  res.json({
    leads: [
      { id: 1, name: 'João Silva', email: 'joao.silva@example.com', status: 'new' },
      { id: 2, name: 'Maria Oliveira', email: 'maria.oliveira@example.com', status: 'contacted' },
      { id: 3, name: 'Carlos Santos', email: 'carlos.santos@example.com', status: 'qualified' },
    ]
  });
});

// Start server
app.listen(config.port, () => {
  console.log(`API server running on port ${config.port} in ${config.environment} mode`);
});