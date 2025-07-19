"""背景故事数据库模型"""
from sqlalchemy import Column, Integer, String, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from ..base import SQLAlchemyBase


class BackgroundStoryDBModel(SQLAlchemyBase):
    """背景故事数据库模型"""
    __tablename__ = 'background_stories'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    script_id = Column(Integer, ForeignKey('scripts.id'), nullable=False)
    title = Column(String(255))
    setting_description = Column(Text)
    incident_description = Column(Text)
    victim_background = Column(Text)
    investigation_scope = Column(Text)
    rules_reminder = Column(Text)
    murder_method = Column(String(100))
    murder_location = Column(String(255))
    discovery_time = Column(String(100))
    victory_conditions = Column(JSON)
    
    # 关联关系
    script = relationship("ScriptDBModel", back_populates="background_stories")