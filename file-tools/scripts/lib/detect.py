"""
File type detection by extension.
"""
import os

EXTENSION_MAP = {
    # PDF
    ".pdf": "pdf",
    # Word
    ".docx": "docx",
    ".doc": "doc",
    ".odt": "odt",
    # Excel
    ".xlsx": "xlsx",
    ".xls": "xls",
    ".csv": "csv",
    ".tsv": "tsv",
    ".ods": "ods",
    # PowerPoint
    ".pptx": "pptx",
    ".ppt": "ppt",
    ".odp": "odp",
    # Images
    ".jpg": "image",
    ".jpeg": "image",
    ".png": "image",
    ".gif": "image",
    ".bmp": "image",
    ".tiff": "image",
    ".tif": "image",
    ".webp": "image",
    ".ico": "image",
    ".svg": "image",
    # Text
    ".txt": "text",
    ".md": "text",
    ".json": "text",
    ".xml": "text",
    ".html": "text",
    ".htm": "text",
}


def detect(path: str) -> str:
    """Return file type category string or 'unknown'."""
    ext = os.path.splitext(path)[1].lower()
    return EXTENSION_MAP.get(ext, "unknown")


def require(path: str, *allowed_types: str):
    """Raise ValueError if file type not in allowed_types."""
    ftype = detect(path)
    if ftype not in allowed_types:
        raise ValueError(
            f"File '{os.path.basename(path)}' is type '{ftype}', "
            f"expected one of: {', '.join(allowed_types)}"
        )
    return ftype
