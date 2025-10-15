import "dotenv/config";
import mysql from "mysql2/promise";

const [quoteId, ticketId] = process.argv.slice(2).map(x => parseInt(x,10));
if (!quoteId || !ticketId) {
  console.error("Usage: node scripts/approve-quote.mjs <QuoteID> <TicketID>");
  process.exit(1);
}

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "rawson_app"
});

// Try common column patterns safely:
try { await conn.execute("UPDATE tblquotes SET Status='Approved' WHERE QuoteID=?", [quoteId]); } catch {}
try { await conn.execute("UPDATE tblquotes SET Approved=1 WHERE QuoteID=?", [quoteId]); } catch {}

await conn.execute("UPDATE tbltickets SET CurrentStatus='Approved' WHERE TicketID=?", [ticketId]);

const [q] = await conn.execute("SELECT QuoteID, Status, Approved FROM tblquotes WHERE QuoteID=?", [quoteId]);
const [t] = await conn.execute("SELECT TicketID, CurrentStatus FROM tbltickets WHERE TicketID=?", [ticketId]);
console.log({ quote: q[0], ticket: t[0] });
process.exit(0);
