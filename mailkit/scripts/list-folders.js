#!/usr/bin/env node
'use strict';
/**
 * list-folders — ดู folders/mailboxes ทั้งหมดใน mailbox
 *
 * Usage:
 *   node scripts/list-folders.js
 *
 * Output JSON:
 *   { count, folders: [{ name, path, total_count, unread_count }] }
 */
const { withImap } = require('./lib/imap');

async function main() {
  const result = await withImap(async (client) => {
    const raw     = await client.list();
    const folders = raw.map(m => ({ name: m.name, path: m.path }));

    // ดึง status ของแต่ละ folder
    const detailed = [];
    for (const f of folders) {
      try {
        const status = await client.status(f.path, { messages: true, unseen: true });
        detailed.push({
          name:         f.name,
          path:         f.path,
          total_count:  status.messages || 0,
          unread_count: status.unseen   || 0,
        });
      } catch {
        detailed.push({ name: f.name, path: f.path, total_count: 0, unread_count: 0 });
      }
    }
    return { count: detailed.length, folders: detailed };
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch(err => {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
});
