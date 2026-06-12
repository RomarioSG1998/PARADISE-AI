"""
PDF Text Extraction Module — Paradise AI / writer.AI
=====================================================
Handles two types of PDFs:
  1. Digital (text-layer) PDFs  → extracted directly with pypdf (fast, lossless)
  2. Scanned / image-based PDFs → OCR via pytesseract + pdf2image (Tesseract)

The heuristic: if pypdf extracts fewer than MIN_CHARS_PER_PAGE characters per page
on average, the PDF is treated as a scanned document and OCR is run.
"""

import io
import re
import logging

logger = logging.getLogger(__name__)

# Minimum average characters per page to consider a PDF as "digital"
MIN_CHARS_PER_PAGE = 80

# Tesseract language code (supports Brazilian Portuguese out of the box)
OCR_LANGUAGES = "por+eng"


def _clean(text: str) -> str:
    """Normalize whitespace and remove control characters."""
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _extract_with_pypdf(file_bytes: bytes) -> tuple[str, int]:
    """
    Extract text using pypdf.
    Returns (extracted_text, num_pages).
    """
    from pypdf import PdfReader
    reader = PdfReader(io.BytesIO(file_bytes))
    pages_text = []
    for page in reader.pages:
        t = page.extract_text() or ""
        pages_text.append(t)
    full_text = "\n".join(pages_text)
    return _clean(full_text), len(pages_text)


def _is_scanned(text: str, num_pages: int) -> bool:
    """Return True if the extracted text is too sparse to be a digital PDF."""
    if num_pages == 0:
        return True
    avg = len(text) / num_pages
    return avg < MIN_CHARS_PER_PAGE


def _extract_with_ocr(file_bytes: bytes) -> str:
    """
    Convert each PDF page to an image and run Tesseract OCR on it.
    Requires: tesseract-ocr, tesseract-ocr-por, poppler-utils (all installed via apt).
    Python packages: pytesseract, pdf2image, Pillow.
    """
    try:
        from pdf2image import convert_from_bytes
        import pytesseract
    except ImportError as exc:
        raise RuntimeError(
            "OCR dependencies not installed. "
            "Add 'pytesseract' and 'pdf2image' to requirements.txt "
            "and install 'tesseract-ocr tesseract-ocr-por poppler-utils' via apt."
        ) from exc

    logger.info("[pdf_extractor] Scanned PDF detected — running OCR (Tesseract)…")

    images = convert_from_bytes(file_bytes, dpi=250)
    pages_text = []
    for idx, img in enumerate(images):
        try:
            text = pytesseract.image_to_string(img, lang=OCR_LANGUAGES)
            pages_text.append(text)
            logger.debug(f"[pdf_extractor] OCR page {idx+1}: {len(text)} chars")
        except Exception as e:
            logger.warning(f"[pdf_extractor] OCR failed on page {idx+1}: {e}")
            pages_text.append("")

    return _clean("\n\n".join(pages_text))


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """
    Main entry point.

    Tries pypdf first (fast). If the result looks like a scanned PDF
    (very little text), falls back to OCR automatically.

    Args:
        file_bytes: Raw bytes of the PDF file.

    Returns:
        Extracted plain text string.

    Raises:
        RuntimeError: If both methods fail.
    """
    # ── Step 1: Try digital extraction ──────────────────────────────────────
    try:
        digital_text, num_pages = _extract_with_pypdf(file_bytes)
        logger.info(
            f"[pdf_extractor] pypdf extracted {len(digital_text)} chars "
            f"across {num_pages} page(s)."
        )
    except Exception as e:
        logger.warning(f"[pdf_extractor] pypdf failed: {e}. Falling back to OCR.")
        digital_text, num_pages = "", 0

    # ── Step 2: If text is sufficient, return it ─────────────────────────────
    if digital_text and not _is_scanned(digital_text, num_pages):
        logger.info("[pdf_extractor] Digital PDF — returning pypdf text.")
        return digital_text

    # ── Step 3: Scanned PDF → OCR ────────────────────────────────────────────
    logger.info(
        f"[pdf_extractor] PDF appears scanned "
        f"(avg {len(digital_text) / max(num_pages,1):.0f} chars/page < {MIN_CHARS_PER_PAGE}). "
        "Switching to OCR…"
    )
    
    import os
    if os.environ.get("RENDER") == "true":
        raise RuntimeError(
            "Este é um PDF escaneado que requer processamento avançado (OCR). "
            "Devido aos limites de processamento e memória do nosso servidor em nuvem (Render), "
            "esta operação foi bloqueada para evitar instabilidade no sistema. "
            "Por favor, utilize a versão local do aplicativo em seu computador para enviar este PDF."
        )
    ocr_text = _extract_with_ocr(file_bytes)

    if not ocr_text:
        if digital_text:
            # Return the sparse digital text as a last resort
            logger.warning("[pdf_extractor] OCR returned empty. Using sparse pypdf text.")
            return digital_text
        raise RuntimeError(
            "Não foi possível extrair texto deste PDF. "
            "Verifique se o arquivo não está corrompido ou protegido por senha."
        )

    logger.info(f"[pdf_extractor] OCR extracted {len(ocr_text)} chars total.")
    return ocr_text
