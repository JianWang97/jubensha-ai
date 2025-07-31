"""完整剧本数据的Pydantic模型"""
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
    background_story: BackgroundStory | None = Field(None, description="背景故事")
    characters: list[ScriptCharacter] = Field(default_factory=list, description="角色列表")
    evidence: list[ScriptEvidence] = Field(default_factory=list, description="证据列表")
    locations: list[ScriptLocation] = Field(default_factory=list, description="场景列表")
    game_phases: list[GamePhase] = Field(default_factory=list, description="游戏阶段列表")
    
    @classmethod
    def get_db_model(cls) -> type:
        # 这个类是对多个模型的组合，没有单一对应的数据库模型
        raise NotImplementedError("Script is a composite model without a direct database mapping")
