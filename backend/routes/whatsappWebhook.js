// Webhook for WhatsApp Cloud API callbacks
// This route handles verification challenges and inbound message events
// from the Meta WhatsApp platform.  It verifies the X‑Hub signature to
// ensure authenticity and logs inbound messages for later processing.

import express from 'express';
import crypto from 'crypto';

const router = express.Router();

// Verification endpoint used by Meta to confirm the webhook URL
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// Verify X‑Hub signature for incoming requests
function verifySignature(req) {
  const sig = req.get('x-hub-signature-256') || '';
  if (!sig.startsWith('sha256=')) return false;
  const secret = process.env.WHATSAPP_APP_SECRET || '';
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(req.rawBody || Buffer.from(''));
  const expected = hmac.digest('hex');
  try {
    // Compare raw bytes of the HMAC (hex to bytes) instead of ASCII hex strings
    return crypto.timingSafeEqual(
      Buffer.from(sig.slice(7), 'hex'),
      Buffer.from(expected, 'hex')
    );
  } catch {
    return false;
  }
}

// Handle inbound messages
router.post('/', (req, res) => {
  try {
    if (!verifySignature(req)) {
      return res.sendStatus(403);
    }
    const payload = JSON.parse(req.rawBody?.toString('utf8') || '{}');
    console.log('[WhatsApp webhook] Inbound payload:', JSON.stringify(payload));
    return res.sendStatus(200);
  } catch (err) {
    console.error('[WhatsApp webhook] Error processing request:', err);
    return res.sendStatus(200);
  }
});

export default router;