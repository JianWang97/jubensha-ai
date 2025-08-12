"""游戏会话数据仓库"""
from typing import List, Optional
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc, func

from .base import BaseRepository
from ..models.game_session import GameSession, GameSessionStatus
from ..models.game_event import GameEventDBModel, TTSGeneratedStatus

class GameSessionRepository(BaseRepository[GameSession]):
    """游戏会话仓库"""
    
    def __init__(self, session: Session):
        super().__init__(GameSession, session)
    
    def get_by_session_id(self, session_id: str) -> Optional[GameSession]:
        """根据会话ID获取会话"""
        return self.session.query(GameSession).filter(
            GameSession.session_id == session_id
        ).first()
    
    def get_session_total_duration(self, session_id: str) -> Optional[float]:
        """获取会话的总TTS时长"""
        row = self.session.query(GameSession.total_tts_duration).filter(
            GameSession.session_id == session_id
        ).first()
        if not row:
            return None
        return float(row.total_tts_duration) or 0.0

    def get_with_events(self, session_id: str) -> Optional[GameSession]:
        """获取包含事件的会话"""
        return self.session.query(GameSession).options(
            joinedload(GameSession.events)
        ).filter(GameSession.session_id == session_id).first()
    
    def get_active_sessions(self) -> List[GameSession]:
        """获取所有活跃会话"""
        return self.session.query(GameSession).filter(
            GameSession.status == "active"
        ).all()
    
    def get_user_active_session(self, user_id: int, script_id: int) -> Optional[GameSession]:
        """获取用户在指定剧本中的活跃会话（PAUSED或STARTED状态）"""
        return self.session.query(GameSession).filter(
            GameSession.host_user_id == user_id,
            GameSession.script_id == script_id,
            GameSession.status.in_([GameSessionStatus.PAUSED, GameSessionStatus.STARTED])
        ).first()
    
    def create_or_resume_session(self, user_id: int, script_id: int, session_id: Optional[str] = None) -> GameSession:
        """创建新会话或恢复现有会话"""
        # 首先检查用户是否已有活跃会话（PAUSED或STARTED状态）
        existing_session = self.get_user_active_session(user_id, script_id)
        
        if existing_session:
            # 如果会话是PAUSED状态，恢复为STARTED
            if existing_session.status == GameSessionStatus.PAUSED:
                existing_session.status = GameSessionStatus.STARTED
                self.session.flush()
            
            return existing_session
        
        # 如果没有现有会话，创建新会话
        if session_id is None:
            import uuid
            session_id = str(uuid.uuid4())
        
        new_session = GameSession(
            session_id=session_id,
            script_id=script_id,
            host_user_id=user_id,
            status=GameSessionStatus.STARTED
        )
        
        self.session.add(new_session)
        self.session.flush()
        
        return new_session
    
    def finalize_session(self, session_id: str) -> bool:
        """结束会话: 设置状态与累计TTS时长"""
        session = self.get_by_session_id(session_id)
        if not session:
            return False
        # 结束状态
        session.status = GameSessionStatus.ENDED
        # 若未设 finished_at 则设置
        from datetime import datetime
        if not session.finished_at:
            session.finished_at = datetime.utcnow()
        # 计算总TTS时长（COMPLETED事件）
        total_secs = (
            self.session.query(func.coalesce(func.sum(GameEventDBModel.tts_duration), 0.0))
            .filter(
                GameEventDBModel.session_id == session_id,
                GameEventDBModel.tts_status == TTSGeneratedStatus.COMPLETED
            )
            .scalar()
        )
        session.total_tts_duration = float(total_secs or 0.0)
        self.session.flush()
        return True

class GameEventRepository(BaseRepository[GameEventDBModel]):
    """游戏事件仓库"""
    
    def __init__(self, session: Session):
        super().__init__(GameEventDBModel, session)
    
    def get_by_session_id(self, session_id: str, limit: Optional[int] = None) -> List[GameEventDBModel]:
        """根据会话ID获取事件列表"""
        query = self.session.query(GameEventDBModel).filter(
            GameEventDBModel.session_id == session_id
        ).order_by(desc(GameEventDBModel.timestamp))
        
        if limit:
            query = query.limit(limit)
        
        return query.all()
    
    def get_pending_tts_events(self, session_id: str) -> List[GameEventDBModel]:
        """获取待生成TTS的事件"""
        return self.session.query(GameEventDBModel).filter(
            GameEventDBModel.session_id == session_id,
            GameEventDBModel.tts_status == TTSGeneratedStatus.PENDING
        ).all()
    
    def get_public_events(self, session_id: str) -> List[GameEventDBModel]:
        """获取公开事件"""
        return self.session.query(GameEventDBModel).filter(
            GameEventDBModel.session_id == session_id,
            GameEventDBModel.is_public == True
        ).order_by(GameEventDBModel.timestamp).all()
