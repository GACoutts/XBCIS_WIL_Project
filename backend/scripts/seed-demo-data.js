import 'dotenv/config';
import bcrypt from 'bcrypt';
import pool from '../db.js';

const DEMO_USERS = [
  {
    fullName: 'John Client',
    email: 'client@demo.com',
    password: 'demo123',
    phone: '+27123456789',
    role: 'Client'
  },
  {
    fullName: 'Sarah Staff',
    email: 'staff@demo.com',
    password: 'demo123',
    phone: '+27123456790',
    role: 'Staff'
  },
  {
    fullName: 'Mike Contractor',
    email: 'contractor@demo.com',
    password: 'demo123',
    phone: '+27123456791',
    role: 'Contractor'
  },
  {
    fullName: 'Lisa Landlord',
    email: 'landlord@demo.com',
    password: 'demo123',
    phone: '+27123456792',
    role: 'Landlord'
  }
];

const DEMO_TICKETS = [
  {
    description: 'Kitchen tap is leaking continuously',
    urgencyLevel: 'High',
    clientEmail: 'client@demo.com'
  },
  {
    description: 'Air conditioning not working in bedroom',
    urgencyLevel: 'Medium',
    clientEmail: 'client@demo.com'
  },
  {
    description: 'Broken tile in bathroom floor',
    urgencyLevel: 'Low',
    clientEmail: 'client@demo.com'
  }
];

async function clearExistingDemoData() {
  console.log('🗑️ Clearing existing demo data...');
  
  try {
    // Delete demo users and their associated data (cascading)
    const demoEmails = DEMO_USERS.map(u => u.email);
    const placeholders = demoEmails.map(() => '?').join(',');
    
    await pool.execute(
      `DELETE FROM tblusers WHERE Email IN (${placeholders})`,
      demoEmails
    );
    
    console.log('✅ Existing demo data cleared');
  } catch (error) {
    console.log('⚠️ Error clearing data (this is normal if no existing data):', error.message);
  }
}

async function createDemoUsers() {
  console.log('👥 Creating demo users...');
  
  const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
  
  for (const user of DEMO_USERS) {
    try {
      const hashedPassword = await bcrypt.hash(user.password, rounds);
      
      const [result] = await pool.execute(
        'INSERT INTO tblusers (FullName, Email, PasswordHash, Phone, Role, Status) VALUES (?, ?, ?, ?, ?, ?)',
        [user.fullName, user.email, hashedPassword, user.phone, user.role, 'Active']
      );
      
      console.log(`✅ Created ${user.role}: ${user.email} (ID: ${result.insertId})`);
    } catch (error) {
      console.error(`❌ Failed to create user ${user.email}:`, error.message);
    }
  }
}

async function createDemoTickets() {
  console.log('🎫 Creating demo tickets...');
  
  // Get client user ID
  const [clientRows] = await pool.execute(
    'SELECT UserID FROM tblusers WHERE Email = ? AND Role = ?',
    ['client@demo.com', 'Client']
  );
  
  if (!clientRows.length) {
    console.error('❌ Client user not found, cannot create tickets');
    return;
  }
  
  const clientId = clientRows[0].UserID;
  
  for (let i = 0; i < DEMO_TICKETS.length; i++) {
    const ticket = DEMO_TICKETS[i];
    const ticketRefNumber = `DEMO-${Date.now()}-${i + 1}`;
    
    try {
      const [result] = await pool.execute(
        'INSERT INTO tblTickets (ClientUserID, TicketRefNumber, Description, UrgencyLevel, CreatedAt, CurrentStatus) VALUES (?, ?, ?, ?, NOW(), ?)',
        [clientId, ticketRefNumber, ticket.description, ticket.urgencyLevel, 'New']
      );
      
      console.log(`✅ Created ticket: ${ticketRefNumber} (ID: ${result.insertId})`);
      
      // Add status history
      await pool.execute(
        'INSERT INTO tblTicketStatusHistory (TicketID, Status, UpdatedByUserID, UpdatedAt) VALUES (?, ?, ?, NOW())',
        [result.insertId, 'New', clientId]
      );
      
    } catch (error) {
      console.error(`❌ Failed to create ticket:`, error.message);
    }
  }
}

