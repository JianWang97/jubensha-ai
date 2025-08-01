"""场景管理API路由"""
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional, List
from sqlalchemy.orm import Session
from ...db.repositories.location_repository import LocationRepository
from ...db.repositories.script_repository import ScriptRepository
from ...services.llm_service import llm_service, LLMMessage
from ...schemas.script import ScriptLocation
from datetime import datetime
from ...schemas.location_schemas import LocationCreateRequest, LocationUpdateRequest, ScriptResponse, LocationPromptRequest
from ...core.container_integration import get_location_repo_depends, get_script_repo_depends

router = APIRouter(prefix="/api/locations", tags=["场景管理"])


@router.post("/{script_id}/locations", summary="创建场景")
async def create_location(script_id: int, request: ScriptLocation, location_repository: LocationRepository = get_location_repo_depends()):
    """为指定剧本创建新场景"""
    try:
        
        # 添加场景
        location = location_repository.add_location(request)
        location_id = location.id
        
        if not location_id:
            raise HTTPException(status_code=500, detail="创建场景失败")
        
        return ScriptResponse(
            success=True,
            message="场景创建成功",
            data={"location_id": location_id}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"创建失败: {str(e)}")

@router.put("/{script_id}/locations/{location_id}", summary="更新场景")
async def update_location(script_id: int, location_id: int, request: ScriptLocation, location_repository: LocationRepository = get_location_repo_depends()):
    """更新指定场景的信息"""
    try:
        # 检查场景是否存在
        location = location_repository.get_location_by_id(location_id)
        if not location:
            raise HTTPException(status_code=404, detail="场景不存在")

        # 更新场景
        if not location_repository.update_location(location_id, request):
            raise HTTPException(status_code=500, detail="更新场景失败")
        
        return ScriptResponse(
            success=True,
            message="场景更新成功",
            data={"location_id": location_id}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"更新失败: {str(e)}")

@router.delete("/{script_id}/locations/{location_id}", summary="删除场景")
async def delete_location(script_id: int, location_id: int, location_repository: LocationRepository = get_location_repo_depends()):
    """删除指定场景"""
    try:

        # 检查场景是否存在
        location = location_repository.get_location_by_id(location_id)
        
        if not location:
            raise HTTPException(status_code=404, detail="场景不存在")
        
        # 删除场景
        success = location_repository.delete_location(location_id)
        if not success:
            raise HTTPException(status_code=500, detail="删除场景失败")
        
        return ScriptResponse(
            success=True,
            message="场景删除成功",
            data={"location_id": location_id}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"删除失败: {str(e)}")

@router.get("/{script_id}/locations", summary="获取场景列表")
async def get_locations(script_id: int, 
    location_repository: LocationRepository = get_location_repo_depends(),
    script_repository: ScriptRepository = get_script_repo_depends()):
    """获取指定剧本的所有场景"""
    try:
        # 检查剧本是否存在
        script = script_repository.get_script_by_id(script_id)
        if not script:
            raise HTTPException(status_code=404, detail="剧本不存在")
        
        locations = location_repository.get_locations_by_script(script_id)
        # 返回场景列表
        locations_data: list[dict] = []
        for location in locations:
            locations_data.append({
                "id": location.id,
                "script_id": location.script_id,
                "name": location.name,
                "description": location.description,
                "searchable_items": list(location.searchable_items) if location.searchable_items else [],
                "background_image_url": location.background_image_url,
                "is_crime_scene": location.is_crime_scene
            })
        
        return ScriptResponse(
            success=True,
            message="获取场景列表成功",
            data={
                "locations": locations_data,
                "total": len(locations_data)
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取失败: {str(e)}")

@router.get("/{script_id}/locations/{location_id}", summary="获取场景详情")
async def get_location_detail(script_id: int, location_id: int,
    location_repository: LocationRepository = get_location_repo_depends(),
    script_repository: ScriptRepository = get_script_repo_depends()):
    """获取指定场景的详细信息"""
    try:
        # 检查场景是否存在
        location = location_repository.get_location_by_id(location_id)
        if not location:
            raise HTTPException(status_code=404, detail="场景不存在")
        
        # 返回场景详情
        location_data = {
            "id": location.id,
            "script_id": location.script_id,
            "name": location.name,
            "description": location.description,
            "searchable_items": location.searchable_items,
            "background_image_url": location.background_image_url,
            "is_crime_scene": location.is_crime_scene
        }
        return ScriptResponse(
            success=True,
            message="获取场景详情成功",
            data={"location": location_data}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取失败: {str(e)}")

@router.post("/locations/generate-prompt", summary="生成场景图片提示词")
async def generate_location_prompt(request: LocationPromptRequest):
    """使用LLM生成场景图片的提示词"""
    try:
        # 构建LLM提示
        system_prompt = "你是一个专业的图片生成提示词创作者，擅长为剧本杀游戏中的场景创建详细的图片描述。"
        
        user_prompt = f"""请为以下场景生成一个详细的图片生成提示词：

场景名称：{request.location_name}
场景描述：{request.location_description}
"""
        
        if request.script_theme:
            user_prompt += f"剧本主题：{request.script_theme}\n"
        
        if request.style_preference:
            user_prompt += f"风格偏好：{request.style_preference}\n"
            
        if request.is_crime_scene:
            user_prompt += "特殊要求：这是一个案发现场，需要体现出紧张、神秘的氛围\n"
        
        user_prompt += """\n要求：
1. 描述要详细具体，包含环境、光线、氛围等元素
2. 适合用于AI图片生成
3. 风格要符合剧本杀游戏的氛围
4. 避免包含具体的人物
5. 重点突出场景的特色和氛围
6. 只返回英文提示词，不要其他解释"""
        
        # 调用LLM服务
        messages = [
            LLMMessage(role="system", content=system_prompt),
            LLMMessage(role="user", content=user_prompt)
        ]
        
        response = await llm_service.chat_completion(messages, max_tokens=200)
        
        if not response.content:
            raise HTTPException(status_code=500, detail="LLM服务返回空内容")
        
        return {
            "success": True,
            "message": "提示词生成成功",
            "data": {
                "prompt": response.content.strip(),
                "location_name": request.location_name
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"生成提示词失败: {str(e)}")