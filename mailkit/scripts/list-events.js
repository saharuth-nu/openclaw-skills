#!/usr/bin/env node
'use strict';
/**
 * list-events — ดูนัดหมายในปฏิทิน
 *
 * Usage:
 *   node scripts/list-events.js [options]
 *
 * Options:
 *   --calendar <id>    calendar_id จาก list-calendars (ว่าง = ดึงทุกปฏิทิน)
 *   --from     <iso>   วันที่เริ่ม ISO 8601 เช่น 2025-06-01T00:00:00Z
 *   --to       <iso>   วันที่สิ้นสุด ISO 8601
 *   --title    <text>  กรองตามชื่อ event (substring)
 *   --page     <n>     หน้าที่ต้องการ (default: 1)
 *   --limit    <n>     จำนวนต่อหน้า (default: 20)
 *
 * Output JSON:
 *   { count, total, page, has_more, items: [{ event_id, title, start, end, ... }] }
 */
const caldav = require('./lib/caldav');

const args     = process.argv.slice(2);
const get      = (flag, def = '') => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : def; };

const calId    = get('--calendar');
const from     = get('--from');
const to       = get('--to');
const title    = get('--title', '').toLowerCase();
const page     = Math.max(1, parseInt(get('--page',  '1')));
const limit    = Math.min(100, Math.max(1, parseInt(get('--limit', '20'))));

async function main() {
  const cfg = require('./lib/config');
  cfg.requireEnv(['CALDAV_URL', 'MAIL_USER', 'MAIL_PASSWORD']);

  let calendars = [];
  if (calId) {
    calendars = [{ calendar_id: calId }];
  } else {
    calendars = await caldav.listCalendars();
  }

  let all = [];
  for (const cal of calendars) {
    const events = await caldav.listEvents(cal.calendar_id, from || null, to || null);
    all.push(...events);
  }

  if (title) all = all.filter(e => e.title.toLowerCase().includes(title));
  all.sort((a, b) => (a.start || '').localeCompare(b.start || ''));

  const total   = all.length;
  const start   = (page - 1) * limit;
  const items   = all.slice(start, start + limit);
  const hasMore = start + limit < total;

  console.log(JSON.stringify({ count: items.length, total, page, has_more: hasMore, items }, null, 2));
}

main().catch(err => {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
});
