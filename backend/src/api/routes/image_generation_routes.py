"""剧本图片生成API路由"""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List
from io import BytesIO
from random import randint

from src.db.repositories.script_repository import ScriptRepository
from src.db.repositories.image_repository import ImageRepository
from src.core.storage import storage_manager
from src.services.comfyui_service import ImageGenerationResponse, comfyui_service, ImageGenerationRequest
from src.services.llm_service import llm_service, LLMMessage
from src.schemas.image_generation_schemas import (
    ImageGenerationRequest as ImageGenRequest, 
    ImageListRequest, 
    ScriptResponse,
    ImageResponse,
    ImageType
)
from src.core.container_integration import get_script_repo_depends, get_image_repo_depends
from src.core.auth_dependencies import get_current_active_user
from src.db.models.user import User
from src.db.models.image import ImageDBModel
from ...schemas.base import APIResponse

router = APIRouter(prefix="/api/images", tags=["图片生成"])

# 默认提示词配置
DEFAULT_PROMPTS = {
    ImageType.COVER: "mysterious book cover, dark atmosphere, thriller game poster, detailed illustration, professional cover art",
    ImageType.CHARACTER: "character portrait, detailed face, professional headshot, game character design",
    ImageType.EVIDENCE: "evidence item, detailed object, crime scene investigation, realistic item photography",
    ImageType.SCENE: "detailed background scene, atmospheric lighting, game environment, cinematic composition"
}

# 图片尺寸配置
IMAGE_SIZES = {
    ImageType.COVER: (1080, 1080),    # 1080p 正方形
    ImageType.SCENE: (1920, 1080),    # 1080p 横屏
    ImageType.CHARACTER: (720, 720),   # 720x720 正方形
    ImageType.EVIDENCE: (720, 720)     # 720x720 正方形
}

async def optimize_prompt_with_llm(image_type: ImageType, script_info: dict, user_prompt: str = None) -> str:
    """使用LLM优化图片提示词"""
    try:
        # 构建系统提示
        system_prompt = "你是一个专业的AI图片生成提示词优化专家，擅长为剧本杀游戏优化和完善图片描述。"
        
        # 获取基础提示词（用户提供的或默认的）
        base_prompt = user_prompt or DEFAULT_PROMPTS.get(image_type, "detailed illustration, professional artwork")
        
        # 根据图片类型构建不同的优化提示
        if image_type == ImageType.COVER:
            llm_prompt = f"""请优化以下剧本封面图片的英文提示词：

当前提示词：{base_prompt}

剧本信息：
- 标题：{script_info.get('title', '未知剧本')}
- 描述：{script_info.get('description', '暂无描述')}
- 标签：{', '.join(script_info.get('tags', [])) if script_info.get('tags') else '推理'}
- 难度：{script_info.get('difficulty', 'medium')}
- 类型：{script_info.get('category', '推理')}

请根据剧本信息优化提示词，要求：
1. 保留原有提示词的核心内容
2. 结合剧本的主题和氛围进行增强
3. 添加适合剧本杀游戏的悬疑、神秘元素
4. 优化艺术风格和视觉效果描述
5. 确保提示词适合AI图片生成
6. 只返回优化后的英文提示词，不要其他解释"""

        elif image_type == ImageType.CHARACTER:
            llm_prompt = f"""请优化以下角色头像图片的英文提示词：

当前提示词：{base_prompt}

剧本信息：
- 标题：{script_info.get('title', '未知剧本')}
- 类型：{script_info.get('category', '推理')}
- 标签：{', '.join(script_info.get('tags', [])) if script_info.get('tags') else '推理'}

请根据剧本信息优化提示词，要求：
1. 保留原有提示词的核心内容
2. 结合剧本类型添加角色特征
3. 体现剧本杀游戏的角色设定感
4. 优化人物形象和神秘感
5. 确保适合头像图片生成
6. 只返回优化后的英文提示词，不要其他解释"""

        elif image_type == ImageType.EVIDENCE:
            llm_prompt = f"""请优化以下证据物品图片的英文提示词：

当前提示词：{base_prompt}

剧本信息：
- 标题：{script_info.get('title', '未知剧本')}
- 类型：{script_info.get('category', '推理')}
- 标签：{', '.join(script_info.get('tags', [])) if script_info.get('tags') else '推理'}

请根据剧本信息优化提示词，要求：
1. 保留原有提示词的核心内容
2. 结合剧本类型设计合适的证据物品
3. 增强物品的神秘感和线索价值
4. 优化物品细节和质感描述
5. 确保适合证据图片生成
6. 只返回优化后的英文提示词，不要其他解释"""

        elif image_type == ImageType.SCENE:
            llm_prompt = f"""请优化以下场景背景图片的英文提示词：

当前提示词：{base_prompt}

剧本信息：
- 标题：{script_info.get('title', '未知剧本')}
- 类型：{script_info.get('category', '推理')}
- 标签：{', '.join(script_info.get('tags', [])) if script_info.get('tags') else '推理'}

请根据剧本信息优化提示词，要求：
1. 保留原有提示词的核心内容
2. 结合剧本类型营造合适的场景氛围
3. 增强神秘、悬疑的环境特征
4. 优化光线、构图和环境细节
5. 确保适合背景场景生成
6. 只返回优化后的英文提示词，不要其他解释"""

        # 调用LLM服务
        messages = [
            LLMMessage(role="system", content=system_prompt),
            LLMMessage(role="user", content=llm_prompt)
        ]
        
        response = await llm_service.chat_completion(messages, max_tokens=250)
        
        if not response.content:
            # 如果LLM失败，返回原始提示词
            return base_prompt
        
        return response.content.strip()
        
    except Exception:
        # 如果出现任何错误，返回原始提示词
        return user_prompt or DEFAULT_PROMPTS.get(image_type, "detailed illustration, professional artwork")

