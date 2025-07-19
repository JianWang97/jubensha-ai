"""使用统一数据模型的剧本API路由

这个文件展示了如何在API层使用新的统一数据模型：
1. 统一的请求/响应格式
2. 自动数据验证
3. 标准化的错误处理
4. 一致的API响应结构
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from sqlalchemy.orm import Session
import logging
from ...db.repositories import ScriptRepository
from ...schemas.script import (
    Script, ScriptInfo, ScriptCharacter, ScriptEvidence, 
    ScriptLocation, ScriptStatus, EvidenceType
)
from ...schemas.base import APIResponse, PaginatedResponse
from ...db.session import get_db_session

router = APIRouter(prefix="/api/scripts", tags=["scripts"])


def get_script_repository(db: Session = Depends(get_db_session)) -> ScriptRepository:
    """获取剧本仓库实例"""
    return ScriptRepository(db)


@router.post("/", response_model=APIResponse[ScriptInfo])
async def create_script(
    script_data: ScriptInfo,
    repo: ScriptRepository = Depends(get_script_repository)
) -> APIResponse[ScriptInfo]:
    """创建新剧本"""
    try:
        created_script = repo.create_script(script_data)
        return APIResponse(
            success=True,
            data=created_script,
            message="剧本创建成功"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"创建剧本失败: {str(e)}")


@router.post("/complete", response_model=APIResponse[Script])
async def create_complete_script(
    script: Script,
    repo: ScriptRepository = Depends(get_script_repository)
) -> APIResponse[Script]:
    """创建完整剧本（包含所有关联数据）"""
    try:
        created_script = repo.create_complete_script(script)
        return APIResponse(
            success=True,
            data=created_script,
            message="完整剧本创建成功"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"创建完整剧本失败: {str(e)}")


@router.get("/", response_model=PaginatedResponse[ScriptInfo])
async def get_scripts(
    status: Optional[ScriptStatus] = Query(None, description="剧本状态过滤"),
    author: Optional[str] = Query(None, description="作者过滤"),
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(20, ge=1, le=100, description="每页数量"),
    repo: ScriptRepository = Depends(get_script_repository)
) -> PaginatedResponse[ScriptInfo]:
    """获取剧本列表（分页）"""
    try:
        print('get_scripts')
        return repo.get_scripts_list(status=status, author=author, page=page, size=size)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取剧本列表失败: {str(e)}")


@router.get("/search", response_model=PaginatedResponse[ScriptInfo])
async def search_scripts(
    keyword: str = Query(..., description="搜索关键词"),
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(20, ge=1, le=100, description="每页数量"),
    repo: ScriptRepository = Depends(get_script_repository)
) -> PaginatedResponse[ScriptInfo]:
    """搜索剧本"""
    try:
        return repo.search_scripts(keyword=keyword, page=page, size=size)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"搜索剧本失败: {str(e)}")


@router.get("/{script_id}", response_model=APIResponse[Script])
async def get_script(
    script_id: int,
    repo: ScriptRepository = Depends(get_script_repository)
) -> APIResponse[Script]:
    """获取完整剧本信息"""
    script = repo.get_script_by_id(script_id)
    if not script:
        raise HTTPException(status_code=404, detail="剧本不存在")
    
    return APIResponse(
        success=True,
        data=script,
        message="获取剧本成功"
    )


@router.get("/{script_id}/info", response_model=APIResponse[ScriptInfo])
async def get_script_info(
    script_id: int,
    repo: ScriptRepository = Depends(get_script_repository)
) -> APIResponse[ScriptInfo]:
    """获取剧本基本信息"""
    script_info = repo.get_script_info_by_id(script_id)
    if not script_info:
        raise HTTPException(status_code=404, detail="剧本不存在")
    
    return APIResponse(
        success=True,
        data=script_info,
        message="获取剧本信息成功"
    )


@router.put("/{script_id}", response_model=APIResponse[Script])
async def update_script(
    script_id: int,
    script: Script,
    repo: ScriptRepository = Depends(get_script_repository)
) -> APIResponse[Script]:
    """更新完整剧本"""
    updated_script = repo.update_complete_script(script_id, script)
    if not updated_script:
        raise HTTPException(status_code=404, detail="剧本不存在")
    
    return APIResponse(
        success=True,
        data=updated_script,
        message="剧本更新成功"
    )


@router.put("/{script_id}/info", response_model=APIResponse[ScriptInfo])
async def update_script_info(
    script_id: int,
    script_data: ScriptInfo,
    request: Request,
    repo: ScriptRepository = Depends(get_script_repository)
) -> APIResponse[ScriptInfo]:
    """更新剧本基本信息"""
    logger = logging.getLogger(__name__)
    
    try:
        # 记录请求数据用于调试
        request_body = await request.body()
        logger.info(f"更新剧本信息请求 - script_id: {script_id}, 请求体: {request_body.decode('utf-8')}")
        
        updated_script = repo.update_script_info(script_id, script_data)
        if not updated_script:
            raise HTTPException(status_code=404, detail="剧本不存在")
        
        return APIResponse(
            success=True,
            data=updated_script,
            message="剧本信息更新成功"
        )
    except RequestValidationError as e:
        logger.error(f"请求数据验证失败 - script_id: {script_id}, 错误详情: {e.errors()}")
        raise HTTPException(
            status_code=422, 
            detail=f"请求数据验证失败: {e.errors()}"
        )
    except Exception as e:
        logger.error(f"更新剧本信息失败 - script_id: {script_id}, 错误: {str(e)}")
        raise HTTPException(status_code=500, detail=f"更新剧本信息失败: {str(e)}")


@router.patch("/{script_id}/status", response_model=APIResponse[str])
async def update_script_status(
    script_id: int,
    status: ScriptStatus,
    repo: ScriptRepository = Depends(get_script_repository)
) -> APIResponse[str]:
    """更新剧本状态"""
    success = repo.update_script_status(script_id, status)
    if not success:
        raise HTTPException(status_code=404, detail="剧本不存在")
    
    return APIResponse(
        success=True,
        data=status.value,
        message="剧本状态更新成功"
    )


@router.delete("/{script_id}", response_model=APIResponse[str])
async def delete_script(
    script_id: int,
    repo: ScriptRepository = Depends(get_script_repository)
) -> APIResponse[str]:
    """删除剧本"""
    success = repo.delete_script(script_id)
    if not success:
        raise HTTPException(status_code=404, detail="剧本不存在")
    
    return APIResponse(
        success=True,
        data="deleted",
        message="剧本删除成功"
    )


# 角色管理已迁移到 character_routes.py


# 证据管理已迁移到 evidence_routes.py
# 场景管理已迁移到 location_routes.py