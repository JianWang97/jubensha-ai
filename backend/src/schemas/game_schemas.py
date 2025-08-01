"""游戏相关的Pydantic模型"""
from pydantic import BaseModel
from typing import Optional

class GameResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None