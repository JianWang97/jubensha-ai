"""游戏阶段数据库模型"""
from sqlalchemy import Column, Integer, String, Text, ForeignKey, Enum
from sqlalchemy.orm import relationship, Mapped, mapped_column
from ..base import SQLAlchemyBase
from ...schemas.script import GamePhaseEnum


class GamePhaseDBModel(SQLAlchemyBase):
    """游戏阶段数据库模型"""
    __tablename__ = 'game_phases'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    script_id = Column(Integer, ForeignKey('scripts.id'), nullable=False)
    phase = mapped_column(Enum(GamePhaseEnum), nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    order_index = Column(Integer, default=0)
    
    # 关联关系
    script = relationship("ScriptDBModel", back_populates="game_phases")