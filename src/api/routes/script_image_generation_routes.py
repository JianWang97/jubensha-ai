"""剧本图片生成API路由"""
from fastapi import APIRouter, HTTPException
from typing import Optional
from pydantic import BaseModel
from ...core.script_repository import script_repository
from ...core.storage import storage_manager
from ...services.comfyui_service import comfyui_service, ImageGenerationRequest
from io import BytesIO

router = APIRouter(prefix="/api/scripts", tags=["剧本图片生成"])

# Pydantic模型用于API请求/响应
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

class ScriptResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None

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
        success = await script_repository.update_cover_image_url(request.script_id, url)
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