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

    // Insert sample interactions - usando separate queries para evitar problemas com parâmetros
    for (const [index, leadId] of leadIds.entries()) {
      await pool.query(`
        INSERT INTO interactions (lead_id, type, channel, content)
        VALUES ($1, $2, $3, $4)
      `, [leadId, 'message', 'email', `Interação de teste ${index + 1}`]);
    }

    // Insert sample appointments - usando separate queries
    for (let i = 0; i < 3; i++) {
      await pool.query(`
        INSERT INTO appointments (lead_id, date, status, notes)
        VALUES ($1, NOW() + INTERVAL '${i + 1} days', $2, $3)
      `, [leadIds[i], 'scheduled', `Appointment de teste ${i + 1}`]);
    }

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