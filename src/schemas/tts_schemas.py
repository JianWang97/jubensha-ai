"""TTS相关的Pydantic模型"""
from pydantic import BaseModel
from typing import Optional

class TTSRequest(BaseModel):
    text: str
    character: str = "default"
    voice: Optional[str] = None