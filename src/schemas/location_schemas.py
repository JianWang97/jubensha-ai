"""场景相关的Pydantic模型"""
from typing import Any
from pydantic import BaseModel

class LocationCreateRequest(BaseModel):
    name: str
    description: str
    background_url: str | None = None
    atmosphere: str | None = None
    available_actions: list[str] | None = None
    connected_locations: list[int] | None = None
    hidden_clues: list[str] | None = None
    access_conditions: str | None = None

class LocationUpdateRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    background_url: str | None = None
    atmosphere: str | None = None
    available_actions: list[str] | None = None
    connected_locations: list[int] | None = None

class LocationPromptRequest(BaseModel):
    """场景图片提示词生成请求模型"""
    location_name: str
    location_description: str
    script_theme: str | None = None
    style_preference: str | None = None
    is_crime_scene: bool = False
    hidden_clues: list[str] | None = None
    access_conditions: str | None = None

class ScriptResponse(BaseModel):
    success: bool
    message: str
    data: dict[str, Any] | None = None