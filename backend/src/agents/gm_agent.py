"""GM Agent — 游戏主持人，负责动态规划游戏阶段流程。

职责：
  1. 分析剧本数据（角色数、证据量、场景数、难度），决定最优阶段序列
  2. 支持 LLM 驱动的动态规划，失败时回退到规则化默认计划
  3. 在阶段切换时生成 GM 旁白公告
  4. 为每个阶段提供定制化指令（gm_instructions），注入 PhaseDirector
"""
from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass, field
from typing import Any, Optional

from ..schemas.game_phase import GamePhaseEnum
from ..services.llm_service import BaseLLMService, LLMMessage

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 数据结构
# ---------------------------------------------------------------------------

@dataclass
class PhaseStep:
    """游戏阶段步骤，由 GM 动态规划而非硬编码。"""
    phase_type: GamePhaseEnum
    name: str
    description: str
    max_turns: Optional[int] = None
    gm_instructions: str = ""
    round_number: int = 1  # 同类型阶段的第几轮（如第 2 轮搜证）


# ---------------------------------------------------------------------------
# 默认阶段模板（规则化构建，不依赖 LLM）
# ---------------------------------------------------------------------------

def _build_default_plan(script_data: dict[str, Any]) -> list[PhaseStep]:
    """根据剧本数据用规则构建默认游戏计划。"""
    chars = [c for c in script_data.get("characters", []) if not c.get("is_victim")]
    char_count = max(len(chars), 1)
    evidence_count = len(script_data.get("evidence", []))
    location_count = len(script_data.get("locations", []))

    plan: list[PhaseStep] = [
        PhaseStep(
            GamePhaseEnum.BACKGROUND,
            "案件背景",
            "GM 介绍案件背景与游戏规则",
            max_turns=None,
        ),
        PhaseStep(
            GamePhaseEnum.INTRODUCTION,
            "角色自我介绍",
            "各角色依次进行自我介绍，建立初步印象",
            max_turns=char_count,
        ),
        PhaseStep(
            GamePhaseEnum.EVIDENCE_COLLECTION,
            "第一轮搜证",
            "玩家分赴各地点搜查关键线索",
            max_turns=max(char_count, location_count),
            round_number=1,
        ),
        PhaseStep(
            GamePhaseEnum.INVESTIGATION,
            "线索公开与调查",
            "公开搜证结果，互相盘问，交换信息",
            max_turns=char_count * 4,
        ),
    ]

    # 复杂剧本（证据≥8 或角色≥5）：在调查后加第二轮搜证
    if evidence_count >= 8 or char_count >= 5:
        plan.append(PhaseStep(
            GamePhaseEnum.EVIDENCE_COLLECTION,
            "第二轮搜证",
            "深入搜查，挖掘更多隐藏线索",
            max_turns=char_count,
            gm_instructions="此轮搜证是最后机会，请优先搜查尚未探索的地点。",
            round_number=2,
        ))
        plan.append(PhaseStep(
            GamePhaseEnum.INVESTIGATION,
            "深入调查",
            "综合两轮搜证结果，深入盘问嫌疑人",
            max_turns=char_count * 3,
            round_number=2,
        ))

    plan += [
        PhaseStep(
            GamePhaseEnum.DISCUSSION,
            "圆桌讨论",
            "自由辩论，综合所有线索推理出真凶",
            max_turns=char_count * 5,
        ),
        PhaseStep(
            GamePhaseEnum.VOTING,
            "最终投票",
            "每位玩家投出最终嫌疑人",
            max_turns=char_count + 3,
        ),
        PhaseStep(
            GamePhaseEnum.REVELATION,
            "真相揭晓",
            "复盘案件真相，凶手坦白，收获游戏体验",
            max_turns=char_count + 2,
        ),
    ]

    return plan


# ---------------------------------------------------------------------------
# GMAgent
# ---------------------------------------------------------------------------

