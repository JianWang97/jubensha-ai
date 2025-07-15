"""证据管理API路由"""
from fastapi import APIRouter, HTTPException
from typing import Optional, List
from pydantic import BaseModel
from ...core.script_repository import script_repository
from ...core.storage import storage_manager
from ...services.llm_service import llm_service

router = APIRouter(prefix="/api/scripts", tags=["证据管理"])

# Pydantic模型用于API请求/响应
class EvidenceCreateRequest(BaseModel):
    name: str
    description: str
    image_url: Optional[str] = None
    is_public: bool = True
    discovery_condition: Optional[str] = None
    related_characters: Optional[List[int]] = None

class EvidenceUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    is_public: Optional[bool] = None
    discovery_condition: Optional[str] = None
    related_characters: Optional[List[int]] = None

class EvidencePromptRequest(BaseModel):
    evidence_name: str
    evidence_description: str
    script_theme: Optional[str] = None
    style_preference: Optional[str] = None

class ScriptResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None

@router.post("/{script_id}/evidence", summary="创建证据")
async def create_evidence(script_id: int, request: EvidenceCreateRequest):
    """为指定剧本创建新证据"""
    try:
        # 检查剧本是否存在
        script = await script_repository.get_script_by_id(script_id)
        if not script:
            raise HTTPException(status_code=404, detail="剧本不存在")
        
        # 创建证据
        evidence_id = await script_repository.create_evidence(
            script_id=script_id,
            name=request.name,
            description=request.description,
            image_url=request.image_url,
            is_public=request.is_public,
            discovery_condition=request.discovery_condition,
            related_characters=request.related_characters or []
        )
        
        if not evidence_id:
            raise HTTPException(status_code=500, detail="创建证据失败")
        
        return ScriptResponse(
            success=True,
            message="证据创建成功",
            data={"evidence_id": evidence_id}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"创建失败: {str(e)}")

@router.put("/{script_id}/evidence/{evidence_id}", summary="更新证据")
async def update_evidence(script_id: int, evidence_id: int, request: EvidenceUpdateRequest):
    """更新指定证据的信息"""
    try:
        # 检查剧本是否存在
        script = await script_repository.get_script_by_id(script_id)
        if not script:
            raise HTTPException(status_code=404, detail="剧本不存在")
        
        # 检查证据是否存在
        evidence = None
        for ev in script.evidence:
            if ev.id == evidence_id:
                evidence = ev
                break
        
        if not evidence:
            raise HTTPException(status_code=404, detail="证据不存在")
        
        # 准备更新数据
        update_data = {}
        if request.name is not None:
            update_data['name'] = request.name
        if request.description is not None:
            update_data['description'] = request.description
        if request.image_url is not None:
            update_data['image_url'] = request.image_url
        if request.is_public is not None:
            update_data['is_public'] = request.is_public
        if request.discovery_condition is not None:
            update_data['discovery_condition'] = request.discovery_condition
        if request.related_characters is not None:
            update_data['related_characters'] = request.related_characters
        
        if not update_data:
            raise HTTPException(status_code=400, detail="没有提供更新数据")
        
        # 更新证据
        success = await script_repository.update_evidence(evidence_id, update_data)
        if not success:
            raise HTTPException(status_code=500, detail="更新证据失败")
        
        return ScriptResponse(
            success=True,
            message="证据更新成功",
            data={"evidence_id": evidence_id}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"更新失败: {str(e)}")

@router.delete("/{script_id}/evidence/{evidence_id}", summary="删除证据")
async def delete_evidence(script_id: int, evidence_id: int):
    """删除指定证据"""
    try:
        # 检查剧本是否存在
        script = await script_repository.get_script_by_id(script_id)
        if not script:
            raise HTTPException(status_code=404, detail="剧本不存在")
        
        # 检查证据是否存在
        evidence = None
        for ev in script.evidence:
            if ev.id == evidence_id:
                evidence = ev
                break
        
        if not evidence:
            raise HTTPException(status_code=404, detail="证据不存在")
        
        # 如果证据有关联的图片，先删除图片文件
        if evidence.image_url:
            try:
                await storage_manager.delete_evidence_image(evidence.image_url)
            except Exception as e:
                # 图片删除失败不应该阻止证据删除
                print(f"删除证据图片失败: {e}")
        
        # 删除证据
        success = await script_repository.delete_evidence(evidence_id)
        if not success:
            raise HTTPException(status_code=500, detail="删除证据失败")
        
        return ScriptResponse(
            success=True,
            message="证据删除成功",
            data={"evidence_id": evidence_id}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"删除失败: {str(e)}")

@router.post("/evidence/generate-prompt", summary="生成证据图片提示词")
async def generate_evidence_prompt(request: EvidencePromptRequest):
    """使用LLM生成证据图片的提示词"""
    try:
        # 构建LLM提示
        system_prompt = "你是一个专业的图片生成提示词创作者，擅长为剧本杀游戏中的证据创建详细的图片描述。"
        
        user_prompt = f"""请为以下证据生成一个详细的图片生成提示词：

证据名称：{request.evidence_name}
证据描述：{request.evidence_description}
"""
        
        if request.script_theme:
            user_prompt += f"剧本主题：{request.script_theme}\n"
        
        if request.style_preference:
            user_prompt += f"风格偏好：{request.style_preference}\n"
        
        user_prompt += """\n请生成一个适合用于AI图片生成的英文提示词，要求：
1. 描述要具体、生动
2. 包含适当的艺术风格描述
3. 考虑光线、构图等视觉元素
4. 适合剧本杀游戏的氛围
5. 只返回英文提示词，不要其他解释"""
        
        # 调用LLM服务
        from ...services.llm_service import LLMMessage
        messages = [
            LLMMessage(role="system", content=system_prompt),
            LLMMessage(role="user", content=user_prompt)
        ]
        
        response = await llm_service.chat_completion(messages, max_tokens=200)
        
        if not response.content:
            raise HTTPException(status_code=500, detail="LLM服务返回空内容")
        
        return ScriptResponse(
            success=True,
            message="提示词生成成功",
            data={
                "prompt": response.content.strip(),
                "evidence_name": request.evidence_name
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"生成失败: {str(e)}")