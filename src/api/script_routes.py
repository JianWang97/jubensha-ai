"""剧本管理API路由"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Query, Depends
from fastapi.responses import JSONResponse
from typing import List, Optional
from pydantic import BaseModel
from ..models.script import Script, ScriptInfo, ScriptStatus
from ..core.script_repository import script_repository
from ..core.storage import storage_manager
from ..services.comfyui_service import comfyui_service, ImageGenerationRequest
from ..services.llm_service import LLMService, LLMMessage
from ..core.config import config
import json
from io import BytesIO

router = APIRouter(prefix="/api/scripts", tags=["剧本管理"])

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

class ImageGenerationRequestModel(BaseModel):
    positive_prompt: str
    negative_prompt: str = ""
    script_id: int
    target_id: int  # 证据/头像/场景的ID
    width: int = 512
    height: int = 720
    steps: int = 20
    cfg: float = 8.0
    seed: Optional[int] = None

class EvidenceCreateRequest(BaseModel):
    script_id: int
    name: str
    description: str = ""
    evidence_type: str = "physical"
    location: str = ""
    significance: str = ""
    related_to: str = ""
    importance: str = "重要证据"
    is_hidden: bool = False

class EvidenceUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    evidence_type: Optional[str] = None
    location: Optional[str] = None
    significance: Optional[str] = None
    related_to: Optional[str] = None
    importance: Optional[str] = None
    is_hidden: Optional[bool] = None

class PromptGenerationRequest(BaseModel):
    evidence_name: str
    evidence_description: str
    evidence_type: str
    location: str = ""
    related_to: str = ""
    script_context: str = ""  # 剧本背景信息

class PromptGenerationResponse(BaseModel):
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

# 图片生成相关路由
@router.post("/generate/cover", summary="生成封面图片")
async def generate_cover_image(request: ImageGenerationRequestModel):
    """生成剧本封面图片"""
    try:
        # 检查剧本是否存在
        script = await script_repository.get_script_by_id(request.script_id)
        if not script:
            raise HTTPException(status_code=404, detail="剧本不存在")
        
        # 创建图片生成请求
        generation_request = ImageGenerationRequest(
            positive_prompt=request.positive_prompt,
            negative_prompt=request.negative_prompt,
            width=request.width,
            height=request.height,
            steps=request.steps,
            cfg=request.cfg,
            seed=request.seed
        )
        
        # 调用ComfyUI服务生成图片
        response = await comfyui_service.generate_image(generation_request)
        
        if not response.success:
            raise HTTPException(status_code=500, detail=f"图片生成失败: {response.error_message}")
        
        # 将生成的图片上传到存储管理器
        url = await storage_manager.upload_cover_image(
            BytesIO(response.image_data),
            response.filename
        )
        
        if not url:
            raise HTTPException(status_code=500, detail="图片上传失败")
        
        # 更新剧本的封面图片URL
        success = await script_repository.update_cover_image_url(script_id, url)
        if not success:
            raise HTTPException(status_code=500, detail="更新封面图片URL失败")
        
        return ScriptResponse(
            success=True,
            message="封面图片生成成功",
            data={
                "url": url,
                "generation_time": response.generation_time,
                "prompt_id": response.prompt_id
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"生成失败: {str(e)}")

@router.post("/generate/avatar", summary="生成角色头像")
async def generate_avatar_image(request: ImageGenerationRequestModel):
    """生成角色头像图片"""
    try:
        # 检查剧本是否存在
        script = await script_repository.get_script_by_id(request.script_id)
        if not script:
            raise HTTPException(status_code=404, detail="剧本不存在")
        
        # 检查角色是否存在
        character = None
        for char in script.characters:
            if char.id == request.target_id:
                character = char
                break
        
        if not character:
            raise HTTPException(status_code=404, detail="角色不存在")
        
        # 创建图片生成请求
        generation_request = ImageGenerationRequest(
            positive_prompt=request.positive_prompt,
            negative_prompt=request.negative_prompt,
            width=request.width,
            height=request.height,
            steps=request.steps,
            cfg=request.cfg,
            seed=request.seed
        )
        
        # 调用ComfyUI服务生成图片
        response = await comfyui_service.generate_image(generation_request)
        
        if not response.success:
            raise HTTPException(status_code=500, detail=f"图片生成失败: {response.error_message}")
        
        # 将生成的图片上传到存储管理器
        url = await storage_manager.upload_avatar_image(
            BytesIO(response.image_data),
            response.filename
        )
        
        if not url:
            raise HTTPException(status_code=500, detail="图片上传失败")
        
        # 更新角色的头像URL
        success = await script_repository.update_character_avatar_url(character.id, url)
        if not success:
            raise HTTPException(status_code=500, detail="更新角色头像URL失败")
        
        return ScriptResponse(
            success=True,
            message="头像图片生成成功",
            data={
                "url": url,
                "character_id": character.id,
                "character_name": character.name,
                "generation_time": response.generation_time,
                "prompt_id": response.prompt_id
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"生成失败: {str(e)}")

@router.post("/generate/evidence", summary="生成证据图片")
async def generate_evidence_image(request: ImageGenerationRequestModel):
    """生成证据图片"""
    try:
        # 检查剧本是否存在
        script = await script_repository.get_script_by_id(request.script_id)
        if not script:
            raise HTTPException(status_code=404, detail="剧本不存在")
        
        # 检查证据是否存在
        evidence = None
        for ev in script.evidence:
            if ev.id == request.target_id:
                evidence = ev
                break
        
        if not evidence:
            raise HTTPException(status_code=404, detail="证据不存在")
        
        # 创建图片生成请求
        generation_request = ImageGenerationRequest(
            positive_prompt=request.positive_prompt,
            negative_prompt=request.negative_prompt,
            width=request.width,
            height=request.height,
            steps=request.steps,
            cfg=request.cfg,
            seed=request.seed
        )
        
        # 调用ComfyUI服务生成图片
        response = await comfyui_service.generate_image(generation_request)
        
        if not response.success:
            raise HTTPException(status_code=500, detail=f"图片生成失败: {response.error_message}")
        
        # 将生成的图片上传到存储管理器
        url = await storage_manager.upload_evidence_image(
            BytesIO(response.image_data),
            response.filename
        )
        
        if not url:
            raise HTTPException(status_code=500, detail="图片上传失败")
        
        # 更新证据的图片URL
        success = await script_repository.update_evidence_image_url(evidence.id, url)
        if not success:
            raise HTTPException(status_code=500, detail="更新证据图片URL失败")
        
        return ScriptResponse(
            success=True,
            message="证据图片生成成功",
            data={
                "url": url,
                "evidence_id": evidence.id,
                "evidence_name": evidence.name,
                "generation_time": response.generation_time,
                "prompt_id": response.prompt_id
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"生成失败: {str(e)}")

@router.post("/generate/scene", summary="生成场景背景图")
async def generate_scene_image(request: ImageGenerationRequestModel):
    """生成场景背景图片"""
    try:
        # 检查剧本是否存在
        script = await script_repository.get_script_by_id(request.script_id)
        if not script:
            raise HTTPException(status_code=404, detail="剧本不存在")
        
        # 检查场景是否存在
        location = None
        for loc in script.locations:
            if loc.id == request.target_id:
                location = loc
                break
        
        if not location:
            raise HTTPException(status_code=404, detail="场景不存在")
        
        # 创建图片生成请求
        generation_request = ImageGenerationRequest(
            positive_prompt=request.positive_prompt,
            negative_prompt=request.negative_prompt,
            width=request.width,
            height=request.height,
            steps=request.steps,
            cfg=request.cfg,
            seed=request.seed
        )
        
        # 调用ComfyUI服务生成图片
        response = await comfyui_service.generate_image(generation_request)
        
        if not response.success:
            raise HTTPException(status_code=500, detail=f"图片生成失败: {response.error_message}")
        
        # 将生成的图片上传到存储管理器
        url = await storage_manager.upload_scene_image(
            BytesIO(response.image_data),
            response.filename
        )
        
        if not url:
            raise HTTPException(status_code=500, detail="图片上传失败")
        
        # 更新场景的背景图片URL
        success = await script_repository.update_location_background_url(location.id, url)
        if not success:
            raise HTTPException(status_code=500, detail="更新场景背景图片URL失败")
        
        return ScriptResponse(
            success=True,
            message="场景图片生成成功",
            data={
                "url": url,
                "location_id": location.id,
                "location_name": location.name,
                "generation_time": response.generation_time,
                "prompt_id": response.prompt_id
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"生成失败: {str(e)}")

# 证据管理相关路由
@router.post("/evidence", summary="创建证据")
async def create_evidence(request: EvidenceCreateRequest):
    """创建新证据"""
    try:
        # 检查剧本是否存在
        script = await script_repository.get_script_by_id(request.script_id)
        if not script:
            raise HTTPException(status_code=404, detail="剧本不存在")
        
        # 创建证据
        evidence_data = {
            "script_id": request.script_id,
            "name": request.name,
            "description": request.description,
            "evidence_type": request.evidence_type,
            "location": request.location,
            "significance": request.significance,
            "related_to": request.related_to,
            "importance": request.importance,
            "is_hidden": request.is_hidden
        }
        
        evidence_id = await script_repository.create_evidence(evidence_data)
        
        return ScriptResponse(
            success=True,
            message="证据创建成功",
            data={"evidence_id": evidence_id}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"创建证据失败: {str(e)}")

@router.put("/evidence/{evidence_id}", summary="更新证据")
async def update_evidence(evidence_id: int, request: EvidenceUpdateRequest):
    """更新证据信息"""
    try:
        # 构建更新数据（只包含非None的字段）
        update_data = {}
        if request.name is not None:
            update_data["name"] = request.name
        if request.description is not None:
            update_data["description"] = request.description
        if request.evidence_type is not None:
            update_data["evidence_type"] = request.evidence_type
        if request.location is not None:
            update_data["location"] = request.location
        if request.significance is not None:
            update_data["significance"] = request.significance
        if request.related_to is not None:
            update_data["related_to"] = request.related_to
        if request.importance is not None:
            update_data["importance"] = request.importance
        if request.is_hidden is not None:
            update_data["is_hidden"] = request.is_hidden
        
        if not update_data:
            raise HTTPException(status_code=400, detail="没有提供要更新的字段")
        
        # 更新证据
        success = await script_repository.update_evidence(evidence_id, update_data)
        if not success:
            raise HTTPException(status_code=404, detail="证据不存在或更新失败")
        
        return ScriptResponse(
            success=True,
            message="证据更新成功"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"更新证据失败: {str(e)}")

@router.delete("/evidence/{evidence_id}", summary="删除证据")
async def delete_evidence(evidence_id: int):
    """删除证据"""
    try:
        # 删除证据
        result = await script_repository.delete_evidence(evidence_id)
        if result is False:
            raise HTTPException(status_code=404, detail="证据不存在或删除失败")
        
        # 如果返回的是图片URL，删除关联的图片文件
        if isinstance(result, str) and result:
            try:
                await storage_manager.delete_file(result)
            except Exception as e:
                print(f"删除证据图片文件失败: {e}")
        
        return ScriptResponse(
            success=True,
            message="证据删除成功"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"删除证据失败: {str(e)}")

@router.post("/evidence/generate-prompt", summary="生成证据图片提示词")
async def generate_evidence_prompt(request: PromptGenerationRequest):
    """使用LLM生成证据图片的提示词和结构化数据"""
    try:
        # 创建LLM服务实例
        llm_service = LLMService.from_config(config.llm_config)
        
        # 构建系统提示词
        system_prompt = """
