"""游戏事件数据库模型"""
from sqlalchemy import Column, Integer, String, DateTime, Text, JSON, ForeignKey, Float, Boolean,Enum as SqlEnum
from sqlalchemy.orm import relationship,Mapped, mapped_column
from datetime import datetime
from typing import Dict, Any, Optional
from ..base import BaseSQLAlchemyModel
from enum import Enum

class TTSGeneratedStatus(Enum):
    PENDING = "PENDING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    SKIPPED = "SKIPPED"

class GameEventDBModel(BaseSQLAlchemyModel):
    """游戏事件模型"""
    __tablename__ = "game_events"
    
    session_id = Column(String(100), ForeignKey("game_sessions.session_id"), nullable=False, index=True)
    event_type = Column(String(50), nullable=False, index=True)  # action, chat, system, phase_change, tts
    character_name = Column(String(100), nullable=True, index=True)
    content = Column(Text, nullable=False)
    
    # TTS相关字段
    tts_file_url = Column(String(500), nullable=True)  # TTS音频文件URL
    tts_voice = Column(String(50), nullable=True)  # 使用的声音类型
    tts_duration = Column(Float, nullable=True)  # 音频时长（秒）
    tts_status:Mapped[TTSGeneratedStatus] = mapped_column(SqlEnum(TTSGeneratedStatus),default=TTSGeneratedStatus.PENDING)
    
    # 其他字段
    event_metadata = Column(JSON, nullable=True)  # 附加数据
    timestamp = Column(DateTime, nullable=False, index=True, default=datetime.utcnow)
    is_public = Column(Boolean, default=True)  # 是否为公开事件
    
    # 关联关系
    session = relationship("GameSession", back_populates="events")
    
    def __repr__(self):
        return f"<GameEvent(session_id={self.session_id}, type={self.event_type}, character={self.character_name})>"
    
    def update_tts_info(self, file_url: str, voice: str, duration: Optional[float] = None):
        """更新TTS信息"""
        self.tts_file_url = file_url
        self.tts_voice = voice
        self.tts_duration = duration
        self.tts_status = TTSGeneratedStatus.COMPLETED
    
    def mark_tts_failed(self):
        """标记TTS生成失败"""
        self.tts_status =TTSGeneratedStatus.FAILED
    
    def skip_tts(self):
        """跳过TTS生成"""
        self.tts_status = TTSGeneratedStatus.SKIPPED
