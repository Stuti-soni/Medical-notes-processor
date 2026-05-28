import pytest
import os
from app.utils.file_parser import extract_text

FIXTURES = os.path.join(os.path.dirname(__file__), "fixtures")


def test_extract_text_from_txt():
    path = os.path.join(FIXTURES, "sample.txt")
    text = extract_text(path)
    assert "Complete Blood Count" in text
    assert "Chest X-Ray" in text


def test_extract_text_unsupported_format_raises():
    with pytest.raises(ValueError, match="Unsupported file type"):
        extract_text("/some/file.docx")


def test_extract_text_missing_file_raises():
    with pytest.raises(FileNotFoundError):
        extract_text("/nonexistent/path/file.txt")
