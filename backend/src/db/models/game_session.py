"""游戏会话数据模型"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from src.db.base import BaseSQLAlchemyModel

class GameSession(BaseSQLAlchemyModel):
    """游戏会话模型"""
    __tablename__ = "game_sessions"
    
    # 基本信息
    session_id = Column(String(100), unique=True, nullable=False, index=True, comment="会话ID")
    script_id = Column(Integer, nullable=False, comment="剧本ID")
    host_user_id = Column(Integer, ForeignKey('users.id'), nullable=False, comment="房主用户ID")
    
    # 游戏状态
    status = Column(String(20), default='waiting', nullable=False, comment="游戏状态: waiting, playing, finished, cancelled")
    current_phase = Column(String(50), nullable=True, comment="当前游戏阶段")
    
    # 游戏配置
    max_players = Column(Integer, default=4, nullable=False, comment="最大玩家数")
    current_players = Column(Integer, default=0, nullable=False, comment="当前玩家数")
    
    # 游戏数据
    game_data = Column(JSON, nullable=True, comment="游戏数据(JSON格式)")
    
    # 时间记录
    started_at = Column(DateTime(timezone=True), nullable=True, comment="游戏开始时间")
    finished_at = Column(DateTime(timezone=True), nullable=True, comment="游戏结束时间")
    
    # 关联关系
    host_user = relationship("User", back_populates="hosted_sessions")
    participants = relationship("GameParticipant", back_populates="session", cascade="all, delete-orphan")
    
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
            'current_phase': self.current_phase,
            'max_players': self.max_players,
            'current_players': self.current_players,
            'game_data': self.game_data,
            'started_at': self.started_at.isoformat() if self.started_at is not None else None,  # 修复：明确检查None
            'finished_at': self.finished_at.isoformat() if self.finished_at is not None else None,  # 修复：明确检查None
            'created_at': self.created_at.isoformat() if self.created_at is not None else None,  # 修复：明确检查None
            'updated_at': self.updated_at.isoformat() if self.updated_at is not None else None  # 修复：明确检查None
        }

class GameParticipant(BaseSQLAlchemyModel):
    """游戏参与者模型"""
    __tablename__ = "game_participants"
    
    # 关联信息
    session_id = Column(Integer, ForeignKey('game_sessions.id'), nullable=False, comment="游戏会话ID")
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, comment="用户ID")
    character_id = Column(Integer, nullable=True, comment="角色ID")
    
    # 游戏状态
    role = Column(String(20), default='player', nullable=False, comment="角色类型: host, player")
    status = Column(String(20), default='joined', nullable=False, comment="参与状态: joined, playing, finished, left")
    
    # 游戏结果
    is_winner = Column(Boolean, default=False, nullable=False, comment="是否获胜")
    score = Column(Integer, default=0, nullable=False, comment="得分")
    
    # 时间记录
    joined_at = Column(DateTime(timezone=True), default=func.now(), nullable=False, comment="加入时间")
    left_at = Column(DateTime(timezone=True), nullable=True, comment="离开时间")
    
    # 关联关系
    session = relationship("GameSession", back_populates="participants")
    user = relationship("User", back_populates="game_participations")
    
    def __repr__(self):
        return f"<GameParticipant(id={self.id}, user_id={self.user_id}, session_id={self.session_id})>"
    
    def to_dict(self):
        """转换为字典"""
        return {
            'id': self.id,
            'session_id': self.session_id,
            'user_id': self.user_id,
            'character_id': self.character_id,
            'role': self.role,
            'status': self.status,
            'is_winner': self.is_winner,
            'score': self.score,
            'joined_at': self.joined_at.isoformat() if self.joined_at else None,
            'left_at': self.left_at.isoformat() if self.left_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }