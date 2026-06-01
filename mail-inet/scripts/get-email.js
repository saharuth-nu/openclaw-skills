#!/usr/bin/env node
'use strict';
/**
 * get-email — ดึงเนื้อหาอีเมลครบถ้วนด้วย UID
 *
 * Usage:
 *   node scripts/get-email.js <uid> [--folder INBOX]
 *
 * Output JSON:
 *   { uid, message_id, subject, from, to, cc, bcc, date, is_read,
 *     tags, body_text, body_html, attachments: [{ filename, content_type, size }] }
 */
const { withImap } = require('./lib/imap');
const { simpleParser } = require('mailparser');

const args   = process.argv.slice(2);
const uid    = args.find(a => !a.startsWith('--'));
const folder = (() => { const i = args.indexOf('--folder'); return i >= 0 ? args[i + 1] : 'INBOX'; })();

if (!uid) {
  console.error(JSON.stringify({ error: 'Usage: node scripts/get-email.js <uid> [--folder INBOX]' }));
  process.exit(1);
}

async function main() {
  const result = await withImap(async (client) => {
    await client.mailboxOpen(folder, { readOnly: true });

    let raw = '';
    for await (const msg of client.fetch([uid], { uid: true, flags: true, source: true }, { uid: true })) {
      raw = msg.source.toString();

      const parsed = await simpleParser(msg.source);
      return {
        uid:         String(msg.uid),
        message_id:  parsed.messageId || '',
        subject:     parsed.subject   || '(no subject)',
        from:        parsed.from?.text || '',
        to:          parsed.to?.text   || '',
        cc:          parsed.cc?.text   || '',
        bcc:         parsed.bcc?.text  || '',
        date:        parsed.date?.toISOString() || '',
        is_read:     !msg.flags.has('\\Unseen'),
        tags:        [...msg.flags].filter(f => !f.startsWith('\\')),
        body_text:   parsed.text || '',
        body_html:   parsed.html || '',
        attachments: (parsed.attachments || []).map(a => ({
          filename:     a.filename     || 'unnamed',
          content_type: a.contentType  || '',
          size:         a.size         || 0,
        })),
      };
    }
    throw new Error(`Email UID ${uid} not found in ${folder}`);
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch(err => {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
});
