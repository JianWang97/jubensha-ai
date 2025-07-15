"""基础数据相关的API路由"""
from fastapi import APIRouter, HTTPException
from typing import Optional

from ...core.websocket_server import game_server
from ...core.script_repository import script_repository

router = APIRouter(prefix="/api", tags=["基础数据"])

def create_response(success: bool, message: str, data=None):
    """创建统一的响应格式"""
    return {
        "success": success,
        "message": message,
        "data": data
    }

@router.get("/scripts")
async def get_scripts():
    """获取剧本列表API"""
    try:
        scripts = await script_repository.get_all_scripts()
        return create_response(True, "获取剧本列表成功", scripts)
    except Exception as e:
        return create_response(False, f"Failed to get scripts: {str(e)}")

@router.get("/characters/{script_id}")
async def get_characters(script_id: int):
    """获取指定剧本的角色信息API"""
    try:
        characters = await script_repository.get_script_characters(script_id)
        return create_response(True, "获取角色列表成功", characters)
    except Exception as e:
        return create_response(False, f"Failed to get characters: {str(e)}")

@router.get("/background/{script_id}")
async def get_background_by_script(script_id: int):
    """获取指定剧本的背景故事API"""
    try:
        background = await script_repository.get_script_background(script_id)
        return create_response(True, "获取背景故事成功", background)
    except Exception as e:
        return create_response(False, f"Failed to get background: {str(e)}")

@router.get("/background")
async def get_background():
    """获取背景故事API（兼容旧版本）"""
    try:
        # 尝试从数据库获取第一个剧本的背景故事
        scripts = await script_repository.get_all_scripts()
        if scripts:
            background = await script_repository.get_script_background(scripts[0]['id'])
            return create_response(True, "获取背景故事成功", background)
        else:
            # 如果数据库中没有剧本，使用游戏引擎的默认背景
            try:
                session = game_server.get_or_create_session("default")
                if not session._game_initialized:
                    await game_server._initialize_game(session)
                background = session.game_engine.get_background_story()
                return create_response(True, "获取背景故事成功", background)
            except Exception as engine_error:
                return create_response(False, f"Failed to get background: {str(engine_error)}")
    except Exception as e:
        # 出错时回退到游戏引擎的默认背景
        try:
            session = game_server.get_or_create_session("default")
            if not session._game_initialized:
                await game_server._initialize_game(session)
            background = session.game_engine.get_background_story()
            return create_response(True, "获取背景故事成功", background)
        except Exception as engine_error:
            return create_response(False, f"Failed to get background: {str(engine_error)}")

@router.get("/voices")
async def get_voice_assignments(session_id: str = None):
    """获取声音分配信息API"""
    try:
        # 如果没有提供session_id，创建一个默认会话
        if session_id is None:
            session_id = "default"
        
        # 获取或创建会话
        session = game_server.get_or_create_session(session_id)
        
        # 确保游戏已初始化
        if not session._game_initialized:
            await game_server._initialize_game(session)
        
        voice_mapping = session.game_engine.get_voice_mapping()
        voice_info = session.game_engine.get_voice_assignment_info()
        
        return {
            "success": True,
            "message": "获取声音分配成功",
            "data": {
                "mapping": voice_mapping,
                "details": voice_info
            }
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Failed to get voice assignments: {str(e)}"
        }