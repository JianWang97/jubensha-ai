"""剧本图片生成API路由"""
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from pydantic import BaseModel
from sqlalchemy.orm import Session

from src.db.repositories.character_repository import CharacterRepository
from ...db.repositories import ScriptRepository
from ...core.storage import storage_manager
from ...services.comfyui_service import ImageGenerationResponse, comfyui_service, ImageGenerationRequest
from ...db.session import get_db_session
from ...db.repositories.evidence_repository import EvidenceRepository
from ...db.repositories.location_repository import LocationRepository
from io import BytesIO

from random import randint
from ...services.llm_service import llm_service, LLMMessage

router = APIRouter(prefix="/api/scripts", tags=["剧本图片生成"])

def get_script_repository(db: Session = Depends(get_db_session)) -> ScriptRepository:
    return ScriptRepository(db)

def get_character_repository(db: Session = Depends(get_db_session)) -> CharacterRepository:
    return CharacterRepository(db)

def get_evidence_repository(db: Session = Depends(get_db_session)) -> EvidenceRepository:
    return EvidenceRepository(db)

def get_location_repository(db: Session = Depends(get_db_session)) -> LocationRepository:
    return LocationRepository(db)
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

class ScriptCoverPromptRequest(BaseModel):
    """剧本封面提示词生成请求模型"""
    script_title: str
    script_description: str
    script_tags: Optional[list] = None
    difficulty: Optional[str] = None
    style_preference: Optional[str] = None

class ScriptResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None

@router.post("/generate/cover", summary="生成封面图片")
async def generate_cover_image(request: ImageGenerationRequestModel, script_repository: ScriptRepository = Depends(get_script_repository)):
    """生成剧本封面图片"""
    try:
        # 检查剧本是否存在
        script = script_repository.get_script_by_id(request.script_id)
        if not script:
            raise HTTPException(status_code=404, detail="剧本不存在")
        
 
        
        # 调用ComfyUI服务生成图片
        response = await generate_image(request)
        
        if not response.success:
            raise HTTPException(status_code=500, detail=f"图片生成失败: {response.error_message}")
        
        # 将生成的图片上传到存储管理器
        url = await storage_manager.upload_cover_image(
            BytesIO(response.image_data),
            response.filename
        )
        
        if not url:
            raise HTTPException(status_code=500, detail="图片上传失败")
        

        success = script_repository.update_script_cover_image_url(request.script_id, url)
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

@router.post("/generate/cover-prompt", summary="生成剧本封面提示词")
async def generate_script_cover_prompt(request: ScriptCoverPromptRequest):
    """使用LLM生成剧本封面图片的提示词"""
    try:
        # 构建LLM提示
        system_prompt = "你是一个专业的图片生成提示词创作者，擅长为剧本杀游戏创建详细的封面图片描述。"
        
        user_prompt = f"""请为以下剧本生成一个详细的封面图片生成提示词：

剧本标题：{request.script_title}
剧本描述：{request.script_description}
"""
        
        if request.script_tags:
            user_prompt += f"剧本标签：{', '.join(request.script_tags)}\n"
        
        if request.difficulty:
            user_prompt += f"难度等级：{request.difficulty}\n"
        
        if request.style_preference:
            user_prompt += f"风格偏好：{request.style_preference}\n"
        
        user_prompt += """\n请生成一个适合用于AI图片生成的英文提示词，要求：
1. 描述要具体、生动，体现剧本的主题和氛围
2. 包含适当的艺术风格描述
3. 考虑光线、构图、色彩等视觉元素
4. 适合剧本杀游戏的神秘、悬疑氛围
5. 只返回英文提示词，不要其他解释"""
        
        # 调用LLM服务
        messages = [
            LLMMessage(role="system", content=system_prompt),
            LLMMessage(role="user", content=user_prompt)
        ]
        
        response = await llm_service.chat_completion(messages, max_tokens=200)
        
        if not response.content:
            raise HTTPException(status_code=500, detail="LLM服务返回空内容")
        
        return ScriptResponse(
            success=True,
            message="封面提示词生成成功",
            data={
                "prompt": response.content.strip(),
                "script_title": request.script_title
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"生成失败: {str(e)}")

@router.post("/generate/avatar", summary="生成角色头像")
async def generate_avatar_image(request: ImageGenerationRequestModel, 
    script_repository: ScriptRepository = Depends(get_script_repository),
    character_repository: CharacterRepository = Depends(get_character_repository)
    ):
    """生成角色头像图片"""
    try:
        # 检查剧本是否存在
        script = script_repository.get_script_by_id(request.script_id)
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
        
        # 调用ComfyUI服务生成图片
        response = await generate_image(request)
        
        if not response.success:
            raise HTTPException(status_code=500, detail=f"图片生成失败: {response.error_message}")
        
        # 将生成的图片上传到存储管理器
        url = await storage_manager.upload_avatar_image(
            BytesIO(response.image_data),
            response.filename
        )
        
        if not url:
            raise HTTPException(status_code=500, detail="图片上传失败")
        
        success = character_repository.update_avatar_url(character.id, url)
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
async def generate_evidence_image(request: ImageGenerationRequestModel, evidence_repository: EvidenceRepository = Depends(get_evidence_repository)):
    """生成证据图片"""
    try:

        evidence = evidence_repository.get_evidence_by_id(request.target_id)
        if not evidence:
            raise HTTPException(status_code=404, detail="证据不存在")
        
        # 调用ComfyUI服务生成图片
        response = await generate_image(request)
        
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
        success = evidence_repository.update_evidence_image_url(evidence.id, url)
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
async def generate_scene_image(request: ImageGenerationRequestModel, location_repository: LocationRepository = Depends(get_location_repository)):
    """生成场景背景图片"""
    try:
        # 检查场景是否存在
        location = location_repository.get_location_by_id(request.target_id)
        
        if not location:
            raise HTTPException(status_code=404, detail="场景不存在")
        
        # 调用ComfyUI服务生成图片
        response = await generate_image(request)
        
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
        success = location_repository.update_location_background_url(location.id, url)
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

async def generate_image(requset:ImageGenerationRequestModel) : 
            # 创建图片生成请求
    generation_request = ImageGenerationRequest(
        positive_prompt=requset.positive_prompt,
        negative_prompt=requset.negative_prompt,
        width=requset.width,
        height=requset.height,
        steps=requset.steps,
        cfg=requset.cfg,
        seed=randint(0, 2**32 - 1),
    )
        
    return await comfyui_service.generate_image(generation_request)
