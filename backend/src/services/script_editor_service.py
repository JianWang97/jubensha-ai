"""剧本对话式编辑服务

提供AI指令解析、剧本编辑操作处理等功能
"""

import json
import re
import logging
from typing import Dict, Any, List, Optional, Union
from pydantic import BaseModel

from ..services.llm_service import llm_service, LLMMessage
from ..schemas.script import Script, ScriptCharacter, ScriptEvidence, ScriptLocation
from ..schemas.script_evidence import EvidenceType

logger = logging.getLogger(__name__)


class InstructionCategory(BaseModel):
    """指令分类结果"""
    category: str
    confidence: float
    reasoning: str


class EditInstruction(BaseModel):
    """编辑指令"""
    action: str
    target: str
    content: Dict[str, Any]
    description: str


class EditResult(BaseModel):
    """编辑结果"""
    success: bool
    message: str
    data: Optional[Dict[str, Any]] = None
    updated_script: Optional[Script] = None


class ScriptEditorService:
    """剧本编辑服务"""
    
    def __init__(self, script_repository):
        self.script_repository = script_repository

    async def categorize_instruction(self, instruction: str, script_id: int) -> InstructionCategory:
        """对用户指令进行分类"""
        # 获取当前剧本信息用于上下文
        current_script = self.script_repository.get_script_by_id(script_id)
        if not current_script:
            raise ValueError(f"剧本 {script_id} 不存在")
        
        # 构建AI提示
        system_prompt = """你是一个专业的指令分类助手，能够理解用户的自然语言指令并识别出操作类型和目标对象。

请分析用户的指令，识别出：
1. 操作类型：add(添加)、update(更新)、delete(删除)、modify(修改)中的一个
2. 目标对象：character(角色)、evidence(证据)、location(场景)、story(背景故事)、info(剧本信息)中的一个

只返回JSON格式的结果，包含：
{
  "category": "目标对象",
  "confidence": "置信度（0-1之间的数字）",
  "reasoning": "简短的分类理由"
}

示例：
用户说"添加一个比较善良的角色"，你应该返回：
{
  "category": "character",
  "confidence": 0.95,
  "reasoning": "用户想要添加角色"
}

用户说"删除血迹证据"，你应该返回：
{
  "category": "evidence",
  "confidence": 0.9,
  "reasoning": "用户想要删除证据"
}"""
        
        user_prompt = f"""用户指令：{instruction}

请分析用户指令并返回分类结果。"""
        
        messages = [
            LLMMessage(role="system", content=system_prompt),
            LLMMessage(role="user", content=user_prompt)
        ]
        
        try:
            response = await llm_service.chat_completion(messages, max_tokens=300, temperature=0.1)
            
            if not response.content:
                raise ValueError("AI服务返回空内容")
            
            # 尝试解析JSON响应
            category_data = json.loads(response.content.strip())
            return InstructionCategory(**category_data)
            
        except json.JSONDecodeError as e:
            logger.warning(f"[INSTRUCTION_CATEGORIZE] JSON解析失败: {e}")
            # 返回默认分类
            return InstructionCategory(
                category="other",
                confidence=0.5,
                reasoning="无法解析分类结果，使用默认分类"
            )
        except Exception as e:
            logger.error(f"[INSTRUCTION_CATEGORIZE] 分类失败: {e}")
            # 返回默认分类
            return InstructionCategory(
                category="other",
                confidence=0.5,
                reasoning="分类过程出错，使用默认分类"
            )

    async def parse_user_instruction(self, instruction: str, script_id: int) -> List[EditInstruction]:
        """解析用户的自然语言指令为具体的编辑操作"""
        # 重试机制
        max_retries = 3
        last_error = None
        base_temperature = 0.3
        
        # 首先对指令进行分类
        logger.info(f"[INSTRUCTION_PARSE] 开始对指令进行分类: {instruction}")
        category_result = await self.categorize_instruction(instruction, script_id)
        logger.info(f"[INSTRUCTION_PARSE] 指令分类结果: {category_result.category}, 置信度: {category_result.confidence}")
        
        for attempt in range(max_retries):
            try:
                # 获取当前剧本信息用于上下文
                current_script = self.script_repository.get_script_by_id(script_id)
                if not current_script:
                    raise ValueError(f"剧本 {script_id} 不存在")
                
                # 根据分类结果选择不同的系统提示
                system_prompt = self._get_category_specific_prompt(category_result.category)
                
                # 构建当前剧本上下文，只包含与当前操作相关的上下文信息
                script_context = self._get_category_specific_context(category_result.category, current_script)
                
                user_prompt = f"""剧本上下文：
{script_context}

用户指令：{instruction}

请分析用户指令并返回对应的编辑操作JSON数组。"""
                
                messages = [
                    LLMMessage(role="system", content=system_prompt),
                    LLMMessage(role="user", content=user_prompt)
                ]
                
                # 每次重试时增加temperature值
                current_temperature = base_temperature + (attempt * 0.1)
                
                response = await llm_service.chat_completion(
                    messages, 
                    max_tokens=1000, 
                    temperature=current_temperature  # 每次重试时temperature增加0.1
                )
                
                if not response.content:
                    raise ValueError("AI服务返回空内容")
                
                # 记录AI返回的原始内容
                logger.info(f"[INSTRUCTION_PARSE] AI返回原始内容: {response.content[:500]}...")
                
                # 尝试解析JSON响应
                instructions_data = json.loads(response.content.strip())
                logger.info(f"[INSTRUCTION_PARSE] JSON解析结果: {instructions_data}")
                
                # 验证并转换为EditInstruction对象
                instructions: List[EditInstruction] = []
                if isinstance(instructions_data, list):
                    for item in instructions_data:
                        if isinstance(item, dict):
                            instructions.append(EditInstruction(**item))
                else:
                    if isinstance(instructions_data, dict):
                        instructions.append(EditInstruction(**instructions_data))
                
                return instructions
                
            except (json.JSONDecodeError, ValueError, Exception) as e:
                last_error = e
                logger.warning(f"[INSTRUCTION_PARSE] 第{attempt + 1}次尝试解析用户指令失败: {str(e)}")
                
                if attempt < max_retries - 1:
                    # 在重试前调整提示词，强调之前失败的原因
                    if "JSON" in str(e) or "格式" in str(e):
                        user_prompt += "\n\n注意：请确保返回的是标准JSON格式，不要包含任何代码标记或额外文字。"
        
        # 所有重试都失败了，使用备用解析方法
        logger.error(f"[INSTRUCTION_PARSE] 解析用户指令失败，已重试{max_retries}次。最后错误: {str(last_error)}")
        logger.info("[INSTRUCTION_PARSE] 尝试使用备用解析方法")
        try:
            fallback_instructions = self._fallback_parse_instruction(instruction)
            logger.info(f"[INSTRUCTION_PARSE] 备用解析方法成功，生成 {len(fallback_instructions)} 个指令")
            return fallback_instructions
        except Exception as fallback_error:
            logger.error(f"[INSTRUCTION_PARSE] 备用解析方法也失败了: {str(fallback_error)}")
            raise ValueError(f"解析用户指令失败，已重试{max_retries}次。最后错误: {str(last_error)}")
    
    def _get_category_specific_context(self, category: str, script) -> str:
        """根据分类获取特定的上下文信息"""
        if category == "character":
            return f"""当前剧本信息：
标题：{script.info.title}
描述：{script.info.description}

现有角色：
{self._format_characters(script.characters)}"""
        
        elif category == "evidence":
            return f"""当前剧本信息：
标题：{script.info.title}
描述：{script.info.description}

现有证据：
{self._format_evidence(script.evidence)}"""
        
        elif category == "location":
            return f"""当前剧本信息：
标题：{script.info.title}
描述：{script.info.description}

现有场景：
{self._format_locations(script.locations)}"""
        
        elif category == "story":
            # 对于故事相关操作，提供完整上下文
            return f"""当前剧本信息：
标题：{script.info.title}
描述：{script.info.description}

现有角色：
{self._format_characters(script.characters)}

现有证据：
{self._format_evidence(script.evidence)}

现有场景：
{self._format_locations(script.locations)}"""
        
        elif category == "info":
            # 对于剧本信息操作，提供基本信息
            return f"""当前剧本信息：
标题：{script.info.title}
描述：{script.info.description}
分类：{script.info.category}
难度：{script.info.difficulty}
标签：{', '.join(script.info.tags) if script.info.tags else '无'}"""
        
        else:
            # 默认提供完整上下文
            return f"""当前剧本信息：
标题：{script.info.title}
描述：{script.info.description}

现有角色：
{self._format_characters(script.characters)}

现有证据：
{self._format_evidence(script.evidence)}

现有场景：
{self._format_locations(script.locations)}"""
    
    def _get_category_specific_prompt(self, category: str) -> str:
        """根据分类获取特定的系统提示"""
        prompts = {
            "character": """你是一个专业的剧本角色编辑助手，专门处理与角色相关的操作。

支持的操作类型：
- add: 添加新角色
- update: 更新现有角色
- delete: 删除角色
- modify: 修改角色

请返回JSON格式的编辑指令数组，每个指令包含：
{
  "action": "操作类型",
  "target": "character",
  "content": {具体的编辑内容，必须包含角色的完整信息},
  "description": "操作描述"
}

【重要】对于角色添加或更新指令，content字段必须包含以下完整信息：
- name: 角色姓名（必填，不能为空）
- profession: 职业（必填，如：侦探、医生、律师等，不能为空）
- background: 角色背景（必填，详细描述角色的过往经历，至少100字，不能为空）
- secret: 角色秘密（必填，与剧本相关的重要秘密，至少50字，不能为空）
- objective: 角色目标（必填，角色在剧本中的目标，至少30字，不能为空）
- gender: 性别（必填，只能是：男、女、中性，不能为空）
- age: 年龄（可选，18-80之间的整数）
- personality_traits: 性格特征（必填，3-5个特征词的数组，不能为空）
- is_murderer: 是否为凶手（必填，布尔值）
- is_victim: 是否为受害者（必填，布尔值）
- avatar_url: 头像URL（可选）
- voice_preference: 语音偏好（可选）
- voice_id: TTS声音ID（可选）

【特别注意】
1. 所有必填字段都不能是空字符串或空数组
2. background字段至少需要100个字符的详细描述
3. secret字段至少需要50个字符的描述
4. objective字段至少需要30个字符的描述
5. personality_traits数组至少需要3个性格特征
6. gender字段只能是"男"、"女"、"中性"中的一个

示例（正确格式）：
{
  "action": "add",
  "target": "character",
  "content": {
    "name": "张三",
    "profession": "私家侦探",
    "background": "张三是一名经验丰富的私家侦探，曾在警局工作十年，因为不满官僚作风而辞职自立门户。他擅长观察细节，逻辑推理能力强，但有时过于固执己见。在这个案件中，他被雇佣来调查一起神秘失踪案。",
    "secret": "张三其实是失踪者的前同事，他们曾经因为一起案件产生过激烈冲突，张三一直对此耿耿于怀。",
    "objective": "找出真相，证明自己当年的判断是正确的，同时为委托人解决案件。",
    "gender": "男",
    "age": 45,
    "personality_traits": ["细心", "固执", "正义感强", "经验丰富"],
    "is_murderer": false,
    "is_victim": false
  },
  "description": "添加角色：张三（私家侦探）"
}""",
            
            "evidence": """你是一个专业的剧本证据编辑助手，专门处理与证据相关的操作。

支持的操作类型：
- add: 添加新证据
- update: 更新现有证据
- delete: 删除证据
- modify: 修改证据

请返回JSON格式的编辑指令数组，每个指令包含：
{
  "action": "操作类型",
  "target": "evidence",
  "content": {具体的编辑内容，必须包含证据的完整信息},
  "description": "操作描述"
}

【重要】对于证据添加或更新指令，content字段必须包含以下完整信息：
- name: 证据名称（必填，不能为空）
- description: 证据描述（必填，详细描述证据的具体内容和重要性，至少100字，不能为空）
- location: 发现地点（必填，具体描述证据的位置，不能为空）
- related_to: 相关角色（可选）
- significance: 证据意义（必填，说明该证据对案件的重要性，至少50字，不能为空）
- evidence_type: 证据类型（必填，可选值：PHYSICAL-物证, DOCUMENT-文件, VIDEO-视频, AUDIO-音频, IMAGE-图片）
- importance: 重要程度（必填，可选值：关键证据、重要证据、普通证据）
- is_hidden: 是否隐藏（必填，布尔值）
- image_url: 证据图片URL（可选）""",
            
            "location": """你是一个专业的剧本场景编辑助手，专门处理与场景相关的操作。

支持的操作类型：
- add: 添加新场景
- update: 更新现有场景
- delete: 删除场景
- modify: 修改场景

请返回JSON格式的编辑指令数组，每个指令包含：
{
  "action": "操作类型",
  "target": "location",
  "content": {具体的编辑内容，必须包含场景的完整信息},
  "description": "操作描述"
}

【重要】对于场景添加或更新指令，content字段必须包含以下完整信息：
- name: 场景名称（必填，不能为空）
- description: 场景描述（必填，详细描述场景的外观、氛围和重要特征，至少100字，不能为空）
- searchable_items: 可搜索物品（必填，列出场景中的重要物品，数组格式，不能为空）
- background_image_url: 背景图片URL（可选）
- is_crime_scene: 是否为案发现场（必填，布尔值）""",
            
            "story": """你是一个专业的剧本背景故事编辑助手，专门处理与背景故事相关的操作。

支持的操作类型：
- add: 添加背景故事内容
- update: 更新背景故事内容
- delete: 删除背景故事内容
- modify: 修改背景故事内容

请返回JSON格式的编辑指令数组，每个指令包含：
{
  "action": "操作类型",
  "target": "story",
  "content": {具体的编辑内容},
  "description": "操作描述"
}

对于背景故事更新，如果用户没有明确说明只更新特定字段，应该在content中添加"generate_missing": true，这样系统会智能生成其他相关的背景故事字段。

背景故事应包含以下字段：
- title: 标题
- setting_description: 背景设定
- incident_description: 事件描述
- victim_background: 受害者背景
- investigation_scope: 调查范围
- rules_reminder: 规则提醒
- murder_method: 作案手法
- murder_location: 作案地点
- discovery_time: 发现时间
- victory_conditions: 胜利条件（可选，字典格式）""",
            
            "info": """你是一个专业的剧本基本信息编辑助手，专门处理与剧本基本信息相关的操作。

支持的操作类型：
- add: 添加基本信息
- update: 更新现有信息
- delete: 删除信息
- modify: 修改信息

请返回JSON格式的编辑指令数组，每个指令包含：
{
  "action": "操作类型",
  "target": "info",
  "content": {具体的编辑内容},
  "description": "操作描述"
}

支持修改的剧本基本信息字段包括：
- title: 剧本标题
- description: 剧本描述
- player_count: 玩家数量
- estimated_duration: 预计游戏时长（分钟）
- difficulty_level: 难度等级（可选值：easy, medium, hard）
- tags: 标签列表
- category: 剧本分类
- is_public: 是否公开
- price: 价格
- cover_image_url: 封面图片URL""",
            
            "other": """你是一个专业的剧本编辑助手，能够理解用户的自然语言指令并将其转换为具体的编辑操作。

你需要分析用户的指令，识别出要执行的操作类型和目标对象，然后返回结构化的编辑指令。

支持的操作类型：
- add: 添加新内容
- update: 更新现有内容
- delete: 删除内容
- modify: 修改内容

支持的目标类型：
- character: 角色相关
- evidence: 证据相关
- location: 场景相关
- info: 剧本基本信息（标题、类型、难度等）
- story: 背景故事（剧本的故事情节、背景描述、剧情内容）

请返回JSON格式的编辑指令数组，每个指令包含：
{
  "action": "操作类型",
  "target": "目标类型",
  "content": {具体的编辑内容},
  "description": "操作描述"
}"""
        }
        
        return prompts.get(category, prompts["other"])
    
    def _format_characters(self, characters: List[ScriptCharacter]) -> str:
        """格式化角色列表"""
        if not characters:
            return "无"
        return "\n".join([f"- {char.name}: {char.background}" for char in characters])
    
    def _format_evidence(self, evidence: List[ScriptEvidence]) -> str:
        """格式化证据列表"""
        if not evidence:
            return "无"
        return "\n".join([f"- {ev.name}: {ev.description}" for ev in evidence])
    
    def _format_locations(self, locations: List[ScriptLocation]) -> str:
        """格式化场景列表"""
        if not locations:
            return "无"
        return "\n".join([f"- {loc.name}: {loc.description}" for loc in locations])
    
    def _fallback_parse_instruction(self, instruction: str) -> List[EditInstruction]:
        """备用指令解析方法"""
        logger.info(f"[FALLBACK_PARSE] 使用备用解析方法处理指令: {instruction}")
        instruction_lower = instruction.lower()
        
        # 简单的关键词匹配
        if "添加" in instruction or "新增" in instruction or "创建" in instruction:
            if "角色" in instruction or "人物" in instruction:
                logger.info(f"[FALLBACK_PARSE] 识别为角色添加指令")
                # 为角色添加提供完整的默认数据
                return [EditInstruction(
                    action="add",
                    target="character",
                    content={
                        "name": "新角色",
                        "profession": "待定职业",
                        "background": "这是一个神秘的角色，背景有待进一步完善。他/她在剧本中扮演着的重要性，与其他角色有着复杂的关系。",
                        "secret": "这个角色隐藏着一个重要的秘密，这个秘密可能与案件的真相有关。",
                        "objective": "角色的具体目标需要根据剧本发展来确定。",
                        "gender": "中性",
                        "age": 30,
                        "personality_traits": ["神秘", "复杂", "重要"],
                        "is_murderer": False,
                        "is_victim": False
                    },
                    description="添加新角色（需要进一步完善）"
                )]
            elif "证据" in instruction or "线索" in instruction:
                return [EditInstruction(
                    action="add",
                    target="evidence",
                    content={
                        "name": "新证据",
                        "description": "这是一个重要的证据，需要进一步完善其具体内容和发现方式。",
                        "location": "待定位置",
                        "related_to": "",
                        "significance": "这个证据可能与案件真相有重要关联。",
                        "evidence_type": "PHYSICAL",
                        "importance": "重要证据",
                        "is_hidden": False,
                        "discovery_condition": "玩家需要仔细搜查才能发现这个证据。"
                    },
                    description="添加新证据（需要进一步完善）"
                )]
            elif "场景" in instruction or "地点" in instruction:
                return [EditInstruction(
                    action="add",
                    target="location",
                    content={"name": "新场景", "description": "待完善的场景描述"},
                    description="添加新场景"
                )]
        elif "删除" in instruction or "移除" in instruction:
            if "角色" in instruction or "人物" in instruction:
                # 尝试从指令中提取角色名称
                character_name = "新角色"  # 默认值
                # 简单的名称提取逻辑
                if "名字叫" in instruction:
                    parts = instruction.split("名字叫")
                    if len(parts) > 1:
                        character_name = parts[1].strip()
                elif "叫" in instruction:
                    parts = instruction.split("叫")
                    if len(parts) > 1:
                        character_name = parts[1].strip()
                
                return [EditInstruction(
                    action="delete",
                    target="character",
                    content={"name": character_name},
                    description=f"删除角色: {character_name}"
                )]
            elif "证据" in instruction or "线索" in instruction:
                # 尝试从指令中提取证据名称
                evidence_name = "新证据"  # 默认值
                if "名字叫" in instruction:
                    parts = instruction.split("名字叫")
                    if len(parts) > 1:
                        evidence_name = parts[1].strip()
                elif "叫" in instruction:
                    parts = instruction.split("叫")
                    if len(parts) > 1:
                        evidence_name = parts[1].strip()
                
                return [EditInstruction(
                    action="delete",
                    target="evidence",
                    content={"name": evidence_name},
                    description=f"删除证据: {evidence_name}"
                )]
            elif "场景" in instruction or "地点" in instruction:
                # 尝试从指令中提取场景名称
                location_name = "新场景"  # 默认值
                if "名字叫" in instruction:
                    parts = instruction.split("名字叫")
                    if len(parts) > 1:
                        location_name = parts[1].strip()
                elif "叫" in instruction:
                    parts = instruction.split("叫")
                    if len(parts) > 1:
                        location_name = parts[1].strip()
                
                return [EditInstruction(
                    action="delete",
                    target="location",
                    content={"name": location_name},
                    description=f"删除场景: {location_name}"
                )]
        
        # 检查是否为背景故事相关指令
        if "背景故事" in instruction or "剧本故事" in instruction or "故事背景" in instruction or "剧情" in instruction:
            return [EditInstruction(
                action="update",
                target="story",
                content={
                    "story": instruction,
                    "generate_missing": True
                },
                description="更新背景故事"
            )]
        
        # 默认返回修改剧本信息的指令
        return [EditInstruction(
            action="modify",
            target="info",
            content={"description": instruction},
            description="修改剧本信息"
        )]
    
    async def execute_instruction(self, instruction: EditInstruction, script_id: int) -> EditResult:
        """执行编辑指令"""
        logger.info(f"[SCRIPT_EDIT] 开始执行编辑指令 - 剧本ID: {script_id}, 操作: {instruction.action}, 目标: {instruction.target}")
        logger.debug(f"[SCRIPT_EDIT] 指令详情: {instruction.model_dump()}")
        
        try:
            # 获取当前剧本
            current_script = self.script_repository.get_script_by_id(script_id)
            if not current_script:
                logger.error(f"[SCRIPT_EDIT] 剧本不存在 - ID: {script_id}")
                return EditResult(
                    success=False,
                    message=f"剧本 {script_id} 不存在"
                )
            
            # 记录操作前的状态
            before_state = self._get_script_state_summary(current_script)
            logger.info(f"[SCRIPT_EDIT] 操作前状态: {before_state}")
            
            # 根据指令类型执行相应操作
            if instruction.target == "character":
                result = await self._handle_character_instruction(instruction, current_script)
            elif instruction.target == "evidence":
                result = await self._handle_evidence_instruction(instruction, current_script)
            elif instruction.target == "location":
                result = await self._handle_location_instruction(instruction, current_script)
            elif instruction.target == "info":
                result = await self._handle_info_instruction(instruction, current_script)
            elif instruction.target == "story":
                result = await self._handle_story_instruction(instruction, current_script)
            else:
                logger.warning(f"[SCRIPT_EDIT] 不支持的目标类型: {instruction.target}")
                return EditResult(
                    success=False,
                    message=f"不支持的目标类型: {instruction.target}"
                )
            
            # 记录操作结果
            if result.success:
                logger.info(f"[SCRIPT_EDIT] 操作成功: {result.message}")
                if result.updated_script:
                    after_state = self._get_script_state_summary(result.updated_script)
                    logger.info(f"[SCRIPT_EDIT] 操作后状态: {after_state}")
                    
                    # 记录具体变更内容
                    changes = self._get_changes_detail(before_state, after_state, instruction)
                    logger.info(f"[SCRIPT_EDIT] 具体变更: {changes}")
                    
                    # 更新数据库
                    updated_script = self.script_repository.update_script(script_id, result.updated_script)
                    result.updated_script = updated_script
                    logger.info(f"[SCRIPT_EDIT] 数据库更新完成")
            else:
                logger.warning(f"[SCRIPT_EDIT] 操作失败: {result.message}")
            
            return result
            
        except Exception as e:
            logger.error(f"[SCRIPT_EDIT] 执行指令异常: {str(e)}", exc_info=True)
            return EditResult(
                success=False,
                message=f"执行指令失败: {str(e)}"
            )
    
    async def _handle_character_instruction(self, instruction: EditInstruction, script: Script) -> EditResult:
        """处理角色相关指令"""
        logger.info(f"[CHARACTER_EDIT] 处理角色指令 - 操作: {instruction.action}")
        
        if instruction.action == "add":
            # 验证必填字段
            required_fields = ["name", "profession", "background", "secret", "objective", "gender"]
            missing_fields = []
            for field in required_fields:
                if not instruction.content.get(field):
                    missing_fields.append(field)
            
            # 检查特殊必填字段
            if not instruction.content.get("personality_traits"):
                missing_fields.append("personality_traits")
            
            if len(missing_fields) > 0:
                logger.warning(f"[CHARACTER_EDIT] 添加角色失败: 缺少必填字段 {missing_fields}")
                return EditResult(
                    success=False, 
                    message=f"添加角色失败: 缺少必填字段 {missing_fields}，请提供完整信息"
                )
            
            # 验证字段内容质量
            content_issues = []
            if len(instruction.content.get("background", "")) < 50:
                content_issues.append("背景描述至少需要50个字符")
            
            if len(instruction.content.get("secret", "")) < 20:
                content_issues.append("角色秘密至少需要20个字符")
            
            if len(instruction.content.get("objective", "")) < 15:
                content_issues.append("角色目标至少需要15个字符")
            
            if not isinstance(instruction.content.get("personality_traits"), list) or \
               len(instruction.content.get("personality_traits", [])) < 2:
                content_issues.append("性格特征至少需要2个")
            
            gender = instruction.content.get("gender", "").lower()
            if gender not in ["男", "女", "中性"]:
                content_issues.append("性别必须是：男、女、中性之一")
            
            if content_issues:
                logger.warning(f"[CHARACTER_EDIT] 添加角色失败: 内容质量问题 {content_issues}")
                return EditResult(
                    success=False,
                    message=f"添加角色失败: {', '.join(content_issues)}"
                )
            
            # 添加新角色
            character_data = {
                "script_id": script.info.id,
                "name": str(instruction.content.get("name", "新角色")),
                "profession": str(instruction.content.get("profession", "")),
                "background": str(instruction.content.get("background", "")),
                "secret": str(instruction.content.get("secret", "")),
                "objective": str(instruction.content.get("objective", "")),
                "gender": str(instruction.content.get("gender", "中性")),
                "personality_traits": list(instruction.content.get("personality_traits", [])),
                "is_murderer": bool(instruction.content.get("is_murderer", False)),
                "is_victim": bool(instruction.content.get("is_victim", False))
            }
            
            # 添加可选字段
            age = instruction.content.get("age")
            if age is not None:
                character_data["age"] = int(age) if isinstance(age, (int, str)) and str(age).isdigit() else None
            
            avatar_url = instruction.content.get("avatar_url")
            if avatar_url:
                character_data["avatar_url"] = str(avatar_url)
                
            voice_preference = instruction.content.get("voice_preference")
            if voice_preference:
                character_data["voice_preference"] = str(voice_preference)
                
            voice_id = instruction.content.get("voice_id")
            if voice_id:
                character_data["voice_id"] = str(voice_id)
            
            logger.info(f"[CHARACTER_EDIT] 准备添加角色数据: {character_data}")
            
            new_character = ScriptCharacter(**character_data)
            script.characters.append(new_character)
            
            logger.info(f"[CHARACTER_EDIT] 成功添加角色: {new_character.name}, 当前角色总数: {len(script.characters)}")
            
            return EditResult(
                success=True,
                message=f"成功添加角色: {new_character.name}",
                data={"character": new_character.model_dump()},
                updated_script=script
            )
        
        elif instruction.action == "update" or instruction.action == "modify":
            # 更新现有角色
            character_name = instruction.content.get("name")
            if not character_name:
                logger.warning(f"[CHARACTER_EDIT] 更新角色失败: 缺少角色名称")
                return EditResult(success=False, message="缺少角色名称")
            
            # 查找角色
            character = None
            for char in script.characters:
                if char.name == character_name:
                    character = char
                    break
            
            if not character:
                logger.warning(f"[CHARACTER_EDIT] 更新角色失败: 未找到角色 {character_name}")
                return EditResult(success=False, message=f"未找到角色: {character_name}")
            
            # 记录更新前的状态
            before_update = character.model_dump()
            logger.info(f"[CHARACTER_EDIT] 更新前角色状态: {before_update}")
            
            # 更新角色属性
            updated_fields = []
            for key, value in instruction.content.items():
                if hasattr(character, key) and key != "id" and key != "script_id":
                    old_value = getattr(character, key)
                    setattr(character, key, value)
                    updated_fields.append(f"{key}: {old_value} -> {value}")
            
            logger.info(f"[CHARACTER_EDIT] 角色 '{character_name}' 字段更新: {'; '.join(updated_fields)}")
            
            return EditResult(
                success=True,
                message=f"成功更新角色: {character.name}",
                data={"character": character.model_dump()},
                updated_script=script
            )
        
        elif instruction.action == "delete":
            # 删除角色
            character_name = instruction.content.get("name")
            if not character_name:
                logger.warning(f"[CHARACTER_EDIT] 删除角色失败: 缺少角色名称")
                return EditResult(success=False, message="缺少角色名称")
            
            # 查找并删除角色
            for i, char in enumerate(script.characters):
                if char.name == character_name:
                    deleted_character = char.model_dump()
                    logger.info(f"[CHARACTER_EDIT] 准备删除角色: {deleted_character}")
                    
                    del script.characters[i]
                    
                    logger.info(f"[CHARACTER_EDIT] 成功删除角色: {character_name}, 剩余角色数: {len(script.characters)}")
                    
                    return EditResult(
                        success=True,
                        message=f"成功删除角色: {character_name}",
                        updated_script=script
                    )
            
            logger.warning(f"[CHARACTER_EDIT] 删除角色失败: 未找到角色 {character_name}")
            return EditResult(success=False, message=f"未找到角色: {character_name}")
        
        return EditResult(success=False, message=f"不支持的角色操作: {instruction.action}")
    
    async def _handle_evidence_instruction(self, instruction: EditInstruction, script: Script) -> EditResult:
        """处理证据相关指令"""
        logger.info(f"[EVIDENCE_EDIT] 处理证据指令 - 操作: {instruction.action}")
        
        if instruction.action == "add":
            # 添加新证据
            evidence_type_value = instruction.content.get("evidence_type", "PHYSICAL")
            if isinstance(evidence_type_value, str):
                try:
                    evidence_type = EvidenceType(evidence_type_value)
                except ValueError:
                    evidence_type = EvidenceType.PHYSICAL
            else:
                evidence_type = EvidenceType.PHYSICAL
                
            evidence_data = {
                "script_id": script.info.id,
                "name": str(instruction.content.get("name", "新证据")),
                "description": str(instruction.content.get("description", "")),
                "location": str(instruction.content.get("location", "")),
                "related_to": str(instruction.content.get("related_to", "")),
                "significance": str(instruction.content.get("significance", "")),
                "evidence_type": evidence_type,
                "importance": str(instruction.content.get("importance", "重要证据")),
                "is_hidden": bool(instruction.content.get("is_hidden", False))
            }
            
            # 添加可选字段
            image_url = instruction.content.get("image_url")
            if image_url:
                evidence_data["image_url"] = str(image_url)
            
            logger.info(f"[EVIDENCE_EDIT] 准备添加证据数据: {evidence_data}")
            
            new_evidence = ScriptEvidence(**evidence_data)
            script.evidence.append(new_evidence)
            
            logger.info(f"[EVIDENCE_EDIT] 成功添加证据: {new_evidence.name}, 当前证据总数: {len(script.evidence)}")
            
            return EditResult(
                success=True,
                message=f"成功添加证据: {new_evidence.name}",
                data={"evidence": new_evidence.model_dump()},
                updated_script=script
            )
        
        elif instruction.action == "update" or instruction.action == "modify":
            # 更新现有证据
            evidence_name = instruction.content.get("name")
            if not evidence_name:
                logger.warning(f"[EVIDENCE_EDIT] 更新证据失败: 缺少证据名称")
                return EditResult(success=False, message="缺少证据名称")
            
            # 查找证据
            evidence = None
            for ev in script.evidence:
                if ev.name == evidence_name:
                    evidence = ev
                    break
            
            if not evidence:
                logger.warning(f"[EVIDENCE_EDIT] 更新证据失败: 未找到证据 {evidence_name}")
                return EditResult(success=False, message=f"未找到证据: {evidence_name}")
            
            # 记录更新前的状态
            before_update = evidence.model_dump()
            logger.info(f"[EVIDENCE_EDIT] 更新前证据状态: {before_update}")
            
            # 更新证据属性
            updated_fields = []
            for key, value in instruction.content.items():
                if hasattr(evidence, key) and key != "id" and key != "script_id":
                    old_value = getattr(evidence, key)
                    if key == "evidence_type" and isinstance(value, str):
                        setattr(evidence, key, EvidenceType(value))
                    else:
                        setattr(evidence, key, value)
                    updated_fields.append(f"{key}: {old_value} -> {value}")
            
            logger.info(f"[EVIDENCE_EDIT] 证据 '{evidence_name}' 字段更新: {'; '.join(updated_fields)}")
            
            return EditResult(
                success=True,
                message=f"成功更新证据: {evidence.name}",
                data={"evidence": evidence.model_dump()},
                updated_script=script
            )
        
        elif instruction.action == "delete":
            # 删除证据
            evidence_name = instruction.content.get("name")
            if not evidence_name:
                logger.warning(f"[EVIDENCE_EDIT] 删除证据失败: 缺少证据名称")
                return EditResult(success=False, message="缺少证据名称")
            
            # 查找并删除证据
            for i, ev in enumerate(script.evidence):
                if ev.name == evidence_name:
                    deleted_evidence = ev.model_dump()
                    logger.info(f"[EVIDENCE_EDIT] 准备删除证据: {deleted_evidence}")
                    
                    del script.evidence[i]
                    
                    logger.info(f"[EVIDENCE_EDIT] 成功删除证据: {evidence_name}, 剩余证据数: {len(script.evidence)}")
                    
                    return EditResult(
                        success=True,
                        message=f"成功删除证据: {evidence_name}",
                        updated_script=script
                    )
            
            logger.warning(f"[EVIDENCE_EDIT] 删除证据失败: 未找到证据 {evidence_name}")
            return EditResult(success=False, message=f"未找到证据: {evidence_name}")
        
        return EditResult(success=False, message=f"不支持的证据操作: {instruction.action}")
    
    async def _handle_location_instruction(self, instruction: EditInstruction, script: Script) -> EditResult:
        """处理场景相关指令"""
        logger.info(f"[LOCATION_EDIT] 处理场景指令 - 操作: {instruction.action}")
        
        if instruction.action == "add":
            # 添加新场景
            location_data = {
                "script_id": script.info.id,
                "name": str(instruction.content.get("name", "新场景")),
                "description": str(instruction.content.get("description", "")),
                "searchable_items": list(instruction.content.get("searchable_items", [])),
                "is_crime_scene": bool(instruction.content.get("is_crime_scene", False))
            }
            
            # 添加可选字段
            background_image_url = instruction.content.get("background_image_url")
            if background_image_url:
                location_data["background_image_url"] = str(background_image_url)
            
            logger.info(f"[LOCATION_EDIT] 准备添加场景数据: {location_data}")
            
            new_location = ScriptLocation(**location_data)
            script.locations.append(new_location)
            
            logger.info(f"[LOCATION_EDIT] 成功添加场景: {new_location.name}, 当前场景总数: {len(script.locations)}")
            
            return EditResult(
                success=True,
                message=f"成功添加场景: {new_location.name}",
                data={"location": new_location.model_dump()},
                updated_script=script
            )
        
        elif instruction.action == "update" or instruction.action == "modify":
            # 更新现有场景
            location_name = instruction.content.get("name")
            if not location_name:
                logger.warning(f"[LOCATION_EDIT] 更新场景失败: 缺少场景名称")
                return EditResult(success=False, message="缺少场景名称")
            
            # 查找场景
            location = None
            for loc in script.locations:
                if loc.name == location_name:
                    location = loc
                    break
            
            if not location:
                logger.warning(f"[LOCATION_EDIT] 更新场景失败: 未找到场景 {location_name}")
                return EditResult(success=False, message=f"未找到场景: {location_name}")
            
            # 记录更新前的状态
            before_update = location.model_dump()
            logger.info(f"[LOCATION_EDIT] 更新前场景状态: {before_update}")
            
            # 更新场景属性
            updated_fields = []
            for key, value in instruction.content.items():
                if hasattr(location, key) and key != "id" and key != "script_id":
                    old_value = getattr(location, key)
                    setattr(location, key, value)
                    updated_fields.append(f"{key}: {old_value} -> {value}")
            
            logger.info(f"[LOCATION_EDIT] 场景 '{location_name}' 字段更新: {'; '.join(updated_fields)}")
            
            return EditResult(
                success=True,
                message=f"成功更新场景: {location.name}",
                data={"location": location.model_dump()},
                updated_script=script
            )
        
        elif instruction.action == "delete":
            # 删除场景
            location_name = instruction.content.get("name")
            if not location_name:
                logger.warning(f"[LOCATION_EDIT] 删除场景失败: 缺少场景名称")
                return EditResult(success=False, message="缺少场景名称")
            
            # 查找并删除场景
            for i, loc in enumerate(script.locations):
                if loc.name == location_name:
                    deleted_location = loc.model_dump()
                    logger.info(f"[LOCATION_EDIT] 准备删除场景: {deleted_location}")
                    
                    del script.locations[i]
                    
                    logger.info(f"[LOCATION_EDIT] 成功删除场景: {location_name}, 剩余场景数: {len(script.locations)}")
                    
                    return EditResult(
                        success=True,
                        message=f"成功删除场景: {location_name}",
                        updated_script=script
                    )
            
            logger.warning(f"[LOCATION_EDIT] 删除场景失败: 未找到场景 {location_name}")
            return EditResult(success=False, message=f"未找到场景: {location_name}")
        
        return EditResult(success=False, message=f"不支持的场景操作: {instruction.action}")
    
    async def _handle_info_instruction(self, instruction: EditInstruction, script: Script) -> EditResult:
        """处理剧本信息相关指令"""
        logger.info(f"[INFO_EDIT] 处理剧本信息指令 - 操作: {instruction.action}")
        
        if instruction.action == "update" or instruction.action == "modify":
            # 记录更新前的状态
            before_update = script.info.model_dump()
            logger.info(f"[INFO_EDIT] 更新前剧本信息: {before_update}")
            
            # 更新剧本基本信息
            updated_fields = []
            for key, value in instruction.content.items():
                if hasattr(script.info, key) and key not in ["id", "author", "created_at", "updated_at"]:
                    old_value = getattr(script.info, key)
                    # 根据字段类型进行适当的类型转换
                    if key == "player_count" and value is not None:
                        value = int(value) if isinstance(value, (int, str)) and str(value).isdigit() else old_value
                    elif key in ["title", "description", "difficulty", "theme", "tags"] and value is not None:
                        value = str(value)
                    elif key == "estimated_duration" and value is not None:
                        value = int(value) if isinstance(value, (int, str)) and str(value).isdigit() else old_value
                    elif key in ["is_published", "is_featured"] and value is not None:
                        value = bool(value)
                    
                    setattr(script.info, key, value)
                    updated_fields.append(f"{key}: {old_value} -> {value}")
            
            logger.info(f"[INFO_EDIT] 剧本信息字段更新: {'; '.join(updated_fields)}")
            
            return EditResult(
                success=True,
                message="成功更新剧本信息",
                data={"info": script.info.model_dump()},
                updated_script=script
            )
        
        logger.warning(f"[INFO_EDIT] 不支持的剧本信息操作: {instruction.action}")
        return EditResult(success=False, message=f"不支持的剧本信息操作: {instruction.action}")
    
    async def _handle_story_instruction(self, instruction: EditInstruction, script: Script) -> EditResult:
        """处理背景故事相关指令"""
        logger.info(f"[STORY_EDIT] 处理背景故事指令 - 操作: {instruction.action}")
        
        # 导入背景故事相关模块
        from ..schemas.background_story import BackgroundStory
        
        if instruction.action == "update" or instruction.action == "modify":
            try:
                # 准备更新数据
                story_data = {}
                
                # 处理所有支持的背景故事字段
                supported_fields = [
                    "title", "setting_description", "incident_description", 
                    "victim_background", "investigation_scope", "rules_reminder",
                    "murder_method", "murder_location", "discovery_time", "victory_conditions"
                ]
                
                # 处理具体字段内容
                for field in supported_fields:
                    if field in instruction.content:
                        story_data[field] = instruction.content[field]
                
                # 智能字段映射 - 处理用户可能使用的别名
                field_mapping = {
                    "story": "setting_description",
                    "description": "setting_description", 
                    "content": "setting_description",
                    "background": "setting_description",
                    "event": "incident_description",
                    "incident": "incident_description",
                    "victim": "victim_background",
                    "scope": "investigation_scope",
                    "rules": "rules_reminder",
                    "method": "murder_method",
                    "location": "murder_location",
                    "time": "discovery_time",
                    "victory": "victory_conditions"
                }
                
                # 应用字段映射
                for alias, actual_field in field_mapping.items():
                    if alias in instruction.content and actual_field not in story_data:
                        story_data[actual_field] = instruction.content[alias]
                
                # AI智能生成缺失字段（仅在明确要求时）
                if "generate_missing" in instruction.content:
                    story_data = await self._generate_missing_story_fields(dict(story_data), script)
                
                # 如果没有指定具体字段，尝试从通用字段中提取
                if not story_data:
                    if "story" in instruction.content:
                        story_data["setting_description"] = instruction.content["story"]
                    elif "description" in instruction.content:
                        story_data["setting_description"] = instruction.content["description"]
                    elif "content" in instruction.content:
                        story_data["setting_description"] = instruction.content["content"]
                    else:
                        # 如果用户直接输入了新的故事内容
                        story_content = str(instruction.content)
                        if story_content and story_content != "{}":
                            story_data["setting_description"] = story_content
                
                if not story_data:
                    return EditResult(success=False, message="未提供有效的背景故事内容")
                
                # 修改内存中的script对象
                if hasattr(script, 'background_story') and script.background_story:
                    # 更新现有背景故事
                    for key, value in story_data.items():
                        setattr(script.background_story, key, value)
                    logger.info(f"[STORY_EDIT] 更新现有背景故事: {list(story_data.keys())}")
                else:
                    # 创建新的背景故事
                    story_data["script_id"] = script.info.id
                    script.background_story = BackgroundStory(**story_data)
                    logger.info(f"[STORY_EDIT] 创建新背景故事: {list(story_data.keys())}")
                
                logger.info(f"[STORY_EDIT] 成功更新背景故事")
                return EditResult(
                    success=True,
                    message=f"成功更新背景故事 ({len(story_data)}个字段)",
                    data={"background_story": script.background_story.model_dump()},
                    updated_script=script
                )
                    
            except Exception as e:
                logger.error(f"[STORY_EDIT] 背景故事更新异常: {str(e)}")
                return EditResult(success=False, message=f"背景故事更新失败: {str(e)}")
        
        logger.warning(f"[STORY_EDIT] 不支持的背景故事操作: {instruction.action}")
        return EditResult(success=False, message=f"不支持的背景故事操作: {instruction.action}")
    
    async def _generate_missing_story_fields(self, existing_data: Dict[str, Any], script: Script) -> Dict[str, Any]:
        """基于现有数据智能生成缺失的背景故事字段"""
        # 重试机制
        max_retries = 3
        last_error = None
        base_temperature = 0.7
        
        for attempt in range(max_retries):
            try:
                from ..services.llm_service import llm_service, LLMMessage
                
                # 构建AI提示
                system_prompt = """你是一个专业的剧本杀背景故事创作助手。基于已有的剧本信息和背景故事片段，
                请生成完整的背景故事各个字段。确保内容逻辑一致、情节合理、适合剧本杀游戏。
                
                请按照以下JSON格式返回结果：
                {
                    "setting_description": "背景设定描述",
                    "incident_description": "事件描述", 
                    "victim_background": "受害者背景",
                    "investigation_scope": "调查范围",
                    "rules_reminder": "规则提醒",
                    "murder_method": "作案手法",
                    "murder_location": "作案地点",
                    "discovery_time": "发现时间"
                }"""
                
                # 构建上下文信息
                context_info = f"""剧本信息：
                标题：{script.info.title}
                描述：{script.info.description}
                玩家人数：{script.info.player_count}
                
                已有背景故事内容：
                {existing_data}
                
                角色信息：
                {[char.name + ': ' + char.background for char in script.characters[:3]]}
                """
                
                messages = [
                    LLMMessage(role="system", content=system_prompt),
                    LLMMessage(role="user", content=context_info)
                ]
                
                # 每次重试时增加temperature值
                current_temperature = base_temperature + (attempt * 0.1)
                
                response = await llm_service.chat_completion(
                    messages, 
                    max_tokens=1000, 
                    temperature=current_temperature  # 每次重试时temperature增加0.1
                )
                
                if response.content:
                    try:
                        import json
                        generated_data = json.loads(response.content)
                        
                        # 合并现有数据和生成数据，现有数据优先
                        result_data = {**generated_data, **existing_data}
                        
                        logger.info(f"[STORY_EDIT] AI生成背景故事字段: {list(generated_data.keys())}")
                        return result_data
                        
                    except json.JSONDecodeError:
                        logger.warning(f"[STORY_EDIT] AI返回内容不是有效JSON，使用原始数据")
                        return existing_data
                
                return existing_data
                
            except Exception as e:
                last_error = e
                logger.warning(f"[STORY_EDIT] 第{attempt + 1}次尝试生成背景故事字段失败: {str(e)}")
                
                if attempt < max_retries - 1:
                    # 在重试前调整提示词，强调之前失败的原因
                    if "JSON" in str(e) or "格式" in str(e):
                        context_info += "\n\n注意：请确保返回的是标准JSON格式，不要包含任何代码标记或额外文字。"
        
        # 所有重试都失败了
        logger.error(f"[STORY_EDIT] AI生成背景故事字段失败，已重试{max_retries}次。最后错误: {str(last_error)}")
        return existing_data
    
    async def generate_ai_suggestion(self, script_id: int, context: str = "") -> str:
        """生成AI编辑建议"""
        # 重试机制
        max_retries = 3
        last_error = None
        base_temperature = 0.7
        
        for attempt in range(max_retries):
            try:
                # 获取当前剧本
                current_script = self.script_repository.get_script_by_id(script_id)
                if not current_script:
                    return "剧本不存在，无法生成建议"
                
                # 构建AI提示
                system_prompt = """你是一个专业的剧本杀游戏设计师，能够分析剧本内容并提供改进建议。

请分析当前剧本的结构和内容，提供具体的改进建议，包括：
1. 角色设计的完善
2. 证据线索的优化
3. 场景设置的改进
4. 剧情逻辑的完善
5. 游戏平衡性的调整

请提供具体、可操作的建议。"""
                
                script_context = f"""剧本信息：
标题：{current_script.info.title}
描述：{current_script.info.description}
玩家人数：{current_script.info.player_count}

角色列表：
{self._format_characters(current_script.characters)}

证据列表：
{self._format_evidence(current_script.evidence)}

场景列表：
{self._format_locations(current_script.locations)}

{context}"""
                
                messages = [
                    LLMMessage(role="system", content=system_prompt),
                    LLMMessage(role="user", content=script_context)
                ]
                
                # 每次重试时增加temperature值
                current_temperature = base_temperature + (attempt * 0.1)
                
                response = await llm_service.chat_completion(
                    messages, 
                    max_tokens=800, 
                    temperature=current_temperature  # 每次重试时temperature增加0.1
                )
                
                return response.content or "无法生成建议，请稍后重试"
                
            except Exception as e:
                last_error = e
                logger.warning(f"[AI_SUGGESTION] 第{attempt + 1}次尝试生成AI建议失败: {str(e)}")
                
                if attempt < max_retries - 1:
                    # 在重试前调整提示词，强调之前失败的原因
                    if "JSON" in str(e) or "格式" in str(e):
                        script_context += "\n\n注意：请确保返回的是标准JSON格式，不要包含任何代码标记或额外文字。"
        
        # 所有重试都失败了
        logger.error(f"[AI_SUGGESTION] AI生成建议失败，已重试{max_retries}次。最后错误: {str(last_error)}")
        return f"生成建议失败，请稍后重试。最后错误: {str(last_error)}"
    
    def _get_script_state_summary(self, script: Script) -> Dict[str, Any]:
        """获取剧本状态摘要"""
        return {
            "title": script.info.title,
            "description": script.info.description[:100] + "..." if len(script.info.description) > 100 else script.info.description,
            "character_count": len(script.characters),
            "character_names": [char.name for char in script.characters],
            "evidence_count": len(script.evidence),
            "evidence_names": [ev.name for ev in script.evidence],
            "location_count": len(script.locations),
            "location_names": [loc.name for loc in script.locations]
        }
    
    def _get_changes_detail(self, before_state: Dict[str, Any], after_state: Dict[str, Any], instruction: EditInstruction) -> str:
        """获取具体变更详情"""
        changes = []
        
        # 检查角色变更
        if before_state["character_count"] != after_state["character_count"]:
            if instruction.action == "add":
                new_characters = set(after_state["character_names"]) - set(before_state["character_names"])
                changes.append(f"新增角色: {', '.join(new_characters)}")
            elif instruction.action == "delete":
                deleted_characters = set(before_state["character_names"]) - set(after_state["character_names"])
                changes.append(f"删除角色: {', '.join(deleted_characters)}")
        elif instruction.target == "character" and instruction.action in ["update", "modify"]:
            character_name = instruction.content.get("name", "未知角色")
            modified_fields = list(instruction.content.keys())
            changes.append(f"修改角色 '{character_name}' 的字段: {', '.join(modified_fields)}")
        
        # 检查证据变更
        if before_state["evidence_count"] != after_state["evidence_count"]:
            if instruction.action == "add":
                new_evidence = set(after_state["evidence_names"]) - set(before_state["evidence_names"])
                changes.append(f"新增证据: {', '.join(new_evidence)}")
            elif instruction.action == "delete":
                deleted_evidence = set(before_state["evidence_names"]) - set(after_state["evidence_names"])
                changes.append(f"删除证据: {', '.join(deleted_evidence)}")
        elif instruction.target == "evidence" and instruction.action in ["update", "modify"]:
            evidence_name = instruction.content.get("name", "未知证据")
            modified_fields = list(instruction.content.keys())
            changes.append(f"修改证据 '{evidence_name}' 的字段: {', '.join(modified_fields)}")
        
        # 检查场景变更
        if before_state["location_count"] != after_state["location_count"]:
            if instruction.action == "add":
                new_locations = set(after_state["location_names"]) - set(before_state["location_names"])
                changes.append(f"新增场景: {', '.join(new_locations)}")
            elif instruction.action == "delete":
                deleted_locations = set(before_state["location_names"]) - set(after_state["location_names"])
                changes.append(f"删除场景: {', '.join(deleted_locations)}")
        elif instruction.target == "location" and instruction.action in ["update", "modify"]:
            location_name = instruction.content.get("name", "未知场景")
            modified_fields = list(instruction.content.keys())
            changes.append(f"修改场景 '{location_name}' 的字段: {', '.join(modified_fields)}")
        
        # 检查剧本信息变更
        if instruction.target == "info":
            modified_fields = list(instruction.content.keys())
            changes.append(f"修改剧本信息字段: {', '.join(modified_fields)}")
        
        # 检查背景故事变更
        if instruction.target == "story":
            changes.append("修改背景故事")
        
        return "; ".join(changes) if changes else "无明显变更"