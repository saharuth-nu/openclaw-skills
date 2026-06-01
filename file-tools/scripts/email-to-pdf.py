#!/usr/bin/env python3
"""
email-to-pdf — Save email content + attachments into a single PDF file

Usage:
  python3 scripts/email-to-pdf.py [options]

Required:
  --uid      <uid>       Email UID
  --date     <date>      Email date (YYYY-MM-DD or ISO)
  --subject  <text>      Email subject
  --from     <email>     Sender

Optional:
  --body     <text>      Email body (plain text)
  --attach   <path>      Attachment file path (repeatable)
  --output-dir <path>    Save folder (default: ~/oneauthen-payment)

Output JSON:
  { saved: true, path, filename, pages }
"""
import json
import os
import re
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, os.path.dirname(__file__))

# ── arg parsing ──────────────────────────────────────────────────────────────
args = sys.argv[1:]
get     = lambda f, d="": args[args.index(f) + 1] if f in args else d
getall  = lambda f: [args[i + 1] for i, a in enumerate(args) if a == f and i + 1 < len(args)]

uid         = get("--uid")
date_raw    = get("--date")
subject     = get("--subject", "(no subject)")
sender      = get("--from", "")
body        = get("--body", "")
attach_paths= getall("--attach")
output_dir  = Path(get("--output-dir", str(Path.home() / "oneauthen-payment"))).expanduser()

if not uid or not date_raw:
    print(json.dumps({"error": "Required: --uid and --date"}))
    sys.exit(1)

# ── helpers ──────────────────────────────────────────────────────────────────
SKILL_DIR  = Path(__file__).resolve().parent.parent
FONT_PATH  = SKILL_DIR / "fonts" / "Sarabun-Regular.ttf"
FONT_URL   = "https://github.com/google/fonts/raw/main/ofl/sarabun/Sarabun-Regular.ttf"

def ensure_font() -> str:
    if not FONT_PATH.is_file():
        import urllib.request
        FONT_PATH.parent.mkdir(parents=True, exist_ok=True)
        urllib.request.urlretrieve(FONT_URL, str(FONT_PATH))
    return str(FONT_PATH)

def sanitize_filename(s: str) -> str:
    """Strip characters illegal in filenames, collapse whitespace."""
    s = re.sub(r'[\\/:*?"<>|]', "", s)
    s = re.sub(r'\s+', "_", s.strip())
    return s[:80]  # keep reasonable length

def date_prefix(raw: str) -> str:
    """Extract YYYY-MM-DD from any date string."""
    m = re.search(r"(\d{4}[-/]\d{2}[-/]\d{2})", raw)
    return m.group(1).replace("/", "-") if m else raw[:10]

