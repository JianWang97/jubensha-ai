"""阶段任务指令层（PhaseDirector）。

参照 hello-agents chapter15 enhanced_message 构建逻辑，
将原 AIAgent._build_context() 中的八路 if/elif 彻底解耦为独立模块。

职责：
  - 根据 GamePhase + CharacterIdentity + CharacterMemory + game_state
    构建注入给 LLM 的 user message（纯函数，无状态）。
  - 阶段任务 prompt 集中在一处管理，易于独立调整和测试。
"""
from __future__ import annotations

from typing import TYPE_CHECKING, Any

from ..schemas.game_phase import GamePhaseEnum as GamePhase

if TYPE_CHECKING:
    from .character_identity import CharacterIdentity
    from .character_memory import CharacterMemory


# ---------------------------------------------------------------------------
# 各阶段核心任务指令（独立于角色身份，可在此处集中调整）
# ---------------------------------------------------------------------------

_PHASE_TASKS: dict[GamePhase, str] = {
    GamePhase.BACKGROUND: "现在是背景介绍阶段。你需要保持沉默，等待系统介绍完毕。",

    GamePhase.INTRODUCTION: """现在是【角色介绍】阶段 - 第一轮发言
你的任务：按照轮流发言的顺序，简洁介绍你的角色形象。

发言要点：
- 我是谁：介绍角色姓名、身份、与其他玩家的关系
- 我的时间线：简述案发前后的个人行动轨迹
- 我的视角：描述你了解的案件信息或发现的异常情况

注意事项：
- 此阶段不允许打断，按顺序完成发言
- 只说公开的身份信息，绝对不要透露秘密
- 如果你是凶手，需要进行伪装性发言隐藏身份
- 体现你的性格特点，为后续留下悬念""",

    GamePhase.EVIDENCE_COLLECTION: """现在是【搜证调查】阶段
你的任务：选择一个具体的地点或物品进行搜查，为后续线索公开做准备。

指令要求：
- 必须明确说出要搜查的地点名称（如"我要搜查书房"、"我检查一下花瓶"）
- 可以简要说明搜查理由，但不要透露过多策略
- 一次只能搜查一个地方
- 搜到的线索将在下一阶段公开展示""",

    GamePhase.INVESTIGATION: """现在是【线索公开与调查】阶段
你的任务：基于已公开的线索，进行信息交换和初步推理。

发言策略：
- 如果你刚搜到线索：清晰念出线索内容，进行初步解读
- 如果你要提问：向具体角色提出针对性问题（如"张三，你昨晚在哪里？"）
- 如果你要回答：诚实回答他人问题（凶手可适当隐瞒）
- 如果你要分析：结合线索进行逻辑推理，但避免过早下定论

注意事项：
- 问题要有针对性，能推进案件调查
- 根据已发现的证据来提问和分析
- 避免重复提问相同问题""",

    GamePhase.DISCUSSION: """现在是【圆桌讨论】阶段 - 核心推理环节
你的任务：进行深入的推理分析和自由讨论。

发言模式：
- 集中讨论：基于所有已知线索，阐述你的观点和怀疑对象
- 自由辩论：针对疑点和矛盾进行深入讨论和对质
- 逻辑推理：结合证据进行有理有据的推理
- 立场表达：适时"跳车"与"站队"，灵活调整怀疑对象

发言要求：
- 可以提出自己的推理和怀疑
- 可以反驳或支持他人的观点，但要加上自己的理由
- 要结合已发现的证据来论证
- 避免直接重复他人的话，要有自己的独特观点
- 保持逻辑清晰，做到有理有据""",

    GamePhase.VOTING: """现在是【最终投票与陈述】阶段
你的任务：做出最终判断，找出真凶。

发言流程：
- 投票前陈述：总结你的最终逻辑，明确指出将要投给谁及理由
- 正式投票：明确说出你投票的对象（如"我投票给张三"）
- 票后陈述：如果被质疑，为自己进行最后的辩解

指令要求：
- 必须明确说出你投票的对象
- 说明你的核心理由（1-2个最重要的证据或逻辑）
- 要坚定表达你的判断
- 不要犹豫不决或说"我不知道是谁"之类的模糊表达""",

    GamePhase.REVELATION: """现在是【真相复盘】阶段
你的任务：根据游戏结果分享你的最终想法和心路历程。

**重要：此阶段游戏已结束，应该诚实分享真相，不再需要隐瞒。**

发言内容：
- 如果你是凶手：应该坦白承认罪行，详细解释作案动机、手法和心路历程
- 如果你是无辜者：分享你的感受和对真相的看法
- 可以透露之前隐藏的秘密（如果不是犯罪相关）
- 分享你在游戏中的心路历程和未能解开的疑惑

注意事项：
- 此阶段可以自由提问和讨论
- 诚实分享你的游戏体验和真实想法
- 如果你是凶手，请详细说明你的作案过程，让大家了解完整真相""",
}


# ---------------------------------------------------------------------------
# PhaseDirector
# ---------------------------------------------------------------------------

