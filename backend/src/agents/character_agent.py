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
"""
from __future__ import annotations

import logging
from typing import Any

from ..schemas.script_character import ScriptCharacter
from ..schemas.game_phase import GamePhaseEnum as GamePhase
from ..services.llm_service import LLMService, LLMMessage
from ..core.config import config
from .character_identity import CharacterIdentity
from .character_memory import CharacterMemory
from .phase_director import PhaseDirector

logger = logging.getLogger(__name__)


class CharacterAgent:
    """三层分离的剧本杀角色 Agent。

    Layer 1 — identity   : 稳定的角色身份 system prompt
    Layer 2 — memory     : 角色私有记忆（工作记忆 + 个人日志 + 怀疑度）
    Layer 3 — director   : 无状态阶段任务指令构建器
    """

    def __init__(self, character: ScriptCharacter) -> None:
        self.name: str = character.name
        self.identity = CharacterIdentity(character)
        self.memory = CharacterMemory()
        self._director = PhaseDirector()
        self._llm = LLMService.from_config(config.llm_config)

    # ------------------------------------------------------------------
    # 主动接口（GameEngine 调用）
    # ------------------------------------------------------------------

    async def respond(self, phase: GamePhase, game_state: dict[str, Any]) -> str:
        """根据当前阶段和游戏状态生成角色发言。

        参照 hello-agents NPCAgentManager.chat() 的完整流程。
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
            response = await self._llm.chat_completion(messages)
            reply = response.content if response and response.content else "我需要仔细想想……"
        except Exception as exc:
            logger.error(f"[{self.name}] LLM 调用失败: {exc}")
            reply = "我现在有点困惑，让我整理一下思路……"

        logger.info(f"[{self.name}] 输出: {reply[:80]}{'…' if len(reply) > 80 else ''}")

        # 4. 保存到私有日志（参照 hello-agents _save_conversation_to_memory）
        self.memory.record_personal_event(f"我说：{reply}", importance=0.6)

        return reply

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

    def record_evidence_found(self, evidence_name: str, description: str) -> None:
        """记录自己搜到的证据（调用 record_personal_event 高重要性版本）。"""
        self.memory.record_personal_event(
            f"我搜到了证据「{evidence_name}」：{description}",
            importance=0.9,
        )
