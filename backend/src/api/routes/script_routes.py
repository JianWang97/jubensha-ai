"""使用统一数据模型的剧本API路由

这个文件展示了如何在API层使用新的统一数据模型：
1. 统一的请求/响应格式
2. 自动数据验证
3. 标准化的错误处理
4. 一致的API响应结构
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from sqlalchemy.orm import Session
import logging
import json
from pydantic import BaseModel
from ...db.repositories import ScriptRepository
from ...schemas.script import (
    Script, ScriptInfo, ScriptCharacter, ScriptEvidence, 
    ScriptLocation
)
from ...schemas.script_info import ScriptStatus
from ...schemas.script_evidence import EvidenceType
from ...schemas.script_requests import GenerateScriptInfoRequest, CreateScriptRequest
from pydantic import BaseModel

# 新增请求模型
class GenerateScriptContentRequest(BaseModel):
    """生成剧本内容请求"""
    script_id: int
    theme: str
    background_story: str
    player_count: int
    script_type: Optional[str] = None
from ...schemas.base import APIResponse, PaginatedResponse
from ...db.session import get_db_session
from src.core.auth_dependencies import get_current_user, get_current_active_user
from src.db.models.user import User
from ...services.llm_service import llm_service, LLMMessage

router = APIRouter(prefix="/api/scripts", tags=["scripts"])


# 请求模型


def get_script_repository(db: Session = Depends(get_db_session)) -> ScriptRepository:
    """获取剧本仓库实例"""
    return ScriptRepository(db)


@router.post("/generate-info", response_model=APIResponse[dict])
async def generate_script_info(
    request: GenerateScriptInfoRequest,
    current_user: User = Depends(get_current_active_user)
) -> APIResponse[dict]:
    """根据主题生成剧本基础信息"""
    try:
        # 构建LLM提示
        system_prompt = """你是一个专业的剧本杀游戏设计师，擅长根据主题创作引人入胜的剧本。
请根据用户提供的主题，生成剧本的基础信息。