你是一个专业的图片生成提示词专家，专门为剧本杀游戏生成证据图片的提示词。
请根据提供的证据信息，生成高质量的英文图片提示词，并按照"主体 + 细节 + 氛围 + 风格 + 技术"的结构组织。

要求：
1. 生成的提示词必须是英文
2. 按照"主体 + 细节 + 氛围 + 风格 + 技术"的结构组织
3. 提示词要具体、生动，能够准确描述证据的特征
4. 考虑证据类型、位置和相关性
5. 适合用于AI图片生成

请以JSON格式返回结果，包含以下字段：
- positive_prompt: 正向提示词（英文）
- negative_prompt: 负向提示词（英文）
- subject: 主体描述
- details: 细节描述
- atmosphere: 氛围描述
- style: 风格描述
- technical: 技术参数描述
- keywords: 关键词数组
"""
        
        # 构建用户提示词
        user_prompt = f"""
证据信息：
- 名称：{request.evidence_name}
- 描述：{request.evidence_description}
- 类型：{request.evidence_type}
- 位置：{request.location}
- 相关角色：{request.related_to}
- 剧本背景：{request.script_context}

请为这个证据生成图片提示词和结构化数据。
"""
        
        # 调用LLM生成提示词
        messages = [
            LLMMessage(role="system", content=system_prompt),
            LLMMessage(role="user", content=user_prompt)
        ]
        
        response = await llm_service.chat_completion(
            messages=messages,
            temperature=0.7,
            max_tokens=1000
        )
        
        # 尝试解析JSON响应
        try:
            import json
            result_data = json.loads(response.content)
        except json.JSONDecodeError:
            # 如果无法解析JSON，返回原始内容
            result_data = {
                "positive_prompt": response.content,
                "negative_prompt": "blurry, low quality, distorted, unrealistic",
                "subject": request.evidence_name,
                "details": request.evidence_description,
                "atmosphere": "mysterious, dramatic",
                "style": "realistic, detailed",
                "technical": "high resolution, professional photography",
                "keywords": [request.evidence_name, request.evidence_type]
            }
        
        return PromptGenerationResponse(
            success=True,
            message="提示词生成成功",
            data=result_data
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"生成提示词失败: {str(e)}")