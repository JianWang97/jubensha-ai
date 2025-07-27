"""游戏阶段相关的Pydantic数据模型"""
from typing import Optional, Type
from enum import Enum
from pydantic import Field
from .base import BaseDataModel


class GamePhaseEnum(Enum):
    """游戏阶段枚举"""
    BACKGROUND = "BACKGROUND"  # 背景介绍
    INTRODUCTION = "INTRODUCTION"  # 自我介绍
    EVIDENCE_COLLECTION = "EVIDENCE_COLLECTION"  # 搜证阶段
    INVESTIGATION = "INVESTIGATION"  # 调查取证
    DISCUSSION = "DISCUSSION"  # 自由讨论
    VOTING = "VOTING"  # 投票表决
    REVELATION = "REVELATION"  # 真相揭晓
    ENDED = "ENDED"  # 游戏结束


class GamePhase(BaseDataModel):
    """游戏阶段"""
    script_id: Optional[int] = Field(None, description="剧本ID")
    phase: GamePhaseEnum = Field(GamePhaseEnum.BACKGROUND, description="阶段标识")
    name: str = Field("", description="阶段名称")
    description: str = Field("", description="阶段描述")
    order_index: int = Field(0, description="排序索引")
    
    @classmethod
    def get_db_model(cls) -> Type:
        from ..db.models.game_phase import GamePhaseDBModel
        return GamePhaseDBModel