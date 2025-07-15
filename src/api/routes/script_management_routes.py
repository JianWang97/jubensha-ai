"""剧本基础管理API路由"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Query
from typing import List, Optional
from pydantic import BaseModel
from ...models.script import Script, ScriptInfo, ScriptStatus
from ...core.script_repository import script_repository
from ...core.storage import storage_manager
import json
from io import BytesIO

router = APIRouter(prefix="/api/scripts", tags=["剧本基础管理"])

# Pydantic模型用于API请求/响应
class ScriptCreateRequest(BaseModel):
    title: str
    description: str = ""
    author: str = ""
    player_count: int = 4
    duration_minutes: int = 120
    difficulty: str = "中等"
    tags: List[str] = []

class ScriptUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    author: Optional[str] = None
    player_count: Optional[int] = None
    duration_minutes: Optional[int] = None
    difficulty: Optional[str] = None
    tags: Optional[List[str]] = None
    status: Optional[str] = None

class ScriptResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None

@router.get("/", summary="获取剧本列表")
async def get_scripts(
    status: Optional[str] = Query(None, description="剧本状态过滤"),
    author: Optional[str] = Query(None, description="作者过滤"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量")
):
    """获取剧本列表"""
    try:
        offset = (page - 1) * page_size
        script_status = ScriptStatus(status) if status else None
        
        scripts = await script_repository.get_scripts_list(
            status=script_status,
            author=author,
            limit=page_size,
            offset=offset
        )
        
        # 转换为字典格式
        scripts_data = []
        for script in scripts:
            script_dict = {
                "id": script.id,
                "title": script.title,
                "description": script.description,
                "author": script.author,
                "player_count": script.player_count,
                "duration_minutes": script.duration_minutes,
                "difficulty": script.difficulty,
                "tags": script.tags,
                "status": script.status.value,
                "cover_image_url": script.cover_image_url,
                "created_at": script.created_at.isoformat() if script.created_at else None,
                "updated_at": script.updated_at.isoformat() if script.updated_at else None
            }
            scripts_data.append(script_dict)
        
        return ScriptResponse(
            success=True,
            message="获取剧本列表成功",
            data={
                "scripts": scripts_data,
                "page": page,
                "page_size": page_size
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取剧本列表失败: {str(e)}")

@router.get("/{script_id}", summary="获取剧本详情")
async def get_script(script_id: int):
    """获取剧本详情"""
    try:
        script = await script_repository.get_script_by_id(script_id)
        if not script:
            raise HTTPException(status_code=404, detail="剧本不存在")
        
        # 转换为字典格式
        script_data = {
            "info": {
                "id": script.info.id,
                "title": script.info.title,
                "description": script.info.description,
                "author": script.info.author,
                "player_count": script.info.player_count,
                "duration_minutes": script.info.duration_minutes,
                "difficulty": script.info.difficulty,
                "tags": script.info.tags,
                "status": script.info.status.value,
                "cover_image_url": script.info.cover_image_url,
                "created_at": script.info.created_at.isoformat() if script.info.created_at else None,
                "updated_at": script.info.updated_at.isoformat() if script.info.updated_at else None
            },
            "background_story": script.background_story,
            "characters": [
                {
                    "id": char.id,
                    "name": char.name,
                    "age": char.age,
                    "profession": char.profession,
                    "background": char.background,
                    "secret": char.secret,
                    "objective": char.objective,
                    "gender": char.gender,
                    "is_murderer": char.is_murderer,
                    "is_victim": char.is_victim,
                    "personality_traits": char.personality_traits,
                    "avatar_url": char.avatar_url,
                    "voice_preference": char.voice_preference
                } for char in script.characters
            ],
            "evidence": [
                {
                    "id": ev.id,
                    "name": ev.name,
                    "location": ev.location,
                    "description": ev.description,
                    "related_to": ev.related_to,
                    "significance": ev.significance,
                    "evidence_type": ev.evidence_type.value,
                    "importance": ev.importance,
                    "image_url": ev.image_url,
                    "is_hidden": ev.is_hidden
                } for ev in script.evidence
            ],
            "locations": [
                {
                    "id": loc.id,
                    "name": loc.name,
                    "description": loc.description,
                    "searchable_items": loc.searchable_items,
                    "background_image_url": loc.background_image_url,
                    "is_crime_scene": loc.is_crime_scene
                } for loc in script.locations
            ],
            "game_phases": script.game_phases
        }
        
        return ScriptResponse(
            success=True,
            message="获取剧本详情成功",
            data=script_data
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取剧本详情失败: {str(e)}")

@router.post("/", summary="创建剧本")
async def create_script(
    script_data: str = Form(..., description="剧本JSON数据"),
    cover_image: Optional[UploadFile] = File(None, description="封面图片")
):
    """创建新剧本"""
    try:
        # 解析JSON数据
        script_dict = json.loads(script_data)
        
        # 处理封面图片上传
        cover_image_url = None
        if cover_image:
            if not cover_image.content_type.startswith("image/"):
                raise HTTPException(status_code=400, detail="封面文件必须是图片格式")
            
            cover_image_url = await storage_manager.upload_cover_image(
                BytesIO(await cover_image.read()),
                cover_image.filename
            )
            if not cover_image_url:
                raise HTTPException(status_code=500, detail="封面图片上传失败")
        
        # 构建Script对象（这里需要根据实际的JSON结构进行解析）
        # 为了简化，这里只处理基本信息
        script_info = ScriptInfo(
            title=script_dict.get("title", ""),
            description=script_dict.get("description", ""),
            author=script_dict.get("author", ""),
            player_count=script_dict.get("player_count", 4),
            duration_minutes=script_dict.get("duration_minutes", 120),
            difficulty=script_dict.get("difficulty", "中等"),
            tags=script_dict.get("tags", []),
            status=ScriptStatus.DRAFT,
            cover_image_url=cover_image_url
        )
        
        script = Script(info=script_info)
        
        # 创建剧本
        script_id = await script_repository.create_script(script)
        
        return ScriptResponse(
            success=True,
            message="剧本创建成功",
            data={"script_id": script_id}
        )
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="无效的JSON数据")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"创建剧本失败: {str(e)}")

@router.put("/{script_id}", summary="更新剧本")
async def update_script(
    script_id: int,
    update_data: ScriptUpdateRequest
):
    """更新剧本信息"""
    try:
        # 获取现有剧本
        script = await script_repository.get_script_by_id(script_id)
        if not script:
            raise HTTPException(status_code=404, detail="剧本不存在")
        
        # 更新字段
        if update_data.title is not None:
            script.info.title = update_data.title
        if update_data.description is not None:
            script.info.description = update_data.description
        if update_data.author is not None:
            script.info.author = update_data.author
        if update_data.player_count is not None:
            script.info.player_count = update_data.player_count
        if update_data.duration_minutes is not None:
            script.info.duration_minutes = update_data.duration_minutes
        if update_data.difficulty is not None:
            script.info.difficulty = update_data.difficulty
        if update_data.tags is not None:
            script.info.tags = update_data.tags
        if update_data.status is not None:
            script.info.status = ScriptStatus(update_data.status)
        
        # 保存更新
        success = await script_repository.update_script(script_id, script)
        if not success:
            raise HTTPException(status_code=500, detail="更新剧本失败")
        
        return ScriptResponse(
            success=True,
            message="剧本更新成功"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"更新剧本失败: {str(e)}")

@router.delete("/{script_id}", summary="删除剧本")
async def delete_script(script_id: int):
    """删除剧本"""
    try:
        # 检查剧本是否存在
        script = await script_repository.get_script_by_id(script_id)
        if not script:
            raise HTTPException(status_code=404, detail="剧本不存在")
        
        # 删除关联的图片文件
        if script.info.cover_image_url:
            await storage_manager.delete_file(script.info.cover_image_url)
        
        for character in script.characters:
            if character.avatar_url:
                await storage_manager.delete_file(character.avatar_url)
        
        for evidence in script.evidence:
            if evidence.image_url:
                await storage_manager.delete_file(evidence.image_url)
        
        for location in script.locations:
            if location.background_image_url:
                await storage_manager.delete_file(location.background_image_url)
        
        # 删除剧本
        success = await script_repository.delete_script(script_id)
        if not success:
            raise HTTPException(status_code=500, detail="删除剧本失败")
        
        return ScriptResponse(
            success=True,
            message="剧本删除成功"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"删除剧本失败: {str(e)}")

@router.get("/search/{keyword}", summary="搜索剧本")
async def search_scripts(
    keyword: str,
    limit: int = Query(20, ge=1, le=100, description="返回数量限制")
):
    """搜索剧本"""
    try:
        scripts = await script_repository.search_scripts(keyword, limit)
        
        scripts_data = []
        for script in scripts:
            script_dict = {
                "id": script.id,
                "title": script.title,
                "description": script.description,
                "author": script.author,
                "player_count": script.player_count,
                "duration_minutes": script.duration_minutes,
                "difficulty": script.difficulty,
                "tags": script.tags,
                "status": script.status.value,
                "cover_image_url": script.cover_image_url,
                "created_at": script.created_at.isoformat() if script.created_at else None,
                "updated_at": script.updated_at.isoformat() if script.updated_at else None
            }
            scripts_data.append(script_dict)
        
        return ScriptResponse(
            success=True,
            message="搜索完成",
            data={
                "scripts": scripts_data,
                "keyword": keyword,
                "count": len(scripts_data)
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"搜索失败: {str(e)}")

@router.get("/stats/overview", summary="获取剧本统计信息")
async def get_script_stats():
    """获取剧本统计信息"""
    try:
        stats = await script_repository.get_script_stats()
        storage_stats = storage_manager.get_storage_stats()
        
        return ScriptResponse(
            success=True,
            message="获取统计信息成功",
            data={
                "script_stats": stats,
                "storage_stats": storage_stats
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取统计信息失败: {str(e)}")