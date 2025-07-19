"""角色管理API路由"""
from fastapi import APIRouter, HTTPException, Query, Depends
from typing import List, Optional, Type
from sqlalchemy.orm import Session
from ...db.repositories import CharacterRepository
from ...schemas.script import ScriptCharacter
from ...schemas.base import APIResponse, PaginatedResponse
from ...db.models.character import CharacterDBModel
from ...schemas.base import BaseDataModel
from ...services.llm_service import llm_service, LLMMessage
from ...db.session import get_db_session
from pydantic import BaseModel, Field
import logging
from datetime import datetime
router = APIRouter(prefix="/api/characters", tags=["角色管理"])
logger = logging.getLogger(__name__)
def get_character_repository(db: Session = Depends(get_db_session)) -> CharacterRepository:
    return CharacterRepository(db)

class CharacterCreateRequest(BaseDataModel):
    """角色创建请求模型"""
    name: str = Field(..., description="角色名称")
    background: Optional[str] = Field(None, description="角色背景")
    gender: str = Field(..., description="性别")
    age: int = Field(..., description="年龄")
    profession: Optional[str] = Field(None, description="职业")
    secret: Optional[str] = Field(None, description="秘密")
    objective: Optional[str] = Field(None, description="目标")
    is_victim: Optional[bool] = Field(False, description="是否为受害者")
    is_murderer: Optional[bool] = Field(False, description="是否为凶手")
    personality_traits: Optional[List[str]] = Field(default=[], description="性格特征")
    avatar_url: Optional[str] = Field(None, description="头像URL")
    voice_id: Optional[str] = Field(None, description="语音ID")
    voice_preference: Optional[str] = Field(None, description="语音偏好")

    @classmethod
    def get_db_model(cls) -> Type:
        """此模型不对应数据库表，返回None"""
        return type(None)

class CharacterUpdateRequest(BaseDataModel):
    """角色更新请求模型"""
    name: Optional[str] = Field(None, description="角色名称")
    background: Optional[str] = Field(None, description="角色背景")
    profession: Optional[str] = Field(None, description="职业")
    personality_traits: Optional[List[str]] = Field(None, description="性格特征")
    avatar_url: Optional[str] = Field(None, description="头像URL")
    voice_id: Optional[str] = Field(None, description="语音ID")
    age: Optional[int] = Field(None, description="年龄")
    gender: Optional[str] = Field(None, description="性别")
    secret: Optional[str] = Field(None, description="秘密")
    objective: Optional[str] = Field(None, description="目标")
    is_victim: Optional[bool] = Field(None, description="是否为受害者")
    is_murderer: Optional[bool] = Field(None, description="是否为凶手")
    
    @classmethod
    def get_db_model(cls) -> Type:
        """此模型不对应数据库表，返回None"""
        return type(None)

class CharacterPromptRequest(BaseDataModel):
    """角色头像提示词生成请求模型"""
    character_name: str = Field(..., description="角色名称")
    character_description: str = Field(..., description="角色描述")
    age: Optional[int] = Field(None, description="年龄")
    gender: Optional[str] = Field(None, description="性别")
    profession: Optional[str] = Field(None, description="职业")
    personality_traits: Optional[List[str]] = Field(None, description="性格特征")
    script_context: Optional[str] = Field(None, description="剧本背景")
    
    @classmethod
    def get_db_model(cls) -> Type:
        """此模型不对应数据库表，返回None"""
        return type(None)

@router.post("/{script_id}/characters", summary="创建角色")
async def create_character(script_id: int, request: CharacterCreateRequest, character_repository: CharacterRepository = Depends(get_character_repository)) -> APIResponse[ScriptCharacter]:
    """为指定剧本创建新角色"""
    try:
        # 创建角色数据
        character_data = ScriptCharacter(
            script_id=script_id,
            name=request.name,
            background=request.background or "",
            gender=request.gender,
            age=request.age,
            profession=request.profession or "",
            secret=request.secret or "",
            objective=request.objective or "",
            is_victim=request.is_victim or False,
            is_murderer=request.is_murderer or False,
            personality_traits=request.personality_traits or [],
            id=None,  # 新建角色时ID为None
            avatar_url=request.avatar_url,
            voice_id=request.voice_id,
            voice_preference= '',
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )
        
        # 创建角色
        created_character = character_repository.add_character(character_data)
        
        return APIResponse(
            success=True,
            message="角色创建成功",
            data=created_character,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"创建失败: {str(e)}")

