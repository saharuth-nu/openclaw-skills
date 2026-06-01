---
name: mail-inet
description: >
  Use this skill whenever the user mentions anything related to email (inbox, mail, send email,
  reply, read email, search email, attachment, unread, subject, from, sender, forward) or calendar
  (meeting, appointment, schedule, event, calendar, create event, cancel meeting, reschedule,
  check availability, free/busy, invite). Trigger even if the user doesn't explicitly ask for
  this skill — if they want to do anything with email or calendar, use it.
  Supports IMAP/SMTP (read/send email) and CalDAV (manage events) via CLI scripts.
  Config: ~/.config/mail-inet/.env | Scripts: ~/.openclaw/workspace/skills/mail-inet/scripts/
metadata:
  openclaw:
    emoji: "📧"
    requires:
      bins:
        - node
      env:
        - IMAP_HOST
        - IMAP_USER
        - IMAP_PASSWORD
        - SMTP_HOST
        - SMTP_USER
        - SMTP_PASSWORD
---

# mail-inet Skill

Manage **Email (IMAP/SMTP)** and **Calendar (CalDAV)** via CLI scripts.

**Run scripts**: `cd ~/.openclaw/workspace/skills/mail-inet && node scripts/<script>.js [options]`  
**Config**: `~/.config/mail-inet/.env` — loaded automatically, no extra setup needed  
**Timezone**: All timestamps are **UTC**. Thailand is UTC+7, so add 7 hours when displaying to user.

---

## Strategy (read this first)

### Use snippet first — only call get-email when you actually need more

`list-emails` already returns a **200-character snippet** of the body. This is usually enough to:
- Summarize what an email is about
- Classify whether action is needed
- Decide whether to reply

Only call `get-email` when you need the full body, attachments, or the `message_id` for replying.

### Handle empty results gracefully

- **No unread emails**: Tell the user, then offer to show recent emails instead → use `list-emails --limit 10`
- **No calendar events in range**: Tell the user, then try fetching without a date range to confirm whether the calendar has any data at all

### Multiple filters = AND

Using `--from` and `--subject` together performs an IMAP AND search automatically.  
`--subject` matches against the **envelope subject only** — it is not a full-body text search.

---

## Common Workflows

### 1. Read and summarize emails

```bash
# Check unread first
node scripts/list-emails.js --unread --limit 20

# If unread = 0, fall back to recent
node scripts/list-emails.js --limit 10

# Check available folders if unsure of folder name
node scripts/list-folders.js

# Get full content only when snippet isn't enough
node scripts/get-email.js <uid>
```

### 2. Search and reply

```bash
# Find the email
node scripts/list-emails.js --from sender@domain.com --subject "keyword"

# Get full content to retrieve message_id for threading
node scripts/get-email.js <uid>

# Reply into the same thread (--reply-to keeps the thread intact)
node scripts/send-email.js \
  --to sender@domain.com \
  --subject "Re: Original subject" \
  --body "Your reply here" \
  --reply-to "<message_id_from_get-email>"
```

### 3. View and manage calendar

```bash
# Always list calendars first to get calendar_id
node scripts/list-calendars.js

# List events in a date range (times in UTC; Thailand = UTC+7)
node scripts/list-events.js \
  --calendar "/dav/user%40domain/Calendar/" \
  --from "2026-06-01T00:00:00Z" \
  --to "2026-06-30T23:59:59Z"

# If no results, try without date range to verify calendar has data
node scripts/list-events.js --calendar "/dav/user%40domain/Calendar/" --limit 10

# Create an event (e.g. 10:00 AM Thailand = 03:00Z)
node scripts/create-event.js \
  --calendar "/dav/user%40domain/Calendar/" \
  --title "Team meeting" \
  --start "2026-06-10T03:00:00Z" \
  --end   "2026-06-10T04:00:00Z"
```

---

## Email Tools (IMAP/SMTP)

### list-folders
List all folders/mailboxes with message counts. Run this first if you're unsure of folder names.

```bash
node scripts/list-folders.js
```

Output: `{ count, folders: [{ name, path, total_count, unread_count }] }`

---

### list-emails
Fetch a list of emails with a 200-char snippet. Usually sufficient without calling get-email.

