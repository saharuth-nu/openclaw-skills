'use strict';
const path = require('path');
const fs   = require('fs');

// โหลด .env จาก ~/.config/mail-inet/.env ก่อน ถ้าไม่เจอค่อย fallback มาที่ skill dir
const CONFIG_PATHS = [
  path.join(process.env.HOME, '.config', 'mail-inet', '.env'),
  path.join(__dirname, '..', '..', '.env'),
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
    console.error(JSON.stringify({ error: `Missing env vars: ${missing.join(', ')}. Run setup.sh first.` }));
    process.exit(1);
  }
}

const imap = {
  host:     get('IMAP_HOST'),
  port:     parseInt(get('IMAP_PORT', '993')),
  user:     get('IMAP_USER'),
  password: get('IMAP_PASSWORD'),
  ssl:      get('IMAP_USE_SSL', 'true') !== 'false',
};

const smtp = {
  host:     get('SMTP_HOST'),
  port:     parseInt(get('SMTP_PORT', '465')),
  user:     get('SMTP_USER'),
  password: get('SMTP_PASSWORD'),
  tls:      get('SMTP_USE_TLS', 'true') !== 'false',
};

const caldav = {
  url:      get('CALDAV_URL'),
  user:     get('CALDAV_USER'),
  password: get('CALDAV_PASSWORD'),
};

module.exports = { imap, smtp, caldav, requireEnv };
