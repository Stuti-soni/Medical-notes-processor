import os
import pdfplumber
import pytesseract
from pdf2image import convert_from_path
from PIL import Image


def extract_text(file_path: str) -> str:
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")

    ext = os.path.splitext(file_path)[1].lower()

    if ext == ".txt":
        with open(file_path, "r", encoding="utf-8") as f:
            return f.read()
    elif ext == ".pdf":
        return _extract_pdf(file_path)
    elif ext in (".png", ".jpg", ".jpeg", ".tiff", ".bmp"):
        return _ocr_image(file_path)
    else:
        raise ValueError(f"Unsupported file type: {ext}. Supported: .txt, .pdf, .png, .jpg, .jpeg")


def _extract_pdf(file_path: str) -> str:
    text_parts = []
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)

    text = "\n".join(text_parts).strip()

    # Fall back to OCR if pdfplumber got little or no text (scanned PDF)
    if len(text) < 50:
        text = _ocr_pdf(file_path)

    return text


def _ocr_pdf(file_path: str) -> str:
    images = convert_from_path(file_path, dpi=300)
    parts = [pytesseract.image_to_string(img) for img in images]
    return "\n".join(parts).strip()


def _ocr_image(file_path: str) -> str:
    img = Image.open(file_path)
    return pytesseract.image_to_string(img).strip()
