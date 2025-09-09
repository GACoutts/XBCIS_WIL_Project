#!/usr/bin/env node
import pool from '../db.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function createPasswordResetTable() {
  try {
    console.log('Creating password reset table...');
    
    const sqlFilePath = join(__dirname, '..', '..', 'database', 'sql', '16-password-reset-function-table.sql');
    const sqlContent = readFileSync(sqlFilePath, 'utf8');
    
    await pool.execute(sqlContent);
    console.log('✅ Password reset table created successfully!');
    
    // Verify table was created
    const [tables] = await pool.execute("SHOW TABLES LIKE 'tblPasswordResetTokens'");
    if (tables.length > 0) {
      console.log('✅ Table verification: tblPasswordResetTokens exists');
    } else {
      console.log('❌ Table verification failed');
    }
    
  } catch (error) {
    console.error('❌ Error creating password reset table:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

createPasswordResetTable();
