"""剧本数据库模型"""
from enum import Enum
from decimal import Decimal
from sqlalchemy import Column, Integer, String, Text, Boolean, JSON, Enum as SQLEnum, Numeric
from sqlalchemy.orm import relationship, Mapped, mapped_column
from ..base import BaseSQLAlchemyModel


class ScriptStatus(Enum):
    """剧本状态"""
    DRAFT = "DRAFT"  # 草稿
    PUBLISHED = "PUBLISHED"  # 已发布
    ARCHIVED = "ARCHIVED"  # 已归档


class ScriptDBModel(BaseSQLAlchemyModel):
    """剧本数据库模型"""
    __tablename__ = 'scripts'
    
    title = Column(String(255), nullable=False)
    description = Column(Text)
    author = Column(String(100))
    player_count = Column(Integer, default=6)
    duration_minutes = Column(Integer, default=180)
    difficulty = Column(String(20), default='medium')
    tags = Column(JSON)
    status: Mapped[ScriptStatus] = mapped_column(SQLEnum(ScriptStatus), default=ScriptStatus.DRAFT)
    cover_image_url = Column(Text)
    is_public = Column(Boolean, default=False)
    price = Column(Numeric(10, 2), default=0.00)  # 使用Decimal类型存储价格
    
    # 关联关系
    characters = relationship("CharacterDBModel", back_populates="script", cascade="all, delete-orphan")
    evidence = relationship("EvidenceDBModel", back_populates="script", cascade="all, delete-orphan")
    locations = relationship("LocationDBModel", back_populates="script", cascade="all, delete-orphan")
    background_stories = relationship("BackgroundStoryDBModel", back_populates="script", cascade="all, delete-orphan")
    game_phases = relationship("GamePhaseDBModel", back_populates="script", cascade="all, delete-orphan")