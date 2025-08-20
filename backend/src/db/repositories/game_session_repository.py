"""游戏会话数据仓库"""
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc, func
from sqlalchemy.exc import SQLAlchemyError

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
    
    def delete_sessions(self, session_ids: List[str], user_id: int) -> Dict[str, Any]:
        """批量删除游戏会话
        
        Args:
            session_ids: 要删除的会话ID列表
            user_id: 当前用户ID，用于权限校验
            
        Returns:
            Dict包含:
            - success: 成功删除的session_id列表
            - failed: 删除失败的session_id列表及错误信息
        """
        success_ids = []
        failed_ids = []
        
        for session_id in session_ids:
            try:
                # 查找会话
                session = self.get_by_session_id(session_id)
                if not session:
                    failed_ids.append({
                        "session_id": session_id,
                        "error": "会话不存在"
                    })
                    continue
                
                # 权限校验：只有会话创建者才能删除
                if session.host_user_id != user_id:
                    failed_ids.append({
                        "session_id": session_id,
                        "error": "无权限删除此会话"
                    })
                    continue
                
                # 删除会话（级联删除关联的events）
                self.session.delete(session)
                self.session.flush()  # 立即执行删除
                success_ids.append(session_id)
                
            except SQLAlchemyError as e:
                # 回滚当前会话的删除操作
                self.session.rollback()
                failed_ids.append({
                    "session_id": session_id,
                    "error": f"数据库错误: {str(e)}"
                })
            except Exception as e:
                failed_ids.append({
                    "session_id": session_id,
                    "error": f"未知错误: {str(e)}"
                })
        
        return {
            "success": success_ids,
            "failed": failed_ids
        }
    
    def delete_session(self, session_id: str, user_id: int) -> bool:
        """删除单个游戏会话
        
        Args:
            session_id: 要删除的会话ID
            user_id: 当前用户ID，用于权限校验
            
        Returns:
            bool: 删除是否成功
        """
        result = self.delete_sessions([session_id], user_id)
        return len(result["success"]) > 0

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
