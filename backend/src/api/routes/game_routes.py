"""游戏管理相关的API路由"""
from fastapi import APIRouter, HTTPException, Depends, Request
from typing import Optional

from ...core.websocket_server import game_server
from ...schemas.game_schemas import GameResponse
from ...schemas.user_schemas import GameSessionDeleteRequest, GameSessionDeleteResponse, GameSessionDeleteFailedItem
from ...db.repositories.game_session_repository import GameSessionRepository
from ...core.container_integration import get_game_session_repo_depends
from ...core.auth import get_current_active_user_from_request

router = APIRouter(prefix="/api/game", tags=["游戏管理"])

def create_response(success: bool, message: str, data=None):
    """创建统一的响应格式"""
    return {
        "success": success,
        "message": message,
        "data": data
    }

@router.get("/status")
async def get_game_status(session_id: str | None = None):
    """获取游戏状态API"""
    try:
        # 如果没有提供session_id，使用默认会话
        if session_id is None:
            session_id = "default"
        
        # 获取或创建会话
        session = game_server.get_or_create_session(session_id)
        
        # 确保游戏已初始化
        if not session.game_initialized:
            await game_server.initialize_game(session)
        
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
async def start_game(session_id: str | None = None, script_id: int = 1):
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
async def reset_game(session_id: str | None = None):
    """重置游戏API"""
    try:
        # 如果没有提供session_id，使用默认会话
        if session_id is None:
            session_id = "default"
        
        await game_server.reset_game(session_id)
        return create_response(True, "游戏已重置")
    except Exception as e:
        return create_response(False, f"Failed to reset game: {str(e)}")

@router.delete("/sessions")
async def delete_game_sessions(
    request: Request,
    delete_request: GameSessionDeleteRequest,
    session_repo: GameSessionRepository = Depends(get_game_session_repo_depends())
) -> GameSessionDeleteResponse:
    """删除游戏会话API（支持单个和批量删除）
    
    Args:
        delete_request: 删除请求，包含要删除的会话ID列表
        session_repo: 游戏会话仓库依赖
        
    Returns:
        GameSessionDeleteResponse: 删除结果响应
    """
    try:
        # 获取当前用户，用于权限验证
        user = get_current_active_user_from_request(request)
        
        # 执行批量删除，传递用户ID进行权限校验
        result = session_repo.delete_sessions(delete_request.session_ids, user.id)
        
        # 转换失败项格式
        failed_items = [
            GameSessionDeleteFailedItem(
                session_id=item["session_id"],
                error=item["error"]
            )
            for item in result["failed"]
        ]
        
        # 构建响应
        response = GameSessionDeleteResponse(
            success=result["success"],
            failed=failed_items,
            total_requested=len(delete_request.session_ids),
            total_success=len(result["success"]),
            total_failed=len(result["failed"])
        )
        
        return response
        
    except Exception as e:
        # 如果发生未预期的错误，返回所有删除失败
        failed_items = [
            GameSessionDeleteFailedItem(
                session_id=session_id,
                error=f"服务器错误: {str(e)}"
            )
            for session_id in delete_request.session_ids
        ]
        
        return GameSessionDeleteResponse(
            success=[],
            failed=failed_items,
            total_requested=len(delete_request.session_ids),
            total_success=0,
            total_failed=len(delete_request.session_ids)
        )