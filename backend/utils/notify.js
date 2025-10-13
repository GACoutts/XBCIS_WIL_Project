import 'dotenv/config';

/**
 * Send a WhatsApp template message via the Meta Cloud API.  The
 * template must already be approved in the WhatsApp Business Manager.
 *
 * @param {Object} opts
 * @param {string} opts.to - E.164 formatted phone number
 * @param {string} opts.name - Template name registered in Meta
 * @param {Array} opts.components - Template component array
 * @param {string} [opts.lang='en'] - Language code
 */
async function sendWhatsAppTemplate({ to, name, components, lang = 'en' }) {
  const url = `https://graph.facebook.com/v20.0/${WA_PHONE_ID}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    to: to.replace(/[^+\d]/g, ''),
    type: 'template',
    template: {
      name,
      language: { code: lang },
      components,
    },
  };
  const res = await axios.post(url, payload, {
    headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
  });
  return res.data?.messages?.[0]?.id || null;
}

// Mapping of notification templates to WhatsApp template definitions.
// Each entry provides the WhatsApp template name and a function that
// builds the components array from our params object
const TEMPLATE_MAP = {
  ticket_created: {
    name: 'ticket_created',
    build: (p) => [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: p.ticketRef || '' },
          { type: 'text', text: p.clientName || '' },
          { type: 'text', text: p.urgency || '' },
          { type: 'text', text: (p.description || '').substring(0, 120) },
        ],
      },
    ],
  },
  contractor_assigned: {
    name: 'contractor_assigned',
    build: (p) => [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: p.ticketRef || '' },
        ],
      },
    ],
  },
  quote_status: {
    name: 'quote_status_changed',
    build: (p) => [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: String(p.quoteId || '') },
          { type: 'text', text: p.ticketRef || '' },
          { type: 'text', text: p.status || '' },
        ],
      },
    ],
  },
};
import axios from 'axios';
import nodemailer from 'nodemailer';
import pool from '../db.js';

const bool = (v, d=false)=>['1','true','yes','on'].includes(String(v||'').toLowerCase());
const WA_ENABLED = bool(process.env.WHATSAPP_ENABLE, false);
const WA_PROVIDER= (process.env.WHATSAPP_PROVIDER || 'meta').toLowerCase();
const WA_PHONE_ID= process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const WA_TOKEN   = process.env.WHATSAPP_TOKEN || '';
const WA_CC      = process.env.WHATSAPP_DEFAULT_COUNTRY || '+27';
const BRAND      = process.env.WHATSAPP_FROM_DISPLAY || 'Rawson';

const SMTP_HOST  = process.env.SMTP_HOST || '';
const SMTP_PORT  = parseInt(process.env.SMTP_PORT || '587',10);
const SMTP_USER  = process.env.SMTP_USER || '';
const SMTP_PASS  = process.env.SMTP_PASS || '';
const SMTP_FROM  = process.env.SMTP_FROM || '"Rawson" <no-reply@example.com>';

const MAX_ATTEMPTS = parseInt(process.env.NOTIFY_MAX_ATTEMPTS || '5', 10);

let transporter = null;
if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: false,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

function normalizeMsisdn(phone) {
  if (!phone) return null;
  const cleaned = String(phone).replace(/[^\d+]/g,'');
  if (cleaned.startsWith('+')) return cleaned;
  return WA_CC + cleaned.replace(/^0+/, '');
}

function renderTemplate(key, params={}) {
  switch (key) {
    case 'ticket_created':
      return `New ticket ${params.ticketRef} from ${params.clientName}. Urgency: ${params.urgency}\n${params.description || ''}`.trim();
    case 'contractor_assigned':
      return `You have been assigned to ticket ${params.ticketRef}. Please review and follow up.`;
    case 'quote_status':
      return `Quote #${params.quoteId} for ticket ${params.ticketRef} is ${params.status}.`;
    case 'message_new':
      return `${params.senderName}: ${params.preview}`;
    default:
      return params.text || 'Notification';
  }
}

async function sendWhatsAppMeta({ to, text }) {
  const url = `https://graph.facebook.com/v20.0/${WA_PHONE_ID}/messages`;
  const res = await axios.post(
    url,
    {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: false, body: text },
    },
    { headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type':'application/json' } }
  );
  return res.data?.messages?.[0]?.id || null;
}

async function sendEmail({ to, subject, text }) {
  if (!transporter) throw new Error('SMTP not configured');
  const info = await transporter.sendMail({ from: SMTP_FROM, to, subject, text });
  return info.messageId || null;
}

/**
 * Notify a single user (WhatsApp first, fallback to email) with dedupe by eventKey.
 * Returns { notificationId, sent, channel, error }
 */
