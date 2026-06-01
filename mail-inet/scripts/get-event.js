#!/usr/bin/env node
'use strict';
/**
 * get-event — ดูรายละเอียด event ครบถ้วนด้วย event URL
 *
 * Usage:
 *   node scripts/get-event.js <event-href>
 *
 * หมายเหตุ: event-href คือ href จาก list-events
 *
 * Output JSON:
 *   { event_id, calendar_id, title, start, end, location, description,
 *     attendees, recurrence, is_all_day, status }
 */
const caldav = require('./lib/caldav');

const args = process.argv.slice(2);
const href = args.find(a => !a.startsWith('--'));

if (!href) {
  console.error(JSON.stringify({ error: 'Usage: node scripts/get-event.js <event-href>' }));
  process.exit(1);
}

async function main() {
  const event = await caldav.getEvent(href);
  console.log(JSON.stringify(event, null, 2));
}

main().catch(err => {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
});
