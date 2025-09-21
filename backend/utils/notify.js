import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' }); // adjust path

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT, 10),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  },
  tls: { rejectUnauthorized: false },
  // Force IPv4 to avoid ::1 issues
  family: 4
});

export async function sendMail({ to, subject, text, html }) {
  const info = await transporter.sendMail({ from: process.env.SMTP_FROM, to, subject, text, html });
  console.log('Email sent:', info.messageId);
  return info;
}
