"""场景相关的Pydantic模型"""
from pydantic import BaseModel
from typing import Optional, List

class LocationCreateRequest(BaseModel):
    name: str
    description: str
    background_url: Optional[str] = None
    atmosphere: Optional[str] = None
    available_actions: Optional[List[str]] = None
    connected_locations: Optional[List[int]] = None
    hidden_clues: Optional[List[str]] = None
    access_conditions: Optional[str] = None

class LocationUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    background_url: Optional[str] = None
    atmosphere: Optional[str] = None
    available_actions: Optional[List[str]] = None
    connected_locations: Optional[List[int]] = None
    hidden_clues: Optional[List[str]] = None
    access_conditions: Optional[str] = None

class ScriptResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None