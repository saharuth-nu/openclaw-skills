---
name: file-tools
description: >
  Use this skill whenever the user wants to read, extract, convert, edit, or process any file —
  PDF, Word (DOCX), Excel (XLSX), PowerPoint (PPTX), or images (JPG, PNG, WEBP, GIF, BMP, TIFF).
  Trigger on: "read this file", "extract text from", "convert to PDF", "resize image",
  "merge PDFs", "compress image", "get image info", "rotate PDF", "watermark", "OCR",
  "what's in this file", or any mention of a supported file extension.
  Works cross-platform: Windows, macOS, and Linux.
metadata:
  openclaw:
    emoji: "📂"
    requires:
      bins:
        - python3
---

# file-tools Skill

Read, extract, convert, and manipulate **PDF, DOCX, XLSX, PPTX, and Image** files.
Cross-platform: **Windows ✅ macOS ✅ Linux ✅**

**Run scripts**: `cd ~/.openclaw/workspace/skills/file-tools && python3 scripts/<script>.py [options]`

---

## First-Time Setup

```bash
# Check what's installed and what's missing
python3 scripts/check-deps.py

# Install all Python dependencies
pip install -r requirements.txt

# LibreOffice (optional — needed only for .doc/.xls/.ppt legacy formats)
# macOS:
brew install --cask libreoffice
# Windows:
winget install TheDocumentFoundation.LibreOffice
# Linux:
sudo apt install libreoffice

# Tesseract OCR (optional — needed only for --ocr on images)
# macOS:
brew install tesseract
# Windows:
winget install UB-Mannheim.TesseractOCR
# Linux:
sudo apt install tesseract-ocr
```

---

## Strategy

### Check deps first on new machines
Always run `check-deps.py` before other scripts if the user hasn't used the skill before.

### File type auto-detection
All scripts detect file type by extension — no need to specify format manually.

### LibreOffice is optional
LibreOffice is only needed for legacy formats (`.doc`, `.xls`, `.ppt`).
Modern formats (`.docx`, `.xlsx`, `.pptx`, `.pdf`) work without it.

### OCR is optional
`--ocr` flag in `extract-text.py` requires Tesseract + pytesseract.
Without `--ocr`, images return dimensions/format only.

---

## Scripts

### check-deps
Check which dependencies are installed, show install commands for missing ones.

```bash
python3 scripts/check-deps.py
```

Output: `{ ok, installed, missing, optional_missing, soffice_found, install }`

---

### file-info
Get metadata about any supported file — no text extraction, just info.

```bash
python3 scripts/file-info.py <path>
```

Output by file type:
- **PDF**: `{ pages, title, author, encrypted, page_size }`
- **DOCX**: `{ paragraphs, tables, sections, title, author, word_count }`
- **XLSX**: `{ sheet_count, sheets: [{ name, rows, columns }] }`
- **PPTX**: `{ slides, slide_width_px, slide_height_px }`
- **Image**: `{ width, height, format, mode, animated, frames, exif? }`
- **CSV/TXT**: `{ rows/lines, columns/words, header/preview }`

Examples:
```bash
python3 scripts/file-info.py ~/Documents/report.pdf
python3 scripts/file-info.py ~/Downloads/photo.jpg
python3 scripts/file-info.py ~/data/sales.xlsx
```

---

### extract-text
Extract text content from any supported file.

```bash
python3 scripts/extract-text.py <path> [options]
```

Options:
```
--pages  <range>   PDF only: "1-3", "2" (default: all)
--sheet  <name>    XLSX only: specific sheet name (default: all)
--ocr              Extract text from images via OCR (requires Tesseract)
--lang   <lang>    OCR language (default: eng). Use tha for Thai, eng+tha for both
```

Output: `{ path, type, text, pages?/slides?/sheets? }`

Examples:
```bash
python3 scripts/extract-text.py report.pdf
python3 scripts/extract-text.py report.pdf --pages 1-5
python3 scripts/extract-text.py document.docx
python3 scripts/extract-text.py data.xlsx --sheet "Sheet1"
python3 scripts/extract-text.py presentation.pptx
python3 scripts/extract-text.py scan.jpg --ocr
python3 scripts/extract-text.py scan.jpg --ocr --lang tha
python3 scripts/extract-text.py scan.jpg --ocr --lang eng+tha
```

---

### image-ops
Image operations: info, resize, convert, crop, rotate, thumbnail, compress.

```bash
python3 scripts/image-ops.py <path> <operation> [options]
```

Operations:

