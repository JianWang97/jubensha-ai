"""剧本角色相关的Pydantic数据模型"""
from typing import List, Optional, Type
from enum import Enum
from pydantic import Field, field_validator
from .base import BaseDataModel


class ScriptCharacter(BaseDataModel):
    """剧本角色"""
    script_id: Optional[int] = Field(None, description="剧本ID")
    name: str = Field("", description="角色姓名")
    age: Optional[int] = Field(None, description="年龄")
    profession: str = Field("", description="职业")
    background: str = Field("", description="背景故事")
    secret: str = Field("", description="秘密")
    objective: str = Field("", description="目标")
    gender: str = Field("中性", description="性别")
    is_murderer: bool = Field(False, description="是否为凶手")
    is_victim: bool = Field(False, description="是否为受害者")
    personality_traits: List[str] = Field(default_factory=list, description="性格特征")
    avatar_url: Optional[str] = Field(None, description="头像URL")
    voice_preference: Optional[str] = Field(None, description="语音偏好")
    voice_id: Optional[str] = Field(None, description="TTS声音ID")
    
    @field_validator('personality_traits', mode='before')
    @classmethod
    def validate_personality_traits(cls, v):
        """验证并转换personality_traits字段"""
        if v is None:
            return []
        return v
    
    @classmethod
    def get_db_model(cls) -> Type:
        from ..db.models.character import CharacterDBModel
        return CharacterDBModel