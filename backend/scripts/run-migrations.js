import 'dotenv/config';
import pool from '../db.js';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  console.log('🗄️  Running database migrations for session system...\n');

  const migrations = [
    '09-create-refresh-tokens.sql',
    '10-create-audit-logs.sql',
    '11-create-revoked-access-jtis.sql'
  ];

  try {
    for (const migrationFile of migrations) {
      console.log(`📄 Running: ${migrationFile}`);
      
      const migrationPath = path.join(__dirname, '..', '..', 'database', 'sql', migrationFile);
      const migrationSQL = readFileSync(migrationPath, 'utf-8');
      
      // Split by semicolons and filter out empty statements
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s && !s.startsWith('--') && s !== 'USE Rawson');

      for (const statement of statements) {
        if (statement.trim()) {
          try {
            await pool.execute(statement);
          } catch (error) {
            // Ignore "table already exists" errors
            if (!error.message.includes('already exists')) {
              throw error;
            }
          }
        }
      }
      
      console.log(`✅ ${migrationFile} completed successfully`);
    }

    console.log('\n🎉 All migrations completed successfully!');
    
    // Test the tables
    console.log('\n🔍 Verifying tables...');
    const [tables] = await pool.query("SHOW TABLES LIKE 'tbl%Tokens' OR SHOW TABLES LIKE 'tblAuditLogs' OR SHOW TABLES LIKE 'tblRevoked%'");
    
    for (const table of tables) {
      const tableName = Object.values(table)[0];
      console.log(`✓ Table exists: ${tableName}`);
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
    console.log('\n📝 Database connection closed.');
  }
}

runMigrations();
