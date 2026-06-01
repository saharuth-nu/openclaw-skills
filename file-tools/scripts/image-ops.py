#!/usr/bin/env python3
"""
image-ops — Image operations: resize, convert, crop, thumbnail, rotate, info

Usage:
  python3 scripts/image-ops.py <path> <operation> [options]

Operations:
  info                      Show image metadata (size, format, mode, EXIF)
  resize  --width <n> --height <n> [--keep-ratio]
                            Resize image (pixels). Omit one dimension + --keep-ratio to scale
  convert --to <format>     Convert format: jpeg, png, webp, bmp, tiff, gif
  crop    --left <n> --top <n> --right <n> --bottom <n>
                            Crop to box (pixels from top-left)
  rotate  --degrees <n>     Rotate clockwise (90/180/270 or any angle with --expand)
  thumbnail --size <n>      Create square thumbnail (n×n)
  compress --quality <n>    Re-save JPEG/WEBP with quality 1-95 (default 85)

Common options:
  --output <path>           Output path (default: <name>_<op>.<ext>)
  --expand                  Expand canvas when rotating to avoid clipping

Output JSON:
  { saved: true, path, width, height, format, size_bytes }
  or for info: { path, width, height, format, mode, ... }
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from lib.detect import detect

args = sys.argv[1:]
get = lambda flag, default="": args[args.index(flag) + 1] if flag in args else default
has = lambda flag: flag in args


FORMAT_MAP = {
    "jpg":  "JPEG",
    "jpeg": "JPEG",
    "png":  "PNG",
    "webp": "WEBP",
    "bmp":  "BMP",
    "tiff": "TIFF",
    "tif":  "TIFF",
    "gif":  "GIF",
    "ico":  "ICO",
}


def default_output(input_path, op, ext=None):
    base, orig_ext = os.path.splitext(input_path)
    out_ext = f".{ext}" if ext else orig_ext
    return f"{base}_{op}{out_ext}"


def save_result(img, out_path, fmt=None, quality=None):
    """Save Pillow image, returns (path, width, height, format)."""
    fmt = fmt or img.format or "PNG"
    save_args = {"format": fmt}

    # Convert RGBA → RGB for JPEG
    if fmt == "JPEG" and img.mode in ("RGBA", "P"):
        img = img.convert("RGB")

    if fmt in ("JPEG", "WEBP") and quality:
        save_args["quality"] = int(quality)

    img.save(out_path, **save_args)
    return img.width, img.height


def op_info(img, path):
    from PIL import ExifTags
    result = {
        "path":    os.path.abspath(path),
        "width":   img.width,
        "height":  img.height,
        "format":  img.format or os.path.splitext(path)[1].lstrip(".").upper(),
        "mode":    img.mode,
        "animated": getattr(img, "n_frames", 1) > 1,
        "frames":  getattr(img, "n_frames", 1),
    }
    try:
        exif_raw = img._getexif()
        if exif_raw:
            keep = {"Make", "Model", "DateTime", "Orientation",
                    "ExposureTime", "FNumber", "ISOSpeedRatings", "Software",
                    "Flash", "FocalLength", "WhiteBalance"}
            result["exif"] = {
                ExifTags.TAGS.get(k, k): str(v)
                for k, v in exif_raw.items()
                if ExifTags.TAGS.get(k, k) in keep
            }
    except Exception:
        pass
    return result


def op_resize(img, path):
    width  = int(get("--width",  0) or 0)
    height = int(get("--height", 0) or 0)
    keep_ratio = has("--keep-ratio")

    if not width and not height:
        raise ValueError("Provide at least --width or --height")

    if keep_ratio:
        orig_w, orig_h = img.size
        if width and not height:
            height = round(orig_h * width / orig_w)
        elif height and not width:
            width = round(orig_w * height / orig_h)

    from PIL import Image
    resized = img.resize((width, height), Image.LANCZOS)
    out = get("--output") or default_output(path, "resized")
    fmt = (img.format or "PNG")
    w, h = save_result(resized, out, fmt)
    return {"saved": True, "path": os.path.abspath(out), "width": w, "height": h,
            "format": fmt, "size_bytes": os.path.getsize(out)}


def op_convert(img, path):
    to_fmt = get("--to").lower()
    if not to_fmt:
        raise ValueError("Provide --to <format>: jpeg, png, webp, bmp, tiff, gif")
    pil_fmt = FORMAT_MAP.get(to_fmt)
    if not pil_fmt:
        raise ValueError(f"Unknown format '{to_fmt}'. Supported: {', '.join(FORMAT_MAP)}")

    out = get("--output") or default_output(path, "converted", to_fmt.replace("jpeg", "jpg"))
    quality = get("--quality") or None
    w, h = save_result(img, out, pil_fmt, quality)
    return {"saved": True, "path": os.path.abspath(out), "width": w, "height": h,
            "format": pil_fmt, "size_bytes": os.path.getsize(out)}


def op_crop(img, path):
    left   = int(get("--left",   0))
    top    = int(get("--top",    0))
    right  = int(get("--right",  img.width))
    bottom = int(get("--bottom", img.height))
    cropped = img.crop((left, top, right, bottom))
    out = get("--output") or default_output(path, "cropped")
    fmt = img.format or "PNG"
    w, h = save_result(cropped, out, fmt)
    return {"saved": True, "path": os.path.abspath(out), "width": w, "height": h,
            "format": fmt, "size_bytes": os.path.getsize(out)}


def op_rotate(img, path):
    degrees = float(get("--degrees") or 90)
    expand = has("--expand")
    rotated = img.rotate(-degrees, expand=expand)  # PIL rotates CCW, we want CW
    out = get("--output") or default_output(path, f"rotated{int(degrees)}")
    fmt = img.format or "PNG"
    w, h = save_result(rotated, out, fmt)
    return {"saved": True, "path": os.path.abspath(out), "width": w, "height": h,
            "format": fmt, "size_bytes": os.path.getsize(out)}


def op_thumbnail(img, path):
    size = int(get("--size") or 256)
    from PIL import Image
    thumb = img.copy()
    thumb.thumbnail((size, size), Image.LANCZOS)
    out = get("--output") or default_output(path, f"thumb{size}")
    fmt = img.format or "PNG"
    w, h = save_result(thumb, out, fmt)
    return {"saved": True, "path": os.path.abspath(out), "width": w, "height": h,
            "format": fmt, "size_bytes": os.path.getsize(out)}


def op_compress(img, path):
    quality = int(get("--quality") or 85)
    fmt = (img.format or "JPEG")
    if fmt not in ("JPEG", "WEBP"):
        fmt = "JPEG"
    ext = "jpg" if fmt == "JPEG" else "webp"
    out = get("--output") or default_output(path, "compressed", ext)
    w, h = save_result(img, out, fmt, quality)
    return {"saved": True, "path": os.path.abspath(out), "width": w, "height": h,
            "format": fmt, "quality": quality, "size_bytes": os.path.getsize(out)}


OPERATIONS = {
    "info":      op_info,
    "resize":    op_resize,
    "convert":   op_convert,
    "crop":      op_crop,
    "rotate":    op_rotate,
    "thumbnail": op_thumbnail,
    "compress":  op_compress,
}


def main():
    positional = [a for a in args if not a.startswith("--")
                  and a not in (get("--output"), get("--to"), get("--width"),
                                get("--height"), get("--left"), get("--top"),
                                get("--right"), get("--bottom"), get("--degrees"),
                                get("--size"), get("--quality"))]
    if len(positional) < 2:
        print(json.dumps({"error": "Usage: image-ops.py <path> <operation> [options]"}))
        sys.exit(1)

    path = positional[0]
    op   = positional[1].lower()

    if not os.path.isfile(path):
        print(json.dumps({"error": f"File not found: {path}"}))
        sys.exit(1)

    ftype = detect(path)
    if ftype != "image":
        print(json.dumps({"error": f"Not an image file: {path}"}))
        sys.exit(1)

    if op not in OPERATIONS:
        print(json.dumps({"error": f"Unknown operation '{op}'. Choose: {', '.join(OPERATIONS)}"}))
        sys.exit(1)

    try:
        from PIL import Image
        img = Image.open(path)
        result = OPERATIONS[op](img, path)
        if isinstance(result, dict) and "path" not in result:
            result["path"] = os.path.abspath(path)
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
