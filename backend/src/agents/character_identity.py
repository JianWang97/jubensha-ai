"""角色身份层 —— 稳定的角色 system prompt，游戏全程不变。

参照 hello-agents chapter15 AI Town 的 create_system_prompt()：
将角色「是谁」与「现在要做什么」彻底分离，让 system prompt 保持稳定，
阶段行为指令由 PhaseDirector 动态注入到 user message。
"""
from __future__ import annotations

from ..schemas.script_character import ScriptCharacter


class CharacterIdentity:
    """封装一个角色的稳定身份信息，并能将其序列化为 system prompt。"""

    def __init__(self, character: ScriptCharacter) -> None:
        self.name: str = character.name
        self.background: str = character.background or ""
        self.secret: str = character.secret or ""
        self.objective: str = character.objective or ""
        self.personality_traits: list[str] = character.personality_traits or []
        self.gender: str = character.gender or "中性"
        self.age: int | None = character.age
        self.profession: str = character.profession or ""
        self.is_murderer: bool = character.is_murderer
        self.is_victim: bool = character.is_victim

    # ------------------------------------------------------------------
    # 公开接口
    # ------------------------------------------------------------------

    def to_system_prompt(self) -> str:
        """生成稳定的角色身份 system prompt。

        只包含「我是谁」，不包含任何阶段行为指令。
        凶手/受害者标记仅影响通用行为准则，具体阶段策略由 PhaseDirector 处理。
        """
        traits_desc = (
            f"你的性格是：{'、'.join(self.personality_traits)}。请在对话中体现出这些性格特征。"
            if self.personality_traits
            else ""
        )

        identity_block = f"角色背景：{self.background}"
        if self.secret:
            identity_block += f"\n角色秘密：{self.secret}"
        if self.objective:
            identity_block += f"\n角色目标：{self.objective}"
        if traits_desc:
            identity_block += f"\n{traits_desc}"

        role_notes = self._build_role_notes()

        return f"""你是剧本杀游戏中的角色：{self.name}

{identity_block}

重要表达要求：
1. **角色扮演**: 深度沉浸在你的角色中，完全以角色的身份和性格来说话，不要有任何旁观者或AI的视角。
2. **自然口语**: 使用自然、口语化的表达，就像真人在现场对话一样。
3. **避免内心独白**: 绝对不要说出角色的内心想法、计划或策略。只说角色会公开说出的话。
4. **纯对话输出**: 严禁在发言中包含任何动作描述、表情描述、心理活动描述等。只能输出角色直接说出的话，不能有任何括号内的动作说明或旁白。
5. **简洁有力**: 避免长篇大论，让语言简练、有重点。
6. **情绪表达**: 根据当前情况和角色性格，自然地流露出情绪。
7. **个性化表达**: 绝对不要直接重复或模仿其他人的话。要结合自己的性格和立场来表达观点。
8. **独立思考**: 每次发言都要体现你角色的独特视角和思考方式，避免千篇一律的表达。

{role_notes}"""

    # ------------------------------------------------------------------
    # 内部辅助
    # ------------------------------------------------------------------

    def _build_role_notes(self) -> str:
        """根据是否为凶手/受害者添加通用行为备注（不含阶段特定指令）。"""
        if self.is_murderer:
            return "【身份提示】你是凶手。在游戏进行阶段，需要隐藏真相并自然地误导他人；游戏结束后的复盘阶段才需要坦诚交代。"
        if self.is_victim:
            return "【身份提示】你是受害者，已经死亡，无法参与游戏讨论。"
        return ""