export async function notifyUser({ userId, ticketId=null, template, params={}, eventKey, fallbackToEmail=true }) {
  // Dedupe check
  if (eventKey) {
    const [rows] = await pool.query(
      `SELECT MarkAsSent FROM tblNotifications
       WHERE UserID=? AND NotificationType IN ('WhatsApp','Email') AND EventKey=?
       ORDER BY SentAt DESC LIMIT 1`,
      [userId, eventKey]
    );
    if (rows.length && rows[0].MarkAsSent === 1) {
      return { skipped: true, reason: 'duplicate' };
    }
  }

  // Recipient
  const [[user]] = await pool.query(
    `SELECT Email, Phone, FullName, COALESCE(WhatsAppOptIn,0) AS WhatsAppOptIn FROM tblusers WHERE UserID=? LIMIT 1`,
    [userId]
  );
  if (!user) throw new Error('Recipient not found');

  const text = renderTemplate(template, params);
  const msisdn = normalizeMsisdn(user.Phone);

  // Create notification row
  const [ins] = await pool.query(
    `INSERT INTO tblNotifications
     (UserID, TicketID, NotificationType, NotificationContent, EventKey, Status, MarkAsSent, AttemptCount, LastAttemptAt)
     VALUES (?, ?, 'WhatsApp', ?, ?, 'Failed', 0, 0, NOW())`,
    [userId, ticketId, text, eventKey]
  );
  const notificationId = ins.insertId;

  let sent = false, providerId = null, errMsg = null, channel = null;

  // Try WhatsApp (only if enabled + opted-in + have number)
  if (WA_ENABLED && user.WhatsAppOptIn && msisdn) {
    // Attempt template-based message first if a mapping exists.
    const tmpl = TEMPLATE_MAP[template];
    if (tmpl) {
      try {
        providerId = await sendWhatsAppTemplate({
          to: msisdn,
          name: tmpl.name,
          components: tmpl.build(params),
        });
        sent = true;
        channel = 'WhatsApp';
      } catch (e) {
        // Capture error but allow fallback to free-form if template fails
        errMsg = e?.response?.data?.error?.message || e.message || 'WhatsApp template send failed';
      }
    }
    // If no template exists or template send failed, fall back to free-form text
    if (!sent) {
      try {
        providerId = await sendWhatsAppMeta({ to: msisdn, text });
        sent = true;
        channel = 'WhatsApp';
      } catch (e) {
        errMsg = e?.response?.data?.error?.message || e.message || 'WhatsApp send failed';
      }
    }
  } else {
    errMsg = 'WhatsApp disabled or no opt-in/phone';
  }

  // Fallback to email
  if (!sent && fallbackToEmail && user.Email) {
    try {
      providerId = await sendEmail({ to: user.Email, subject: `${BRAND}: Notification`, text });
      sent = true; channel = 'Email';
      await pool.query(`UPDATE tblNotifications SET NotificationType='Email' WHERE NotificationID=?`, [notificationId]);
    } catch (e) {
      errMsg = e.message || 'Email send failed';
    }
  }

  await pool.query(
    `UPDATE tblNotifications
     SET Status=?, MarkAsSent=?, ProviderMessageID=?, ErrorMessage=?, AttemptCount=AttemptCount+1, LastAttemptAt=NOW()
     WHERE NotificationID=?`,
    [sent ? 'Sent' : 'Failed', sent ? 1 : 0, providerId, sent ? null : errMsg, notificationId]
  );

  return { notificationId, sent, channel, error: errMsg };
}

/** Retry helper: pick failed rows and try email fallback */
export async function retryFailedNotifications(limit=50) {
  const [rows] = await pool.query(
    `SELECT NotificationID, UserID, NotificationContent, AttemptCount
     FROM tblNotifications
     WHERE MarkAsSent=0 AND AttemptCount < ?
     ORDER BY SentAt DESC
     LIMIT ?`,
    [MAX_ATTEMPTS, limit]
  );

  let ok=0, fail=0;
  for (const n of rows) {
    try {
      const [[u]] = await pool.query(`SELECT Email FROM tblusers WHERE UserID=?`, [n.UserID]);
      if (!u?.Email) throw new Error('No email for retry');
      const id = await sendEmail({ to: u.Email, subject: `${BRAND}: Notification Retry`, text: n.NotificationContent });
      await pool.query(
        `UPDATE tblNotifications SET Status='Sent', MarkAsSent=1, ProviderMessageID=?, AttemptCount=AttemptCount+1, LastAttemptAt=NOW() WHERE NotificationID=?`,
        [id || null, n.NotificationID]
      );
      ok++;
    } catch(e) {
      fail++;
      await pool.query(
        `UPDATE tblNotifications SET ErrorMessage=?, AttemptCount=AttemptCount+1, LastAttemptAt=NOW() WHERE NotificationID=?`,
        [e.message || 'Retry failed', n.NotificationID]
      );
    }
  }
  return { retried: rows.length, ok, fail };
}
