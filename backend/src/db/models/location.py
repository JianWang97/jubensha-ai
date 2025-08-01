"""场景数据库模型"""
from sqlalchemy import Column, Integer, String, Text, Boolean, ForeignKey, JSON
from sqlalchemy.orm import relationship
from ..base import SQLAlchemyBase


class LocationDBModel(SQLAlchemyBase):
    """场景数据库模型"""
    __tablename__ = 'locations'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    script_id = Column(Integer, ForeignKey('scripts.id'), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    searchable_items = Column(JSON)
    background_image_url = Column(Text)
    is_crime_scene = Column(Boolean, default=False)
    
    # 关联关系
    script = relationship("ScriptDBModel", back_populates="locations")