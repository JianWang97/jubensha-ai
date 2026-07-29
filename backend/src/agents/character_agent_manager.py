"""角色 Agent 管理器。

参照 hello-agents chapter15 NPCAgentManager，
负责：
  1. 批量创建 CharacterAgent（初始化）
  2. 调用指定角色发言（respond）
  3. 广播发言给其他所有角色（broadcast_speech）
  4. 代理旧 AIAgent 接口，保持与 GameEngine 的兼容性
"""
from __future__ import annotations

import logging
from typing import Any

from ..schemas.script_character import ScriptCharacter
from ..schemas.game_phase import GamePhaseEnum as GamePhase
from ..services.llm_service import get_llm_service
from .character_agent import AgentResponse, CharacterAgent

logger = logging.getLogger(__name__)


class CharacterAgentManager:
    """管理所有角色 Agent 的生命周期和通信。

    参照 hello-agents NPCAgentManager，核心设计：
    - agents dict  : {角色名 → CharacterAgent}
    - respond()    : 调用指定角色生成发言，并自动广播给其他角色
    - broadcast()  : 将外部（系统/搜证结果）消息广播给所有角色
    """

    def __init__(self) -> None:
        self._agents: dict[str, CharacterAgent] = {}
        # 所有角色共享同一个 LLMService 实例（避免每个 Agent 持有独立连接池）
        # 通过DI容器解析全局单例；容器未配置时回退到按配置创建
        self._shared_llm = get_llm_service()

    # ------------------------------------------------------------------
    # 初始化
    # ------------------------------------------------------------------

    def create_agents(self, characters: list[ScriptCharacter]) -> None:
        """为非受害者角色批量创建 CharacterAgent。

        参照 hello-agents NPCAgentManager._create_agents()。
        """
        for character in characters:
            if character.is_victim:
                continue
            try:
                self._agents[character.name] = CharacterAgent(character, self._shared_llm)
                logger.info(f"[CharacterAgentManager] 创建角色 Agent: {character.name}")
            except Exception as exc:
                logger.error(f"[CharacterAgentManager] 创建 {character.name} 失败: {exc}")

    # ------------------------------------------------------------------
    # 主动接口（GameEngine 调用）
    # ------------------------------------------------------------------

    async def respond(
        self, name: str, phase: GamePhase, game_state: dict[str, Any]
    ) -> AgentResponse:
        """让指定角色根据阶段和游戏状态发言，并将公开发言广播给其他角色。

        参照 hello-agents NPCAgentManager.chat() 的广播机制。
        返回结构化 AgentResponse；只有 say 会广播，vote/emotion 等内部字段不外泄。
        """
        agent = self._agents.get(name)
        if agent is None:
            logger.error(f"[CharacterAgentManager] 未找到角色: {name}")
            return AgentResponse(say=f"{name} 暂时无法发言。")

        response = await agent.respond(phase, game_state)

        # 只广播公开发言给其他角色，更新其工作记忆
        self.broadcast_speech(speaker=name, content=response.say)

        return response

    def broadcast_speech(self, speaker: str, content: str) -> None:
        """将一条发言广播给除发言者以外的所有角色。

        参照 hello-agents 的多 Agent 观察机制。
        """
        for name, agent in self._agents.items():
            if name != speaker:
                agent.observe(speaker, content)

    def broadcast_system_message(self, content: str) -> None:
        """将系统消息（如证据公布）广播给所有角色。"""
        for agent in self._agents.values():
            agent.memory.observe_public_speech("系统", content)

    def notify_evidence_found(self, finder: str, evidence: dict) -> None:
        """搜证结果私有化：仅发现者记录到私有知识，其他角色不被告知证据内容。

        公开渠道（前端/其他角色的工作记忆）只会有"XX搜查了某地"的动作信息，
        由 GameEngine 通过 add_public_chat / broadcast_system_message 另行广播。
        """
        finder_agent = self._agents.get(finder)
        if finder_agent:
            finder_agent.record_evidence_found(evidence)

    # ------------------------------------------------------------------
    # 兼容性接口（保持 GameEngine 现有调用方式）
    # ------------------------------------------------------------------

    def keys(self):
        return self._agents.keys()

    def __contains__(self, name: str) -> bool:
        return name in self._agents

    def __len__(self) -> int:
        return len(self._agents)

    def __getitem__(self, name: str) -> CharacterAgent:
        return self._agents[name]

    def get(self, name: str) -> CharacterAgent | None:
        return self._agents.get(name)
