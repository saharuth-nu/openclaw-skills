'use strict';
const path = require('path');
const fs   = require('fs');

// Load .env — skill dir first, then ~/.config/mailkit/.env
const CONFIG_PATHS = [
  path.join(__dirname, '..', '..', '.env'),
  path.join(process.env.HOME, '.config', 'mailkit', '.env'),
];

for (const p of CONFIG_PATHS) {
  if (fs.existsSync(p)) {
    require('dotenv').config({ path: p });
    break;
  }
}

function get(key, fallback = '') {
  return process.env[key] || fallback;
}

function requireEnv(keys) {
  const missing = keys.filter(k => !process.env[k]);
  if (missing.length) {
    console.error(JSON.stringify({
      error: `Missing env vars: ${missing.join(', ')}. Check your .env file.`
    }));
    process.exit(1);
  }
}

// Shared credentials — MAIL_USER / MAIL_PASSWORD used for IMAP, SMTP, and CalDAV
// Per-service overrides (IMAP_USER, SMTP_USER, CALDAV_USER) are still supported
const sharedUser     = get('MAIL_USER');
const sharedPassword = get('MAIL_PASSWORD');

const imap = {
  host:     get('IMAP_HOST'),
  port:     parseInt(get('IMAP_PORT', '993')),
  user:     get('IMAP_USER')     || sharedUser,
  password: get('IMAP_PASSWORD') || sharedPassword,
  ssl:      get('IMAP_USE_SSL', 'true') !== 'false',
};

const smtp = {
  host:     get('SMTP_HOST'),
  port:     parseInt(get('SMTP_PORT', '465')),
  user:     get('SMTP_USER')     || sharedUser,
  password: get('SMTP_PASSWORD') || sharedPassword,
  tls:      get('SMTP_USE_TLS', 'true') !== 'false',
};

const caldav = {
  url:      get('CALDAV_URL'),
  user:     get('CALDAV_USER')     || sharedUser,
  password: get('CALDAV_PASSWORD') || sharedPassword,
};

module.exports = { imap, smtp, caldav, requireEnv };
