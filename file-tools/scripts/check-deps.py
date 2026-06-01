#!/usr/bin/env python3
"""
check-deps — Check which dependencies are installed and show install instructions

Usage:
  python3 scripts/check-deps.py

Output JSON:
  { ok: bool, installed: [...], missing: [...], install_cmd: "..." }
"""
import json
import platform
import sys

PACKAGES = {
    "pypdf":        "pypdf>=4.0.0",
    "reportlab":    "reportlab>=4.2.0",
    "docx":         "python-docx>=1.1.0",
    "openpyxl":     "openpyxl>=3.1.0",
    "pptx":         "python-pptx>=0.6.23",
    "PIL":          "Pillow>=10.0.0",
    "pdfplumber":   "pdfplumber>=0.10.0",
    "pytesseract":  "pytesseract>=0.3.10",
}

OPTIONAL = {"pytesseract"}  # OCR — requires Tesseract binary too

installed = []
missing = []
optional_missing = []

for import_name, pip_name in PACKAGES.items():
    try:
        __import__(import_name)
        installed.append(import_name)
    except ImportError:
        if import_name in OPTIONAL:
            optional_missing.append(pip_name)
        else:
            missing.append(pip_name)

# Check LibreOffice (soffice)
import os, shutil
soffice_found = False
system = platform.system()
if system == "Windows":
    candidates = [
        r"C:\Program Files\LibreOffice\program\soffice.exe",
        r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
    ]
    soffice_found = any(os.path.isfile(p) for p in candidates) or bool(shutil.which("soffice"))
elif system == "Darwin":
    soffice_found = os.path.isfile("/Applications/LibreOffice.app/Contents/MacOS/soffice") \
                    or bool(shutil.which("soffice"))
else:
    soffice_found = bool(shutil.which("soffice"))

# Build install command
pip_cmd = "pip install " + " ".join(f'"{p}"' for p in missing) if missing else ""
all_cmd  = "pip install " + " ".join(f'"{p}"' for p in PACKAGES.values())

soffice_install = {
    "Windows": "winget install TheDocumentFoundation.LibreOffice",
    "Darwin":  "brew install --cask libreoffice",
    "Linux":   "sudo apt install libreoffice  # or: sudo dnf install libreoffice",
}.get(system, "Install LibreOffice from https://www.libreoffice.org/download/")

tesseract_install = {
    "Windows": "winget install UB-Mannheim.TesseractOCR",
    "Darwin":  "brew install tesseract",
    "Linux":   "sudo apt install tesseract-ocr",
}.get(system, "https://github.com/tesseract-ocr/tesseract")

# ── Auto-install Tesseract if not found ──────────────────────────────────────
tesseract_found = bool(shutil.which("tesseract"))
if not tesseract_found and system == "Darwin":
    candidates = ["/opt/homebrew/bin/tesseract", "/usr/local/bin/tesseract"]
    tesseract_found = any(os.path.isfile(p) for p in candidates)

tesseract_status = "already installed" if tesseract_found else "not found"
tesseract_auto   = None

if not tesseract_found:
    import subprocess

    if system == "Darwin":
        # ต้องมี Homebrew
        if shutil.which("brew"):
            print("[check-deps] Tesseract not found — installing via brew...", file=sys.stderr)
            r = subprocess.run(["brew", "install", "tesseract"], capture_output=True, text=True)
            if r.returncode == 0:
                tesseract_status = "installed"
                tesseract_auto   = "brew install tesseract"
            else:
                tesseract_status = f"install failed: {r.stderr.strip()}"
        else:
            tesseract_status = "brew not found — install manually: brew install tesseract"

    elif system == "Windows":
        # winget ไม่ต้องการ admin สำหรับ user-scope install
        if shutil.which("winget"):
            print("[check-deps] Tesseract not found — installing via winget...", file=sys.stderr)
            r = subprocess.run(
                ["winget", "install", "--id", "UB-Mannheim.TesseractOCR", "-e", "--silent"],
                capture_output=True, text=True
            )
            if r.returncode == 0:
                tesseract_status = "installed"
                tesseract_auto   = "winget install UB-Mannheim.TesseractOCR"
            else:
                tesseract_status = f"install failed: {r.stderr.strip()}"
        else:
            tesseract_status = "winget not found — install manually: https://github.com/UB-Mannheim/tesseract/wiki"

    elif system == "Linux":
        # apt — ลองโดยไม่มี sudo ก่อน ถ้าไม่ได้ค่อยแจ้ง
        if shutil.which("apt-get"):
            print("[check-deps] Tesseract not found — trying: sudo apt-get install tesseract-ocr ...", file=sys.stderr)
            r = subprocess.run(
                ["sudo", "apt-get", "install", "-y", "tesseract-ocr"],
                capture_output=True, text=True
            )
            if r.returncode == 0:
                tesseract_status = "installed"
                tesseract_auto   = "sudo apt-get install -y tesseract-ocr"
            else:
                tesseract_status = "install failed — run manually: sudo apt-get install tesseract-ocr"
        elif shutil.which("dnf"):
            print("[check-deps] Tesseract not found — trying: sudo dnf install tesseract ...", file=sys.stderr)
            r = subprocess.run(
                ["sudo", "dnf", "install", "-y", "tesseract"],
                capture_output=True, text=True
            )
            if r.returncode == 0:
                tesseract_status = "installed"
                tesseract_auto   = "sudo dnf install -y tesseract"
            else:
                tesseract_status = "install failed — run manually: sudo dnf install tesseract"
        else:
            tesseract_status = "no supported package manager found — install manually"

result = {
    "ok":               len(missing) == 0,
    "python_version":   sys.version,
    "os":               system,
    "installed":        installed,
    "missing":          missing,
    "optional_missing": optional_missing,
    "soffice_found":    soffice_found,
    "tesseract":        tesseract_status,
    "install": {
        "missing_packages": pip_cmd or "(all installed)",
        "all_packages":     all_cmd,
        "libreoffice":      soffice_install if not soffice_found else "(already installed)",
        "tesseract_ocr":    tesseract_auto or (tesseract_install if not tesseract_found else "(already installed)"),
    },
}

print(json.dumps(result, indent=2))
