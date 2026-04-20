"""剧本 API 路由"""

from typing import Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
import logging
from ...db.repositories.script_repository import ScriptRepository
from ...schemas.script import Script
from ...schemas.script_info import ScriptInfo, ScriptStatus
from ...schemas.script_requests import GenerateScriptInfoRequest, CreateScriptRequest, GenerateScriptContentRequest
from ...schemas.base import APIResponse, PaginatedResponse
from src.core.auth_dependencies import get_current_active_user
from src.db.models.user import User
from ...core.container_integration import get_script_repo_depends, get_script_editor_svc_depends, get_script_generation_svc_depends
from ...services.script_generation_service import ScriptGenerationService

router = APIRouter(prefix="/api/scripts", tags=["scripts"])


@router.post("/generate-info", response_model=APIResponse[Dict[str, str]])
async def generate_script_info(
    request: GenerateScriptInfoRequest,
    current_user: User = Depends(get_current_active_user),
    svc: ScriptGenerationService = get_script_generation_svc_depends(),
) -> APIResponse[Dict[str, str]]:
    """根据主题生成剧本基础信息"""
    try:
        result = await svc.generate_script_info(
            request.theme, request.script_type, request.player_count
        )
        return APIResponse(success=True, message="剧本基础信息生成成功", data=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"生成剧本信息失败: {str(e)}")


@router.post("/generate-content", response_model=APIResponse[dict])
async def generate_script_content(
    request: GenerateScriptContentRequest,
    current_user: User = Depends(get_current_active_user),
    svc: ScriptGenerationService = get_script_generation_svc_depends(),
    repo: ScriptRepository = get_script_repo_depends(),
) -> APIResponse[dict]:
    """根据剧本背景自动生成角色和证据"""
    try:
        script = repo.get_script_by_id(request.script_id)
        if not script:
            raise HTTPException(status_code=404, detail="剧本不存在")
        if script.info.author != str(current_user.username):
            raise HTTPException(status_code=403, detail="无权限操作此剧本")

        result = await svc.generate_and_save_content(
            request.script_id,
            request.theme,
            request.background_story,
            request.player_count,
            request.script_type,
        )
        return APIResponse(
            success=True,
            message=f"成功生成{len(result['characters'])}个角色和{len(result['evidence'])}个证据",
            data=result,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"生成剧本内容失败: {str(e)}")


@router.post("/", response_model=APIResponse[ScriptInfo])
async def create_script(
    request: CreateScriptRequest,
    current_user: User = Depends(get_current_active_user),
    repo: ScriptRepository = get_script_repo_depends()
) -> APIResponse[ScriptInfo]:
    """创建新剧本"""
    try:
        # 创建ScriptInfo对象
        script_data = ScriptInfo(
            title=request.title,
            description=request.description,
            author=str(current_user.username),
            player_count=request.player_count,
            duration_minutes=request.estimated_duration or 180,
            difficulty=request.difficulty or "medium",
            category=request.category or "推理",
            tags=request.tags or [],
            status=ScriptStatus.DRAFT,
            cover_image_url=None,
            is_public=False,
            price=0.0,
            rating=0.0,
            play_count=0,
            # 以下字段使用默认值
            id=None,
            created_at=None,
            updated_at=None
        )
        
        # 创建剧本
        created_script = repo.create_script(script_data)
        
        # 如果有背景故事，创建背景故事记录
        # if request.background_story and created_script.id:
        #     from ...schemas.background_story import BackgroundStory
        #     background_story = BackgroundStory(
        #         script_id=created_script.id,
        #         title="AI生成的背景故事",
        #         setting_description=request.background_story
        #     )
        #     # 这里可以添加创建背景故事的逻辑
        #     # repo.create_background_story(background_story)
        
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
    current_user: User = Depends(get_current_active_user),
    repo: ScriptRepository = get_script_repo_depends()
) -> APIResponse[Script]:
    """创建完整剧本（包含所有关联数据）"""
    try:
        # 设置作者为当前用户
        script.info.author = str(current_user.username)
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
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(20, ge=1, le=100, description="每页数量"),
    current_user: User = Depends(get_current_active_user),
    repo: ScriptRepository = get_script_repo_depends()
) -> PaginatedResponse[ScriptInfo]:
    """获取剧本列表（分页）- 仅返回当前用户的剧本"""
    try:
        print(f'get_scripts for user: {current_user.username}')
        # 只返回当前用户的剧本
        return repo.get_scripts_list(status=status, author=str(current_user.username), page=page, size=size)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取剧本列表失败: {str(e)}")


