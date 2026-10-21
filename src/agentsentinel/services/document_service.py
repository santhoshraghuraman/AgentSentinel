"""
Document Processing Service (Phase 6B).

Provides robust, safe, and validated extraction of text from PDF documents.
Enforces:
- File size restrictions (max 10MB)
- Strict PDF format & %PDF- header verification
- Safe sandboxing without path traversal
- Handling of corrupted, encrypted, empty, and image-only PDFs
- Token safety bounds on extracted text
"""

import io
import os
import re
import logging
from typing import Dict, Any, Optional
import pypdf

logger = logging.getLogger(__name__)


class DocumentProcessingError(ValueError):
    """Raised when PDF validation or extraction fails."""
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class DocumentService:
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
    MAX_EXTRACT_CHARS = 50_000

    def __init__(self, sandbox_dir: str = "./sandbox"):
        self.sandbox_dir = os.path.abspath(sandbox_dir)
        os.makedirs(self.sandbox_dir, exist_ok=True)

    def validate_and_extract_pdf(self, file_bytes: bytes, filename: str) -> Dict[str, Any]:
        """
        Validates the PDF bytes and filename, extracts text using pypdf,
        safely stores a copy inside the sandbox/documents folder, and
        returns extraction metadata.
        """
        if not filename or not filename.lower().endswith(".pdf"):
            raise DocumentProcessingError(
                "Invalid file format: Only PDF documents (.pdf) are supported.",
                status_code=400
            )

        if not file_bytes or len(file_bytes) == 0:
            raise DocumentProcessingError(
                "Uploaded PDF file is empty (0 bytes).",
                status_code=400
            )

        if len(file_bytes) > self.MAX_FILE_SIZE:
            raise DocumentProcessingError(
                f"File size ({len(file_bytes)} bytes) exceeds the maximum allowed limit of 10MB.",
                status_code=413
            )

        # Header magic bytes validation
        if b"%PDF-" not in file_bytes[:1024]:
            raise DocumentProcessingError(
                "Invalid PDF header: Missing %PDF- file signature.",
                status_code=400
            )

        # Parse with pypdf
        try:
            stream = io.BytesIO(file_bytes)
            reader = pypdf.PdfReader(stream)
        except Exception as e:
            raise DocumentProcessingError(
                f"Malformed or corrupted PDF file: {e}",
                status_code=422
            )

        if reader.is_encrypted:
            raise DocumentProcessingError(
                "PDF is encrypted or password-protected. Please provide an unencrypted PDF.",
                status_code=422
            )

        page_count = len(reader.pages)
        if page_count == 0:
            raise DocumentProcessingError(
                "PDF contains zero pages.",
                status_code=422
            )

        extracted_pages = []
        for idx, page in enumerate(reader.pages):
            try:
                page_text = page.extract_text() or ""
                extracted_pages.append(page_text)
            except Exception as e:
                logger.warning(f"Failed to extract page {idx + 1} from {filename}: {e}")
                extracted_pages.append(f"[Page {idx + 1} extraction error: {e}]")

        full_text = "\n\n".join(extracted_pages).strip()

        warning: Optional[str] = None
        if not full_text:
            warning = "No extractable text found in PDF. The document may be scanned images or empty."
        elif len(full_text) > self.MAX_EXTRACT_CHARS:
            full_text = (
                full_text[:self.MAX_EXTRACT_CHARS] +
                "\n\n[Content truncated after 50,000 characters for token safety]"
            )

        # Safely save a sandboxed copy under ./sandbox/documents
        documents_dir = os.path.join(self.sandbox_dir, "documents")
        os.makedirs(documents_dir, exist_ok=True)
        base_name = os.path.basename(filename)
        safe_name = re.sub(r"[^a-zA-Z0-9_.-]", "_", base_name)
        safe_target_path = os.path.join(documents_dir, safe_name)

        # Prevent sandbox breakout
        if not safe_target_path.startswith(self.sandbox_dir):
            raise DocumentProcessingError(
                "Unsafe filesystem path detected: Path traversal outside sandbox denied.",
                status_code=403
            )

        try:
            with open(safe_target_path, "wb") as f:
                f.write(file_bytes)
            relative_path = os.path.relpath(safe_target_path, self.sandbox_dir).replace("\\", "/")
        except Exception as e:
            logger.error(f"Failed to persist sandbox document {safe_name}: {e}")
            relative_path = None

        return {
            "filename": safe_name,
            "file_size": len(file_bytes),
            "page_count": page_count,
            "extracted_text": full_text,
            "character_count": len(full_text),
            "preview": full_text[:400] + ("..." if len(full_text) > 400 else ""),
            "warning": warning,
            "sandbox_path": relative_path,
        }