| Operation | Options | Description |
|-----------|---------|-------------|
| `info` | | Show dimensions, format, mode, EXIF |
| `resize` | `--width <n> --height <n> [--keep-ratio]` | Resize to exact size or scale proportionally |
| `convert` | `--to <format>` | Convert: jpeg, png, webp, bmp, tiff, gif |
| `crop` | `--left --top --right --bottom` | Crop to bounding box (pixels) |
| `rotate` | `--degrees <n> [--expand]` | Rotate CW (any angle; --expand avoids clipping) |
| `thumbnail` | `--size <n>` | Fit into n×n square, preserve ratio |
| `compress` | `--quality <1-95>` | Re-save JPEG/WEBP at lower quality |

Common option: `--output <path>` (default: auto-named next to source)

Examples:
```bash
python3 scripts/image-ops.py photo.jpg info
python3 scripts/image-ops.py photo.jpg resize --width 800 --keep-ratio
python3 scripts/image-ops.py photo.jpg resize --width 1920 --height 1080
python3 scripts/image-ops.py photo.png convert --to webp
python3 scripts/image-ops.py photo.jpg crop --left 100 --top 50 --right 500 --bottom 400
python3 scripts/image-ops.py photo.jpg rotate --degrees 90
python3 scripts/image-ops.py photo.jpg thumbnail --size 128
python3 scripts/image-ops.py photo.jpg compress --quality 70 --output small.jpg
```

Output: `{ saved: true, path, width, height, format, size_bytes }`
(info operation returns metadata instead)

---

### pdf-ops
PDF operations: merge, split, rotate, extract images, watermark, encrypt/decrypt.

```bash
python3 scripts/pdf-ops.py <operation> [files...] [options]
```

Operations:

| Operation | Args | Description |
|-----------|------|-------------|
| `merge` | `file1 file2 ...` | Merge multiple PDFs into one |
| `split` | `file` | Split each page into separate PDF |
| `rotate` | `file` | Rotate pages (--degrees 90/180/270) |
| `extract-images` | `file` | Extract embedded images to folder |
| `watermark` | `file` | Add text watermark (--text) |
| `encrypt` | `file` | Encrypt with password (--password) |
| `decrypt` | `file` | Decrypt with password (--password) |

Options:
```
--output  <path>     Output file or directory
--pages   <range>    Page range: "1-3", "2,4,6" (for split/rotate)
--degrees <n>        Rotation: 90, 180, 270
--text    <text>     Watermark text
--password <pwd>     Encrypt/decrypt password
```

Examples:
```bash
python3 scripts/pdf-ops.py merge a.pdf b.pdf c.pdf --output combined.pdf
python3 scripts/pdf-ops.py split report.pdf
python3 scripts/pdf-ops.py split report.pdf --pages 1-5 --output ./pages/
python3 scripts/pdf-ops.py rotate report.pdf --degrees 90
python3 scripts/pdf-ops.py rotate report.pdf --degrees 90 --pages 1,3,5
python3 scripts/pdf-ops.py extract-images report.pdf
python3 scripts/pdf-ops.py watermark report.pdf --text "CONFIDENTIAL"
python3 scripts/pdf-ops.py encrypt report.pdf --password secret123
python3 scripts/pdf-ops.py decrypt report.pdf --password secret123
```

Output: `{ done: true, output, ... }`

---

### email-to-pdf
Convert email content + attachments into a single PDF file.

```bash
python3 scripts/email-to-pdf.py \
  --uid      <uid> \
  --date     <YYYY-MM-DD> \
  --subject  <text> \
  --from     <email> \
  --body     <text> \
  --attach   <path>        (repeatable) \
  --output-dir <path>      (default: ~/oneauthen-payment)
```

- ชื่อไฟล์อัตโนมัติ: `YYYY-MM-DD_<uid>_<subject>.pdf`
- สร้างโฟลเดอร์ output อัตโนมัติถ้ายังไม่มี
- รูปภาพ → embed เป็น image page | PDF → merge | DOCX/XLSX → extract text
- รองรับภาษาไทยด้วยฟอนต์ Sarabun (ดาวน์โหลดอัตโนมัติครั้งแรก)

Output: `{ saved: true, path, filename, pages }`

---

## Supported Formats Summary

| Format | file-info | extract-text | image-ops | pdf-ops |
|--------|-----------|--------------|-----------|---------|
| PDF | ✅ | ✅ | — | ✅ |
| DOCX | ✅ | ✅ | — | — |
| XLSX | ✅ | ✅ | — | — |
| PPTX | ✅ | ✅ | — | — |
| JPG/PNG/WEBP/GIF/BMP/TIFF | ✅ | ✅ (OCR) | ✅ | — |
| CSV/TXT/MD | ✅ | ✅ | — | — |

---

## Windows Notes

- Python path: use `python` instead of `python3` if needed
- Scripts use `pathlib.Path` internally — backslash paths work fine
- LibreOffice path auto-detected from `C:\Program Files\LibreOffice\`
- No `LD_PRELOAD`, no `.so` files — fully compatible with Windows
