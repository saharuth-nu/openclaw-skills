'use strict';
const { ImapFlow } = require('imapflow');
const cfg = require('./config');

/**
 * เปิด IMAP connection, รัน fn(client), แล้วปิด connection
 * ใช้ทุก script ที่ต้องการอ่านเมลล์
 */
async function withImap(fn) {
  cfg.requireEnv(['IMAP_HOST', 'MAIL_USER', 'MAIL_PASSWORD']);

  const client = new ImapFlow({
    host:   cfg.imap.host,
    port:   cfg.imap.port,
    secure: cfg.imap.ssl,
    auth:   { user: cfg.imap.user, pass: cfg.imap.password },
    tls:    { rejectUnauthorized: false },
    logger: false,
  });

  await client.connect();
  try {
    return await fn(client);
  } finally {
    client.close();
  }
}

/**
 * แปลง imapflow message → object ที่ clean พร้อม output
 */
function formatMessage(msg, snippet = false) {
  const out = {
    uid:             String(msg.uid),
    message_id:      msg.envelope?.messageId || '',
    subject:         msg.envelope?.subject   || '(no subject)',
    from:            msg.envelope?.from?.[0]?.address || '',
    to:              (msg.envelope?.to || []).map(a => a.address).join(', '),
    date:            msg.envelope?.date?.toISOString() || '',
    is_read:         !msg.flags?.has('\\Unseen'),
    has_attachments: false, // set downstream if needed
    tags:            [...(msg.flags || [])].filter(f => !f.startsWith('\\')),
  };
  if (snippet && msg.bodyParts) out.snippet = '';
  return out;
}

module.exports = { withImap, formatMessage };
