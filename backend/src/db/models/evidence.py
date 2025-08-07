"""证据数据库模型"""
from enum import Enum
from sqlalchemy import Column, Integer, String, Text, Boolean, ForeignKey,Enum as SqlEnum
from sqlalchemy.orm import relationship,mapped_column
from ..base import SQLAlchemyBase
from ...schemas.evidence_type import EvidenceType
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
    evidence_type = mapped_column(SqlEnum(EvidenceType), nullable=True)
    importance = Column(String(20), default='重要证据')
    image_url = Column(Text)
    is_hidden = Column(Boolean, default=False)
    
    # 关联关系
    script = relationship("ScriptDBModel", back_populates="evidence")