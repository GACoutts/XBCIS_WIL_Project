import "dotenv/config";
import mysql from "mysql2/promise";

const [ticketId, landlordEmail] = process.argv.slice(2);
if (!ticketId || !landlordEmail) {
  console.error("Usage: node scripts/set-ticket-landlord.mjs <ticketId> <landlordEmail>");
  process.exit(1);
}

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "rawson_app"
});

// Look up landlord user id by email
const [urows] = await conn.execute("SELECT UserID, Role, Status FROM tblusers WHERE Email=? LIMIT 1", [landlordEmail]);
if (!urows.length) {
  console.error("No such landlord email:", landlordEmail);
  process.exit(2);
}
const landlordUserId = urows[0].UserID;

// Attach landlord to ticket
await conn.execute("UPDATE tbltickets SET LandlordUserID = ? WHERE TicketID = ?", [landlordUserId, ticketId]);

// Show confirmation
const [trows] = await conn.execute("SELECT TicketID, LandlordUserID, CurrentStatus FROM tbltickets WHERE TicketID=? LIMIT 1", [ticketId]);
console.log("Updated:", trows[0]);

process.exit(0);
