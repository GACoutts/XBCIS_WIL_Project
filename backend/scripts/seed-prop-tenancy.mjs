import "dotenv/config";
import mysql from "mysql2/promise";

const [landlordEmail, clientEmail, address = "23 Apple Road, Benoni", propRef = "PROP-AUTO"] = process.argv.slice(2);
if (!landlordEmail || !clientEmail) { 
  console.error("Usage: node scripts/seed-prop-tenancy.mjs <landlordEmail> <clientEmail> [address] [propertyRef]");
  process.exit(1);
}

const db = await mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "Rawson"
});

// find users
const [L] = await db.query(`SELECT UserID FROM tblusers WHERE Email=? LIMIT 1`, [landlordEmail]);
const [C] = await db.query(`SELECT UserID FROM tblusers WHERE Email=? LIMIT 1`, [clientEmail]);
if (!L.length || !C.length) { console.error("Landlord or Client not found"); process.exit(2); }
const LandlordUserID = L[0].UserID, TenantUserID = C[0].UserID;

// create or fetch property
await db.query(
  `INSERT INTO tblProperties (PropertyRef, AddressLine1, City, Province)
   VALUES (?, ?, 'Benoni', 'Gauteng')
   ON DUPLICATE KEY UPDATE AddressLine1=VALUES(AddressLine1)`,
  [propRef, address]
);
const [P] = await db.query(`SELECT PropertyID FROM tblProperties WHERE PropertyRef=? LIMIT 1`, [propRef]);
const PropertyID = P[0].PropertyID;

// map landlord
await db.query(
  `INSERT INTO tblLandlordProperties (LandlordUserID, PropertyID, ActiveFrom, IsPrimary)
   VALUES (?, ?, CURDATE(), 1)
   ON DUPLICATE KEY UPDATE ActiveTo=NULL`,
  [LandlordUserID, PropertyID]
);

// create tenancy (client to property)
await db.query(
  `INSERT INTO tblTenancies (PropertyID, TenantUserID, StartDate, IsActive)
   VALUES (?, ?, CURDATE(), 1)`,
  [PropertyID, TenantUserID]
);

console.log({ PropertyID, LandlordUserID, TenantUserID });
process.exit(0);
