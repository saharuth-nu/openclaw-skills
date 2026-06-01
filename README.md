# openclaw-skills

OpenClaw skills สำหรับจัดการอีเมล, ปฏิทิน และไฟล์ประเภทต่างๆ

---

## Skills

### 📧 mail-inet
อ่าน/ส่งอีเมล และจัดการปฏิทินผ่าน IMAP/SMTP/CalDAV

**ความสามารถ:**
- อ่าน, ค้นหา, ส่ง, ตอบกลับอีเมล
- download attachment
- จัดการโฟลเดอร์และ tag
- ดู/สร้าง/แก้ไข/ลบ calendar event
- ตรวจสอบ free/busy

### 📂 file-tools
อ่าน, แปลง และจัดการไฟล์ทุกประเภท

**ความสามารถ:**
- ดึงข้อมูลและ metadata จาก PDF, DOCX, XLSX, PPTX, รูปภาพ, CSV
- OCR ภาษาไทย/อังกฤษจากรูปภาพ
- จัดการรูปภาพ: resize, convert, crop, rotate, compress
- จัดการ PDF: merge, split, rotate, watermark, encrypt
- แปลงอีเมลพร้อม attachment เป็น PDF

---

## Requirements

| เครื่องมือ | เวอร์ชัน |
|-----------|---------|
| Node.js | ≥ 18 |
| Python | ≥ 3.10 |
| OpenClaw | latest |

---

## Installation

### 1. Clone

```bash
cd ~/.openclaw/workspace/skills
git clone https://github.com/saharuth-nu/openclaw-skills.git .
```

### 2. ติดตั้ง dependencies

```bash
# mail-inet
cd mail-inet && npm install

# file-tools
cd ../file-tools && pip install -r requirements.txt
```

### 3. ตั้งค่า mail-inet

```bash
cp mail-inet/.env.example mail-inet/.env
```

แก้ไข `mail-inet/.env`:

```env
IMAP_HOST=your-imap-server
IMAP_PORT=993
IMAP_USER=your@email.com
IMAP_PASSWORD=your-password
IMAP_USE_SSL=true

SMTP_HOST=your-smtp-server
SMTP_PORT=465
SMTP_USER=your@email.com
SMTP_PASSWORD=your-password
SMTP_USE_TLS=true

# CalDAV (optional)
CALDAV_URL=https://your-caldav-server/dav/your%40email.com/
CALDAV_USER=your@email.com
CALDAV_PASSWORD=your-password
```

### 4. ลงทะเบียนใน openclaw.json

```json
{
  "skills": {
    "entries": {
      "mail-inet": {
        "enabled": true,
        "env": {
          "IMAP_HOST": "your-imap-server",
          "IMAP_PORT": "993",
          "IMAP_USER": "your@email.com",
          "IMAP_PASSWORD": "your-password",
          "IMAP_USE_SSL": "true",
          "SMTP_HOST": "your-smtp-server",
          "SMTP_PORT": "465",
          "SMTP_USER": "your@email.com",
          "SMTP_PASSWORD": "your-password",
          "SMTP_USE_TLS": "true",
          "CALDAV_URL": "https://...",
          "CALDAV_USER": "your@email.com",
          "CALDAV_PASSWORD": "your-password"
        }
      }
    }
  }
}
```

### 5. ตรวจสอบ

```bash
# เช็ค file-tools dependencies
python3 file-tools/scripts/check-deps.py

# เช็ค mail-inet เชื่อมต่อได้
node mail-inet/scripts/list-folders.js

# ตรวจสอบ config
openclaw config validate
```

---

## Optional: Tesseract OCR (สำหรับอ่านข้อความจากรูปภาพ)

```bash
# macOS
brew install tesseract

# Windows
winget install UB-Mannheim.TesseractOCR

# Linux
sudo apt install tesseract-ocr
```

## Optional: LibreOffice (สำหรับไฟล์ .doc/.xls/.ppt รุ่นเก่า)

```bash
# macOS
brew install --cask libreoffice

# Windows
winget install TheDocumentFoundation.LibreOffice

# Linux
sudo apt install libreoffice
```

---

## Usage

ดูคู่มือการใช้งานแต่ละ script ได้ใน:
- [`mail-inet/SKILL.md`](mail-inet/SKILL.md)
- [`file-tools/SKILL.md`](file-tools/SKILL.md)
