"""游戏管理相关的API路由"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from ...core.websocket_server import game_server

router = APIRouter(prefix="/api/game", tags=["游戏管理"])

class GameResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None

def create_response(success: bool, message: str, data=None):
    """创建统一的响应格式"""
    return {
        "success": success,
        "message": message,
        "data": data
    }

@router.get("/status")
async def get_game_status(session_id: str = None):
    """获取游戏状态API"""
    try:
        # 如果没有提供session_id，使用默认会话
        if session_id is None:
            session_id = "default"
        
        # 获取或创建会话
        session = game_server.get_or_create_session(session_id)
        
        # 确保游戏已初始化
        if not session._game_initialized:
            await game_server._initialize_game(session)
        
        return {
            "success": True,
            "message": "获取游戏状态成功",
            "data": session.game_engine.game_state
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Failed to get game status: {str(e)}"
        }

@router.post("/start")
async def start_game(session_id: str = None, script_id: int = 1):
    """启动游戏API"""
    try:
        # 如果没有提供session_id，使用默认会话
        if session_id is None:
            session_id = "default"
        
        await game_server.start_game(session_id, script_id)
        return create_response(True, "游戏启动中...")
    except Exception as e:
        return create_response(False, f"Failed to start game: {str(e)}")

@router.post("/reset")
async def reset_game(session_id: str = None):
    """重置游戏API"""
    try:
        # 如果没有提供session_id，使用默认会话
        if session_id is None:
            session_id = "default"
        
        await game_server.reset_game(session_id)
        return create_response(True, "游戏已重置")
    except Exception as e:
        return create_response(False, f"Failed to reset game: {str(e)}")