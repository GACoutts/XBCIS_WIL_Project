import nodemailer from 'nodemailer';

async function createTestAccount() {
  try {
    console.log('Creating test email account...');
    
    // Create a test account with Ethereal Email
    const testAccount = await nodemailer.createTestAccount();
    
    console.log('\n✅ Test email account created successfully!');
    console.log('\n📧 Add these to your .env file:');
    console.log(`SMTP_HOST=${testAccount.smtp.host}`);
    console.log(`SMTP_PORT=${testAccount.smtp.port}`);
    console.log(`SMTP_USER=${testAccount.user}`);
    console.log(`SMTP_PASS=${testAccount.pass}`);
    console.log(`SMTP_FROM=no-reply@rawson.local`);
    
    console.log('\n🔗 You can view sent emails at:');
    console.log('https://ethereal.email/login');
    console.log(`Username: ${testAccount.user}`);
    console.log(`Password: ${testAccount.pass}`);
    
  } catch (error) {
    console.error('❌ Error creating test account:', error.message);
    process.exit(1);
  }
}

createTestAccount();
