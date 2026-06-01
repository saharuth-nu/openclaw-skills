#!/usr/bin/env node
'use strict';
/**
 * free-busy — ดูช่วงเวลาว่าง/ไม่ว่างในช่วงที่กำหนด
 *
 * Usage:
 *   node scripts/free-busy.js --from <iso> --to <iso> [--calendar <id>]
 *
 * Options:
 *   --from     <iso>  วันเวลาเริ่ม ISO 8601 เช่น 2025-06-02T08:00:00Z  (required)
 *   --to       <iso>  วันเวลาสิ้นสุด ISO 8601                           (required)
 *   --calendar <id>   calendar_id เฉพาะ (ว่าง = ดูทุกปฏิทิน)
 *
 * Output JSON:
 *   { range_from, range_to, busy_count, free_count, busy_slots[], free_slots[] }
 *   แต่ละ slot: { start, end, title? }
 */
const caldav = require('./lib/caldav');

const args = process.argv.slice(2);
const get  = (flag, def = '') => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : def; };

const from  = get('--from');
const to    = get('--to');
const calId = get('--calendar');

if (!from || !to) {
  console.error(JSON.stringify({ error: 'Required: --from <iso> --to <iso>' }));
  process.exit(1);
}

async function main() {
  let calendars = calId ? [{ calendar_id: calId }] : await caldav.listCalendars();

  const busy = [];
  for (const cal of calendars) {
    const events = await caldav.listEvents(cal.calendar_id, from, to);
    for (const e of events) {
      if (e.start && e.end) busy.push({ start: e.start, end: e.end, title: e.title });
    }
  }

  busy.sort((a, b) => a.start.localeCompare(b.start));

  // คำนวณ free slots จาก gap ระหว่าง busy
  const free = [];
  let cursor = new Date(from);
  const end  = new Date(to);

  for (const slot of busy) {
    const slotStart = new Date(slot.start);
    const slotEnd   = new Date(slot.end);
    if (slotStart > cursor) free.push({ start: cursor.toISOString(), end: slotStart.toISOString() });
    if (slotEnd > cursor) cursor = slotEnd;
  }
  if (cursor < end) free.push({ start: cursor.toISOString(), end: end.toISOString() });

  console.log(JSON.stringify({
    range_from:  from,
    range_to:    to,
    busy_count:  busy.length,
    free_count:  free.length,
    busy_slots:  busy,
    free_slots:  free,
  }, null, 2));
}

main().catch(err => {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
});