class GMAgent:
    """游戏 GM Agent：动态规划阶段流程，并在阶段切换时生成旁白。"""

    def __init__(self, llm: BaseLLMService) -> None:
        self._llm = llm

    # ------------------------------------------------------------------
    # 主接口：创建游戏计划
    # ------------------------------------------------------------------

    async def create_game_plan(self, script_data: dict[str, Any]) -> list[PhaseStep]:
        """根据剧本数据生成阶段计划。优先用 LLM，失败时回退到规则计划。"""
        try:
            plan = await self._llm_create_plan(script_data)
            if plan:
                logger.info(f"[GMAgent] LLM 生成游戏计划（{len(plan)} 个阶段）: "
                            f"{[s.name for s in plan]}")
                return plan
        except Exception as exc:
            logger.warning(f"[GMAgent] LLM 规划失败，使用默认计划: {exc}")

        plan = _build_default_plan(script_data)
        logger.info(f"[GMAgent] 使用默认游戏计划（{len(plan)} 个阶段）: "
                    f"{[s.name for s in plan]}")
        return plan

    # ------------------------------------------------------------------
    # 阶段公告生成
    # ------------------------------------------------------------------

    async def generate_phase_announcement(
        self, step: PhaseStep, game_state: dict[str, Any]
    ) -> str:
        """生成阶段开场白（GM 作为叙述者发言）。"""
        if step.phase_type == GamePhaseEnum.BACKGROUND:
            return ""  # 背景阶段由引擎自身处理

        characters = game_state.get("characters", [])
        char_names = [c["name"] if isinstance(c, dict) else str(c) for c in characters]
        char_list = "、".join(char_names) if char_names else "各位"

        static_announcements: dict[GamePhaseEnum, str] = {
            GamePhaseEnum.INTRODUCTION: (
                f"现在进入【角色介绍】阶段。请{char_list}依次进行自我介绍，"
                f"让其他人了解你的身份和立场。"
            ),
            GamePhaseEnum.INVESTIGATION: (
                "搜证阶段结束。请大家公开搜查到的线索，并展开盘问调查。"
            ),
            GamePhaseEnum.DISCUSSION: (
                "现在进入【圆桌讨论】阶段。请大家综合所有已知线索，"
                "深入推理，指出你的怀疑对象并说明理由。"
            ),
            GamePhaseEnum.VOTING: (
                "讨论结束。现在进入【最终投票】阶段，请每位嘉宾说出你的最终判断，"
                "并明确投票给你认为是凶手的人。"
            ),
            GamePhaseEnum.REVELATION: (
                "投票已完成。现在是【真相揭晓】时刻——"
            ),
        }

        if step.phase_type == GamePhaseEnum.EVIDENCE_COLLECTION:
            round_label = f"第{step.round_number}轮" if step.round_number > 1 else ""
            return (
                f"现在进入【{round_label}搜证】阶段。"
                f"请{char_list}分头前往不同地点搜查线索，"
                f"每次只能搜查一个地点。"
            )

        return static_announcements.get(step.phase_type, f"进入【{step.name}】阶段。")

    # ------------------------------------------------------------------
    # LLM 驱动的计划生成（内部）
    # ------------------------------------------------------------------

    async def _llm_create_plan(self, script_data: dict[str, Any]) -> list[PhaseStep] | None:
        """用 LLM 分析剧本并生成阶段计划（JSON 格式）。"""
        info = script_data.get("script_info", {})
        chars = [c["name"] for c in script_data.get("characters", []) if not c.get("is_victim")]
        evidence_count = len(script_data.get("evidence", []))
        location_count = len(script_data.get("locations", []))

        system_prompt = """你是专业的剧本杀 GM（游戏主持人），根据剧本信息为本局游戏设计最佳阶段流程。

可用阶段类型（枚举值）：
- BACKGROUND        背景介绍（必须且只能有 1 次，必须排第一）
- INTRODUCTION      角色自我介绍（必须且只能有 1 次，紧跟背景之后）
- EVIDENCE_COLLECTION  搜证阶段（可 1-2 次，证据多时可安排两轮）
- INVESTIGATION     线索公开与调查（可 1-2 次，配合搜证使用）
- DISCUSSION        圆桌讨论（可 1-2 次）
- VOTING            最终投票（必须且只能有 1 次，在 DISCUSSION 之后）
- REVELATION        真相揭晓（必须且只能有 1 次，必须排最后）

输出 JSON 数组，每项格式：
{
  "phase_type": "<枚举值>",
  "name": "<阶段显示名称>",
  "description": "<阶段简介>",
  "max_turns": <整数或 null>,
  "gm_instructions": "<给角色的特殊提示，可为空字符串>"
}

设计原则：
1. 简单剧本（证据≤5）：一轮搜证 + 一轮调查
2. 复杂剧本（证据≥8 或角色≥5）：两轮搜证，每轮搜证后各有一次调查
3. max_turns 根据角色数量合理设置（角色数×倍数），BACKGROUND/REVELATION 可填 null
4. gm_instructions 是帮助角色更好完成该阶段任务的额外提示
5. 只输出 JSON 数组，不要任何额外文字"""

        context = (
            f"剧本标题：{info.get('title', '未知')}\n"
            f"剧本描述：{info.get('description', '')}\n"
            f"玩家角色（{len(chars)} 人）：{', '.join(chars)}\n"
            f"证据数量：{evidence_count}\n"
            f"场景数量：{location_count}\n"
            f"难度：{info.get('difficulty', 'medium')}"
        )

        messages = [
            LLMMessage(role="system", content=system_prompt),
            LLMMessage(role="user", content=context),
        ]

        response = await self._llm.chat_completion(messages)
        if not response or not response.content:
            return None

        text = response.content.strip()
        match = re.search(r'\[.*\]', text, re.DOTALL)
        if not match:
            logger.warning("[GMAgent] LLM 返回内容中未找到 JSON 数组")
            return None

        try:
            data = json.loads(match.group())
        except json.JSONDecodeError as exc:
            logger.warning(f"[GMAgent] JSON 解析失败: {exc}")
            return None

        steps = self._parse_steps(data)
        if steps is None:
            return None

        return steps

    def _parse_steps(self, data: list[dict]) -> list[PhaseStep] | None:
        """将 LLM 返回的 dict 列表转换为 PhaseStep 列表，并校验必要阶段。"""
        steps: list[PhaseStep] = []
        type_counters: dict[GamePhaseEnum, int] = {}

        for item in data:
            phase_str = item.get("phase_type", "")
            try:
                phase_type = GamePhaseEnum(phase_str)
            except ValueError:
                logger.warning(f"[GMAgent] 未知阶段类型，跳过: {phase_str}")
                continue

            type_counters[phase_type] = type_counters.get(phase_type, 0) + 1
            round_number = type_counters[phase_type]

            step = PhaseStep(
                phase_type=phase_type,
                name=item.get("name", phase_str),
                description=item.get("description", ""),
                max_turns=item.get("max_turns"),
                gm_instructions=item.get("gm_instructions", ""),
                round_number=round_number,
            )
            steps.append(step)

        # 校验必须包含的阶段
        required = {
            GamePhaseEnum.BACKGROUND,
            GamePhaseEnum.INTRODUCTION,
            GamePhaseEnum.VOTING,
            GamePhaseEnum.REVELATION,
        }
        present = {s.phase_type for s in steps}
        missing = required - present
        if missing:
            logger.warning(f"[GMAgent] LLM 计划缺少必要阶段 {missing}，拒绝使用")
            return None

        # 校验顺序：BACKGROUND 第一，REVELATION 最后
        if steps[0].phase_type != GamePhaseEnum.BACKGROUND:
            logger.warning("[GMAgent] LLM 计划首阶段不是 BACKGROUND，拒绝使用")
            return None
        if steps[-1].phase_type != GamePhaseEnum.REVELATION:
            logger.warning("[GMAgent] LLM 计划末阶段不是 REVELATION，拒绝使用")
            return None

        return steps
