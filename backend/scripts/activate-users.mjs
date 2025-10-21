import "dotenv/config";
import mysql from "mysql2/promise";

const emails = process.argv.slice(2);
if (!emails.length) {
  console.error("Pass emails as args, e.g. node scripts/activate-users.mjs a@x b@x");
  process.exit(1);
}

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "rawson_app"
});

// Build the IN clause placeholders dynamically
const placeholders = emails.map(() => "?").join(",");
await conn.execute(
  `UPDATE tblusers SET Status='Active' WHERE Email IN (${placeholders})`,
  emails
);

const [rows] = await conn.query(
  `SELECT Email, Role, Status FROM tblusers WHERE Email IN (${placeholders})`,
  emails
);
console.log(rows);
process.exit(0);
