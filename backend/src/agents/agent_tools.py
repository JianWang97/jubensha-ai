"""角色 Agent 的游戏行动工具定义（OpenAI function calling 范式）。

角色的行动（搜证 / 质询 / 公开证据 / 投票）从"prompt 约定 JSON 输出"
改为原生 tool calling：
  - tools_for_phase(phase)  返回该阶段应向 LLM 提供的 tools 数组
  - apply_tool_calls(...)   把（可能多个）tool call 合并进一个 AgentResponse

不支持 tool calling 的模型由 CharacterAgent.respond 回退到旧版 JSON 输出契约
（parse_agent_response），本模块不参与该兜底路径。
"""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from ..schemas.game_phase import GamePhaseEnum as GamePhase

if TYPE_CHECKING:
    from ..services.llm_service import ToolCall
    from .character_agent import AgentResponse

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 工具 schema（OpenAI function 格式）
# ---------------------------------------------------------------------------

_SEARCH_LOCATION_TOOL: dict[str, Any] = {
    "type": "function",
    "function": {
        "name": "search_location",
        "description": "搜查一个地点或物品以寻找案件线索。仅在搜证阶段可用，一次只能搜查一处。",
        "parameters": {
            "type": "object",
            "properties": {
                "location": {
                    "type": "string",
                    "description": "要搜查的地点或物品名称，必须来自本轮可搜查列表",
                },
            },
            "required": ["location"],
        },
    },
}

_ASK_QUESTION_TOOL: dict[str, Any] = {
    "type": "function",
    "function": {
        "name": "ask_question",
        "description": "向另一名角色提出针对性的质询问题。问题内容会作为你的公开发言被所有人听到。",
        "parameters": {
            "type": "object",
            "properties": {
                "target": {
                    "type": "string",
                    "description": "被提问的角色名，必须是在场的其他角色之一",
                },
                "question": {
                    "type": "string",
                    "description": "要问对方的具体问题",
                },
            },
            "required": ["target", "question"],
        },
    },
}

_REVEAL_EVIDENCE_TOOL: dict[str, Any] = {
    "type": "function",
    "function": {
        "name": "reveal_evidence",
        "description": (
            "公开你掌握的证据，公开后所有角色都会知道其内容。"
            "evidence_names 必须来自你自己搜到/已知的证据名称，不能编造不存在的证据。"
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "evidence_names": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "要公开的证据名称列表（必须是你自己掌握的证据）",
                },
            },
            "required": ["evidence_names"],
        },
    },
}

_CAST_VOTE_TOOL: dict[str, Any] = {
    "type": "function",
    "function": {
        "name": "cast_vote",
        "description": "投出你认为是凶手的人。仅在投票阶段可用，suspect 必须是投票候选人之一。",
        "parameters": {
            "type": "object",
            "properties": {
                "suspect": {
                    "type": "string",
                    "description": "你投票指认的角色名",
                },
            },
            "required": ["suspect"],
        },
    },
}


# ---------------------------------------------------------------------------
# 阶段 → 可用工具映射（INTRODUCTION / REVELATION 等阶段无工具）
# ---------------------------------------------------------------------------

_PHASE_TOOLS: dict[GamePhase, tuple[dict[str, Any], ...]] = {
    GamePhase.EVIDENCE_COLLECTION: (_SEARCH_LOCATION_TOOL,),
    GamePhase.INVESTIGATION: (_ASK_QUESTION_TOOL, _REVEAL_EVIDENCE_TOOL),
    GamePhase.DISCUSSION: (_ASK_QUESTION_TOOL, _REVEAL_EVIDENCE_TOOL),
    GamePhase.VOTING: (_CAST_VOTE_TOOL,),
}


def tools_for_phase(phase: GamePhase) -> list[dict[str, Any]]:
    """返回该阶段应向 LLM 提供的 OpenAI tools 数组（无工具阶段返回空列表）。"""
    return list(_PHASE_TOOLS.get(phase, ()))


def apply_tool_calls(
    tool_calls: list["ToolCall"] | None,
    response: "AgentResponse",
) -> "AgentResponse":
    """把（可能多个）tool call 合并进一个 AgentResponse。

    - search_location → action = {"type": "search", "target": 地点名}
    - ask_question    → action = {"type": "question", "target": 角色名}；
                        say 为空时用问题文本充当公开发言
    - reveal_evidence → 并入 reveal_evidence 列表（去重）
    - cast_vote       → vote = 嫌疑人角色名
    未知工具名记录告警后忽略；单个调用的参数异常不影响其余调用。
    """
    for tc in tool_calls or []:
        name = getattr(tc, "name", "") or ""
        args = getattr(tc, "arguments", None)
        if not isinstance(args, dict):
            logger.warning(f"[agent_tools] 工具 {name} 的参数不是对象，已忽略: {args!r}")
            continue

        if name == "search_location":
            location = str(args.get("location") or "").strip()
            if location:
                response.action = {"type": "search", "target": location}
        elif name == "ask_question":
            target = str(args.get("target") or "").strip()
            question = str(args.get("question") or "").strip()
            if target:
                response.action = {"type": "question", "target": target}
            if question and not response.say.strip():
                response.say = question
        elif name == "reveal_evidence":
            names = args.get("evidence_names")
            if isinstance(names, str):
                names = [names]
            if isinstance(names, list):
                for item in names:
                    item = str(item).strip()
                    if item and item not in response.reveal_evidence:
                        response.reveal_evidence.append(item)
        elif name == "cast_vote":
            suspect = str(args.get("suspect") or "").strip()
            if suspect:
                response.vote = suspect
        else:
            logger.warning(f"[agent_tools] 未知工具调用已忽略: {name}")

    return response
