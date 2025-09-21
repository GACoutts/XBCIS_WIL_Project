

import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

import { sendMail } from './notify.js'; //  transporter

console.log('SMTP_HOST:', process.env.SMTP_HOST);

dotenv.config();

async function testEmail() {
  try {
    const testUserEmail = ''; // change to your email
    const token = '123456abcdef'; // fake token for testing
    const resetUrl = `${process.env.APP_URL}/reset-password?token=${token}`;
    const TTL_MIN = process.env.RESET_TOKEN_TTL_MIN || 30;

    await sendMail({
      to: testUserEmail,
      subject: 'Test: Reset your Rawson password',
      html: `
        <p>This is a test password reset email.</p>
        <p><a href="${resetUrl}">Click here to reset your password</a></p>
        <p>This link would expire in ${TTL_MIN} minutes.</p>
      `
    });

    console.log('Test password reset email sent successfully!');
  } catch (err) {
    console.error('Error sending test email:', err);
  }
}

testEmail();

console.log('SMTP_HOST:', process.env.SMTP_HOST);

