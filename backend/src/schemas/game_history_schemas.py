"""游戏历史/回放相关Pydantic模型"""
from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime
from enum import Enum

class GameSessionStatusEnum(str, Enum):
    PENDING = "PENDING"
    STARTED = "STARTED"
    ENDED = "ENDED"
    PAUSED = "PAUSED"
    CANCELED = "CANCELED"

class PaginationParams(BaseModel):
    page: int = Field(1, ge=1)
    size: int = Field(20, ge=1, le=100)

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.size

class GameHistoryFilters(BaseModel):
    status: Optional[GameSessionStatusEnum] = None
    script_id: Optional[int] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None

class EventFilters(BaseModel):
    event_type: Optional[str] = None
    character_name: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None

class GameEventItem(BaseModel):
    id: int
    session_id: str
    event_type: str
    character_name: Optional[str]
    content: str
    tts_file_url: Optional[str] = None
    tts_voice: Optional[str] = None
    tts_duration: Optional[float] = None
    tts_status: Optional[str] = None
    event_metadata: Optional[Any] = None
    timestamp: datetime

class GameHistoryItem(BaseModel):
    id: int
    session_id: str
    script_id: int
    script_title: Optional[str] = None
    status: GameSessionStatusEnum
    created_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    player_count: Optional[int] = None
    event_count: Optional[int] = None

class PaginatedResponse(BaseModel):
    success: bool = True
    items: List[Any]
    total: int
    page: int
    size: int

class GameDetailSessionInfo(BaseModel):
    id: int
    session_id: str
    script_id: int
    script_title: Optional[str]
    status: GameSessionStatusEnum
    created_at: Optional[datetime]
    started_at: Optional[datetime]
    finished_at: Optional[datetime]

class GameDetailStatistics(BaseModel):
    total_events: int
    chat_messages: int
    system_events: int
    tts_generated: int
    duration_minutes: Optional[int]

class GameDetailPlayer(BaseModel):
    user_id: int
    username: str
    character_name: Optional[str]
    join_time: Optional[datetime]

class GameDetailData(BaseModel):
    session_info: GameDetailSessionInfo
    statistics: GameDetailStatistics
    players: List[GameDetailPlayer]

class GameDetailResponse(BaseModel):
    success: bool = True
    data: GameDetailData

class ResumeGameResponse(BaseModel):
    success: bool = True
    session_id: str
    websocket_url: str
    current_state: dict

class BaseSuccessResponse(BaseModel):
    success: bool = True
    data: Any | None = None

