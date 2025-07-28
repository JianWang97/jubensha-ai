"""证据相关的Pydantic模型"""
from pydantic import BaseModel
from typing import Optional, List

class EvidenceCreateRequest(BaseModel):
    script_id: int
    name: str
    description: str
    image_url: str | None = None
    is_public: bool = True
    discovery_condition: str | None = None
    related_characters: list[int] | None = None

class EvidenceUpdateRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    image_url: str | None = None
    is_public: bool | None = None
    discovery_condition: str | None = None
    related_characters: list[int] | None = None
    importance: str | None = None

class EvidencePromptRequest(BaseModel):
    evidence_name: str
    evidence_description: str
    script_theme: str | None = None
    style_preference: str | None = None

class ScriptResponse(BaseModel):
    success: bool
    message: str
    data: dict | None = None