"""角色管理API路由"""
from fastapi import APIRouter, HTTPException
from typing import Optional, List
from pydantic import BaseModel
from ...core.script_repository import script_repository
from ...services.llm_service import llm_service

router = APIRouter(prefix="/api/scripts", tags=["角色管理"])

# Pydantic模型用于API请求/响应
class CharacterCreateRequest(BaseModel):
    name: str
    description: str
    background_story: str
    personality: str
    avatar_url: Optional[str] = None
    voice_id: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    occupation: Optional[str] = None
    relationships: Optional[List[dict]] = None
    secrets: Optional[List[str]] = None
    goals: Optional[List[str]] = None

class CharacterUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    background_story: Optional[str] = None
    personality: Optional[str] = None
    avatar_url: Optional[str] = None
    voice_id: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    occupation: Optional[str] = None
    relationships: Optional[List[dict]] = None
    secrets: Optional[List[str]] = None
    goals: Optional[List[str]] = None

class CharacterPromptRequest(BaseModel):
    character_name: str
    character_description: str
    profession: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    personality_traits: Optional[List[str]] = None
    script_context: Optional[str] = None

class ScriptResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None

@router.post("/{script_id}/characters", summary="创建角色")
async def create_character(script_id: int, request: CharacterCreateRequest):
    """为指定剧本创建新角色"""
    try:
        # 检查剧本是否存在
        script = await script_repository.get_script_by_id(script_id)
        if not script:
            raise HTTPException(status_code=404, detail="剧本不存在")
        
        # 创建角色
        character_id = await script_repository.create_character(
            script_id=script_id,
            name=request.name,
            description=request.description,
            background_story=request.background_story,
            personality=request.personality,
            avatar_url=request.avatar_url,
            voice_id=request.voice_id,
            age=request.age,
            gender=request.gender,
            occupation=request.occupation,
            relationships=request.relationships or [],
            secrets=request.secrets or [],
            goals=request.goals or []
        )
        
        if not character_id:
            raise HTTPException(status_code=500, detail="创建角色失败")
        
        return ScriptResponse(
            success=True,
            message="角色创建成功",
            data={"character_id": character_id}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"创建失败: {str(e)}")

@router.put("/{script_id}/characters/{character_id}", summary="更新角色")
async def update_character(script_id: int, character_id: int, request: CharacterUpdateRequest):
    """更新指定角色的信息"""
    try:
        # 检查剧本是否存在
        script = await script_repository.get_script_by_id(script_id)
        if not script:
            raise HTTPException(status_code=404, detail="剧本不存在")
        
        # 检查角色是否存在
        character = None
        for char in script.characters:
            if char.id == character_id:
                character = char
                break
        
        if not character:
            raise HTTPException(status_code=404, detail="角色不存在")
        
        # 准备更新数据
        update_data = {}
        if request.name is not None:
            update_data['name'] = request.name
        if request.description is not None:
            update_data['description'] = request.description
        if request.background_story is not None:
            update_data['background_story'] = request.background_story
        if request.personality is not None:
            update_data['personality'] = request.personality
        if request.avatar_url is not None:
            update_data['avatar_url'] = request.avatar_url
        if request.voice_id is not None:
            update_data['voice_id'] = request.voice_id
        if request.age is not None:
            update_data['age'] = request.age
        if request.gender is not None:
            update_data['gender'] = request.gender
        if request.occupation is not None:
            update_data['occupation'] = request.occupation
        if request.relationships is not None:
            update_data['relationships'] = request.relationships
        if request.secrets is not None:
            update_data['secrets'] = request.secrets
        if request.goals is not None:
            update_data['goals'] = request.goals
        
        if not update_data:
            raise HTTPException(status_code=400, detail="没有提供更新数据")
        
        # 更新角色
        success = await script_repository.update_character(character_id, update_data)
        if not success:
            raise HTTPException(status_code=500, detail="更新角色失败")
        
        return ScriptResponse(
            success=True,
            message="角色更新成功",
            data={"character_id": character_id}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"更新失败: {str(e)}")

@router.delete("/{script_id}/characters/{character_id}", summary="删除角色")
async def delete_character(script_id: int, character_id: int):
    """删除指定角色"""
    try:
        # 检查剧本是否存在
        script = await script_repository.get_script_by_id(script_id)
        if not script:
            raise HTTPException(status_code=404, detail="剧本不存在")
        
        # 检查角色是否存在
        character = None
        for char in script.characters:
            if char.id == character_id:
                character = char
                break
        
        if not character:
            raise HTTPException(status_code=404, detail="角色不存在")
        
        # 删除角色
        success = await script_repository.delete_character(character_id)
        if not success:
            raise HTTPException(status_code=500, detail="删除角色失败")
        
        return ScriptResponse(
            success=True,
            message="角色删除成功",
            data={"character_id": character_id}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"删除失败: {str(e)}")

@router.post("/characters/generate-prompt", summary="生成角色头像提示词")
async def generate_character_prompt(request: CharacterPromptRequest):
    """使用LLM生成角色头像的提示词"""
    try:
        # 构建LLM提示
        system_prompt = "你是一个专业的角色设计师和图片生成提示词创作者，擅长为剧本杀游戏中的角色创建详细的头像描述。"
        
        user_prompt = f"""请为以下角色生成一个详细的头像图片生成提示词：

角色名称：{request.character_name}
角色描述：{request.character_description}
"""
        
        if request.age:
            user_prompt += f"年龄：{request.age}岁\n"
        
        if request.gender:
            user_prompt += f"性别：{request.gender}\n"
        
        if request.profession:
            user_prompt += f"职业：{request.profession}\n"
        
        if request.personality_traits:
            traits_str = ", ".join(request.personality_traits)
            user_prompt += f"性格特点：{traits_str}\n"
        
        if request.script_context:
            user_prompt += f"剧本背景：{request.script_context}\n"
        
        user_prompt += """\n请生成一个适合用于AI图片生成的英文提示词，要求：
1. 重点描述角色的外貌特征
2. 体现角色的性格和职业特点
3. 包含适当的艺术风格描述
4. 考虑光线、构图等视觉元素
5. 适合剧本杀游戏的氛围
6. 只返回英文提示词，不要其他解释"""
        
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
                "character_name": request.character_name
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"生成失败: {str(e)}")