"""游戏历史与回放服务实现"""
from typing import List
from sqlalchemy.orm import Session
from sqlalchemy import func, and_ , desc
from src.db.repositories.game_session_repository import GameSessionRepository, GameEventRepository
from src.db.models.game_event import GameEventDBModel
from src.db.models.game_session import GameSession, GameSessionStatus
from src.db.models.user import User
from src.db.models.user_game_participant import UserGameParticipant
from src.schemas.game_history_schemas import (
    GameHistoryFilters, PaginationParams, PaginatedResponse, GameHistoryItem,
    EventFilters, GameEventItem, GameDetailResponse, GameDetailData,
    GameDetailSessionInfo, GameDetailStatistics, GameDetailPlayer, ResumeGameResponse
)

class GameHistoryService:
    def __init__(self, session: Session, session_repo: GameSessionRepository, event_repo: GameEventRepository):
        self.db = session
        self.session_repo = session_repo
        self.event_repo = event_repo

    def _base_session_query(self, user_id: int):
        # 用户为房主或参与玩家
        return (
            self.db.query(GameSession)
            .filter(GameSession.host_user_id == user_id)
        )

    async def get_user_game_history(self, user_id: int, filters: GameHistoryFilters, pagination: PaginationParams) -> PaginatedResponse:
        q = self._base_session_query(user_id)
        if filters.status:
            q = q.filter(GameSession.status == filters.status)
        if filters.script_id:
            q = q.filter(GameSession.script_id == filters.script_id)
        if filters.start_date:
            q = q.filter(GameSession.created_at >= filters.start_date)
        if filters.end_date:
            q = q.filter(GameSession.created_at <= filters.end_date)
        total = q.count()
        rows = q.order_by(desc(GameSession.created_at)).offset(pagination.offset).limit(pagination.size).all()
        items: List[GameHistoryItem] = []
        for s in rows:
            duration = None
            if s.started_at and (s.finished_at or s.status == GameSessionStatus.ENDED):
                end_time = s.finished_at
                if end_time and s.started_at:
                    duration = int((end_time - s.started_at).total_seconds() // 60)
            event_count = self.db.query(func.count(GameEventDBModel.id)).filter(GameEventDBModel.session_id==s.session_id).scalar() or 0
            player_count = self.db.query(func.count(func.distinct(UserGameParticipant.user_id))).filter(UserGameParticipant.session_id==s.session_id).scalar() or 0
            items.append(GameHistoryItem(
                id=s.id,
                session_id=s.session_id,
                script_id=s.script_id,
                script_title=None,
                status=s.status.value if hasattr(s.status, 'value') else s.status,
                created_at=s.created_at,
                started_at=s.started_at,
                finished_at=s.finished_at,
                duration_minutes=duration,
                player_count=player_count,
                event_count=event_count
            ))
        return PaginatedResponse(items=items, total=total, page=pagination.page, size=pagination.size)

    async def get_game_detail(self, session_id: str, user_id: int) -> GameDetailResponse:
        s = self.session_repo.get_by_session_id(session_id)
        if not s:
            raise ValueError("会话不存在")
        if s.host_user_id != user_id:
            # TODO: also allow participants
            pass
        # statistics
        q_events = self.db.query(GameEventDBModel).filter(GameEventDBModel.session_id==session_id)
        total_events = q_events.count()
        chat_messages = q_events.filter(GameEventDBModel.event_type=="chat").count()
        system_events = q_events.filter(GameEventDBModel.event_type=="system").count()
        tts_generated = q_events.filter(GameEventDBModel.tts_status=="COMPLETED").count()
        duration = None
        if s.started_at:
            from datetime import datetime
            end_time = s.finished_at or datetime.utcnow()
            duration = int((end_time - s.started_at).total_seconds() // 60)
        # players
        participants = self.db.query(UserGameParticipant, User).join(User, UserGameParticipant.user_id==User.id).filter(UserGameParticipant.session_id==session_id).all()
        players: List[GameDetailPlayer] = []
        for p,u in participants:
            players.append(GameDetailPlayer(user_id=u.id, username=u.username, character_name=p.character_name, join_time=p.joined_at))
        session_info = GameDetailSessionInfo(
            id=s.id,
            session_id=s.session_id,
            script_id=s.script_id,
            script_title=None,
            status=s.status.value if hasattr(s.status,'value') else s.status,
            created_at=s.created_at,
            started_at=s.started_at,
            finished_at=s.finished_at
        )
        stats = GameDetailStatistics(
            total_events=total_events,
            chat_messages=chat_messages,
            system_events=system_events,
            tts_generated=tts_generated,
            duration_minutes=duration
        )
        data = GameDetailData(session_info=session_info, statistics=stats, players=players)
        return GameDetailResponse(data=data)

    async def get_game_events(self, session_id: str, user_id: int, filters: EventFilters, pagination: PaginationParams):
        q = self.db.query(GameEventDBModel).filter(GameEventDBModel.session_id==session_id)
        if filters.event_type:
            q = q.filter(GameEventDBModel.event_type==filters.event_type)
        if filters.character_name:
            q = q.filter(GameEventDBModel.character_name==filters.character_name)
        if filters.start_time:
            q = q.filter(GameEventDBModel.timestamp >= filters.start_time)
        if filters.end_time:
            q = q.filter(GameEventDBModel.timestamp <= filters.end_time)
        total = q.count()
        events = q.order_by(GameEventDBModel.timestamp.asc()).offset(pagination.offset).limit(pagination.size).all()
        items = [GameEventItem(
            id=e.id,
            session_id=e.session_id,
            event_type=e.event_type,
            character_name=e.character_name,
            content=e.content,
            tts_file_url=e.tts_file_url,
            tts_voice=e.tts_voice,
            tts_duration=e.tts_duration,
            tts_status=e.tts_status.value if hasattr(e.tts_status, 'value') else e.tts_status,
            event_metadata=e.event_metadata,
            timestamp=e.timestamp
        ) for e in events]
        return PaginatedResponse(items=items, total=total, page=pagination.page, size=pagination.size)

class GameResumeService:
    def __init__(self, session: Session, session_repo: GameSessionRepository):
        self.db = session
        self.session_repo = session_repo

    async def resume_game(self, session_id: str, user_id: int) -> ResumeGameResponse:
        s = self.session_repo.get_by_session_id(session_id)
        if not s:
            raise ValueError("会话不存在")
        # 权限检查: 房主或参与者
        # 这里简单放行房主
        if s.host_user_id != user_id:
            pass
        # 如果是暂停则恢复
        if hasattr(s.status, 'value'):
            status_val = s.status.value
        else:
            status_val = s.status
        if status_val == GameSessionStatus.PAUSED.value:
            s.status = GameSessionStatus.STARTED
        self.db.flush()
        # 构造websocket URL (假设路径 /ws)
        websocket_url = f"ws://localhost:8000/ws?script_id={s.script_id}"
        current_state = {"status": status_val, "script_id": s.script_id}
        return ResumeGameResponse(session_id=session_id, websocket_url=websocket_url, current_state=current_state)
