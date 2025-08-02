import { Pool } from 'pg';
import { config } from '../config';

const pool = new Pool({
  connectionString: config.databaseUrl,
});

async function seed() {
  console.log('Starting database seed...');
  
  try {
    // Insert sample leads
    const leadResult = await pool.query(`
      INSERT INTO leads (name, email, phone, source, status)
      VALUES 
        ('João Silva', 'joao.silva@example.com', '(11) 98765-4321', 'website', 'new'),
        ('Maria Oliveira', 'maria.oliveira@example.com', '(21) 91234-5678', 'referral', 'contacted'),
        ('Carlos Santos', 'carlos.santos@example.com', '(31) 99876-5432', 'social_media', 'qualified'),
        ('Ana Pereira', 'ana.pereira@example.com', '(41) 98765-1234', 'website', 'new')
      RETURNING id;
    `);

    const leadIds = leadResult.rows.map(row => row.id);

    // Insert sample interactions
    await pool.query(`
      INSERT INTO interactions (lead_id, type, channel, content)
      VALUES 
        ($1, 'message', 'email', 'Primeiro contato sobre imóvel'),
        ($1, 'message', 'whatsapp', 'Agendamento de visita'),
        ($2, 'message', 'email', 'Informações sobre financiamento'),
        ($3, 'call', 'phone', 'Ligação para esclarecer dúvidas'),
        ($4, 'message', 'email', 'Solicitação de mais informações');
    `, [leadIds[0]]);

    // Insert sample appointments
    await pool.query(`
      INSERT INTO appointments (lead_id, date, status, notes)
      VALUES 
        ($1, NOW() + INTERVAL '2 days', 'scheduled', 'Visita ao imóvel na Rua das Flores'),
        ($2, NOW() + INTERVAL '3 days', 'scheduled', 'Reunião para discutir financiamento'),
        ($3, NOW() + INTERVAL '1 day', 'completed', 'Visita já realizada, cliente interessado');
    `, [leadIds[0]]);

    console.log('Seed completed successfully!');
  } catch (error) {
    console.error('Error during seed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run seed if this file is executed directly
if (require.main === module) {
  seed()
    .then(() => {
      console.log('Seed completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seed failed:', error);
      process.exit(1);
    });
}

export { seed };