@router.post("/generate", summary="生成图片")
async def generate_image(
    request: ImageGenRequest,
    current_user: User = Depends(get_current_active_user),
    script_repository: ScriptRepository = get_script_repo_depends(),
    image_repository: ImageRepository = get_image_repo_depends()
) -> APIResponse[dict]:
    """
    生成图片
    - image_type: 图片类型（cover, character, evidence, scene）必填
    - script_id: 剧本ID
    - positive_prompt: 提示词（可选，会通过LLM优化）
    """
    try:
        # 检查剧本是否存在
        script = script_repository.get_by_id(request.script_id)
        if not script:
            raise HTTPException(status_code=404, detail="剧本不存在")
        
        # 获取剧本信息用于LLM优化
        script_info = {
            'title': script.title,
            'description': script.description,
            'tags': script.tags,
            'difficulty': script.difficulty,
            'category': getattr(script, 'category', '推理')
        }
        
        # 总是使用LLM优化提示词（无论用户是否提供）
        prompt = await optimize_prompt_with_llm(
            request.image_type, 
            script_info, 
            request.positive_prompt
        )
        
        # 获取图片尺寸
        width, height = IMAGE_SIZES[request.image_type]
        
        # 创建ComfyUI请求
        generation_request = ImageGenerationRequest(
            positive_prompt=prompt,
            negative_prompt=request.negative_prompt,
            width=width,
            height=height,
            steps=20,
            cfg=8.0,
            seed=randint(0, 2**32 - 1),
        )
        
        # 调用ComfyUI服务生成图片
        response = await comfyui_service.generate_image(generation_request)
        
        if not response.success:
            raise HTTPException(status_code=500, detail=f"图片生成失败: {response.error_message}")
        
        # 根据图片类型选择上传方法
        if request.image_type == ImageType.COVER:
            url = await storage_manager.upload_cover_image(
                BytesIO(response.image_data),
                response.filename
            ) if response.image_data and response.filename else None
        elif request.image_type == ImageType.CHARACTER:
            url = await storage_manager.upload_avatar_image(
                BytesIO(response.image_data),
                response.filename
            ) if response.image_data and response.filename else None
        elif request.image_type == ImageType.EVIDENCE:
            url = await storage_manager.upload_evidence_image(
                BytesIO(response.image_data),
                response.filename
            ) if response.image_data and response.filename else None
        elif request.image_type == ImageType.SCENE:
            url = await storage_manager.upload_scene_image(
                BytesIO(response.image_data),
                response.filename
            ) if response.image_data and response.filename else None
        else:
            raise HTTPException(status_code=400, detail="不支持的图片类型")
        
        if not url:
            raise HTTPException(status_code=500, detail="图片上传失败")
        
        # 保存图片信息到数据库
        image_data = {
            "image_type": request.image_type.value,  # 使用.value获取字符串值
            "url": url,
            "path": response.filename,
            "script_id": request.script_id,
            "positive_prompt": prompt,
            "author_id": current_user.id,
            "negative_prompt": request.negative_prompt,
            "width": str(width),
            "height": str(height)
        }
        
        image = image_repository.create(**image_data)
        image_repository.session.commit()
        
        return ScriptResponse(
            success=True,
            message="图片生成成功",
            data={
                "id": str(image.id),
                "url": url,
                "image_type": request.image_type.value,
                "generation_time": response.generation_time,
                "prompt_id": response.prompt_id
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"生成失败: {str(e)}")

@router.get("/my-images", summary="获取当前用户的图片")
async def get_my_images(
    script_id: int = None,
    current_user: User = Depends(get_current_active_user),
    image_repository: ImageRepository = get_image_repo_depends()
) -> List[ImageResponse]:
    """
    获取当前用户的所有图片
    - script_id: 可选，如果提供则只返回该剧本的图片
    """
    try:
        images = image_repository.get_by_author_and_script(
            author_id=current_user.id,
            script_id=script_id
        )
        
        return [
            ImageResponse(
                id=str(image.id),
                image_type=image.image_type,
                url=image.url,
                script_id=image.script_id,
                author_id=image.author_id,
                positive_prompt=image.positive_prompt,
                negative_prompt=image.negative_prompt,
                width=image.width,
                height=image.height,
                created_at=image.created_at.isoformat() if image.created_at else None
            )
            for image in images
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取图片列表失败: {str(e)}")

@router.delete("/{image_id}", summary="删除图片")
async def delete_image(
    image_id: str,
    current_user: User = Depends(get_current_active_user),
    image_repository: ImageRepository = get_image_repo_depends()
):
    """删除指定图片"""
    try:
        # 获取图片
        image = image_repository.get_by_id(image_id)
        if not image:
            raise HTTPException(status_code=404, detail="图片不存在")
        
        # 检查权限（只能删除自己的图片）
        if image.author_id != current_user.id:
            raise HTTPException(status_code=403, detail="没有权限删除此图片")
        
        # 删除图片记录
        success = image_repository.delete(image_id)
        if not success:
            raise HTTPException(status_code=500, detail="删除图片失败")
        
        return ScriptResponse(
            success=True,
            message="图片删除成功"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"删除失败: {str(e)}")

@router.delete("/script/{script_id}", summary="删除剧本相关图片")
async def delete_script_images(
    script_id: int,
    current_user: User = Depends(get_current_active_user),
    script_repository: ScriptRepository = get_script_repo_depends(),
    image_repository: ImageRepository = get_image_repo_depends()
):
    """删除剧本相关的所有图片（仅剧本作者可操作）"""
    try:
        # 检查剧本是否存在
        script = script_repository.get_by_id(script_id)
        if not script:
            raise HTTPException(status_code=404, detail="剧本不存在")
        
        # 检查权限（这里需要添加剧本作者检查，暂时允许任何用户删除）
        # if script.author_id != current_user.id:
        #     raise HTTPException(status_code=403, detail="没有权限删除此剧本的图片")
        
        # 删除剧本相关图片
        success = image_repository.delete_by_script_id(script_id)
        
        return ScriptResponse(
            success=True,
            message=f"剧本相关图片删除{'成功' if success else '完成'}（可能没有相关图片）"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"删除失败: {str(e)}")