# ── build PDF ────────────────────────────────────────────────────────────────
def build_pdf(out_path: Path) -> int:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.lib import colors
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, HRFlowable,
        PageBreak, Image as RLImage, KeepTogether
    )
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont

    # Register Thai font
    font_path = ensure_font()
    pdfmetrics.registerFont(TTFont("Sarabun", font_path))

    styles = getSampleStyleSheet()
    thai = ParagraphStyle("Thai",    fontName="Sarabun", fontSize=11, leading=18, spaceAfter=4)
    h1   = ParagraphStyle("H1Thai", fontName="Sarabun", fontSize=14, leading=20, spaceAfter=8,
                           textColor=colors.HexColor("#1a3a5c"), fontWeight="bold")
    meta = ParagraphStyle("Meta",   fontName="Sarabun", fontSize=10, leading=16,
                           textColor=colors.HexColor("#555555"))
    att_h= ParagraphStyle("AttH",   fontName="Sarabun", fontSize=13, leading=18,
                           textColor=colors.HexColor("#2c5282"), spaceAfter=6)

    story = []

    # ── Email header ──────────────────────────────────────────────────────────
    story.append(Paragraph("📧 Payment Email Record", h1))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#cccccc")))
    story.append(Spacer(1, 0.3 * cm))
    story.append(Paragraph(f"<b>UID:</b> {uid}", meta))
    story.append(Paragraph(f"<b>วันที่:</b> {date_raw}", meta))
    story.append(Paragraph(f"<b>จาก:</b> {sender}", meta))
    story.append(Paragraph(f"<b>Subject:</b> {subject}", meta))
    story.append(Spacer(1, 0.4 * cm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#eeeeee")))
    story.append(Spacer(1, 0.3 * cm))

    # ── Email body ────────────────────────────────────────────────────────────
    if body:
        story.append(Paragraph("เนื้อหาอีเมล", att_h))
        for line in body.splitlines():
            line = line.strip()
            if line:
                story.append(Paragraph(line.replace("&", "&amp;").replace("<", "&lt;"), thai))
            else:
                story.append(Spacer(1, 0.2 * cm))

    # ── Attachments ───────────────────────────────────────────────────────────
    for att_path_str in attach_paths:
        att_path = Path(att_path_str)
        if not att_path.is_file():
            continue

        story.append(PageBreak())
        story.append(Paragraph(f"📎 แนบ: {att_path.name}", att_h))
        story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#eeeeee")))
        story.append(Spacer(1, 0.3 * cm))

        ext = att_path.suffix.lower()

        # Image attachments → embed as image
        if ext in (".jpg", ".jpeg", ".png", ".bmp", ".gif", ".tiff", ".tif", ".webp"):
            try:
                from PIL import Image as PILImage
                with PILImage.open(att_path) as img:
                    img_w, img_h = img.size
                max_w = 15 * cm
                max_h = 20 * cm
                ratio = min(max_w / img_w, max_h / img_h, 1.0)
                story.append(RLImage(str(att_path), width=img_w * ratio, height=img_h * ratio))
            except Exception as e:
                story.append(Paragraph(f"[ไม่สามารถแสดงภาพ: {e}]", thai))

        # PDF attachments → will be merged after building main PDF
        elif ext == ".pdf":
            story.append(Paragraph(f"[PDF attachment — ดูหน้าถัดไป]", thai))
            story.append(Paragraph(f"ไฟล์: {att_path.name}", meta))

        # Text-based attachments → extract and show
        else:
            try:
                sys.path.insert(0, str(SKILL_DIR / "scripts"))
                from lib.detect import detect
                ftype = detect(str(att_path))
                text_content = ""

                if ftype in ("text", "csv", "tsv"):
                    text_content = att_path.read_text(encoding="utf-8-sig", errors="replace")
                elif ftype in ("docx", "xlsx", "pptx", "pdf"):
                    import subprocess
                    result = subprocess.run(
                        [sys.executable, str(SKILL_DIR / "scripts" / "extract-text.py"), str(att_path)],
                        capture_output=True, text=True
                    )
                    data = json.loads(result.stdout)
                    text_content = data.get("text", "")

                if text_content:
                    for line in text_content[:3000].splitlines():
                        line = line.strip()
                        if line:
                            story.append(Paragraph(
                                line.replace("&", "&amp;").replace("<", "&lt;"), thai
                            ))
                        else:
                            story.append(Spacer(1, 0.15 * cm))
                else:
                    story.append(Paragraph(f"[ไม่สามารถแสดงเนื้อหา — ประเภทไฟล์: {ext}]", thai))
            except Exception as e:
                story.append(Paragraph(f"[error reading attachment: {e}]", thai))

    # ── Build main PDF ────────────────────────────────────────────────────────
    tmp_fd, tmp_path = tempfile.mkstemp(suffix=".pdf",
                                        dir=os.path.realpath(tempfile.gettempdir()))
    os.close(tmp_fd)

    doc = SimpleDocTemplate(
        tmp_path, pagesize=A4,
        leftMargin=2*cm, rightMargin=2*cm,
        topMargin=2*cm, bottomMargin=2*cm
    )
    doc.build(story)

    # ── Merge PDF attachments ─────────────────────────────────────────────────
    pdf_attachments = [Path(p) for p in attach_paths if Path(p).suffix.lower() == ".pdf" and Path(p).is_file()]

    if pdf_attachments:
        from pypdf import PdfWriter, PdfReader
        writer = PdfWriter()
        # Main content first
        for page in PdfReader(tmp_path).pages:
            writer.add_page(page)
        # Append each PDF attachment
        for pdf_att in pdf_attachments:
            try:
                for page in PdfReader(str(pdf_att)).pages:
                    writer.add_page(page)
            except Exception:
                pass
        with open(str(out_path), "wb") as fh:
            writer.write(fh)
        os.unlink(tmp_path)
    else:
        import shutil
        shutil.move(tmp_path, str(out_path))

    from pypdf import PdfReader
    return len(PdfReader(str(out_path)).pages)


# ── main ─────────────────────────────────────────────────────────────────────
def main():
    date_str = date_prefix(date_raw)          # e.g. "2026-06-01"
    month_str = date_str[:7]                   # e.g. "2026-06"

    # Save under ~/oneauthen-payment/YYYY-MM/
    monthly_dir = output_dir / month_str
    monthly_dir.mkdir(parents=True, exist_ok=True)

    safe_subject = sanitize_filename(subject)
    filename = f"{date_str}_{uid}_{safe_subject}.pdf"
    out_path = monthly_dir / filename

    try:
        pages = build_pdf(out_path)
        print(json.dumps({
            "saved":    True,
            "path":     str(out_path),
            "filename": filename,
            "pages":    pages,
        }, ensure_ascii=False, indent=2))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
