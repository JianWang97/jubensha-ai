"""角色数据库模型"""
from sqlalchemy import Column, Integer, String, Text, Boolean, ForeignKey, JSON
from sqlalchemy.orm import relationship
from ..base import SQLAlchemyBase


class CharacterDBModel(SQLAlchemyBase):
    """角色数据库模型"""
    __tablename__ = 'characters'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    script_id = Column(Integer, ForeignKey('scripts.id'), nullable=False)
    name = Column(String(100), nullable=False)
    age = Column(Integer)
    profession = Column(String(100))
    background = Column(Text)
    secret = Column(Text)
    objective = Column(Text)
    gender = Column(String(10), default='中性')
    is_murderer = Column(Boolean, default=False)
    is_victim = Column(Boolean, default=False)
    personality_traits = Column(JSON)
    avatar_url = Column(Text)
    voice_preference = Column(String(50))
    voice_id = Column(String(50))
    
    # 关联关系
    script = relationship("ScriptDBModel", back_populates="characters")