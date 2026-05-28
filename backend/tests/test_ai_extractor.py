import pytest
from unittest.mock import MagicMock, patch
from app.utils.ai_extractor import GeminiExtractor
from app.schemas.ai import AIExtractionResult


MOCK_RESPONSE = '''{
  "tasks": [
    {"task_type": "LAB_TEST", "task_name": "Complete Blood Count", "confidence_score": 0.95},
    {"task_type": "RADIOLOGY", "task_name": "Chest X-Ray", "confidence_score": 0.88},
    {"task_type": "FOLLOW_UP", "task_name": "Cardiology in 2 weeks", "confidence_score": 0.91}
  ]
}'''


def test_gemini_extractor_parses_valid_response():
    extractor = GeminiExtractor(api_key="fake-key")
    result = extractor._parse_response(MOCK_RESPONSE)
    assert isinstance(result, AIExtractionResult)
    assert len(result.tasks) == 3
    assert result.tasks[0].task_name == "Complete Blood Count"


def test_gemini_extractor_raises_on_invalid_json():
    extractor = GeminiExtractor(api_key="fake-key")
    with pytest.raises(ValueError, match="Failed to parse"):
        extractor._parse_response("not json at all")


def test_gemini_extractor_raises_on_empty_tasks():
    extractor = GeminiExtractor(api_key="fake-key")
    with pytest.raises(ValueError):
        extractor._parse_response('{"tasks": []}')
