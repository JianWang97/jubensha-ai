"""完整剧本数据的Pydantic模型"""
from typing import List, Optional, Type
from pydantic import BaseModel, Field

from .script_info import ScriptInfo
from .background_story import BackgroundStory
from .script_character import ScriptCharacter
from .script_evidence import ScriptEvidence
from .script_location import ScriptLocation
from .game_phase import GamePhase


class Script(BaseModel):
    """完整剧本数据"""
    info: ScriptInfo = Field(description="剧本基本信息")
    background_story: Optional[BackgroundStory] = Field(None, description="背景故事")
    characters: List[ScriptCharacter] = Field(default_factory=list, description="角色列表")
    evidence: List[ScriptEvidence] = Field(default_factory=list, description="证据列表")
    locations: List[ScriptLocation] = Field(default_factory=list, description="场景列表")
    game_phases: List[GamePhase] = Field(default_factory=list, description="游戏阶段列表")
    
    @classmethod
    def get_db_model(cls) -> Type:
        # 这个类是对多个模型的组合，没有单一对应的数据库模型
        raise NotImplementedError("Script is a composite model without a direct database mapping")
