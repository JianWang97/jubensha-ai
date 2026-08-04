"""TTS语音合成相关的API路由"""
from fastapi import APIRouter, Request, Depends, HTTPException
from fastapi.responses import StreamingResponse
from typing import List, Dict, Any, Optional
import json
import logging

from ...core.websocket_server import game_server
from ...services import TTSService
from ...services.tts_service import get_tts_service
from ...services.tts_voices import fetch_voices_payload
from ...core.config import config
from ...schemas.tts_schemas import TTSRequest
from ...services.tts_event_service import get_tts_event_service
from ...core.auth_middleware import get_current_active_user_from_request
from ...db.session import get_db_session
from sqlalchemy.orm import Session
from ...db.repositories.game_session_repository import GameSessionRepository

router = APIRouter(prefix="/api/tts", tags=["语音合成"])

# 配置日志
logger = logging.getLogger(__name__)

@router.get("/voices")
async def get_available_voices() -> Dict[str, Any]:
    """获取可用的TTS声音列表（实现见 services.tts_voices，与编辑Agent共用）"""
    return await fetch_voices_payload()