class PhaseDirector:
    """无状态的阶段任务指令构建器（纯函数）。

    参照 hello-agents 中 enhanced_message 的构建逻辑，
    把「现在要做什么」与角色「是谁」完全解耦。
    """

    def build_user_message(
        self,
        phase: GamePhase,
        identity: "CharacterIdentity",
        memory: "CharacterMemory",
        game_state: dict[str, Any],
    ) -> str:
        """构建完整的 user message，注入记忆 + 阶段任务 + 游戏状态。

        结构（参照 hello-agents enhanced_message）：
          [记忆上下文]
          [阶段专属内容（可搜证地点 / 投票候选人等）]
          [已发现的证据]
          [当前阶段核心任务指令]
        """
        parts: list[str] = []

        # 1. 角色私有记忆（工作记忆 + 个人日志 + 怀疑度）
        include_suspicions = phase in (GamePhase.DISCUSSION, GamePhase.VOTING)
        memory_ctx = memory.build_memory_context(include_suspicions=include_suspicions)
        if memory_ctx:
            parts.append(memory_ctx)

        # 2. 阶段专属补充内容
        phase_extra = self._build_phase_extra(phase, identity, game_state)
        if phase_extra:
            parts.append(phase_extra)

        # 3. 已发现的证据
        evidence_ctx = self._build_evidence_context(game_state)
        if evidence_ctx:
            parts.append(evidence_ctx)

        # 4. 核心阶段任务（放在最后，最靠近 LLM 的生成，确保遵循）
        task = _PHASE_TASKS.get(phase, "请根据当前情况做出回应。")

        # 凶手在复盘阶段需要特殊提示
        if identity.is_murderer and phase == GamePhase.REVELATION:
            task = task.replace(
                "如果你是凶手：应该坦白承认罪行",
                "**你就是凶手，必须坦白承认罪行**"
            )
        # 凶手在投票前不要暴露
        elif identity.is_murderer and phase in (GamePhase.INVESTIGATION, GamePhase.DISCUSSION, GamePhase.VOTING):
            task += "\n\n【凶手提示】继续隐藏你的身份，自然地将怀疑引向他人。"

        parts.append(f"【当前阶段：{phase.value}】\n\n**=== 你的核心任务 ===**\n{task}\n**====================**")

        parts.append("请严格按照你的核心任务进行回应，只说角色会说的话。")

        return "\n\n".join(parts)

    # ------------------------------------------------------------------
    # 内部辅助
    # ------------------------------------------------------------------

    def _build_phase_extra(
        self,
        phase: GamePhase,
        identity: "CharacterIdentity",
        game_state: dict[str, Any],
    ) -> str:
        """为特定阶段提供额外的游戏状态信息（可搜地点、投票对象等）。"""

        if phase == GamePhase.EVIDENCE_COLLECTION:
            return self._build_searchable_locations(game_state)

        if phase == GamePhase.INVESTIGATION:
            return self._build_queryable_characters(identity, game_state)

        if phase == GamePhase.VOTING:
            return self._build_voting_candidates(identity, game_state)

        # 其他阶段禁止搜证提示
        if phase not in (GamePhase.BACKGROUND, GamePhase.REVELATION):
            return "**注意：当前不是搜证阶段，绝对禁止提出任何搜证要求。**"

        return ""

    def _build_searchable_locations(self, game_state: dict[str, Any]) -> str:
        discovered_ids = {e["id"] for e in game_state.get("discovered_evidence", [])}
        searchable = sorted({
            ev["location"]
            for ev in game_state.get("evidence", [])
            if ev["id"] not in discovered_ids
        })
        if not searchable:
            return "所有地点都已搜查完毕。请等待其他玩家行动。"
        locations_str = "\n".join(f"- {loc}" for loc in searchable)
        return (
            f"**你可以搜查的地点：**\n{locations_str}\n\n"
            "请从上述地点中选择一个进行搜查。直接说出你的选择，例如：'我要搜查书房'。"
        )

    def _build_queryable_characters(
        self, identity: "CharacterIdentity", game_state: dict[str, Any]
    ) -> str:
        others = self._get_active_others(identity, game_state)
        if not others:
            return ""
        return (
            f"**【可询问角色】：**{', '.join(others)}\n"
            "请选择一个角色并提出具体问题，例如：'张三，你昨晚几点睡的？'"
        )

    def _build_voting_candidates(
        self, identity: "CharacterIdentity", game_state: dict[str, Any]
    ) -> str:
        candidates = self._get_active_others(identity, game_state)
        if not candidates:
            return ""
        return (
            f"**【投票对象】：**{', '.join(candidates)}\n"
            "请明确说出你的投票选择，例如：'我投票给张三，因为……'。"
        )

    @staticmethod
    def _get_active_others(
        identity: "CharacterIdentity", game_state: dict[str, Any]
    ) -> list[str]:
        result: list[str] = []
        for char in game_state.get("characters", []):
            name = char.get("name") if isinstance(char, dict) else str(char)
            is_victim = char.get("is_victim", False) if isinstance(char, dict) else False
            if name and name != identity.name and not is_victim:
                result.append(name)
        return result

    @staticmethod
    def _build_evidence_context(game_state: dict[str, Any]) -> str:
        discovered = game_state.get("discovered_evidence", [])
        if not discovered:
            return ""
        lines = [f"- {ev['name']}：{ev['description']}" for ev in discovered]
        return "**已发现的全部证据：**\n" + "\n".join(lines)