```bash
node scripts/list-emails.js [options]
```

Options:
```
--folder    <name>   Folder to fetch from (default: INBOX)
--subject   <text>   Filter by subject — substring match, case-insensitive
--from      <email>  Filter by sender address
--unread             Only unread messages
--date-from <date>   Start date — ISO (2025-06-01) or DD-Mon-YYYY (01-Jun-2025)
--date-to   <date>   End date
--page      <n>      Page number (default: 1)
--limit     <n>      Results per page (default: 20, max: 100)
```

Output: `{ count, total, page, has_more, items: [{ uid, message_id, subject, from, to, date, is_read, has_attachments, tags, snippet }] }`

Examples:
```bash
node scripts/list-emails.js --unread --limit 10
node scripts/list-emails.js --subject invoice --from finance@company.com
node scripts/list-emails.js --folder "ManageAI" --date-from 2026-05-01
```

---

### get-email
Fetch full email content. Use when snippet isn't enough or you need `message_id` for replying.

```bash
node scripts/get-email.js <uid> [--folder INBOX]
```

Output: `{ uid, message_id, subject, from, to, cc, bcc, date, is_read, tags, body_text, body_html, attachments: [{ filename, content_type, size }] }`

---

### send-email
Send a new email or reply into an existing thread.

```bash
node scripts/send-email.js --to <email> --subject <text> --body <text> [options]
```

Required: `--to`, `--subject`, `--body`

Optional:
```
--cc       <email>       CC recipients (comma-separated)
--bcc      <email>       BCC recipients (comma-separated)
--html                   Send body as HTML
--reply-to <message-id>  message_id from get-email — keeps the email in the same thread
--attach   <path>        File to attach — repeat for multiple attachments
```

Examples:
```bash
# Send with a single attachment
node scripts/send-email.js \
  --to customer@example.com \
  --subject "Report" \
  --body "Please find the report attached." \
  --attach ~/Downloads/report.pdf

# Send with multiple attachments
node scripts/send-email.js \
  --to customer@example.com \
  --subject "Files" \
  --body "See attached files." \
  --attach ~/Downloads/report.pdf \
  --attach ~/Downloads/photo.png
```

Output: `{ sent: true, message_id, attachments?: [{ filename, size }] }`

---

### mark-email
Mark an email as read or unread.

```bash
node scripts/mark-email.js <uid> [--folder INBOX] [--unread]
```

Output: `{ updated: true, uid, read: true|false }`

---

### tag-email
Add or remove a custom IMAP keyword tag on an email.

```bash
node scripts/tag-email.js <uid> --tag <tag> [--folder INBOX] [--remove]
```

Any tag name works: `payment`, `urgent`, `follow-up`, `done`, etc.

Output: `{ updated: true, uid, tag, added: true|false }`

---

### move-email
Move an email between folders.

```bash
node scripts/move-email.js <uid> --to <folder> [--from INBOX]
```

Output: `{ moved: true, uid, from, to }`

---

### download-attachment
Download an email attachment to disk. First call `get-email` to see the list of attachment filenames.

```bash
node scripts/download-attachment.js <uid> --filename <name> [options]
```

Options:
```
--filename  <name>   Attachment filename (from get-email attachments list)
--output    <path>   Save path (default: ~/Downloads/<filename>)
--folder    <name>   Folder the email is in (default: INBOX)
--index     <n>      Download by index (0-based) instead of filename
```

Example:
```bash
# Step 1 — see what attachments are available
node scripts/get-email.js 6042
# → attachments: [{ filename: "report.pdf", content_type: "application/pdf", size: 204800 }]

# Step 2 — download it
node scripts/download-attachment.js 6042 --filename "report.pdf"
# saves to ~/Downloads/report.pdf by default

# Or save to a specific path
node scripts/download-attachment.js 6042 --filename "report.pdf" --output "/tmp/report.pdf"
```

Output: `{ saved: true, filename, path, size, content_type }`

---

### delete-email
Permanently delete an email.

```bash
node scripts/delete-email.js <uid> [--folder INBOX]
```

Output: `{ deleted: true, uid }`

---

## Calendar Tools (CalDAV)

> All times are **UTC**. Thailand is UTC+7 — e.g. 9:00 AM TH = 02:00Z

