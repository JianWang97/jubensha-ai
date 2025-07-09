"""游戏事件数据模型"""
from dataclasses import dataclass

@dataclass
class GameEvent:
    """游戏事件数据模型"""
    type: str
    character: str
    content: str
    timestamp: float