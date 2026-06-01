"""
Cross-platform LibreOffice (soffice) helper.
Supports Windows, macOS, and Linux without LD_PRELOAD or .so shims.
"""
import os
import platform
import shutil
import subprocess
import tempfile


def get_soffice_path() -> str | None:
    """Find soffice executable path for the current OS."""
    system = platform.system()

    if system == "Windows":
        username = os.environ.get("USERNAME", "")
        candidates = [
            r"C:\Program Files\LibreOffice\program\soffice.exe",
            r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
            rf"C:\Users\{username}\AppData\Local\Programs\LibreOffice\program\soffice.exe",
        ]
    elif system == "Darwin":  # macOS
        candidates = [
            "/Applications/LibreOffice.app/Contents/MacOS/soffice",
            "/opt/homebrew/bin/soffice",
            "/usr/local/bin/soffice",
        ]
    else:  # Linux
        candidates = [
            "/usr/bin/soffice",
            "/usr/local/bin/soffice",
            "/snap/bin/libreoffice",
        ]

    for path in candidates:
        if os.path.isfile(path):
            return path

    # Fall back to PATH lookup
    return shutil.which("soffice")


def is_available() -> bool:
    return get_soffice_path() is not None


def run_soffice(args: list, **kwargs) -> subprocess.CompletedProcess:
    """Run soffice with the correct cross-platform path."""
    soffice = get_soffice_path()
    if not soffice:
        raise FileNotFoundError(
            "LibreOffice not found. Install it from https://www.libreoffice.org/download/"
        )
    return subprocess.run([soffice] + args, **kwargs)


def convert(input_path: str, output_format: str, output_dir: str | None = None) -> str:
    """
    Convert a file using LibreOffice headless.
    Returns path to the converted file.
    """
    out_dir = output_dir or tempfile.mkdtemp()
    run_soffice(
        ["--headless", "--convert-to", output_format, "--outdir", out_dir, input_path],
        capture_output=True,
        timeout=60,
    )
    # soffice names output as <basename>.<format>
    base = os.path.splitext(os.path.basename(input_path))[0]
    ext = output_format.split(":")[0]  # handle "pdf:writer_pdf_Export" style
    return os.path.join(out_dir, f"{base}.{ext}")
