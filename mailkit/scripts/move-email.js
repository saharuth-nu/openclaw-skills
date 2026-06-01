#!/usr/bin/env node
'use strict';
/**
 * move-email — ย้ายอีเมลระหว่าง folders
 *
 * Usage:
 *   node scripts/move-email.js <uid> --to <folder> [--from INBOX]
 *
 * Output JSON:
 *   { moved: true, uid, from, to }
 */
const { withImap } = require('./lib/imap');

const args       = process.argv.slice(2);
const uid        = args.find(a => !a.startsWith('--'));
const toFolder   = (() => { const i = args.indexOf('--to');   return i >= 0 ? args[i + 1] : ''; })();
const fromFolder = (() => { const i = args.indexOf('--from'); return i >= 0 ? args[i + 1] : 'INBOX'; })();

if (!uid || !toFolder) {
  console.error(JSON.stringify({ error: 'Usage: node scripts/move-email.js <uid> --to <folder> [--from INBOX]' }));
  process.exit(1);
}

async function main() {
  await withImap(async (client) => {
    // Auto-create destination folder if it doesn't exist
    const mailboxes = await client.list();
    const exists = mailboxes.some(m => m.path === toFolder);
    if (!exists) {
      await client.mailboxCreate(toFolder);
    }

    await client.mailboxOpen(fromFolder);
    await client.messageMove([uid], toFolder, { uid: true });
  });

  console.log(JSON.stringify({ moved: true, uid, from: fromFolder, to: toFolder }, null, 2));
}

main().catch(err => {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
});
