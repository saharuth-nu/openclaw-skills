#!/usr/bin/env node
'use strict';
/**
 * tag-email — เพิ่มหรือลบ IMAP keyword tag บนอีเมล
 *
 * Usage:
 *   node scripts/tag-email.js <uid> --tag <tag> [--folder INBOX] [--remove]
 *
 * Options:
 *   --tag    <name>   ชื่อ tag เช่น work, urgent, follow-up
 *   --remove          ลบ tag แทนที่จะเพิ่ม
 *   --folder <name>   folder ที่อีเมลอยู่ (default: INBOX)
 *
 * Output JSON:
 *   { updated: true, uid, tag, added: true|false }
 */
const { withImap } = require('./lib/imap');

const args   = process.argv.slice(2);
const uid    = args.find(a => !a.startsWith('--'));
const tag    = (() => { const i = args.indexOf('--tag'); return i >= 0 ? args[i + 1] : ''; })();
const folder = (() => { const i = args.indexOf('--folder'); return i >= 0 ? args[i + 1] : 'INBOX'; })();
const remove = args.includes('--remove');

if (!uid || !tag) {
  console.error(JSON.stringify({ error: 'Usage: node scripts/tag-email.js <uid> --tag <tag> [--remove]' }));
  process.exit(1);
}

async function main() {
  await withImap(async (client) => {
    await client.mailboxOpen(folder);
    if (remove) {
      await client.messageFlagsRemove([uid], [tag], { uid: true });
    } else {
      await client.messageFlagsAdd([uid], [tag], { uid: true });
    }
  });

  console.log(JSON.stringify({ updated: true, uid, tag, added: !remove }, null, 2));
}

main().catch(err => {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
});
