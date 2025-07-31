"""剧本信息相关的Pydantic数据模型"""
from enum import Enum
from pydantic import Field, field_validator
from .base import BaseDataModel


class ScriptStatus(Enum):
    """剧本状态"""
    DRAFT = "DRAFT"  # 草稿
    PUBLISHED = "PUBLISHED"  # 已发布
    ARCHIVED = "ARCHIVED"  # 已归档


class ScriptInfo(BaseDataModel):
    """剧本基本信息"""
    title: str = Field("", description="剧本标题")
    description: str = Field("", description="剧本描述")
    author: str | None = Field(None, description="作者")
    player_count: int = Field(4, description="玩家数量")
    estimated_duration: int = Field(180, description="预计游戏时长(分钟)", alias="duration_minutes")
    difficulty_level: str = Field("medium", description="难度等级", alias="difficulty")
    tags: list[str] = Field(default_factory=list, description="标签列表")
    status: ScriptStatus = Field(ScriptStatus.DRAFT, description="剧本状态")
    cover_image_url: str | None = Field(None, description="封面图片URL")
    is_public: bool = Field(False, description="是否公开")
    price: float = Field(0.00, description="价格")
    # 新增字段
    rating: float = Field(0.0, description="剧本评分(0-5分)")
    category: str = Field("推理", description="剧本分类")
    play_count: int = Field(0, description="游玩次数统计")
    
    model_config = {"populate_by_name": True}
    
    @field_validator('status', mode='before')
    @classmethod
    def validate_status(cls, v):
        """验证并转换status字段"""
        if hasattr(v, 'value'):  # 如果是枚举对象，获取其值
            return v.value
        return v
    
    @field_validator('tags', mode='before')
    @classmethod
    def validate_tags(cls, v):
        """验证并转换tags字段"""
        if v is None:
            return []
        return v
    
    @classmethod
    def get_db_model(cls) -> type:
        from ..db.models.script_model import ScriptDBModel
        return ScriptDBModel