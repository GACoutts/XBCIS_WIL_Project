import 'dotenv/config';
import pool from '../db.js';

async function verifyTables() {
  try {
    console.log('🔍 Verifying session system tables...\n');
    
    const connection = await pool.getConnection();
    
    const tables = ['tblRefreshTokens', 'tblAuditLogs', 'tblRevokedAccessJti'];
    
    for (const tableName of tables) {
      try {
        const [rows] = await connection.query(`DESCRIBE ${tableName}`);
        console.log(`✅ ${tableName} exists with ${rows.length} columns`);
        rows.forEach(row => console.log(`   - ${row.Field} (${row.Type})`));
        console.log('');
      } catch (error) {
        console.log(`❌ ${tableName} does not exist or has errors:`, error.message);
      }
    }
    
    connection.release();
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
  } finally {
    await pool.end();
  }
}

verifyTables();
