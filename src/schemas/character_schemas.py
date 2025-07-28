"""角色相关的Pydantic模型"""
from .base import BaseDataModel
from pydantic import Field
from datetime import datetime

class CharacterCreateRequest(BaseDataModel):
    """角色创建请求模型"""
    name: str = Field(..., description="角色名称")
    background: str | None = Field(None, description="角色背景")
    gender: str = Field(..., description="性别")
    age: int = Field(..., description="年龄")
    profession: str | None = Field(None, description="职业")
    secret: str | None = Field(None, description="秘密")
    objective: str | None = Field(None, description="目标")
    is_victim: bool = Field(False, description="是否为受害者")
    is_murderer: bool = Field(False, description="是否为凶手")
    personality_traits: list[str] = Field(default=[], description="性格特征")
    avatar_url: str | None = Field(None, description="头像URL")
    voice_id: str | None = Field(None, description="语音ID")
    voice_preference: str | None = Field(None, description="语音偏好")

    @classmethod
    def get_db_model(cls) -> type:
        """此模型不对应数据库表，返回None"""
        return type(None)

class CharacterUpdateRequest(BaseDataModel):
    """角色更新请求模型"""
    name: str | None = Field(None, description="角色名称")
    background: str | None = Field(None, description="角色背景")
    profession: str | None = Field(None, description="职业")
    personality_traits: list[str] | None = Field(None, description="性格特征")
    avatar_url: str | None = Field(None, description="头像URL")
    voice_id: str | None = Field(None, description="语音ID")
    age: int | None = Field(None, description="年龄")
    gender: str | None = Field(None, description="性别")
    secret: str | None = Field(None, description="秘密")
    objective: str | None = Field(None, description="目标")
    is_victim: bool | None = Field(None, description="是否为受害者")
    is_murderer: bool | None = Field(None, description="是否为凶手")
    
    @classmethod
    def get_db_model(cls) -> type:
        """此模型不对应数据库表，返回None"""
        return type(None)

class CharacterPromptRequest(BaseDataModel):
    """角色头像提示词生成请求模型"""
    character_name: str = Field(..., description="角色名称")
    character_description: str = Field(..., description="角色描述")
    age: int | None = Field(None, description="年龄")
    gender: str | None = Field(None, description="性别")
    profession: str | None = Field(None, description="职业")
    personality_traits: list[str] | None = Field(None, description="性格特征")
    script_context: str | None = Field(None, description="剧本背景")
    
    @classmethod
    def get_db_model(cls) -> type:
        """此模型不对应数据库表，返回None"""
        return type(None)