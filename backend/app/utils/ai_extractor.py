import json
import re
from abc import ABC, abstractmethod

from groq import Groq

from app.schemas.ai import AIExtractionResult

EXTRACTION_PROMPT = """
You are a medical assistant. Analyze the following medical note and extract all:
- Lab tests ordered
- Radiology tests ordered
- Follow-up appointments

Return ONLY a valid JSON object with this exact structure (no markdown, no explanation):
{{
  "tasks": [
    {{"task_type": "LAB_TEST", "task_name": "<name>", "confidence_score": <0.0-1.0>}},
    {{"task_type": "RADIOLOGY", "task_name": "<name>", "confidence_score": <0.0-1.0>}},
    {{"task_type": "FOLLOW_UP", "task_name": "<name>", "confidence_score": <0.0-1.0>}}
  ]
}}

task_type must be exactly: LAB_TEST, RADIOLOGY, or FOLLOW_UP
confidence_score must be a float between 0.0 and 1.0

Medical note:
{text}
"""


class BaseExtractor(ABC):
    @abstractmethod
    def extract(self, text: str) -> AIExtractionResult:
        pass

    def _parse_response(self, raw: str) -> AIExtractionResult:
        cleaned = re.sub(r"```(?:json)?", "", raw).strip()
        try:
            data = json.loads(cleaned)
            return AIExtractionResult(**data)
        except (json.JSONDecodeError, Exception) as e:
            raise ValueError(f"Failed to parse AI response: {e}\nRaw: {raw[:200]}")


class GeminiExtractor(BaseExtractor):
    def __init__(self, api_key: str):
        self.client = Groq(api_key=api_key)

    def extract(self, text: str) -> AIExtractionResult:
        prompt = EXTRACTION_PROMPT.format(text=text)
        response = self.client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
        )
        return self._parse_response(response.choices[0].message.content)
