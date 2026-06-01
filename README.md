# openclaw-skills

OpenClaw skills สำหรับจัดการอีเมล, ปฏิทิน และไฟล์ประเภทต่างๆ

---

## Skills

### 📧 mailkit
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
- OCR ภาษาไทย/อังกฤษจากรูปภาพ (auto-install Tesseract ถ้ายังไม่มี)
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
# mailkit
cd mailkit && npm install

# file-tools (ตรวจสอบและ auto-install Tesseract OCR ด้วย)
cd ../file-tools
pip install -r requirements.txt
python3 scripts/check-deps.py
```

> `check-deps.py` จะ **auto-install Tesseract OCR** ให้อัตโนมัติถ้ายังไม่มี ผ่าน `brew` / `winget` / `apt` ตาม OS

> **ถ้า `pip install` ล้มเหลว** — ดู [Troubleshooting](#troubleshooting) ด้านล่าง

### 3. ตั้งค่า mailkit

```bash
cp mailkit/.env.example mailkit/.env
```

แก้ไข `mailkit/.env`:

```env
# Shared credentials — ใช้ร่วมกันทั้ง IMAP, SMTP และ CalDAV
MAIL_USER=your@email.com
MAIL_PASSWORD=your-password

IMAP_HOST=your-imap-server
IMAP_PORT=993
IMAP_USE_SSL=true

SMTP_HOST=your-smtp-server
SMTP_PORT=465
SMTP_USE_TLS=true

# CalDAV (optional)
CALDAV_URL=https://your-caldav-server/dav/your%40email.com/
```

### 4. ลงทะเบียนใน openclaw.json

```json
{
  "skills": {
    "entries": {
      "mailkit": {
        "enabled": true,
        "env": {
          "MAIL_USER": "your@email.com",
          "MAIL_PASSWORD": "your-password",
          "IMAP_HOST": "your-imap-server",
          "IMAP_PORT": "993",
          "IMAP_USE_SSL": "true",
          "SMTP_HOST": "your-smtp-server",
          "SMTP_PORT": "465",
          "SMTP_USE_TLS": "true",
          "CALDAV_URL": "https://..."
        }
      }
    }
  }
}
```

### 5. ตรวจสอบ

```bash
# เช็ค file-tools dependencies + auto-install Tesseract
python3 file-tools/scripts/check-deps.py

# เช็ค mailkit เชื่อมต่อได้
node mailkit/scripts/list-folders.js

# ตรวจสอบ config
openclaw config validate
```

---

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

## Troubleshooting

### `pip install` ล้มเหลว

**macOS** — Pillow error เรื่อง image library:
```bash
brew install libjpeg zlib
pip install -r requirements.txt
```

**Windows** — อัปเกรด pip ก่อน:
```powershell
python -m pip install --upgrade pip
pip install -r requirements.txt
```

ถ้ายังไม่ได้ — ติดตั้ง **Microsoft C++ Build Tools**:
1. ดาวน์โหลดจาก https://visualstudio.microsoft.com/visual-cpp-build-tools/
2. เลือก **"Desktop development with C++"** → Install
3. เปิด terminal ใหม่ → `pip install -r requirements.txt`

**Linux** — ติดตั้ง system library ก่อน:
```bash
sudo apt install python3-dev libjpeg-dev zlib1g-dev libpng-dev
pip install -r requirements.txt
```

### `npm install` ล้มเหลว

ตรวจสอบ Node.js version:
```bash
node --version   # ต้องการ >= 18
```

ถ้า version ต่ำกว่า 18 — อัปเกรด Node.js:
```bash
# macOS
brew upgrade node

# Windows
winget install OpenJS.NodeJS.LTS

# Linux
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install nodejs
```

### Tesseract OCR ไม่ได้ติดตั้งอัตโนมัติ

`check-deps.py` จะพยายาม auto-install ให้ แต่ถ้าล้มเหลวให้ติดตั้งเองครับ:

```bash
# macOS
brew install tesseract

# Windows
winget install UB-Mannheim.TesseractOCR

# Linux
sudo apt install tesseract-ocr
```

---

## Usage

ดูคู่มือการใช้งานแต่ละ script ได้ใน:
- [`mailkit/SKILL.md`](mailkit/SKILL.md)
- [`file-tools/SKILL.md`](file-tools/SKILL.md)
