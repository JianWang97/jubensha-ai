"""剧本场景相关的Pydantic数据模型"""
from typing import List, Optional, Type
from pydantic import Field, field_validator
from .base import BaseDataModel


class ScriptLocation(BaseDataModel):
    """剧本场景"""
    script_id: Optional[int] = Field(None, description="剧本ID")
    name: str = Field("", description="场景名称")
    description: str = Field("", description="场景描述")
    searchable_items: List[str] = Field(default_factory=list, description="可搜索物品")
    background_image_url: Optional[str] = Field(None, description="背景图片URL")
    is_crime_scene: bool = Field(False, description="是否为案发现场")
    
    @field_validator('searchable_items', mode='before')
    @classmethod
    def validate_searchable_items(cls, v):
        """验证并转换searchable_items字段"""
        if v is None:
            return []
        return v
    
    @classmethod
    def get_db_model(cls) -> Type:
        from ..db.models.location import LocationDBModel
        return LocationDBModel