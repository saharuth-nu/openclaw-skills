#!/usr/bin/env node
'use strict';
/**
 * list-emails — ดึงรายการอีเมล พร้อม filter และ pagination
 *
 * Usage:
 *   node scripts/list-emails.js [options]
 *
 * Options:
 *   --folder    <name>   folder ที่จะดึง (default: INBOX)
 *   --subject   <text>   กรองตาม subject (substring)
 *   --from      <email>  กรองตาม sender
 *   --unread             เฉพาะที่ยังไม่อ่าน
 *   --date-from <date>   วันที่เริ่ม ISO หรือ DD-Mon-YYYY เช่น 01-Jan-2025
 *   --date-to   <date>   วันที่สิ้นสุด
 *   --page      <n>      หน้าที่ต้องการ (default: 1)
 *   --limit     <n>      จำนวนต่อหน้า (default: 20, max: 100)
 *
 * Output JSON:
 *   { count, total, page, has_more, items: [{ uid, subject, from, to, date, is_read, has_attachments, tags, snippet }] }
 */
const { withImap } = require('./lib/imap');

const args = process.argv.slice(2);
const get  = (flag, def = '') => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : def; };
const has  = (flag) => args.includes(flag);

const folder   = get('--folder',    'INBOX');
const subject  = get('--subject',   '');
const from     = get('--from',      '');
const dateFrom = get('--date-from', '');
const dateTo   = get('--date-to',   '');
const unread   = has('--unread');
const page     = Math.max(1, parseInt(get('--page',  '1')));
const limit    = Math.min(100, Math.max(1, parseInt(get('--limit', '20'))));

async function main() {
  const result = await withImap(async (client) => {
    await client.mailboxOpen(folder, { readOnly: true });

    // imapflow ใช้ object format สำหรับ search
    const criteria = {};
    if (unread)   criteria.seen    = false;
    if (subject)  criteria.subject = subject;
    if (from)     criteria.from    = from;
    if (dateFrom) criteria.since   = new Date(dateFrom);
    if (dateTo)   criteria.before  = new Date(dateTo);

    const uids = Array.from(await client.search(criteria, { uid: true }));
    uids.sort((a, b) => b - a); // newest first

    const total    = uids.length;
    const start    = (page - 1) * limit;
    const pageUids = uids.slice(start, start + limit);
    const hasMore  = start + limit < total;

    if (!pageUids.length) return { count: 0, total, page, has_more: hasMore, items: [] };

    // fetch envelope + flags + bodyStructure ในครั้งเดียว ไม่ดึง body เพิ่ม
    const items = [];
    for await (const msg of client.fetch(pageUids, {
      uid:           true,
      flags:         true,
      envelope:      true,
      bodyStructure: true,
      bodyParts:     ['1'], // part 1 = text/plain ส่วนแรก
    }, { uid: true })) {
      const snippet = extractSnippet(msg.bodyParts?.get('1'));
      items.push({
        uid:             String(msg.uid),
        message_id:      msg.envelope?.messageId || '',
        subject:         msg.envelope?.subject   || '(no subject)',
        from:            msg.envelope?.from?.[0]?.address || '',
        to:              (msg.envelope?.to || []).map(a => a.address).join(', '),
        date:            msg.envelope?.date?.toISOString() || '',
        is_read:         !msg.flags.has('\\Unseen'),
        has_attachments: checkAttachments(msg.bodyStructure),
        tags:            [...msg.flags].filter(f => !f.startsWith('\\')),
        snippet,
      });
    }

    return { count: items.length, total, page, has_more: hasMore, items };
  });

  console.log(JSON.stringify(result, null, 2));
}

function extractSnippet(part) {
  if (!part) return '';
  try {
    let text = part.toString('utf-8');
    // decode base64 if it looks encoded (no Thai/readable chars but has b64 chars)
    if (/^[A-Za-z0-9+/\r\n]+=*$/.test(text.trim()) && text.length > 40) {
      try { text = Buffer.from(text.replace(/\s/g, ''), 'base64').toString('utf-8'); } catch {}
    }
    // decode quoted-printable
    text = text
      .replace(/=\r?\n/g, '')                          // soft line breaks
      .replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
    // strip HTML tags
    text = text.replace(/<[^>]+>/g, ' ');
    return text.replace(/\s+/g, ' ').trim().slice(0, 200);
  } catch { return ''; }
}

function checkAttachments(structure) {
  if (!structure) return false;
  const disp = structure.disposition?.toLowerCase?.() ?? '';
  // disposition = "attachment" OR inline with a filename = downloadable file
  if (disp === 'attachment') return true;
  if (disp === 'inline' && structure.dispositionParameters?.filename) return true;
  // also catch application/* and image/* with a name parameter (no explicit disposition)
  const type = (structure.type || '').toLowerCase();
  if ((type.startsWith('application/') || type.startsWith('image/')) &&
      (structure.parameters?.name || structure.dispositionParameters?.filename)) return true;
  if (structure.childNodes) return structure.childNodes.some(checkAttachments);
  return false;
}

main().catch(err => {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
});