### list-calendars
List all available calendars. **Always run this first** to get `calendar_id` values.

```bash
node scripts/list-calendars.js
```

Output: `{ count, calendars: [{ calendar_id, name, color, description }] }`

`calendar_id` is a URL path like `/dav/user%40domain.com/Calendar/` — used in all other calendar scripts.

---

### list-events
Fetch events in a time range.

```bash
node scripts/list-events.js [options]
```

Options:
```
--calendar <id>    calendar_id from list-calendars (omit to fetch all calendars)
--from     <iso>   Start datetime UTC, e.g. 2026-06-01T00:00:00Z
--to       <iso>   End datetime UTC
--title    <text>  Filter by event title (substring)
--page     <n>     Page number (default: 1)
--limit    <n>     Results per page (default: 20)
```

Output: `{ count, total, page, has_more, items: [{ event_id, href, calendar_id, title, start, end, location, is_all_day, attendees, recurrence, status }] }`

`href` is used with get-event, update-event, and delete-event.

---

### get-event
Fetch full event details.

```bash
node scripts/get-event.js <event-href>
```

`<event-href>` is the `href` field from list-events.

Output: `{ event_id, calendar_id, title, start, end, location, description, attendees, recurrence, is_all_day, status }`

---

### create-event
Create a new calendar event.

```bash
node scripts/create-event.js --calendar <id> --title <text> --start <iso> --end <iso> [options]
```

Required: `--calendar`, `--title`, `--start` (UTC), `--end` (UTC)

Optional:
```
--description <text>
--location    <text>
--attendees   <emails>  Comma-separated
--all-day               All-day event
--recurrence  <rule>    RRULE e.g. FREQ=WEEKLY;BYDAY=MO,WE
```

Example (10:00 AM Thailand = 03:00Z):
```bash
node scripts/create-event.js \
  --calendar "/dav/saharuth.nu%40inet.co.th/Calendar/" \
  --title "Team meeting" \
  --start "2026-06-10T03:00:00Z" \
  --end   "2026-06-10T04:00:00Z" \
  --location "Meeting Room A" \
  --attendees "a@company.com,b@company.com"
```

Output: `{ created: true, event_id }`

---

### update-event
Update an existing event. Only specify the fields you want to change — unspecified fields keep their current values.

```bash
node scripts/update-event.js <event-href> [options]
```

Same options as create-event.

Output: `{ updated: true, event_id }`

---

### delete-event
Delete a calendar event.

```bash
node scripts/delete-event.js <event-href>
```

Output: `{ deleted: true, href }`

---

### free-busy
Show busy and free time slots within a given range.

```bash
node scripts/free-busy.js --from <iso> --to <iso> [--calendar <id>]
```

Example (08:00–18:00 Thailand = 01:00–11:00Z):
```bash
node scripts/free-busy.js \
  --from "2026-06-10T01:00:00Z" \
  --to   "2026-06-10T11:00:00Z"
```

Output: `{ range_from, range_to, busy_count, free_count, busy_slots[], free_slots[] }`

---

## Setup (first time)

```bash
node ~/.openclaw/workspace/skills/mail-inet/setup.js
```

Interactive setup — saves credentials to `~/.config/mail-inet/.env`.

---

## openclaw.json config

```json
"mail-inet": {
  "enabled": true,
  "env": {
    "IMAP_HOST": "incoming.inet.co.th",
    "IMAP_PORT": "993",
    "IMAP_USER": "YOUR_EMAIL@inet.co.th",
    "IMAP_PASSWORD": "YOUR_PASSWORD",
    "IMAP_USE_SSL": "true",
    "SMTP_HOST": "outgoing.inet.co.th",
    "SMTP_PORT": "465",
    "SMTP_USER": "YOUR_EMAIL@inet.co.th",
    "SMTP_PASSWORD": "YOUR_PASSWORD",
    "SMTP_USE_TLS": "true",
    "CALDAV_URL": "https://mail.inet.co.th/dav/YOUR_EMAIL%40inet.co.th/",
    "CALDAV_USER": "YOUR_EMAIL@inet.co.th",
    "CALDAV_PASSWORD": "YOUR_PASSWORD"
  }
}
```