@router.put("/{script_id}/characters/{character_id}", summary="更新角色")
async def update_character(script_id: int, character_id: int, request: CharacterUpdateRequest, character_repository: CharacterRepository = Depends(get_character_repository)) -> APIResponse[ScriptCharacter]:
    """更新指定角色的信息"""
    try:

        # 检查角色是否存在
        character = character_repository.get_character_by_id(character_id)
        if not character or character.script_id != script_id:
            raise HTTPException(status_code=404, detail="角色不存在")
        
        # 准备更新数据
        update_data = request.model_dump(exclude_unset=True)
        if not update_data:
            raise HTTPException(status_code=400, detail="没有提供更新数据")
        
        # 创建更新后的角色对象
        for field, value in update_data.items():
            if hasattr(character, field):
                setattr(character, field, value)
        
        # 更新角色
        updated_character = character_repository.update_character(character_id, character)
        if not updated_character:
            raise HTTPException(status_code=500, detail="更新角色失败")
        
        return APIResponse(
            success=True,
            message="角色更新成功",
            data=updated_character
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"更新失败: {str(e)}")

@router.delete("/{script_id}/characters/{character_id}", summary="删除角色")
async def delete_character(script_id: int, character_id: int, character_repository: CharacterRepository = Depends(get_character_repository)) -> APIResponse[dict]:
    """删除指定角色"""
    try:

        # 检查角色是否存在
        character = character_repository.get_character_by_id(character_id)
        if not character or character.script_id != script_id:
            raise HTTPException(status_code=404, detail="角色不存在")
        
        # 删除角色
        success = character_repository.delete_character(character_id)
        if not success:
            raise HTTPException(status_code=500, detail="删除角色失败")
        
        return APIResponse(
            success=True,
            message="角色删除成功",
            data={"character_id": character_id}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"删除失败: {str(e)}")

@router.get("/{script_id}/characters", summary="获取角色列表")
async def get_characters(
    script_id: int,
    skip: int = Query(0, ge=0, description="跳过的记录数"),
    limit: int = Query(10, ge=1, le=100, description="返回的记录数"),
    character_repository_orm: CharacterRepository = Depends(get_character_repository)
) -> APIResponse[List[ScriptCharacter]]:
    """获取指定剧本的角色列表"""
    try:
        # 获取角色列表
        all_characters = character_repository_orm.get_characters_by_script(script_id)
        
        # 手动实现分页
        total_count = len(all_characters)
        characters = all_characters[skip:skip + limit]
        
        return APIResponse(
            success=True,
            message="获取角色列表成功",
            data=characters
        )
    except HTTPException:
        logger.error(f"获取角色列表失败，剧本ID: {script_id}")
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取失败: {str(e)}")

@router.get("/{script_id}/characters/{character_id}", summary="获取角色详情")
async def get_character(script_id: int, character_id: int, character_repository_orm: CharacterRepository = Depends(get_character_repository)) -> APIResponse[ScriptCharacter]:
    """获取指定角色的详细信息"""
    try:

        # 获取角色详情
        character = character_repository_orm.get_character_by_id(character_id)
        if not character or character.script_id != script_id:
            raise HTTPException(status_code=404, detail="角色不存在")

        return APIResponse(
            success=True,
            message="获取角色详情成功",
            data=character
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取失败: {str(e)}")

@router.post("/characters/generate-prompt", summary="生成角色头像提示词")
async def generate_character_prompt(request: CharacterPromptRequest) -> APIResponse[dict]:
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
        messages = [
            LLMMessage(role="system", content=system_prompt),
            LLMMessage(role="user", content=user_prompt)
        ]
        
        response = await llm_service.chat_completion(messages, max_tokens=200)
        
        if not response.content:
            raise HTTPException(status_code=500, detail="LLM服务返回空内容")
        
        return APIResponse(
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