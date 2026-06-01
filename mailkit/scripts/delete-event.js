#!/usr/bin/env node
'use strict';
/**
 * delete-event — ลบนัดหมายออกจากปฏิทิน
 *
 * Usage:
 *   node scripts/delete-event.js <event-href>
 *
 * event-href คือ href จาก list-events
 *
 * Output JSON:
 *   { deleted: true, href }
 */
const caldav = require('./lib/caldav');

const args = process.argv.slice(2);
const href = args.find(a => !a.startsWith('--'));

if (!href) {
  console.error(JSON.stringify({ error: 'Usage: node scripts/delete-event.js <event-href>' }));
  process.exit(1);
}

async function main() {
  const res = await caldav.deleteEvent(href);
  if (res.status >= 400) throw new Error(`CalDAV error ${res.status}: ${res.body}`);
  console.log(JSON.stringify({ deleted: true, href }, null, 2));
}

main().catch(err => {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
});
