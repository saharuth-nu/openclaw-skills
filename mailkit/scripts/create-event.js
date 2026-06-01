#!/usr/bin/env node
'use strict';
/**
 * create-event — สร้างนัดหมายใหม่ในปฏิทิน
 *
 * Usage:
 *   node scripts/create-event.js --calendar <id> --title <text> --start <iso> --end <iso> [options]
 *
 * Required:
 *   --calendar   <id>     calendar_id จาก list-calendars
 *   --title      <text>   ชื่อ event
 *   --start      <iso>    วันเวลาเริ่ม ISO 8601 เช่น 2025-06-01T09:00:00Z
 *   --end        <iso>    วันเวลาสิ้นสุด ISO 8601
 *
 * Optional:
 *   --description <text>  คำอธิบาย
 *   --location    <text>  สถานที่
 *   --attendees   <list>  อีเมลผู้เข้าร่วม คั่นด้วย comma
 *   --all-day             all-day event (ใช้ start=2025-06-01 end=2025-06-02)
 *   --recurrence  <rule>  RRULE เช่น FREQ=WEEKLY;BYDAY=MO,WE
 *
 * Output JSON:
 *   { created: true, event_id }
 */
const { v4: uuidv4 } = (() => { try { return require('uuid'); } catch { return { v4: () => `${Date.now()}-${Math.random().toString(36).slice(2)}` }; } })();
const caldav = require('./lib/caldav');

const args = process.argv.slice(2);
const get  = (flag, def = '') => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : def; };
const has  = (flag) => args.includes(flag);

const calId       = get('--calendar');
const title       = get('--title');
const start       = get('--start');
const end         = get('--end');
const description = get('--description');
const location    = get('--location');
const attendees   = get('--attendees') ? get('--attendees').split(',').map(s => s.trim()) : [];
const allDay      = has('--all-day');
const recurrence  = get('--recurrence');

if (!calId || !title || !start || !end) {
  console.error(JSON.stringify({ error: 'Required: --calendar, --title, --start, --end' }));
  process.exit(1);
}

async function main() {
  const uid    = uuidv4();
  const ical   = caldav.buildIcal({ uid, title, start, end, description, location, attendees, allDay, recurrence });
  const res    = await caldav.putEvent(calId, uid, ical);

  if (res.status >= 400) throw new Error(`CalDAV error ${res.status}: ${res.body}`);
  console.log(JSON.stringify({ created: true, event_id: uid }, null, 2));
}

main().catch(err => {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
});