要求：
1. 生成的内容要有创意和吸引力
2. 符合剧本杀游戏的特点
3. 内容要完整且逻辑合理
4. 返回JSON格式，包含以下字段：
   - title: 剧本标题
   - description: 剧本简介（100-200字）
   - background: 背景故事（200-300字）
   - suggested_type: 建议的剧本类型
   - suggested_player_count: 建议的玩家人数"""
        
        user_prompt = f"""主题：{request.theme}"""
        
        if request.script_type:
            user_prompt += f"\n剧本类型偏好：{request.script_type}"
        
        if request.player_count:
            user_prompt += f"\n玩家人数：{request.player_count}"
        
        user_prompt += "\n\n请生成剧本基础信息，以JSON格式返回。"
        
        # 调用LLM服务
        messages = [
            LLMMessage(role="system", content=system_prompt),
            LLMMessage(role="user", content=user_prompt)
        ]
        
        response = await llm_service.chat_completion(messages, max_tokens=800, temperature=0.8)
        
        if not response.content:
            raise HTTPException(status_code=500, detail="LLM服务返回空内容")
        
        # 尝试解析JSON响应
        import json
        try:
            generated_info = json.loads(response.content.strip())
        except json.JSONDecodeError:
            # 如果不是有效JSON，返回原始内容
            generated_info = {
                "title": "AI生成的剧本",
                "description": response.content.strip(),
                "background": "",
                "suggested_type": request.script_type or "mystery",
                "suggested_player_count": request.player_count or "6"
            }
        
        return APIResponse(
            success=True,
            message="剧本基础信息生成成功",
            data=generated_info
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"生成剧本信息失败: {str(e)}")


@router.post("/generate-content", response_model=APIResponse[dict])
async def generate_script_content(
    request: GenerateScriptContentRequest,
    current_user: User = Depends(get_current_active_user),
    repo: ScriptRepository = Depends(get_script_repository)
) -> APIResponse[dict]:
    """根据剧本背景自动生成角色和证据"""
    try:
        # 验证剧本是否存在且属于当前用户
        script = repo.get_script_by_id(request.script_id)
        if not script:
            raise HTTPException(status_code=404, detail="剧本不存在")
        
        if script.info.author != str(current_user.username):
            raise HTTPException(status_code=403, detail="无权限操作此剧本")
        
        # 生成角色
        characters = await _generate_characters(
            request.theme, 
            request.background_story, 
            request.player_count,
            request.script_type
        )
        
        # 生成证据
        evidence = await _generate_evidence(
            request.theme,
            request.background_story,
            characters,
            request.script_type
        )
        
        # 保存生成的角色和证据到数据库
        created_characters = []
        created_evidence = []
        
        # 创建角色
        for char_data in characters:
            character = ScriptCharacter(
                script_id=request.script_id,
                name=char_data["name"],
                background=char_data["background"],
                gender=char_data["gender"],
                age=char_data["age"],
                profession=char_data["profession"],
                secret=char_data["secret"],
                objective=char_data["objective"],
                personality_traits=char_data["personality_traits"],
                is_murderer=char_data["is_murderer"],
                is_victim=char_data["is_victim"]
            )
            
            # 使用角色仓库创建角色
            from ...db.repositories.character_repository import CharacterRepository
            char_repo = CharacterRepository(repo.db)
            created_char = char_repo.create_character(character)
            created_characters.append(created_char)
        
        # 创建证据
        for ev_data in evidence:
            evidence_item = ScriptEvidence(
                script_id=request.script_id,
                name=ev_data["name"],
                description=ev_data["description"],
                evidence_type=EvidenceType(ev_data["evidence_type"]),
                location=ev_data["location"],
                related_character=ev_data["related_character"],
                is_key_evidence=ev_data["is_key_evidence"],
                discovery_condition=ev_data["discovery_condition"]
            )
            
            # 使用证据仓库创建证据
            from ...db.repositories.evidence_repository import EvidenceRepository
            ev_repo = EvidenceRepository(repo.db)
            created_ev = ev_repo.create_evidence(evidence_item)
            created_evidence.append(created_ev)
        
        return APIResponse(
            success=True,
            message=f"成功生成{len(created_characters)}个角色和{len(created_evidence)}个证据",
            data={
                "characters": [char.to_dict() for char in created_characters],
                "evidence": [ev.to_dict() for ev in created_evidence]
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"生成剧本内容失败: {str(e)}")


async def _generate_characters(theme: str, background_story: str, player_count: int, script_type: Optional[str] = None) -> List[dict]:
    """使用AI生成角色，包含schema校验和重试机制"""
    
    # 定义角色数据的JSON Schema
    character_schema = {
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "minLength": 1, "maxLength": 50},
                "background": {"type": "string", "minLength": 50, "maxLength": 500},
                "gender": {"type": "string", "enum": ["男", "女", "中性"]},
                "age": {"type": "integer", "minimum": 18, "maximum": 80},
                "profession": {"type": "string", "minLength": 1, "maxLength": 50},
                "secret": {"type": "string", "minLength": 20, "maxLength": 300},
                "objective": {"type": "string", "minLength": 10, "maxLength": 200},
                "personality_traits": {
                    "type": "array",
                    "items": {"type": "string"},
                    "minItems": 3,
                    "maxItems": 5
                },
                "is_murderer": {"type": "boolean"},
                "is_victim": {"type": "boolean"}
            },
            "required": ["name", "background", "gender", "age", "profession", "secret", "objective", "personality_traits", "is_murderer", "is_victim"]
        },
        "minItems": player_count,
        "maxItems": player_count
    }
    
    system_prompt = f"""你是一个专业的剧本杀游戏设计师，擅长创造有深度和逻辑性的角色。

请根据剧本背景生成{player_count}个角色，严格遵循以下要求：

【角色设计原则】
1. 每个角色都必须有独特的背景故事和明确的动机
2. 角色之间要有合理的关系网络和利益冲突
3. 必须有且仅有一个凶手和一个受害者
4. 角色的秘密和目标要与剧本主题紧密相关
5. 性格特征要鲜明、多样化且符合角色设定
6. 年龄分布要合理，职业要多样化

【字段要求】
- name: 角色姓名（2-10个字符，要有特色）
- background: 角色背景（150-300字，详细描述角色的过往经历、社会关系、重要事件）
- gender: 性别（必须是：男、女、中性 之一）
- age: 年龄（18-80岁之间的整数）
- profession: 职业（具体明确的职业名称）
- secret: 角色秘密（100-200字，与剧本主题相关的重要秘密）
- objective: 角色目标（50-150字，角色在剧本中想要达成的目标）
- personality_traits: 性格特征（3-5个特征词，如：冷静、狡猾、善良、冲动等）
- is_murderer: 是否为凶手（true/false，只能有一个角色为true）
- is_victim: 是否为受害者（true/false，只能有一个角色为true）

【重要提醒】
- 必须返回标准JSON数组格式
- 确保所有字段都有实际内容，不能为空
- 性别字段只能使用中文：男、女、中性
- 角色之间要有逻辑关联，不能是孤立的个体
- 凶手和受害者的设定要符合剧本逻辑

请严格按照以上要求生成角色数据。"""
    
    user_prompt = f"""【剧本信息】
