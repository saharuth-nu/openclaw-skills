#!/usr/bin/env node
'use strict';
/**
 * update-event — แก้ไขนัดหมาย (ระบุเฉพาะ fields ที่ต้องการเปลี่ยน)
 *
 * Usage:
 *   node scripts/update-event.js <event-href> [options]
 *
 * event-href คือ href จาก list-events
 *
 * Options (ระบุเฉพาะที่ต้องการเปลี่ยน — ที่ไม่ระบุจะคงค่าเดิม):
 *   --title       <text>
 *   --start       <iso>
 *   --end         <iso>
 *   --description <text>
 *   --location    <text>
 *   --attendees   <list>  คั่นด้วย comma (แทนที่ทั้งหมด)
 *   --all-day
 *   --recurrence  <rule>
 *
 * Output JSON:
 *   { updated: true, event_id }
 */
const caldav = require('./lib/caldav');

const args = process.argv.slice(2);
const href = args.find(a => !a.startsWith('--'));
const get  = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; };
const has  = (flag) => args.includes(flag);

if (!href) {
  console.error(JSON.stringify({ error: 'Usage: node scripts/update-event.js <event-href> [options]' }));
  process.exit(1);
}

async function main() {
  // ดึง event เดิมมาก่อน
  const current = await caldav.getEvent(href);

  const updated = {
    uid:         current.event_id,
    title:       get('--title')       ?? current.title,
    start:       get('--start')       ?? current.start,
    end:         get('--end')         ?? current.end,
    description: get('--description') ?? current.description,
    location:    get('--location')    ?? current.location,
    attendees:   get('--attendees')   ? get('--attendees').split(',').map(s => s.trim()) : current.attendees,
    allDay:      has('--all-day')     ? true : current.is_all_day,
    recurrence:  get('--recurrence')  ?? current.recurrence,
  };

  const ical = caldav.buildIcal(updated);
  const res  = await caldav.updateEvent(href, ical);

  if (res.status >= 400) throw new Error(`CalDAV error ${res.status}: ${res.body}`);
  console.log(JSON.stringify({ updated: true, event_id: current.event_id }, null, 2));
}

main().catch(err => {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
});
