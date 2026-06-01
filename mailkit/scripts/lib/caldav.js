'use strict';
const https  = require('https');
const http   = require('http');
const { XMLParser } = require('fast-xml-parser');
const ICAL   = require('ical.js');
const cfg    = require('./config');

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

/** Normalize uppercase DAV namespace prefixes to lowercase so parser keys are consistent */
function normalizeNs(xml) {
  return xml
    .replace(/\bD:/g, 'd:')
    .replace(/\bC:/g, 'c:')
    .replace(/\bCS:/g, 'cs:')
    .replace(/xmlns:D=/g, 'xmlns:d=')
    .replace(/xmlns:C=/g, 'xmlns:c=')
    .replace(/xmlns:CS=/g, 'xmlns:cs=');
}

/** ส่ง CalDAV HTTP request แล้วคืน { status, headers, body } */
function request(method, url, body = '', extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    cfg.requireEnv(['CALDAV_URL', 'MAIL_USER', 'MAIL_PASSWORD']);

    const parsed = new URL(url);
    const auth   = Buffer.from(`${cfg.caldav.user}:${cfg.caldav.password}`).toString('base64');
    const opts   = {
      hostname: parsed.hostname,
      port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path:     parsed.pathname + parsed.search,
      method,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type':  'application/xml; charset=utf-8',
        'Content-Length': Buffer.byteLength(body),
        ...extraHeaders,
      },
      rejectUnauthorized: false,
    };

    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request(opts, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

/** Helper: จาก D:response หลาย propstat ดึง prop ที่ status 200 */
function getOkProp(r) {
  const propstats = [r?.['d:propstat'] || []].flat();
  const ok = propstats.find(p => String(p?.['d:status'] || '').includes('200'));
  return ok?.['d:prop'] || {};
}

/** PROPFIND เพื่อ list calendars */
async function listCalendars() {
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<d:propfind xmlns:d="DAV:" xmlns:cs="urn:ietf:params:xml:ns:caldav" xmlns:ical="http://apple.com/ns/ical/">
  <d:prop>
    <d:resourcetype/>
    <d:displayname/>
    <ical:calendar-color/>
    <cs:calendar-description/>
  </d:prop>
</d:propfind>`;

  const res = await request('PROPFIND', cfg.caldav.url, body, { 'Depth': '1' });
  const xml = parser.parse(normalizeNs(res.body));
  const responses = [xml?.['d:multistatus']?.['d:response'] || []].flat();

  return responses
    .filter(r => {
      const rt = getOkProp(r)?.['d:resourcetype'] || {};
      return rt['c:calendar'] !== undefined || rt['cs:calendar'] !== undefined ||
             JSON.stringify(rt).toLowerCase().includes('calendar');
    })
    .map(r => {
      const prop = getOkProp(r);
      const desc = prop['c:calendar-description'] || prop['cs:calendar-description'] || '';
      return {
        calendar_id:  r['d:href'],
        name:         prop['d:displayname'] || '',
        color:        prop['a:calendar-color'] || prop['ical:calendar-color'] || '',
        description:  typeof desc === 'object' ? (desc['#text'] || '') : desc,
      };
    });
}

/** REPORT เพื่อ query events ในช่วงเวลา */
async function listEvents(calendarUrl, dateFrom, dateTo) {
  const timeRange = (dateFrom && dateTo)
    ? `<c:time-range start="${toCalFormat(dateFrom)}" end="${toCalFormat(dateTo)}"/>`
    : '';

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop><d:getetag/><c:calendar-data/></d:prop>
  <c:filter>
    <c:comp-filter name="VCALENDAR">
      <c:comp-filter name="VEVENT">${timeRange}</c:comp-filter>
    </c:comp-filter>
  </c:filter>
</c:calendar-query>`;

  const url = new URL(calendarUrl, cfg.caldav.url).href;
  const res = await request('REPORT', url, body, { 'Depth': '1' });
  const xml = parser.parse(normalizeNs(res.body));
  const responses = [xml?.['d:multistatus']?.['d:response'] || []].flat();

  const events = [];
  for (const r of responses) {
    const prop     = getOkProp(r);
    const raw      = prop['c:calendar-data'] || prop['cal:calendar-data'];
    if (!raw) continue;
    // fast-xml-parser returns object when element has attributes — extract text
    const icalData = typeof raw === 'object' ? (raw['#text'] || '') : String(raw);
    if (!icalData) continue;
    const event = parseEvent(icalData, r['d:href'], calendarUrl);
    if (event) events.push(event);
  }
  return events;
}

/** GET event ด้วย URL */
async function getEvent(eventUrl) {
  const url = new URL(eventUrl, cfg.caldav.url).href;
  const res = await request('GET', url);
  if (res.status !== 200) throw new Error(`Event not found (HTTP ${res.status})`);
  return parseEvent(res.body, eventUrl, '');
}

/** PUT เพื่อ create/update event */
async function putEvent(calendarUrl, eventId, icalData) {
  const url = new URL(`${calendarUrl}${eventId}.ics`, cfg.caldav.url).href;
  return request('PUT', url, icalData, {
    'Content-Type': 'text/calendar; charset=utf-8',
    'If-None-Match': '*',
  });
}

/** PUT เพื่อ update event (ใช้ event URL โดยตรง) */
async function updateEvent(eventUrl, icalData) {
  const url = new URL(eventUrl, cfg.caldav.url).href;
  return request('PUT', url, icalData, { 'Content-Type': 'text/calendar; charset=utf-8' });
}

/** DELETE event */
async function deleteEvent(eventUrl) {
  const url = new URL(eventUrl, cfg.caldav.url).href;
  return request('DELETE', url);
}

// ── helpers ───────────────────────────────────────────────────────────────────

function parseEvent(icalStr, href, calendarId) {
  try {
    const jcal  = ICAL.parse(icalStr);
    const comp  = new ICAL.Component(jcal);
    const vevent = comp.getFirstSubcomponent('vevent');
    if (!vevent) return null;

    const ev = new ICAL.Event(vevent);
    return {
      event_id:    ev.uid,
      href,
      calendar_id: calendarId,
      title:       ev.summary    || '',
      start:       ev.startDate?.toJSDate()?.toISOString() || '',
      end:         ev.endDate?.toJSDate()?.toISOString()   || '',
      location:    ev.location   || '',
      description: ev.description || '',
      is_all_day:  ev.startDate?.isDate || false,
      attendees:   (vevent.getAllProperties('attendee') || [])
                     .map(a => a.getFirstValue()?.replace('mailto:', '') || ''),
      recurrence:  vevent.getFirstPropertyValue('rrule')?.toString() || '',
      status:      ev.status || '',
    };
  } catch {
    return null;
  }
}

function toCalFormat(iso) {
  return iso.replace(/[-:]/g, '').replace('.000', '');
}

function buildIcal({ uid, title, start, end, description, location, attendees, allDay, recurrence }) {
  const comp  = new ICAL.Component(['vcalendar', [], []]);
  comp.updatePropertyWithValue('prodid', '-//mail-inet-skill//EN');
  comp.updatePropertyWithValue('version', '2.0');

  const vevent = new ICAL.Component('vevent');
  vevent.updatePropertyWithValue('uid',     uid);
  vevent.updatePropertyWithValue('summary', title);
  vevent.updatePropertyWithValue('dtstamp', ICAL.Time.now());

  const parseDt = (s, isDate) => {
    if (isDate) {
      const t = new ICAL.Time();
      t.fromString(s);
      t.isDate = true;
      return t;
    }
    return ICAL.Time.fromDateTimeString(s.replace('Z', ''));
  };

  vevent.updatePropertyWithValue('dtstart', parseDt(start, allDay));
  vevent.updatePropertyWithValue('dtend',   parseDt(end,   allDay));
  if (description) vevent.updatePropertyWithValue('description', description);
  if (location)    vevent.updatePropertyWithValue('location',    location);
  if (recurrence)  vevent.updatePropertyWithValue('rrule', ICAL.Recur.fromString(recurrence));
  if (attendees?.length) {
    for (const a of attendees) {
      const prop = new ICAL.Property('attendee');
      prop.setValue(`mailto:${a}`);
      vevent.addProperty(prop);
    }
  }

  comp.addSubcomponent(vevent);
  return comp.toString();
}

module.exports = { listCalendars, listEvents, getEvent, putEvent, updateEvent, deleteEvent, buildIcal };
