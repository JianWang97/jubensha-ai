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
from .agent_tools import tools_for_phase

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
- 必须调用 search_location 工具选定要搜查的地点名称（发言中也可说明，如"我要搜查书房"）
- 可以简要说明搜查理由，但不要透露过多策略
- 一次只能搜查一个地方
- 搜到的线索默认只有你自己知道，之后你可以选择公开或隐瞒""",

    GamePhase.INVESTIGATION: """现在是【线索公开与调查】阶段
你的任务：基于你已掌握的线索，进行信息交换和初步推理。

发言策略：
- 如果你刚搜到线索：可以选择公开线索内容并解读，也可以暂时隐瞒
- 如果你要提问：向具体角色提出针对性问题（如"张三，你昨晚在哪里？"）
- 如果你要回答：诚实回答他人问题（凶手可适当隐瞒）
- 如果你要分析：结合线索进行逻辑推理，但避免过早下定论

注意事项：
- 问题要有针对性，能推进案件调查
- 根据已发现的证据来提问和分析
- 你可以选择公开你掌握的证据（调用 reveal_evidence 工具），也可以暂时隐瞒
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
- 你可以选择公开你掌握的证据（调用 reveal_evidence 工具），也可以暂时隐瞒
- 避免直接重复他人的话，要有自己的独特观点
- 保持逻辑清晰，做到有理有据""",

    GamePhase.VOTING: """现在是【最终投票与陈述】阶段
你的任务：做出最终判断，找出真凶。

发言流程：
- 投票前陈述：总结你的最终逻辑，明确指出将要投给谁及理由
- 正式投票：明确说出你投票的对象（如"我投票给张三"）
- 票后陈述：如果被质疑，为自己进行最后的辩解

指令要求：
- 必须调用 cast_vote 工具投出你的投票对象
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
# 回应方式说明（行动走原生 tool calling，发言走回复正文；
# 解析端见 character_agent.CharacterAgent._build_response / agent_tools）
# ---------------------------------------------------------------------------

# 有工具的阶段（搜证 / 调查 / 讨论 / 投票）
_OUTPUT_FORMAT_TOOLS = """**=== 回应方式（严格遵守）===**
- 公开发言：直接作为回复正文输出，保持你的角色口吻；不要输出 JSON、代码围栏或任何格式标记。
- 游戏行动：通过调用系统提供的工具完成（不要只在文字里描述）；没有想做的行动时可以不调用任何工具。
**=================**"""

# 无工具的阶段（背景 / 自我介绍 / 复盘）
_OUTPUT_FORMAT_PLAIN = """**=== 回应方式（严格遵守）===**
- 直接把你的公开发言作为回复正文输出，保持你的角色口吻。
- 不要输出 JSON、代码围栏或任何格式标记。
**=================**"""

