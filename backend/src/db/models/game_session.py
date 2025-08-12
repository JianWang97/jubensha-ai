"""游戏会话数据模型"""
from sqlalchemy import Index,Column, Integer, String, Boolean, DateTime, Text, ForeignKey, JSON,Enum as SqlEnum, Float
from sqlalchemy.orm import relationship,mapped_column
from sqlalchemy.sql import func
from src.db.base import BaseSQLAlchemyModel
from enum import Enum

class GameSessionStatus(Enum):
    """游戏会话状态"""
    PENDING = "PENDING"
    STARTED = "STARTED"
    ENDED = "ENDED"
    PAUSED = "PAUSED"
    CANCELED = "CANCELED"

class GameSession(BaseSQLAlchemyModel):
    """游戏会话模型"""
    __tablename__ = "game_sessions"
    
    # 基本信息
    session_id = Column(String(100), unique=True, nullable=False, index=True, comment="会话ID")
    script_id = Column(Integer, nullable=False, comment="剧本ID")
    host_user_id = Column(Integer, ForeignKey('users.id'), nullable=False, comment="房主用户ID")
    status = mapped_column(SqlEnum(GameSessionStatus), nullable=False, comment="游戏会话状态")
    # 时间记录
    started_at = Column(DateTime(timezone=True), nullable=True, comment="游戏开始时间")
    finished_at = Column(DateTime(timezone=True), nullable=True, comment="游戏结束时间")
    # TTS相关
    total_tts_duration:Column[float] = Column(Float, nullable=True, default=0.0, comment="累计TTS音频时长（秒）")
    
    # 关联关系
    host_user = relationship("User", back_populates="hosted_sessions")
    events = relationship("GameEventDBModel", back_populates="session", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index('idx_game_sessions_host_user_id', 'host_user_id'),
        Index('idx_game_sessions_status', 'status'),
        Index('idx_game_sessions_script_id', 'script_id'),
    )

    def __repr__(self):
        return f"<GameSession(id={self.id}, session_id='{self.session_id}', status='{self.status}')>"
    
    def to_dict(self):
        """转换为字典"""
        return {
            'id': self.id,
            'session_id': self.session_id,
            'script_id': self.script_id,
            'host_user_id': self.host_user_id,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at is not None else None,  # 修复：明确检查None
            'updated_at': self.updated_at.isoformat() if self.updated_at is not None else None  # 修复：明确检查None
        }
