"""游戏阶段枚举"""
from enum import Enum

class GamePhase(Enum):
    """游戏阶段枚举"""
    BACKGROUND = "background"
    INTRODUCTION = "introduction"
    EVIDENCE_COLLECTION = "evidence_collection"
    INVESTIGATION = "investigation"
    DISCUSSION = "discussion"
    VOTING = "voting"
    REVELATION = "revelation"
    ENDED = "ended"