require("dotenv").config();
const mysql = require("mysql2/promise");

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "rawson_app"
  });
  const emails = process.argv.slice(2);
  if (!emails.length) {
    console.error("Pass emails as args, e.g. node scripts/activate-users.js a@x b@x");
    process.exit(1);
  }
  await conn.execute("UPDATE tblusers SET Status='Active' WHERE Email IN (" + emails.map(()=>"?").join(",") + ")", emails);
  const [rows] = await conn.query("SELECT Email, Role, Status FROM tblusers WHERE Email IN (" + emails.map(()=>"?").join(",") + ")", emails);
  console.log(rows);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
