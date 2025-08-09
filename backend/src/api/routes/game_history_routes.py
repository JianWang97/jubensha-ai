"""游戏历史/回放 API 路由"""
from fastapi import APIRouter, Depends, Query, Request, HTTPException
from typing import Optional
from datetime import datetime
from src.schemas.game_history_schemas import (
    GameHistoryFilters, PaginationParams, EventFilters
)
from src.core.auth_middleware import get_current_active_user_from_request
from src.core.container_integration import get_scoped_service
from src.services.game_history_service import GameHistoryService, GameResumeService

"""
注意: 原始前缀曾为 /api/user/game-history (单数 user), 前端/中间件其余接口使用复数 /api/users/。
为与 Auth 中间件规则 ^/api/users/.* 保持一致改为复数。若前端仍有旧请求, 返回 404。
可在需要时在 server 中临时 include 一个旧前缀兼容路由; 当前实现直接切换为新前缀。
"""
router = APIRouter(prefix="/api/users/game-history", tags=["游戏历史"])

# FastAPI依赖工厂
GameHistorySvcDep = get_scoped_service(GameHistoryService)
GameResumeSvcDep = get_scoped_service(GameResumeService)

@router.get("")
async def list_game_history(
    request: Request,
    # 新版分页参数
    page: int = Query(1, ge=1, description="页码(>=1)"),
    size: int = Query(20, ge=1, le=100, description="每页大小"),
    # 兼容旧版 skip/limit (优先级高于 page/size)
    skip: Optional[int] = Query(None, ge=0, description="(兼容) 偏移量"),
    limit: Optional[int] = Query(None, ge=1, le=1000, description="(兼容) 限制条数"),
    status: Optional[str] = None,
    script_id: Optional[int] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    svc: GameHistoryService = Depends(GameHistorySvcDep)
):
    user = get_current_active_user_from_request(request)
    # 若提供 skip/limit -> 计算 page/size
    if skip is not None:
        eff_size = limit if limit is not None else size
        # 避免 size=0
        eff_size = eff_size if eff_size > 0 else 20
        page = skip // eff_size + 1
        size = eff_size
    filters = GameHistoryFilters(status=status, script_id=script_id, start_date=start_date, end_date=end_date)  # type: ignore
    pagination = PaginationParams(page=page, size=size)
    resp = await svc.get_user_game_history(user.id, filters, pagination)
    return {"success": True, "data": {"items": [i.dict() for i in resp.items], "total": resp.total, "page": resp.page, "size": resp.size}}

@router.get("/{session_id}")
async def get_game_detail(session_id: str, request: Request, svc: GameHistoryService = Depends(GameHistorySvcDep)):
    user = get_current_active_user_from_request(request)
    try:
        resp = await svc.get_game_detail(session_id, user.id)
        return resp.dict()
    except ValueError:
        raise HTTPException(status_code=404, detail="会话不存在")

@router.get("/{session_id}/events")
async def get_game_events(session_id: str, request: Request,
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=500),
    event_type: Optional[str] = None,
    character_name: Optional[str] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    svc: GameHistoryService = Depends(GameHistorySvcDep)):
    user = get_current_active_user_from_request(request)
    filters = EventFilters(event_type=event_type, character_name=character_name, start_time=start_time, end_time=end_time)
    pagination = PaginationParams(page=page, size=size)
    resp = await svc.get_game_events(session_id, user.id, filters, pagination)
    return {"success": True, "data": {"items": [i.dict() for i in resp.items], "total": resp.total, "page": resp.page, "size": resp.size}}

@router.post("/{session_id}/resume")
async def resume_game(session_id: str, request: Request, svc: GameResumeService = Depends(GameResumeSvcDep)):
    user = get_current_active_user_from_request(request)
    try:
        resp = await svc.resume_game(session_id, user.id)
        return {"success": True, "data": resp.dict()}
    except ValueError:
        raise HTTPException(status_code=404, detail="会话不存在")
