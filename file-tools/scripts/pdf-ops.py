#!/usr/bin/env python3
"""
pdf-ops — PDF operations: merge, split, rotate, extract images, add watermark

Usage:
  python3 scripts/pdf-ops.py <operation> [files...] [options]

Operations:
  merge   <file1> <file2> ...   Merge multiple PDFs into one
  split   <file>                Split PDF into individual pages
  rotate  <file> --degrees <n>  Rotate pages (90/180/270)
  extract-images <file>         Extract embedded images
  watermark <file> --text <t>   Add text watermark to all pages
  encrypt <file> --password <p> Encrypt PDF with password
  decrypt <file> --password <p> Decrypt PDF

Common options:
  --output  <path>    Output file/directory (default: auto-named)
  --pages   <range>   Page range e.g. "1-3", "2,4,6" (for split/rotate)

Output JSON:
  { done: true, output, pages?, files? }
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

args = sys.argv[1:]
get = lambda flag, default="": args[args.index(flag) + 1] if flag in args else default
has = lambda flag: flag in args


def parse_pages(spec, total):
    """Parse page spec like '1-3', '2,4,6' → 0-based list."""
    if not spec:
        return list(range(total))
    result = []
    for part in spec.split(","):
        part = part.strip()
        if "-" in part:
            a, b = part.split("-", 1)
            result.extend(range(int(a) - 1, int(b)))
        else:
            result.append(int(part) - 1)
    return [i for i in result if 0 <= i < total]


def op_merge():
    from pypdf import PdfWriter, PdfReader
    # Collect all PDF file args (positional, after "merge")
    files = [a for a in args[1:] if not a.startswith("--")
             and a != get("--output") and os.path.isfile(a)]
    if len(files) < 2:
        raise ValueError("merge requires at least 2 PDF files")

    out = get("--output") or os.path.join(
        os.path.dirname(files[0]), "merged.pdf"
    )
    writer = PdfWriter()
    total = 0
    for f in files:
        r = PdfReader(f)
        for page in r.pages:
            writer.add_page(page)
            total += 1
    with open(out, "wb") as fh:
        writer.write(fh)
    return {"done": True, "output": os.path.abspath(out),
            "pages": total, "merged_files": len(files)}


def op_split():
    from pypdf import PdfWriter, PdfReader
    path = next((a for a in args[1:] if not a.startswith("--") and os.path.isfile(a)), None)
    if not path:
        raise ValueError("split requires a PDF file path")

    out_dir = get("--output") or os.path.join(
        os.path.dirname(path),
        os.path.splitext(os.path.basename(path))[0] + "_pages"
    )
    os.makedirs(out_dir, exist_ok=True)

    r = PdfReader(path)
    pages_arg = get("--pages")
    indices = parse_pages(pages_arg, len(r.pages))

    files = []
    for i in indices:
        w = PdfWriter()
        w.add_page(r.pages[i])
        out_path = os.path.join(out_dir, f"page_{i+1:04d}.pdf")
        with open(out_path, "wb") as fh:
            w.write(fh)
        files.append(os.path.abspath(out_path))

    return {"done": True, "output_dir": os.path.abspath(out_dir),
            "files": files, "page_count": len(files)}


def op_rotate():
    from pypdf import PdfWriter, PdfReader
    path = next((a for a in args[1:] if not a.startswith("--") and os.path.isfile(a)), None)
    if not path:
        raise ValueError("rotate requires a PDF file path")

    degrees = int(get("--degrees") or 90)
    if degrees not in (90, 180, 270):
        raise ValueError("--degrees must be 90, 180, or 270")

    pages_arg = get("--pages")
    base, ext = os.path.splitext(path)
    out = get("--output") or f"{base}_rotated{degrees}{ext}"

    r = PdfReader(path)
    w = PdfWriter()
    indices = set(parse_pages(pages_arg, len(r.pages)))

    for i, page in enumerate(r.pages):
        if i in indices:
            page.rotate(degrees)
        w.add_page(page)

    with open(out, "wb") as fh:
        w.write(fh)
    return {"done": True, "output": os.path.abspath(out),
            "pages_rotated": len(indices), "degrees": degrees}


def op_extract_images():
    from pypdf import PdfReader
    path = next((a for a in args[1:] if not a.startswith("--") and os.path.isfile(a)), None)
    if not path:
        raise ValueError("extract-images requires a PDF file path")

    out_dir = get("--output") or os.path.join(
        os.path.dirname(path),
        os.path.splitext(os.path.basename(path))[0] + "_images"
    )
    os.makedirs(out_dir, exist_ok=True)

    r = PdfReader(path)
    saved = []
    for page_num, page in enumerate(r.pages):
        if "/Resources" not in page or "/XObject" not in page["/Resources"]:
            continue
        xobjects = page["/Resources"]["/XObject"].get_object()
        for obj_name, obj_ref in xobjects.items():
            obj = obj_ref.get_object()
            if obj.get("/Subtype") != "/Image":
                continue
            ext_map = {"/DCTDecode": "jpg", "/FlateDecode": "png",
                       "/JPXDecode": "jp2", "/CCITTFaxDecode": "tiff"}
            filter_type = obj.get("/Filter", "")
            ext = ext_map.get(str(filter_type), "png")
            fname = f"page{page_num+1}_{obj_name.lstrip('/').lower()}.{ext}"
            fpath = os.path.join(out_dir, fname)
            with open(fpath, "wb") as f:
                f.write(obj.get_data())
            saved.append(os.path.abspath(fpath))

    return {"done": True, "output_dir": os.path.abspath(out_dir),
            "images": saved, "image_count": len(saved)}


def op_watermark():
    from pypdf import PdfWriter, PdfReader
    from reportlab.pdfgen import canvas as rl_canvas
    from reportlab.lib.pagesizes import letter
    import io

    path = next((a for a in args[1:] if not a.startswith("--") and os.path.isfile(a)), None)
    if not path:
        raise ValueError("watermark requires a PDF file path")

    text = get("--text")
    if not text:
        raise ValueError("--text is required for watermark")

    # Build watermark PDF in memory
    buf = io.BytesIO()
    c = rl_canvas.Canvas(buf, pagesize=letter)
    c.setFont("Helvetica", 48)
    c.setFillColorRGB(0.75, 0.75, 0.75, alpha=0.4)
    c.saveState()
    c.translate(300, 400)
    c.rotate(45)
    c.drawCentredString(0, 0, text)
    c.restoreState()
    c.save()
    buf.seek(0)

    watermark_pdf = PdfReader(buf)
    watermark_page = watermark_pdf.pages[0]

    r = PdfReader(path)
    w = PdfWriter()
    for page in r.pages:
        page.merge_page(watermark_page)
        w.add_page(page)

    base, ext = os.path.splitext(path)
    out = get("--output") or f"{base}_watermarked{ext}"
    with open(out, "wb") as fh:
        w.write(fh)
    return {"done": True, "output": os.path.abspath(out), "watermark_text": text}


def op_encrypt():
    from pypdf import PdfWriter, PdfReader
    path = next((a for a in args[1:] if not a.startswith("--") and os.path.isfile(a)), None)
    if not path:
        raise ValueError("encrypt requires a PDF file path")
    password = get("--password")
    if not password:
        raise ValueError("--password is required")

    r = PdfReader(path)
    w = PdfWriter()
    for page in r.pages:
        w.add_page(page)
    w.encrypt(password)

    base, ext = os.path.splitext(path)
    out = get("--output") or f"{base}_encrypted{ext}"
    with open(out, "wb") as fh:
        w.write(fh)
    return {"done": True, "output": os.path.abspath(out)}


def op_decrypt():
    from pypdf import PdfWriter, PdfReader
    path = next((a for a in args[1:] if not a.startswith("--") and os.path.isfile(a)), None)
    if not path:
        raise ValueError("decrypt requires a PDF file path")
    password = get("--password")
    if not password:
        raise ValueError("--password is required")

    r = PdfReader(path)
    if r.is_encrypted:
        r.decrypt(password)
    w = PdfWriter()
    for page in r.pages:
        w.add_page(page)

    base, ext = os.path.splitext(path)
    out = get("--output") or f"{base}_decrypted{ext}"
    with open(out, "wb") as fh:
        w.write(fh)
    return {"done": True, "output": os.path.abspath(out)}


OPERATIONS = {
    "merge":          op_merge,
    "split":          op_split,
    "rotate":         op_rotate,
    "extract-images": op_extract_images,
    "watermark":      op_watermark,
    "encrypt":        op_encrypt,
    "decrypt":        op_decrypt,
}


def main():
    if not args:
        print(json.dumps({"error": "Usage: pdf-ops.py <operation> [files...] [options]"}))
        sys.exit(1)

    op = args[0].lower()
    if op not in OPERATIONS:
        print(json.dumps({
            "error": f"Unknown operation '{op}'. Choose: {', '.join(OPERATIONS)}"
        }))
        sys.exit(1)

    try:
        result = OPERATIONS[op]()
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
