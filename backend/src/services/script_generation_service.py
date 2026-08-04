"""剧本AI内容生成服务

负责调用 LLM 生成剧本基础信息、角色和证据，并将结果持久化到数据库。
业务逻辑从路由层迁移至此，保持路由处理器薄且纯净。
"""

import json
import logging
import re
from typing import Any, Dict, List, Optional

from ..services.llm_service import llm_service, LLMMessage
from ..schemas.script_character import ScriptCharacter
from ..schemas.script_evidence import ScriptEvidence
from ..schemas.evidence_type import EvidenceType
from ..db.repositories.script_repository import ScriptRepository
from ..db.repositories.character_repository import CharacterRepository
from ..db.repositories.evidence_repository import EvidenceRepository

logger = logging.getLogger(__name__)


def _strip_json_markdown(content: str) -> str:
    """从 LLM 输出中提取可解析的 JSON 文本。"""
    content = content.strip()

    # 部分思考模型会输出 <think>...</think>，先去除后再提取 JSON
    content = re.sub(r"<think>[\s\S]*?</think>", "", content, flags=re.IGNORECASE)
    content = content.strip()

    # 优先提取 markdown 中的 JSON 代码块
    fence_match = re.search(
        r"```(?:json)?\s*([\s\S]*?)\s*```", content, flags=re.IGNORECASE
    )
    if fence_match:
        return fence_match.group(1).strip()

    # 兼容仅包含代码块起止标记但无完整匹配的场景
    if content.startswith("```json"):
        content = content[7:]
    elif content.startswith("```"):
        content = content[3:]
    if content.endswith("```"):
        content = content[:-3]

    content = content.strip()

    # 若仍有额外说明文本，尝试提取第一个平衡的 JSON 对象/数组
    start_positions = [
        pos for pos in (content.find("{"), content.find("[")) if pos != -1
    ]
    if not start_positions:
        return content

    start = min(start_positions)
    opening = content[start]
    closing = "}" if opening == "{" else "]"

    depth = 0
    in_string = False
    escaped = False

    for i in range(start, len(content)):
        ch = content[i]

        if in_string:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == '"':
                in_string = False
            continue

        if ch == '"':
            in_string = True
            continue

        if ch == opening:
            depth += 1
        elif ch == closing:
            depth -= 1
            if depth == 0:
                return content[start : i + 1].strip()

    return content[start:].strip()


