#!/usr/bin/env node
'use strict';
/**
 * list-calendars — ดูปฏิทินทั้งหมดใน CalDAV account
 *
 * Usage:
 *   node scripts/list-calendars.js
 *
 * Output JSON:
 *   { count, calendars: [{ calendar_id, name, color, description }] }
 *
 * หมายเหตุ: calendar_id คือ URL path ของปฏิทิน ใช้กับ list-events, create-event
 */
const caldav = require('./lib/caldav');

async function main() {
  const calendars = await caldav.listCalendars();
  console.log(JSON.stringify({ count: calendars.length, calendars }, null, 2));
}

main().catch(err => {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
});
