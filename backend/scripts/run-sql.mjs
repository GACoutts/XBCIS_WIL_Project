import "dotenv/config";
import { readFileSync } from "fs";
import mysql from "mysql2/promise";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/run-sql.mjs <path-to-sql-file>");
  process.exit(1);
}

const sql = readFileSync(file, "utf8");
// split on semicolons at line ends to be safe
const statements = sql.split(/;\s*$/m).map(s => s.trim()).filter(Boolean);

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "Rawson"   // IMPORTANT: must match where your earlier migrations ran
});

for (const s of statements) {
  await conn.query(s);
}
console.log("✅ Ran", file);
process.exit(0);