async function createDemoQuotes() {
  console.log('💰 Creating demo quotes...');
  
  // Get contractor and tickets
  const [contractorRows] = await pool.execute(
    'SELECT UserID FROM tblusers WHERE Email = ? AND Role = ?',
    ['contractor@demo.com', 'Contractor']
  );
  
  const [ticketRows] = await pool.execute(
    'SELECT TicketID FROM tblTickets WHERE TicketRefNumber LIKE ?',
    ['DEMO-%']
  );
  
  if (!contractorRows.length || !ticketRows.length) {
    console.log('⚠️ No contractor or tickets found for quotes');
    return;
  }
  
  const contractorId = contractorRows[0].UserID;
  
  // Create quotes for first two tickets
  const quotes = [
    { amount: 450.00, description: 'Replace kitchen tap and check plumbing connections' },
    { amount: 1200.00, description: 'Service air conditioning unit and replace filters' }
  ];
  
  for (let i = 0; i < Math.min(quotes.length, ticketRows.length); i++) {
    try {
      const [result] = await pool.execute(
        'INSERT INTO tblQuotes (TicketID, ContractorUserID, QuoteAmount, QuoteDescription, SubmittedAt, QuoteStatus) VALUES (?, ?, ?, ?, NOW(), ?)',
        [ticketRows[i].TicketID, contractorId, quotes[i].amount, quotes[i].description, 'Pending']
      );
      
      console.log(`✅ Created quote: R${quotes[i].amount} for ticket ${ticketRows[i].TicketID}`);
      
      // Update ticket status to 'Awaiting Landlord Approval'
      await pool.execute(
        'UPDATE tblTickets SET CurrentStatus = ? WHERE TicketID = ?',
        ['Awaiting Landlord Approval', ticketRows[i].TicketID]
      );
      
      // Add status history
      await pool.execute(
        'INSERT INTO tblTicketStatusHistory (TicketID, Status, UpdatedByUserID, UpdatedAt) VALUES (?, ?, ?, NOW())',
        [ticketRows[i].TicketID, 'Awaiting Landlord Approval', contractorId]
      );
      
    } catch (error) {
      console.error(`❌ Failed to create quote:`, error.message);
    }
  }
}

async function displayDemoCredentials() {
  console.log('\n🔑 DEMO CREDENTIALS FOR PRESENTATION:');
  console.log('=====================================');
  
  DEMO_USERS.forEach(user => {
    console.log(`${user.role.toUpperCase()}:`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Password: ${user.password}`);
    console.log('');
  });
  
  console.log('🌐 DEMO URLs:');
  console.log('  Frontend: http://localhost:5173');
  console.log('  Backend API: http://localhost:5000');
  console.log('  DB Viewer: http://localhost:5000/db-viewer');
  console.log('  Health Check: http://localhost:5000/api/health');
  console.log('');
  
  // Show created data summary
  const [userCount] = await pool.execute('SELECT COUNT(*) as count FROM tblusers WHERE Email LIKE ?', ['%@demo.com']);
  const [ticketCount] = await pool.execute('SELECT COUNT(*) as count FROM tblTickets WHERE TicketRefNumber LIKE ?', ['DEMO-%']);
  const [quoteCount] = await pool.execute('SELECT COUNT(*) as count FROM tblQuotes WHERE TicketID IN (SELECT TicketID FROM tblTickets WHERE TicketRefNumber LIKE ?)', ['DEMO-%']);
  
  console.log('📊 DEMO DATA SUMMARY:');
  console.log(`  Users created: ${userCount[0].count}`);
  console.log(`  Tickets created: ${ticketCount[0].count}`);
  console.log(`  Quotes created: ${quoteCount[0].count}`);
  console.log('');
}

async function seedDemoData() {
  console.log('🌱 Starting demo data seeding...\n');
  
  try {
    await clearExistingDemoData();
    await createDemoUsers();
    await createDemoTickets();
    await createDemoQuotes();
    await displayDemoCredentials();
    
    console.log('🎉 Demo data seeding completed successfully!');
    console.log('\n💡 NEXT STEPS:');
    console.log('1. Start your backend: npm run dev');
    console.log('2. Start your frontend: npm run dev');
    console.log('3. Run integration tests: npm run test:integration');
    console.log('4. Use the credentials above for your demo');
    
  } catch (error) {
    console.error('❌ Demo data seeding failed:', error);
  } finally {
    await pool.end();
  }
}

// Run the seeding
seedDemoData();