主题：{theme}
背景故事：{background_story}
玩家人数：{player_count}人"""
    
    if script_type:
        user_prompt += f"\n剧本类型：{script_type}"
    
    user_prompt += f"\n\n请为这个剧本生成{player_count}个高质量的角色，确保每个角色都有丰富的背景和明确的动机。必须以JSON数组格式返回，不要包含任何其他文字说明。"
    
    # 重试机制
    max_retries = 3
    last_error = None
    
    for attempt in range(max_retries):
        try:
            logging.info(f"[AI_CHARACTER_GENERATION] 第{attempt + 1}次尝试生成角色")
            
            messages = [
                LLMMessage(role="system", content=system_prompt),
                LLMMessage(role="user", content=user_prompt)
            ]
            
            response = await llm_service.chat_completion(
                messages, 
                max_tokens=3000, 
                temperature=0.6  # 降低温度以提高一致性
            )
            
            if not response.content:
                raise ValueError("AI服务返回空内容")
            
            # 清理响应内容，移除可能的markdown格式
            content = response.content.strip()
            if content.startswith("```json"):
                content = content[7:]
            if content.endswith("```"):
                content = content[:-3]
            content = content.strip()
            
            # 解析JSON
            characters = json.loads(content)
            
            # 基本格式验证
            if not isinstance(characters, list):
                raise ValueError("返回的不是数组格式")
            
            if len(characters) != player_count:
                raise ValueError(f"角色数量不匹配，期望{player_count}个，实际{len(characters)}个")
            
            # 手动Schema验证（避免依赖jsonschema库）
            def validate_character_schema(characters_data):
                """手动验证角色数据格式"""
                required_fields = ["name", "background", "gender", "age", "profession", "secret", "objective", "personality_traits", "is_murderer", "is_victim"]
                valid_genders = ["男", "女", "中性"]
                
                for i, char in enumerate(characters_data):
                    # 检查必填字段
                    for field in required_fields:
                        if field not in char:
                            raise ValueError(f"第{i+1}个角色缺少必填字段: {field}")
                    
                    # 验证字段类型和值
                    if not isinstance(char["name"], str) or len(char["name"]) < 1 or len(char["name"]) > 50:
                        raise ValueError(f"第{i+1}个角色的姓名格式错误")
                    
                    if not isinstance(char["background"], str) or len(char["background"]) < 50 or len(char["background"]) > 500:
                        raise ValueError(f"第{i+1}个角色的背景描述长度不符合要求（50-500字符）")
                    
                    if char["gender"] not in valid_genders:
                        raise ValueError(f"第{i+1}个角色的性别必须是：男、女、中性 之一")
                    
                    if not isinstance(char["age"], int) or char["age"] < 18 or char["age"] > 80:
                        raise ValueError(f"第{i+1}个角色的年龄必须是18-80之间的整数")
                    
                    if not isinstance(char["profession"], str) or len(char["profession"]) < 1 or len(char["profession"]) > 50:
                        raise ValueError(f"第{i+1}个角色的职业格式错误")
                    
                    if not isinstance(char["secret"], str) or len(char["secret"]) < 20 or len(char["secret"]) > 300:
                        raise ValueError(f"第{i+1}个角色的秘密描述长度不符合要求（20-300字符）")
                    
                    if not isinstance(char["objective"], str) or len(char["objective"]) < 10 or len(char["objective"]) > 200:
                        raise ValueError(f"第{i+1}个角色的目标描述长度不符合要求（10-200字符）")
                    
                    if not isinstance(char["personality_traits"], list) or len(char["personality_traits"]) < 3 or len(char["personality_traits"]) > 5:
                        raise ValueError(f"第{i+1}个角色的性格特征必须是3-5个字符串的数组")
                    
                    if not isinstance(char["is_murderer"], bool):
                        raise ValueError(f"第{i+1}个角色的is_murderer字段必须是布尔值")
                    
                    if not isinstance(char["is_victim"], bool):
                        raise ValueError(f"第{i+1}个角色的is_victim字段必须是布尔值")
            
            validate_character_schema(characters)
            
            # 业务逻辑验证
            murderer_count = sum(1 for char in characters if char.get('is_murderer', False))
            victim_count = sum(1 for char in characters if char.get('is_victim', False))
            
            if murderer_count != 1:
                raise ValueError(f"凶手数量错误，应该有1个，实际有{murderer_count}个")
            
            if victim_count != 1:
                raise ValueError(f"受害者数量错误，应该有1个，实际有{victim_count}个")
            
            # 检查必填字段是否为空
            for i, char in enumerate(characters):
                for field in ['name', 'background', 'gender', 'profession', 'secret', 'objective']:
                    if not char.get(field) or (isinstance(char.get(field), str) and not char.get(field).strip()):
                        raise ValueError(f"第{i+1}个角色的{field}字段为空")
                
                if not char.get('personality_traits') or len(char.get('personality_traits', [])) < 3:
                    raise ValueError(f"第{i+1}个角色的性格特征不足3个")
            
            logging.info(f"[AI_CHARACTER_GENERATION] 成功生成{len(characters)}个角色")
            return characters
            
        except (json.JSONDecodeError, ValueError, Exception) as e:
            last_error = e
            logging.warning(f"[AI_CHARACTER_GENERATION] 第{attempt + 1}次尝试失败: {str(e)}")
            
            if attempt < max_retries - 1:
                # 在重试前调整提示词，强调之前失败的原因
                if "JSON" in str(e) or "格式" in str(e):
                    user_prompt += "\n\n注意：请确保返回的是标准JSON格式，不要包含任何markdown标记或额外文字。"
                elif "数量" in str(e):
                    user_prompt += f"\n\n注意：必须生成恰好{player_count}个角色，不多不少。"
                elif "凶手" in str(e) or "受害者" in str(e):
                    user_prompt += "\n\n注意：必须有且仅有一个凶手和一个受害者。"
                elif "为空" in str(e):
                    user_prompt += "\n\n注意：所有字段都必须填写实际内容，不能为空或只有空格。"
    
    # 所有重试都失败了
    raise ValueError(f"AI生成角色失败，已重试{max_retries}次。最后错误: {str(last_error)}")


async def _generate_evidence(theme: str, background_story: str, characters: List[dict], script_type: Optional[str] = None) -> List[dict]:
    """使用AI生成证据"""
    system_prompt = """你是一个专业的剧本杀游戏设计师，擅长设计逻辑严密的证据线索。
