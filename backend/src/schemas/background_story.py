"""背景故事相关的Pydantic数据模型"""
from typing import Optional, Type, Dict, Any
from pydantic import Field, field_validator
from .base import BaseDataModel


class BackgroundStory(BaseDataModel):
    """背景故事"""
    script_id: Optional[int] = Field(None, description="剧本ID")
    title: str = Field("", description="标题")
    setting_description:Optional[str] = Field("", description="背景设定")
    incident_description:Optional[str] = Field("", description="事件描述")
    victim_background:Optional[str] = Field("", description="受害者背景")
    investigation_scope:Optional[str] = Field("", description="调查范围")
    rules_reminder:Optional[str] = Field("", description="规则提醒")
    murder_method:Optional[str] = Field("", description="作案手法")
    murder_location:Optional[str] = Field("", description="作案地点")
    discovery_time:Optional[str] = Field("", description="发现时间")
    victory_conditions: Optional[Dict[str, Any]] = Field(default=dict(), description="胜利条件")
    
    @field_validator('victory_conditions', mode='before')
    @classmethod
    def validate_victory_conditions(cls, v):
        """验证并转换victory_conditions字段"""
        if v is None:
            return {}
        if isinstance(v, str):
            try:
                import json
                return json.loads(v)
            except (json.JSONDecodeError, TypeError):
                return {}
        if isinstance(v, dict):
            return v
        return {}
    
    @classmethod
    def get_db_model(cls) -> Type:
        from ..db.models.background_story import BackgroundStoryDBModel
        return BackgroundStoryDBModel