@router.get("/public", response_model=PaginatedResponse[ScriptInfo])
async def get_public_scripts(
    status: Optional[ScriptStatus] = Query(None, description="剧本状态过滤"),
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(20, ge=1, le=100, description="每页数量"),
    repo: ScriptRepository = get_script_repo_depends()
) -> PaginatedResponse[ScriptInfo]:
    """获取公开的剧本列表（分页）"""
    try:
        # 获取所有公开状态的剧本
        return repo.get_scripts_list(
            status = ScriptStatus.PUBLISHED,
            page=page,
            size=size
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取公开剧本列表失败: {str(e)}")


@router.get("/search", response_model=PaginatedResponse[ScriptInfo])
async def search_scripts(
    keyword: str = Query(..., description="搜索关键词"),
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(20, ge=1, le=100, description="每页数量"),
    repo: ScriptRepository = get_script_repo_depends()
) -> PaginatedResponse[ScriptInfo]:
    """搜索剧本"""
    try:
        return repo.search_scripts(keyword=keyword, page=page, size=size)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"搜索剧本失败: {str(e)}")


@router.get("/{script_id}", response_model=APIResponse[Script])
async def get_script(
    script_id: int,
    current_user: User = Depends(get_current_active_user),
    repo: ScriptRepository = get_script_repo_depends()
) -> APIResponse[Script]:
    """获取完整剧本信息"""
    script = repo.get_script_by_id(script_id)
    if not script:
        raise HTTPException(status_code=404, detail="剧本不存在")
    
    # 检查权限：只能查看自己的剧本
    if script.info.author != current_user.username:
        raise HTTPException(status_code=403, detail="无权限访问此剧本")
    
    return APIResponse(
        success=True,
        data=script,
        message="获取剧本成功"
    )


@router.get("/{script_id}/info", response_model=APIResponse[ScriptInfo])
async def get_script_info(
    script_id: int,
    current_user: User = Depends(get_current_active_user),
    repo: ScriptRepository = get_script_repo_depends()
) -> APIResponse[ScriptInfo]:
    """获取剧本基本信息"""
    script_info = repo.get_script_info_by_id(script_id)
    if not script_info:
        raise HTTPException(status_code=404, detail="剧本不存在")
    
    # 检查权限：只能查看自己的剧本
    if script_info.author != current_user.username:
        raise HTTPException(status_code=403, detail="无权限访问此剧本")
    
    return APIResponse(
        success=True,
        data=script_info,
        message="获取剧本信息成功"
    )


@router.put("/{script_id}", response_model=APIResponse[Script])
async def update_script(
    script_id: int,
    script: Script,
    current_user: User = Depends(get_current_active_user),
    repo: ScriptRepository = get_script_repo_depends()
) -> APIResponse[Script]:
    """更新完整剧本"""
    # 检查剧本是否存在和权限
    existing_script = repo.get_script_by_id(script_id)
    if not existing_script:
        raise HTTPException(status_code=404, detail="剧本不存在")
    
    if existing_script.info.author != current_user.username:
        raise HTTPException(status_code=403, detail="无权限修改此剧本")
    
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
    current_user: User = Depends(get_current_active_user),
    repo: ScriptRepository = get_script_repo_depends()
) -> APIResponse[ScriptInfo]:
    """更新剧本基本信息"""
    logger = logging.getLogger(__name__)
    
    try:
        # 记录请求数据用于调试
        request_body = await request.body()
        logger.info(f"更新剧本信息请求 - script_id: {script_id}, 请求体: {request_body.decode('utf-8')}")
        
        # 检查剧本是否存在和权限
        existing_script = repo.get_script_info_by_id(script_id)
        if not existing_script:
            raise HTTPException(status_code=404, detail="剧本不存在")
        
        if existing_script.author != current_user.username:
            raise HTTPException(status_code=403, detail="无权限修改此剧本")
        
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
    current_user: User = Depends(get_current_active_user),
    repo: ScriptRepository = get_script_repo_depends()
) -> APIResponse[str]:
    """更新剧本状态"""
    # 检查剧本是否存在和权限
    existing_script = repo.get_script_info_by_id(script_id)
    if not existing_script:
        raise HTTPException(status_code=404, detail="剧本不存在")
    
    if existing_script.author != current_user.username:
        raise HTTPException(status_code=403, detail="无权限修改此剧本")
    
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
    current_user: User = Depends(get_current_active_user),
    repo: ScriptRepository = get_script_repo_depends()
) -> APIResponse[str]:
    """删除剧本"""
    # 检查剧本是否存在和权限
    existing_script = repo.get_script_info_by_id(script_id)
    if not existing_script:
        raise HTTPException(status_code=404, detail="剧本不存在")
    
    if existing_script.author != current_user.username:
        raise HTTPException(status_code=403, detail="无权限删除此剧本")
    
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