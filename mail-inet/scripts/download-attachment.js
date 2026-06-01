#!/usr/bin/env node
'use strict';
/**
 * download-attachment — Download an email attachment to disk
 *
 * Usage:
 *   node scripts/download-attachment.js <uid> --filename <name> [options]
 *
 * Arguments:
 *   <uid>               Email UID (from list-emails)
 *
 * Options:
 *   --filename  <name>  Attachment filename to download (from get-email attachments list)
 *   --output    <path>  Save path (default: ~/Downloads/<filename>)
 *   --folder    <name>  Folder the email is in (default: INBOX)
 *   --index     <n>     Download attachment by index (0-based) instead of filename
 *
 * Output JSON:
 *   { saved: true, filename, path, size, content_type }
 */
const { withImap } = require('./lib/imap');
const { simpleParser } = require('mailparser');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

const args     = process.argv.slice(2);
const uid      = args.find(a => !a.startsWith('--'));
const get      = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : ''; };

const filename = get('--filename');
const output   = get('--output');
const folder   = get('--folder') || 'INBOX';
const index    = get('--index') !== '' ? parseInt(get('--index')) : -1;

if (!uid || (!filename && index < 0)) {
  console.error(JSON.stringify({
    error: 'Usage: node scripts/download-attachment.js <uid> --filename <name> [--output <path>] [--folder INBOX]'
  }));
  process.exit(1);
}

async function main() {
  const result = await withImap(async (client) => {
    await client.mailboxOpen(folder, { readOnly: true });

    for await (const msg of client.fetch([uid], { uid: true, source: true }, { uid: true })) {
      const parsed = await simpleParser(msg.source);
      const attachments = parsed.attachments || [];

      if (!attachments.length) {
        throw new Error(`Email UID ${uid} has no attachments`);
      }

      // find by filename or index
      let attachment;
      if (index >= 0) {
        attachment = attachments[index];
        if (!attachment) throw new Error(`No attachment at index ${index} (found ${attachments.length})`);
      } else {
        attachment = attachments.find(a => a.filename === filename);
        if (!attachment) {
          const names = attachments.map(a => a.filename).join(', ');
          throw new Error(`Attachment "${filename}" not found. Available: ${names}`);
        }
      }

      // resolve output path
      const saveName = attachment.filename || `attachment-${uid}-${index >= 0 ? index : 0}`;
      const savePath = output
        ? path.resolve(output.replace('~', os.homedir()))
        : path.join(os.homedir(), 'Downloads', saveName);

      // ensure directory exists
      fs.mkdirSync(path.dirname(savePath), { recursive: true });

      // write file
      fs.writeFileSync(savePath, attachment.content);

      return {
        saved:        true,
        filename:     saveName,
        path:         savePath,
        size:         attachment.content.length,
        content_type: attachment.contentType || '',
      };
    }

    throw new Error(`Email UID ${uid} not found in ${folder}`);
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch(err => {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
});
