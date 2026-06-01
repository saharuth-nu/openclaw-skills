#!/usr/bin/env node
'use strict';
/**
 * mark-email — Mark อีเมลว่าอ่านแล้ว หรือยังไม่อ่าน
 *
 * Usage:
 *   node scripts/mark-email.js <uid> [--folder INBOX] [--unread]
 *
 * Options:
 *   --unread    mark เป็นยังไม่อ่าน (default: mark เป็นอ่านแล้ว)
 *   --folder    folder ที่อีเมลอยู่ (default: INBOX)
 *
 * Output JSON:
 *   { updated: true, uid, read: true|false }
 */
const { withImap } = require('./lib/imap');

const args   = process.argv.slice(2);
const uid    = args.find(a => !a.startsWith('--'));
const folder = (() => { const i = args.indexOf('--folder'); return i >= 0 ? args[i + 1] : 'INBOX'; })();
const unread = args.includes('--unread');

if (!uid) {
  console.error(JSON.stringify({ error: 'Usage: node scripts/mark-email.js <uid> [--folder INBOX] [--unread]' }));
  process.exit(1);
}

async function main() {
  await withImap(async (client) => {
    await client.mailboxOpen(folder);
    if (unread) {
      await client.messageFlagsRemove([uid], ['\\Seen'], { uid: true });
    } else {
      await client.messageFlagsAdd([uid], ['\\Seen'], { uid: true });
    }
  });

  console.log(JSON.stringify({ updated: true, uid, read: !unread }, null, 2));
}

main().catch(err => {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
});