class ScriptGenerationService:
    """剧本 AI 内容生成服务

    依赖通过构造函数注入，由 DI 容器管理生命周期（scoped）。
    LLM 调用使用全局 llm_service 单例（与 ScriptEditorService 保持一致）。
    """

    def __init__(
        self,
        script_repository: ScriptRepository,
        character_repository: CharacterRepository,
        evidence_repository: EvidenceRepository,
    ):
        self.script_repository = script_repository
        self.character_repository = character_repository
        self.evidence_repository = evidence_repository

    # ------------------------------------------------------------------
    # 公开方法
    # ------------------------------------------------------------------

    async def generate_script_info(
        self,
        theme: str,
        script_type: Optional[str] = None,
        player_count: Optional[str] = None,
    ) -> Dict[str, Any]:
        """根据主题生成剧本基础信息（标题、简介、背景等）"""
        system_prompt = (
            "你是一个专业的剧本杀游戏设计师，擅长根据主题创作引人入胜的剧本。\n"
            "请根据用户提供的主题，生成剧本的基础信息。\n\n"
            "要求：\n"
            "1. 生成的内容要有创意和吸引力\n"
            "2. 符合剧本杀游戏的特点\n"
            "3. 内容要完整且逻辑合理\n"
            "4. 返回JSON格式，包含以下字段：\n"
            "   - title: 剧本标题\n"
            "   - description: 剧本简介（100-200字）\n"
            "   - background: 背景故事（200-300字）\n"
            "   - suggested_type: 建议的剧本类型\n"
            "   - suggested_player_count: 建议的玩家人数"
        )

        user_prompt = f"主题：{theme}"
        if script_type:
            user_prompt += f"\n剧本类型偏好：{script_type}"
        if player_count:
            user_prompt += f"\n玩家人数：{player_count}"
        user_prompt += "\n\n请生成剧本基础信息，以JSON格式返回。"

        max_retries = 3
        base_temperature = 0.8
        last_error: Exception = RuntimeError("未知错误")

        for attempt in range(max_retries):
            try:
                messages = [
                    LLMMessage(role="system", content=system_prompt),
                    LLMMessage(role="user", content=user_prompt),
                ]
                response = await llm_service.chat_completion(
                    messages,
                    max_tokens=800,
                    temperature=base_temperature + attempt * 0.1,
                )
                if not response.content:
                    raise ValueError("LLM服务返回空内容")

                try:
                    return json.loads(_strip_json_markdown(response.content))
                except json.JSONDecodeError:
                    # 解析失败时返回原始内容作为 description
                    cleaned_content = _strip_json_markdown(response.content)
                    return {
                        "title": "AI生成的剧本",
                        "description": cleaned_content,
                        "background": "",
                        "suggested_type": script_type or "mystery",
                        "suggested_player_count": str(player_count or 6),
                    }

            except Exception as e:
                last_error = e
                logger.warning(
                    f"[SCRIPT_GENERATION] generate_script_info 第{attempt + 1}次失败: {e}"
                )
                if attempt < max_retries - 1 and ("JSON" in str(e) or "格式" in str(e)):
                    user_prompt += (
                        "\n\n注意：请确保返回的是标准JSON格式，不要包含任何代码标记或额外文字。"
                    )

        raise ValueError(
            f"生成剧本信息失败，已重试{max_retries}次。最后错误: {last_error}"
        )

    async def generate_characters(
        self,
        theme: str,
        background_story: str,
        player_count: int,
        script_type: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """使用 AI 生成角色列表，包含格式校验与重试机制"""
        system_prompt = (
            f"你是一个专业的剧本杀游戏设计师，擅长创造有深度和逻辑性的角色。\n"
            f"请根据剧本背景生成{player_count}个角色，严格遵循以下要求：\n\n"
            "【角色设计原则】\n"
            "1. 每个角色都必须有独特的背景故事和明确的动机\n"
            "2. 角色之间要有合理的关系网络和利益冲突\n"
            "3. 必须有且仅有一个凶手和一个受害者\n"
            "4. 角色的秘密和目标要与剧本主题紧密相关\n"
            "5. 性格特征要鲜明、多样化且符合角色设定\n"
            "6. 年龄分布要合理，职业要多样化\n\n"
            "【字段要求】\n"
            "- name: 角色姓名（2-10个字符，要有特色）\n"
            "- background: 角色背景（150-300字，详细描述角色的过往经历）\n"
            "- gender: 性别（必须是：男、女、中性 之一）\n"
            "- age: 年龄（18-80岁之间的整数）\n"
            "- profession: 职业（具体明确的职业名称）\n"
            "- secret: 角色秘密（100-200字，与剧本主题相关的重要秘密）\n"
            "- objective: 角色目标（50-150字，角色在剧本中想要达成的目标）\n"
            "- personality_traits: 性格特征（3-5个特征词的JSON数组）\n"
            "- is_murderer: 是否为凶手（boolean，只能有一个true）\n"
            "- is_victim: 是否为受害者（boolean，只能有一个true）\n\n"
            "必须返回标准JSON数组格式，不要包含任何代码标记或额外文字。"
        )

        user_prompt = (
            f"【剧本信息】\n"
            f"主题：{theme}\n"
            f"背景故事：{background_story}\n"
            f"玩家人数：{player_count}人"
        )
        if script_type:
            user_prompt += f"\n剧本类型：{script_type}"
        user_prompt += (
            f"\n\n请为这个剧本生成{player_count}个高质量的角色，"
            "确保每个角色都有丰富的背景和明确的动机。必须以JSON数组格式返回，不要包含任何其他文字说明。"
        )

        max_retries = 3
        base_temperature = 0.6
        last_error: Exception = RuntimeError("未知错误")

        for attempt in range(max_retries):
            try:
                logger.info(
                    f"[SCRIPT_GENERATION] generate_characters 第{attempt + 1}次尝试"
                )
                messages = [
                    LLMMessage(role="system", content=system_prompt),
                    LLMMessage(role="user", content=user_prompt),
                ]
                response = await llm_service.chat_completion(
                    messages,
                    max_tokens=3000,
                    temperature=base_temperature + attempt * 0.1,
                )
                if not response.content:
                    raise ValueError("AI服务返回空内容")

                characters = json.loads(_strip_json_markdown(response.content))

                if not isinstance(characters, list):
                    raise ValueError("返回的不是数组格式")
                if len(characters) != player_count:
                    raise ValueError(
                        f"角色数量不匹配，期望{player_count}个，实际{len(characters)}个"
                    )

                self._validate_characters(characters, player_count)

                logger.info(f"[SCRIPT_GENERATION] 成功生成{len(characters)}个角色")
                return characters

            except Exception as e:
                last_error = e
                logger.warning(
                    f"[SCRIPT_GENERATION] generate_characters 第{attempt + 1}次失败: {e}"
                )
                if attempt < max_retries - 1:
                    if "JSON" in str(e) or "格式" in str(e):
                        user_prompt += (
                            "\n\n注意：请确保返回的是标准JSON格式，不要包含任何代码标记或额外文字。"
                        )
                    elif "数量" in str(e):
                        user_prompt += (
                            f"\n\n注意：必须生成恰好{player_count}个角色，不多不少。"
                        )
                    elif "凶手" in str(e) or "受害者" in str(e):
                        user_prompt += "\n\n注意：必须有且仅有一个凶手和一个受害者。"
                    elif "为空" in str(e):
                        user_prompt += (
                            "\n\n注意：所有字段都必须填写实际内容，不能为空或只有空格。"
                        )

        raise ValueError(
            f"AI生成角色失败，已重试{max_retries}次。最后错误: {last_error}"
        )

    async def generate_evidence(
        self,
        theme: str,
        background_story: str,
        characters: List[Dict[str, Any]],
        script_type: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """使用 AI 生成证据列表，包含重试机制"""
        system_prompt = (
            "你是一个专业的剧本杀游戏设计师，擅长设计逻辑严密的证据线索。\n"
            "请根据剧本背景和角色信息生成证据，确保：\n"
            "1. 证据要与角色和背景故事紧密相关\n"
            "2. 包含关键证据和普通证据\n"
            "3. 证据之间要有逻辑关联\n"
            "4. 每个证据都有明确的发现条件\n"
            "5. 证据类型要多样化\n\n"
            "返回JSON数组格式，每个证据包含以下字段：\n"
            "- name: 证据名称\n"
            "- description: 证据描述（100-150字）\n"
            "- evidence_type: 证据类型（physical/document/digital/testimony/photo）\n"
            "- location: 发现地点\n"
            "- related_character: 相关角色（可为空）\n"
            "- is_key_evidence: 是否为关键证据（boolean）\n"
            "- discovery_condition: 发现条件（50-100字）\n\n"
            "必须返回标准JSON数组格式，不要包含任何代码标记或额外文字。"
        )

        character_summary = "\n".join(
            f"- {char['name']}（{char['profession']}）：{char['background'][:50]}..."
            for char in characters
        )
        evidence_count = max(len(characters) + 2, 6)
        user_prompt = (
            f"剧本主题：{theme}\n"
            f"背景故事：{background_story}\n\n"
            f"角色信息：\n{character_summary}"
        )
        if script_type:
            user_prompt += f"\n剧本类型：{script_type}"
        user_prompt += (
            f"\n\n请为这个剧本生成{evidence_count}个证据，"
            "确保证据与角色和背景故事逻辑一致。以JSON数组格式返回。"
        )

        max_retries = 3
        base_temperature = 0.7
        last_error: Exception = RuntimeError("未知错误")

        for attempt in range(max_retries):
            try:
                logger.info(
                    f"[SCRIPT_GENERATION] generate_evidence 第{attempt + 1}次尝试"
                )
                messages = [
                    LLMMessage(role="system", content=system_prompt),
                    LLMMessage(role="user", content=user_prompt),
                ]
                response = await llm_service.chat_completion(
                    messages,
                    max_tokens=2000,
                    temperature=base_temperature + attempt * 0.1,
                )
                if not response.content:
                    raise ValueError("AI生成证据失败：返回空内容")

                evidence = json.loads(_strip_json_markdown(response.content))
                if not isinstance(evidence, list):
                    raise ValueError("AI返回的不是数组格式")

                return evidence

            except Exception as e:
                last_error = e
                logger.warning(
                    f"[SCRIPT_GENERATION] generate_evidence 第{attempt + 1}次失败: {e}"
                )
                if attempt < max_retries - 1 and ("JSON" in str(e) or "格式" in str(e)):
                    user_prompt += (
                        "\n\n注意：请确保返回的是标准JSON格式，不要包含任何代码标记或额外文字。"
                    )

        raise ValueError(
            f"AI生成证据失败，已重试{max_retries}次。最后错误: {last_error}"
        )

    async def generate_and_save_content(
        self,
        script_id: int,
        theme: str,
        background_story: str,
        player_count: int,
        script_type: Optional[str] = None,
    ) -> Dict[str, Any]:
        """生成角色和证据并持久化到数据库

        Returns:
            包含 ``characters`` 和 ``evidence`` 列表的字典，每项为 model_dump() 结果。
        """
        characters_data = await self.generate_characters(
            theme, background_story, player_count, script_type
        )
        evidence_data = await self.generate_evidence(
            theme, background_story, characters_data, script_type
        )

        created_characters: List[ScriptCharacter] = []
        for char_data in characters_data:
            character = ScriptCharacter(
                script_id=script_id,
                name=char_data["name"],
                background=char_data["background"],
                gender=char_data["gender"],
                age=char_data["age"],
                profession=char_data["profession"],
                secret=char_data["secret"],
                objective=char_data["objective"],
                personality_traits=char_data["personality_traits"],
                is_murderer=char_data["is_murderer"],
                is_victim=char_data["is_victim"],
            )
            created_characters.append(self.character_repository.add_character(character))

        created_evidence: List[ScriptEvidence] = []
        for ev_data in evidence_data:
            evidence_item = ScriptEvidence(
                script_id=script_id,
                name=ev_data["name"],
                description=ev_data["description"],
                evidence_type=EvidenceType(ev_data.get("evidence_type", "physical")),
                location=ev_data.get("location", ""),
                related_to=ev_data.get("related_character", ""),
                importance="关键证据" if ev_data.get("is_key_evidence", False) else "普通证据",
                significance=ev_data.get("discovery_condition", ""),
            )
            created_evidence.append(self.evidence_repository.add_evidence(evidence_item))

        return {
            "characters": [char.model_dump() for char in created_characters],
            "evidence": [ev.model_dump() for ev in created_evidence],
        }

    # ------------------------------------------------------------------
    # 私有辅助方法
    # ------------------------------------------------------------------

    @staticmethod
    def _validate_characters(
        characters: List[Dict[str, Any]], player_count: int
    ) -> None:
        """校验 AI 生成的角色数据格式与业务逻辑"""
        required_fields = [
            "name", "background", "gender", "age", "profession",
            "secret", "objective", "personality_traits", "is_murderer", "is_victim",
        ]
        valid_genders = {"男", "女", "中性"}

        for i, char in enumerate(characters):
            for field in required_fields:
                if field not in char:
                    raise ValueError(f"第{i + 1}个角色缺少必填字段: {field}")

            if not isinstance(char["name"], str) or not (1 <= len(char["name"]) <= 50):
                raise ValueError(f"第{i + 1}个角色的姓名格式错误")
            if not isinstance(char["background"], str) or not (50 <= len(char["background"]) <= 500):
                raise ValueError(f"第{i + 1}个角色的背景描述长度不符合要求（50-500字符）")
            if char["gender"] not in valid_genders:
                raise ValueError(f"第{i + 1}个角色的性别必须是：男、女、中性 之一")
            if not isinstance(char["age"], int) or not (18 <= char["age"] <= 80):
                raise ValueError(f"第{i + 1}个角色的年龄必须是18-80之间的整数")
            if not isinstance(char["profession"], str) or not (1 <= len(char["profession"]) <= 50):
                raise ValueError(f"第{i + 1}个角色的职业格式错误")
            if not isinstance(char["secret"], str) or not (20 <= len(char["secret"]) <= 300):
                raise ValueError(f"第{i + 1}个角色的秘密描述长度不符合要求（20-300字符）")
            if not isinstance(char["objective"], str) or not (10 <= len(char["objective"]) <= 200):
                raise ValueError(f"第{i + 1}个角色的目标描述长度不符合要求（10-200字符）")
            if (
                not isinstance(char["personality_traits"], list)
                or not (3 <= len(char["personality_traits"]) <= 5)
            ):
                raise ValueError(f"第{i + 1}个角色的性格特征必须是3-5个字符串的数组")
            if not isinstance(char["is_murderer"], bool):
                raise ValueError(f"第{i + 1}个角色的is_murderer字段必须是布尔值")
            if not isinstance(char["is_victim"], bool):
                raise ValueError(f"第{i + 1}个角色的is_victim字段必须是布尔值")

            for field in ["name", "background", "profession", "secret", "objective"]:
                if not char.get(field) or (
                    isinstance(char[field], str) and not char[field].strip()
                ):
                    raise ValueError(f"第{i + 1}个角色的{field}字段为空")

            if len(char.get("personality_traits", [])) < 3:
                raise ValueError(f"第{i + 1}个角色的性格特征不足3个")

        murderer_count = sum(1 for c in characters if c.get("is_murderer", False))
        victim_count = sum(1 for c in characters if c.get("is_victim", False))
        if murderer_count != 1:
            raise ValueError(f"凶手数量错误，应该有1个，实际有{murderer_count}个")
        if victim_count != 1:
            raise ValueError(f"受害者数量错误，应该有1个，实际有{victim_count}个")
