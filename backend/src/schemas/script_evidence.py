"""剧本证据相关的Pydantic数据模型"""
from typing import Optional, Type
from enum import Enum
from pydantic import Field
from .base import BaseDataModel


class EvidenceType(Enum):
    """证据类型"""
    PHYSICAL = "PHYSICAL"  # 物理证据
    DOCUMENT = "DOCUMENT"  # 文件证据
    VIDEO = "VIDEO"  # 视频证据
    AUDIO = "AUDIO"  # 音频证据
    IMAGE = "IMAGE"  # 图片证据


class ScriptEvidence(BaseDataModel):
    """剧本证据"""
    script_id: Optional[int] = Field(None, description="剧本ID")
    name: str = Field("", description="证据名称")
    location: str = Field("", description="发现地点")
    description: str = Field("", description="证据描述")
    related_to: Optional[str] = Field("", description="关联角色")
    significance: Optional[str] = Field("", description="重要性说明")
    evidence_type: EvidenceType = Field(EvidenceType.PHYSICAL, description="证据类型")
    importance: str = Field("重要证据", description="重要程度")
    image_url: Optional[str] = Field(None, description="证据图片URL")
    is_hidden: bool = Field(False, description="是否隐藏证据")
    
    @classmethod
    def get_db_model(cls) -> Type:
        from ..db.models.evidence import EvidenceDBModel
        return EvidenceDBModel