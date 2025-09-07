import 'dotenv/config';
import mysql from 'mysql2/promise';

const {
  DB_HOST = '127.0.0.1',
  DB_PORT = '3306',
  DB_USER,
  DB_PASSWORD,
  DB_NAME
} = process.env;

if (!DB_USER || DB_PASSWORD === undefined || !DB_NAME) {
  console.error('Database environment variables missing. Check your .env file.');
  console.error('Required: DB_USER, DB_PASSWORD (can be empty), DB_NAME');
  process.exit(1);
}

const pool = mysql.createPool({
  host: '127.0.0.1',
  port: Number(DB_PORT),
  user: 'rawson_local',
  password: 'Ppottie987!',
  database: 'Rawson',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: undefined
});

// Health check function to verify database connectivity
export async function dbHealth() {
  try {
    const [rows] = await pool.query('SELECT 1 AS ok');
    return rows[0]?.ok === 1;
  } catch (error) {
    console.error('Database health check failed:', error.message);
    return false;
  }
}

// Test connection on module load
pool.getConnection()
  .then(connection => {
    console.log('✓ Database connection established successfully');
    connection.release();
  })
  .catch(error => {
    console.error('✗ Failed to connect to database:', error.message);
  });

export default pool;
