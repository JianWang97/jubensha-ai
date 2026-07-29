"""重构后的核心角色 Agent。

参照 hello-agents chapter15 AI Town NPCAgentManager.chat() 的三步流程：
  1. 从记忆检索上下文
  2. 构建增强消息（身份 system prompt + 记忆 + 阶段任务）
  3. 调用 LLM 生成回复
  4. 将结果存入私有记忆

与旧版 AIAgent 的关键差异：
  - system prompt = 只含稳定身份（CharacterIdentity），全程不变
  - user message  = 记忆上下文 + 阶段任务（PhaseDirector 动态构建）
  - memory        = 分层私有记忆（CharacterMemory）
  - observe()     = 被动接收他人发言，更新工作记忆
  - respond()     = 返回结构化 AgentResponse（JSON 输出，解析失败自动降级）
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from typing import Any

from ..schemas.script_character import ScriptCharacter
from ..schemas.game_phase import GamePhaseEnum as GamePhase
from ..services.llm_service import BaseLLMService, LLMMessage
from .character_identity import CharacterIdentity
from .character_memory import CharacterMemory
from .phase_director import PhaseDirector

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 结构化输出
# ---------------------------------------------------------------------------

@dataclass
class AgentResponse:
    """角色一次回应的结构化结果（对应 PhaseDirector 约定的 JSON 输出契约）。

    say             : 公开发言（唯一会广播给其他角色与前端的内容）
    action          : {"type": "search|question|none", "target": 地点名/角色名/None}
    reveal_evidence : 本角色选择公开的证据名称/id 列表
    vote            : 投票对象角色名（仅投票阶段填写）
    emotion         : 当前情绪一词
    """
    say: str
    action: dict[str, Any] | None = None
    reveal_evidence: list[str] = field(default_factory=list)
    vote: str | None = None
    emotion: str | None = None


# vote 字段中视为"未投票"的占位值
_INVALID_VOTE_VALUES = {"", "null", "none", "无", "暂无", "不投票"}


def _extract_json_object(text: str) -> dict[str, Any] | None:
    """从文本中提取第一个可解析的 JSON 对象。

    容忍 ```json 代码围栏和前后散文：逐个 "{" 起点做括号配平扫描，
    返回第一个 json.loads 成功且为 dict 的对象；全部失败返回 None。
    """
    start = text.find("{")
    while start != -1:
        depth = 0
        in_str = False
        escaped = False
        for i in range(start, len(text)):
            ch = text[i]
            if in_str:
                if escaped:
                    escaped = False
                elif ch == "\\":
                    escaped = True
                elif ch == '"':
                    in_str = False
            else:
                if ch == '"':
                    in_str = True
                elif ch == "{":
                    depth += 1
                elif ch == "}":
                    depth -= 1
                    if depth == 0:
                        try:
                            data = json.loads(text[start:i + 1])
                            if isinstance(data, dict):
                                return data
                        except (json.JSONDecodeError, ValueError):
                            pass
                        break  # 该起点配平成功但解析失败，尝试下一个起点
        start = text.find("{", start + 1)
    return None


def parse_agent_response(text: str) -> AgentResponse:
    """把 LLM 原始输出解析为 AgentResponse，任何失败都降级为纯文本发言。"""
    data = _extract_json_object(text)
    if data is None:
        return AgentResponse(say=text.strip() or "……")

    # say：JSON 中没有可用发言时退回原始全文
    say = data.get("say")
    if not isinstance(say, str) or not say.strip():
        say = text.strip() or "……"

    # action：校验 type 合法性，非法值按 none 处理
    action: dict[str, Any] | None = None
    raw_action = data.get("action")
    if isinstance(raw_action, dict):
        action_type = raw_action.get("type")
        if action_type not in ("search", "question", "none"):
            action_type = "none"
        target = raw_action.get("target")
        action = {
            "type": action_type,
            "target": str(target).strip() if target else None,
        }

    # reveal_evidence：统一成字符串列表
    raw_reveal = data.get("reveal_evidence")
    if isinstance(raw_reveal, list):
        reveal_evidence = [str(item).strip() for item in raw_reveal if item]
    elif isinstance(raw_reveal, str) and raw_reveal.strip():
        reveal_evidence = [raw_reveal.strip()]
    else:
        reveal_evidence = []

    # vote / emotion：非空字符串才有效
    raw_vote = data.get("vote")
    vote = (
        raw_vote.strip()
        if isinstance(raw_vote, str) and raw_vote.strip().lower() not in _INVALID_VOTE_VALUES
        else None
    )
    raw_emotion = data.get("emotion")
    emotion = raw_emotion.strip() if isinstance(raw_emotion, str) and raw_emotion.strip() else None

    return AgentResponse(
        say=say,
        action=action,
        reveal_evidence=reveal_evidence,
        vote=vote,
        emotion=emotion,
    )


class CharacterAgent:
    """三层分离的剧本杀角色 Agent。

    Layer 1 — identity   : 稳定的角色身份 system prompt
    Layer 2 — memory     : 角色私有记忆（工作记忆 + 个人日志 + 怀疑度）
    Layer 3 — director   : 无状态阶段任务指令构建器
    """

    def __init__(self, character: ScriptCharacter, llm: BaseLLMService) -> None:
        self.name: str = character.name
        self.identity = CharacterIdentity(character)
        self.memory = CharacterMemory()
        self._director = PhaseDirector()
        self._llm = llm  # 共享单例，由 CharacterAgentManager 注入

    # ------------------------------------------------------------------
    # 主动接口（GameEngine 调用）
    # ------------------------------------------------------------------

    async def respond(self, phase: GamePhase, game_state: dict[str, Any]) -> AgentResponse:
        """根据当前阶段和游戏状态生成角色发言（结构化输出）。

        参照 hello-agents NPCAgentManager.chat() 的完整流程。
        LLM 被要求输出 JSON（见 PhaseDirector 的输出契约）；
        解析失败时降级为纯文本发言，绝不向游戏循环抛异常。
        """
        # 1. system prompt = 稳定身份（全程不变）
        system_prompt = self.identity.to_system_prompt()

        # 2. user message = 记忆上下文 + 阶段专属内容 + 任务指令
        user_message = self._director.build_user_message(
            phase=phase,
            identity=self.identity,
            memory=self.memory,
            game_state=game_state,
        )

        # 3. LLM 调用
        messages = [
            LLMMessage(role="system", content=system_prompt),
            LLMMessage(role="user", content=user_message),
        ]
        try:
            llm_result = await self._llm.chat_completion(messages)
            raw_text = llm_result.content if llm_result and llm_result.content else "我需要仔细想想……"
        except Exception as exc:
            logger.error(f"[{self.name}] LLM 调用失败: {exc}")
            raw_text = "我现在有点困惑，让我整理一下思路……"

        # 4. 解析结构化输出（解析失败自动降级为纯文本发言）
        response = parse_agent_response(raw_text)

        logger.info(
            f"[{self.name}] 输出: {response.say[:80]}{'…' if len(response.say) > 80 else ''}"
            f" (action={response.action}, vote={response.vote}, reveal={response.reveal_evidence})"
        )

        # 5. 保存到私有日志（参照 hello-agents _save_conversation_to_memory）
        self.memory.record_personal_event(f"我说：{response.say}", importance=0.6)

        return response

    # ------------------------------------------------------------------
    # 被动接口（CharacterAgentManager 广播调用）
    # ------------------------------------------------------------------

    def observe(self, speaker: str, content: str) -> None:
        """观察他人发言，更新工作记忆，并做简单怀疑度推断。

        参照 hello-agents _save_conversation_to_memory：
        他人的发言存入工作记忆；若发言中提到自己名字，轻微上调怀疑度。
        """
        self.memory.observe_public_speech(speaker, content)

        # 简单启发式：被点名则上调对提问者的怀疑度（被怀疑 → 也怀疑对方）
        if self.name in content:
            self.memory.update_suspicion(speaker, delta=0.05)

    def record_evidence_found(self, evidence: dict[str, Any]) -> None:
        """记录自己搜到的证据：写入私有知识库 + 高重要性私有日志。

        证据私有化：此处只影响发现者自己的记忆，其他角色不会获知内容。
        """
        ev_name = evidence.get("name", "未知证据")
        ev_desc = evidence.get("description", "")
        self.memory.add_known_evidence(evidence)
        self.memory.record_personal_event(
            f"我搜到了证据「{ev_name}」：{ev_desc}（尚未公开，可以选择公开或隐瞒）",
            importance=0.9,
        )
