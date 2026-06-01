#!/usr/bin/env node
'use strict';
/**
 * send-email — Send a new email or reply into an existing thread, with optional attachments
 *
 * Usage:
 *   node scripts/send-email.js --to <email> --subject <text> --body <text> [options]
 *
 * Required:
 *   --to       <email>        Recipient(s), comma-separated for multiple
 *   --subject  <text>         Subject line
 *   --body     <text>         Body content (plain text by default)
 *
 * Optional:
 *   --cc       <email>        CC recipients (comma-separated)
 *   --bcc      <email>        BCC recipients (comma-separated)
 *   --html                    Send body as HTML
 *   --reply-to <message-id>   message_id from get-email — keeps email in the same thread
 *   --attach   <path>         File to attach (can be used multiple times)
 *
 * Output JSON:
 *   { sent: true, message_id, attachments: [{ filename, size }] }
 */
const nodemailer = require('nodemailer');
const cfg        = require('./lib/config');
const fs         = require('fs');
const path       = require('path');
const os         = require('os');

const args    = process.argv.slice(2);
const has     = (flag) => args.includes(flag);

// single-value flags
const get = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : '';
};

// multi-value flags — collect every occurrence of --flag <value>
const getAll = (flag) => {
  const values = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === flag && args[i + 1]) values.push(args[i + 1]);
  }
  return values;
};

const to       = get('--to');
const subject  = get('--subject');
const body     = get('--body');
const cc       = get('--cc');
const bcc      = get('--bcc');
const replyTo  = get('--reply-to');
const isHtml   = has('--html');
const attachPaths = getAll('--attach').map(p => p.replace(/^~/, os.homedir()));

if (!to || !subject || !body) {
  console.error(JSON.stringify({ error: 'Required: --to, --subject, --body' }));
  process.exit(1);
}

// validate attachment paths exist
for (const p of attachPaths) {
  if (!fs.existsSync(p)) {
    console.error(JSON.stringify({ error: `Attachment file not found: ${p}` }));
    process.exit(1);
  }
}

async function main() {
  cfg.requireEnv(['SMTP_HOST', 'MAIL_USER', 'MAIL_PASSWORD']);

  const transporter = nodemailer.createTransport({
    host:   cfg.smtp.host,
    port:   cfg.smtp.port,
    secure: cfg.smtp.port === 465,
    auth:   { user: cfg.smtp.user, pass: cfg.smtp.password },
    tls:    { rejectUnauthorized: false },
  });

  // build attachments array for nodemailer
  const attachments = attachPaths.map(p => ({
    filename: path.basename(p),
    path:     p,
  }));

  const mail = {
    from:    cfg.smtp.user,
    to,
    subject,
    ...(isHtml ? { html: body } : { text: body }),
    ...(cc          ? { cc }                                        : {}),
    ...(bcc         ? { bcc }                                       : {}),
    ...(replyTo     ? { inReplyTo: replyTo, references: replyTo }   : {}),
    ...(attachments.length ? { attachments }                        : {}),
  };

  const info = await transporter.sendMail(mail);

  const result = {
    sent:       true,
    message_id: info.messageId,
  };

  if (attachments.length) {
    result.attachments = attachPaths.map(p => ({
      filename: path.basename(p),
      size:     fs.statSync(p).size,
    }));
  }

  console.log(JSON.stringify(result, null, 2));
}

main().catch(err => {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
});
