"""证据数据库模型"""
from enum import Enum
from sqlalchemy import Column, Integer, String, Text, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from ..base import SQLAlchemyBase


class EvidenceType(Enum):
    """证据类型"""
    PHYSICAL = "physical"  # 物理证据
    DOCUMENT = "document"  # 文件证据
    VIDEO = "video"  # 视频证据
    AUDIO = "audio"  # 音频证据
    IMAGE = "image"  # 图片证据


class EvidenceDBModel(SQLAlchemyBase):
    """证据数据库模型"""
    __tablename__ = 'evidence'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    script_id = Column(Integer, ForeignKey('scripts.id'), nullable=False)
    name = Column(String(255), nullable=False)
    location = Column(String(255))
    description = Column(Text)
    related_to = Column(String(100))
    significance = Column(Text)
    evidence_type = Column(String(20), default='physical')
    importance = Column(String(20), default='重要证据')
    image_url = Column(Text)
    is_hidden = Column(Boolean, default=False)
    
    # 关联关系
    script = relationship("ScriptDBModel", back_populates="evidence")