请根据剧本背景和角色信息生成证据，确保：
1. 证据要与角色和背景故事紧密相关
2. 包含关键证据和普通证据
3. 证据之间要有逻辑关联
4. 每个证据都有明确的发现条件
5. 证据类型要多样化

返回JSON数组格式，每个证据包含以下字段：
- name: 证据名称
- description: 证据描述（100-150字）
- evidence_type: 证据类型（physical/document/digital/testimony/photo）
- location: 发现地点
- related_character: 相关角色（可为空）
- is_key_evidence: 是否为关键证据（boolean）
- discovery_condition: 发现条件（50-100字）"""
    
    # 构建角色信息摘要
    character_summary = "\n".join([
        f"- {char['name']}（{char['profession']}）：{char['background'][:50]}..."
        for char in characters
    ])
    
    user_prompt = f"""剧本主题：{theme}
背景故事：{background_story}

角色信息：
{character_summary}"""
    
    if script_type:
        user_prompt += f"\n剧本类型：{script_type}"
    
    evidence_count = max(len(characters) + 2, 6)  # 至少6个证据
    user_prompt += f"\n\n请为这个剧本生成{evidence_count}个证据，确保证据与角色和背景故事逻辑一致。以JSON数组格式返回。"
    
    messages = [
        LLMMessage(role="system", content=system_prompt),
        LLMMessage(role="user", content=user_prompt)
    ]
    
    response = await llm_service.chat_completion(messages, max_tokens=2000, temperature=0.7)
    
    if not response.content:
        raise ValueError("AI生成证据失败：返回空内容")
    
    try:
        evidence = json.loads(response.content.strip())
        if not isinstance(evidence, list):
            raise ValueError("AI返回的不是数组格式")
        return evidence
    except json.JSONDecodeError as e:
        raise ValueError(f"AI返回的JSON格式错误: {e}")


@router.post("/", response_model=APIResponse[ScriptInfo])
async def create_script(
    request: CreateScriptRequest,
    current_user: User = Depends(get_current_active_user),
    repo: ScriptRepository = Depends(get_script_repository)
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
    repo: ScriptRepository = Depends(get_script_repository)
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
    repo: ScriptRepository = Depends(get_script_repository)
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
    repo: ScriptRepository = Depends(get_script_repository)
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
    repo: ScriptRepository = Depends(get_script_repository)
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
    repo: ScriptRepository = Depends(get_script_repository)
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
    repo: ScriptRepository = Depends(get_script_repository)
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
    repo: ScriptRepository = Depends(get_script_repository)
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
    repo: ScriptRepository = Depends(get_script_repository)
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
    repo: ScriptRepository = Depends(get_script_repository)
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
    repo: ScriptRepository = Depends(get_script_repository)
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