# 各阶段对工具使用的补充要求（追加在回应方式说明之后）
_PHASE_OUTPUT_HINTS: dict[GamePhase, str] = {
    GamePhase.EVIDENCE_COLLECTION: (
        "本阶段要搜证时，调用 search_location 工具，location 填要搜查的地点名。"
    ),
    GamePhase.INVESTIGATION: (
        "本阶段可以用 ask_question 工具质询（target 填被提问的角色名，question 填问题内容），"
        "也可以用 reveal_evidence 工具公开你掌握的证据（evidence_names 只能填你自己掌握的证据名称），"
        "也可以都不用、只发言。"
    ),
    GamePhase.DISCUSSION: (
        "可以用 ask_question 工具质询，或用 reveal_evidence 工具公开你掌握的证据"
        "（evidence_names 只能填你自己掌握的证据名称），暂不公开则不调用、只发言。"
    ),
    GamePhase.VOTING: (
        "本阶段必须调用 cast_vote 工具投票（suspect 填你指认的角色名），并在发言中说明理由。"
    ),
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
          [本角色可见的证据（已公开的 + 自己私藏的）]
          [当前阶段核心任务指令]
          [回应方式说明（tool calling）]
          [GM 特殊指令（可选）]
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

        # 3. 证据上下文：只包含本角色可见的证据（公开 + 私藏），不再全量广播
        evidence_ctx = self._build_evidence_context(memory, game_state)
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
            task += "\n\n【凶手提示】继续隐藏你的身份，自然地将怀疑引向他人；你可以隐瞒或选择性公开自己掌握的证据，在发言中也可以说谎。"

        parts.append(f"【当前阶段：{phase.value}】\n\n**=== 你的核心任务 ===**\n{task}\n**====================**")

        # 5. 回应方式说明（有工具的阶段说明 tool calling，无工具阶段只要求直接发言）
        has_tools = bool(tools_for_phase(phase))
        output_block = _OUTPUT_FORMAT_TOOLS if has_tools else _OUTPUT_FORMAT_PLAIN
        output_hint = _PHASE_OUTPUT_HINTS.get(phase)
        if output_hint:
            output_block += f"\n{output_hint}"
        parts.append(output_block)

        # 6. GM 特殊指令（来自 PhaseStep.gm_instructions）
        gm_instructions = game_state.get("gm_instructions", "").strip()
        if gm_instructions:
            parts.append(f"【GM 特别提示】{gm_instructions}")

        if has_tools:
            parts.append("请严格按照你的核心任务进行回应：公开发言直接作为正文输出，行动通过调用工具完成。")
        else:
            parts.append("请严格按照你的核心任务进行回应，直接输出你的发言。")

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
        """构建搜证阶段的地点列表：显示可搜查 vs 已搜查。"""
        search_status: dict[str, str] = game_state.get("evidence_search_status", {})

        # 优先使用 game_state 中的 all_locations，否则从证据中推断
        all_locations: list[str] = list(game_state.get("all_locations", []))
        if not all_locations:
            all_locations = sorted({
                ev["location"]
                for ev in game_state.get("evidence", [])
                if ev.get("location")
            })

        available = [loc for loc in all_locations if loc not in search_status]
        searched = {loc: searcher for loc, searcher in search_status.items()
                    if loc in all_locations or loc in search_status}

        if not available:
            return "所有地点都已搜查完毕。请等待其他玩家或考虑提问。"

        lines = [f"- {loc}" for loc in available]
        result = "**本轮可搜查的地点（每次只能搜一处）：**\n" + "\n".join(lines)

        if searched:
            s_lines = [f"- {loc}（{searcher}已搜查）" for loc, searcher in searched.items()]
            result += "\n\n**已搜查的地点：**\n" + "\n".join(s_lines)

        result += "\n\n请调用 search_location 工具选定你要搜查的地点（发言中也可说明，如「我要搜查书房」）。每次只能选一个地点。"
        return result

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
    def _build_evidence_context(memory: "CharacterMemory", game_state: dict[str, Any]) -> str:
        """构建本角色可见的证据上下文。

        证据私有化：
          - revealed_evidence —— 已被任意角色公开的证据（所有人都知道）
          - memory.known_evidence —— 本角色自己搜到、尚未公开的私藏证据
        未公开且非本角色搜到的证据不会出现在 prompt 中。
        """
        revealed = game_state.get("revealed_evidence", [])
        # 已公开的证据从私藏列表中剔除，避免提示词仍声称其"尚未公开"
        revealed_keys = {ev.get("id", ev.get("name")) for ev in revealed}
        private = [
            ev for ev in getattr(memory, "known_evidence", [])
            if ev.get("id", ev.get("name")) not in revealed_keys
        ]
        if not revealed and not private:
            return ""

        parts: list[str] = []
        if revealed:
            lines = [f"- {ev['name']}：{ev.get('description', '')}" for ev in revealed]
            parts.append("**已公开的证据（所有人都知道）：**\n" + "\n".join(lines))
        if private:
            lines = [f"- {ev['name']}：{ev.get('description', '')}" for ev in private]
            parts.append(
                "**你私下掌握的证据（尚未公开，其他人不知道）：**\n" + "\n".join(lines)
                + "\n你可以选择公开这些证据（调用 reveal_evidence 工具），也可以继续隐瞒。"
            )
        return "\n\n".join(parts)
