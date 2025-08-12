"""TTS语音合成相关的API路由"""
from fastapi import APIRouter, Request, Depends, HTTPException
from fastapi.responses import StreamingResponse
from typing import List, Dict, Any, Optional
import json
import logging

from ...core.websocket_server import game_server
from ...services import TTSService
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
    """获取可用的TTS声音列表"""
    try:
        # 创建TTS服务实例
        tts_service = TTSService.from_config(config.tts_config)
        
        # 根据不同的TTS提供商返回不同的声音列表
        provider = config.tts_config.provider.lower()
        
        if provider == "dashscope":
            # DashScope使用固定的声音列表
            voices = [
                {"voice_id": "Ethan", "name": "Ethan", "gender": "male", "language": "en"},
                {"voice_id": "Emma", "name": "Emma", "gender": "female", "language": "en"},
                {"voice_id": "Liam", "name": "Liam", "gender": "male", "language": "en"},
                {"voice_id": "Olivia", "name": "Olivia", "gender": "female", "language": "en"},
                {"voice_id": "Noah", "name": "Noah", "gender": "male", "language": "en"},
                {"voice_id": "Ava", "name": "Ava", "gender": "female", "language": "en"},
                {"voice_id": "William", "name": "William", "gender": "male", "language": "en"},
                {"voice_id": "Sophia", "name": "Sophia", "gender": "female", "language": "en"}
            ]
            return {
                "success": True,
                "provider": "dashscope",
                "voices": voices
            }
        
        elif provider == "minimax":
            # MiniMax需要调用API获取声音列表
            if hasattr(tts_service, 'get_voice_list'):
                voice_response = await tts_service.get_voice_list()
                if voice_response and voice_response.get('success'):
                    data = voice_response.get('data', {})
                    return {
                        "success": True,
                        "provider": "minimax",
                        "data": data,
                    }
                else:
                    error_msg = voice_response.get('error') if voice_response else "Unknown error"
                    logger.error(f"Failed to get voice list from MiniMax: {error_msg}")
                    return {
                        "success": False,
                        "error": f"获取Minimax声音列表失败: {error_msg}",
                        "provider": "minimax"
                    }
            return {
                "success": False,
                "error": "获取Minimax声音列表失败: 服务不支持get_voice_list方法"
            }
        else:
            return {
                "success": False,
                "error": f"不支持的TTS提供商: {provider}"
            }

    except Exception as e:
        logger.error(f"Failed to get available voices: {str(e)}", exc_info=True)
        return {
            "success": False,
            "error": f"获取声音列表失败: {str(e)}"
        }
