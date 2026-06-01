#!/usr/bin/env node
'use strict';
/**
 * delete-email — ลบอีเมลถาวร (mark Deleted + EXPUNGE)
 *
 * Usage:
 *   node scripts/delete-email.js <uid> [--folder INBOX]
 *
 * Output JSON:
 *   { deleted: true, uid }
 */
const { withImap } = require('./lib/imap');

const args   = process.argv.slice(2);
const uid    = args.find(a => !a.startsWith('--'));
const folder = (() => { const i = args.indexOf('--folder'); return i >= 0 ? args[i + 1] : 'INBOX'; })();

if (!uid) {
  console.error(JSON.stringify({ error: 'Usage: node scripts/delete-email.js <uid> [--folder INBOX]' }));
  process.exit(1);
}

async function main() {
  await withImap(async (client) => {
    await client.mailboxOpen(folder);
    await client.messageDelete([uid], { uid: true });
  });

  console.log(JSON.stringify({ deleted: true, uid }, null, 2));
}

main().catch(err => {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
});
