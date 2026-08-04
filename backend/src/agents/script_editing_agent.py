"""剧本编辑 Agent（ReAct 循环）

把「对话式剧本编辑」从 categorize → parse → execute 两段式管线重构为
ReAct 工具调用 Agent，结构镜像 script_generation_agent：
思考 → 调用工具 → 观察结果 → 再思考，直到 finish。

- 先规划（plan 工具）再逐个调用编辑工具；
- 校验失败作为 observation 回喂 LLM 自我修正；
- 批量指令（如"设计 5 个角色"）必须逐个调用 add 工具；
- 全过程通过 event_callback 透出（script_edit_event 契约不变），供前端时间线展示。

事务约定：工具内只 flush，commit 由调用方（WebSocket 编辑 handler / HTTP 路由的
scoped 会话）统一执行；plan_only 模式下工具在 SAVEPOINT 内执行并回滚，只校验不落库。
"""
import asyncio
import json
import logging
from typing import Any, Awaitable, Callable, Dict, List, Optional, Tuple

from ..services.llm_service import BaseLLMService, LLMMessage, ToolCall, split_think_tags
from ..services.script_editor_service import (
    EditInstruction,
    ScriptEditorService,
    _make_edit_event,
)

logger = logging.getLogger(__name__)

EventCallback = Callable[[Dict[str, Any]], Awaitable[None]]

# 工具名 → 步骤域（步骤中文名见 script_editor_service.EDIT_STEP_NAME）
TOOL_STEP: Dict[str, str] = {
    "plan": "plan",
    "add_character": "characters",
    "update_character": "characters",
    "delete_character": "characters",
    "add_evidence": "evidence",
    "update_evidence": "evidence",
    "delete_evidence": "evidence",
    "add_location": "locations",
    "update_location": "locations",
    "delete_location": "locations",
    "update_script_info": "script_info",
    "update_background_story": "background_story",
    "add_game_phase": "game_phases",
    "update_game_phase": "game_phases",
    "delete_game_phase": "game_phases",
    "reorder_game_phases": "game_phases",
    "bind_character_voice": "voice",
}

# 工具名 → (EditInstruction.action, EditInstruction.target)，用于 tool_results 与 plan_only 指令
TOOL_ACTION_TARGET: Dict[str, Tuple[str, str]] = {
    "add_character": ("add", "character"),
    "update_character": ("update", "character"),
    "delete_character": ("delete", "character"),
    "add_evidence": ("add", "evidence"),
    "update_evidence": ("update", "evidence"),
    "delete_evidence": ("delete", "evidence"),
    "add_location": ("add", "location"),
    "update_location": ("update", "location"),
    "delete_location": ("delete", "location"),
    "update_script_info": ("update", "info"),
    "update_background_story": ("update", "story"),
    "add_game_phase": ("add", "game_phase"),
    "update_game_phase": ("update", "game_phase"),
    "delete_game_phase": ("delete", "game_phase"),
    "reorder_game_phases": ("reorder", "game_phase"),
    "bind_character_voice": ("update", "character"),
}

# 通过 EditInstruction → ScriptEditorService.execute_instruction 复用校验与落库的工具
_EDITOR_TOOLS = {
    "add_character", "update_character", "delete_character",
    "add_evidence", "update_evidence", "delete_evidence",
    "add_location", "update_location", "delete_location",
    "update_script_info", "update_background_story",
}

# 不产生 edit_result 聊天气泡的工具（plan 为规划、finish 为收尾）
_NON_RESULT_TOOLS = {"plan", "finish"}

# update_script_info 字段白名单：工具参数 → EditInstruction content 键
_SCRIPT_INFO_FIELD_MAP = {
    "title": "title",
    "description": "description",
    "tags": "tags",
    "player_count": "player_count",
    "duration_minutes": "estimated_duration",
    "difficulty": "difficulty_level",
    "status": "status",
}

# 游戏阶段名称关键词 → 阶段枚举（add_game_phase 未显式传 phase 时推断）
_PHASE_NAME_HINTS = [
    (("背景",), "BACKGROUND"),
    (("介绍", "自我"), "INTRODUCTION"),
    (("搜证", "搜查"), "EVIDENCE_COLLECTION"),
    (("调查", "取证"), "INVESTIGATION"),
    (("讨论",), "DISCUSSION"),
    (("投票",), "VOTING"),
    (("真相", "揭晓"), "REVELATION"),
    (("结束",), "ENDED"),
]

SYSTEM_PROMPT = """你是一名资深剧本杀编辑助手，正在通过工具调用帮助作者修改一个已有剧本。

【工作方式】
- 你必须通过调用工具来完成修改，只在文本里输出内容是无效的。
- 先调用 plan 工具简要规划要做的修改（一句话即可），然后逐个调用编辑工具。
- 按名称寻址：任务消息中给出了当前剧本的实体清单，更新/删除时使用清单中的准确名称。
- 批量创建必须逐个调用 add 工具，每次只创建一个实体（例如"设计 5 个角色"要调用 5 次 add_character）。
- 如果工具返回校验失败，请根据失败原因修正参数后重新调用，不要放弃。
- 世界观必须自洽：整批设计角色时，全部角色中必须恰好 1 名凶手、恰好 1 名受害者；
  证据的发现地点应与已有场景对应。
- 全部修改完成后调用 finish 收尾；如果用户的指令无法落实为任何编辑操作，说明原因后调用 finish。

【输出要求】
- 所有创作与修改内容使用中文。"""

FALLBACK_ACTION_PROMPT = """当前模型不支持工具调用，请改用 JSON 格式输出你的下一步行动：
{"action": "工具名", "arguments": {工具参数}}
每次只输出一个 JSON，不要输出其他内容。可用工具同上。"""


def _build_tools_schema() -> List[Dict[str, Any]]:
    """OpenAI function calling 工具定义"""
    character_properties = {
        "name": {"type": "string", "description": "角色姓名"},
        "age": {"type": "integer", "description": "年龄（18-80）"},
        "gender": {"type": "string", "description": "性别：男/女/中性"},
        "profession": {"type": "string", "description": "职业"},
        "background": {"type": "string", "description": "背景故事（至少50字）"},
        "secret": {"type": "string", "description": "秘密（至少20字）"},
        "objective": {"type": "string", "description": "游戏目标（至少15字）"},
        "is_murderer": {"type": "boolean", "description": "是否为凶手（全部角色中恰好1人）"},
        "is_victim": {"type": "boolean", "description": "是否为受害者（全部角色中恰好1人）"},
        "personality_traits": {"type": "array", "items": {"type": "string"}, "description": "性格特征（至少2个）"},
    }
    evidence_properties = {
        "name": {"type": "string", "description": "证据名称"},
        "location": {"type": "string", "description": "发现地点（建议与已有场景名称一致）"},
        "description": {"type": "string", "description": "证据描述"},
        "related_to": {"type": "string", "description": "关联角色姓名"},
        "significance": {"type": "string", "description": "重要性说明"},
        "evidence_type": {"type": "string", "description": "类型：PHYSICAL/DOCUMENT/VIDEO/AUDIO/IMAGE"},
        "importance": {"type": "string", "description": "重要程度，如 关键证据/重要证据/误导线索"},
        "is_hidden": {"type": "boolean", "description": "是否隐藏证据"},
    }
    location_properties = {
        "name": {"type": "string", "description": "场景名称"},
        "description": {"type": "string", "description": "场景描述"},
        "searchable_items": {"type": "array", "items": {"type": "string"}, "description": "可搜索物品"},
        "is_crime_scene": {"type": "boolean", "description": "是否为案发现场"},
    }

    def fn(name: str, description: str, properties: Dict[str, Any], required: List[str]):
        return {"type": "function", "function": {
            "name": name, "description": description,
            "parameters": {"type": "object", "properties": properties, "required": required},
        }}

    return [
        fn("plan", "先规划：用一句话说明本次修改计划，再开始调用编辑工具",
           {"plan": {"type": "string", "description": "修改计划简述"}}, ["plan"]),
        fn("add_character", "添加一个角色（批量创建时每次调用只添加一个）",
           character_properties,
           ["name", "profession", "background", "secret", "objective", "gender", "personality_traits"]),
        fn("update_character", "按名称更新角色，只需传要修改的字段",
           character_properties, ["name"]),
        fn("delete_character", "按名称删除角色",
           {"name": {"type": "string", "description": "角色姓名"}}, ["name"]),
        fn("add_evidence", "添加一条证据",
           evidence_properties, ["name", "location", "description"]),
        fn("update_evidence", "按名称更新证据，只需传要修改的字段",
           evidence_properties, ["name"]),
        fn("delete_evidence", "按名称删除证据",
           {"name": {"type": "string", "description": "证据名称"}}, ["name"]),
        fn("add_location", "添加一个场景",
           location_properties, ["name", "description"]),
        fn("update_location", "按名称更新场景，只需传要修改的字段",
           location_properties, ["name"]),
        fn("delete_location", "按名称删除场景",
           {"name": {"type": "string", "description": "场景名称"}}, ["name"]),
        fn("update_script_info", "更新剧本基础信息（只需传要修改的字段）",
           {
               "title": {"type": "string", "description": "剧本标题"},
               "description": {"type": "string", "description": "剧本简介"},
               "tags": {"type": "array", "items": {"type": "string"}, "description": "标签"},
               "player_count": {"type": "integer", "description": "玩家数量"},
               "duration_minutes": {"type": "integer", "description": "预计游戏时长（分钟）"},
               "difficulty": {"type": "string", "description": "难度：easy/medium/hard"},
               "status": {"type": "string", "description": "状态：draft/published"},
           }, []),
        fn("update_background_story", "更新背景故事（upsert，只需传要修改的字段）",
           {
               "title": {"type": "string", "description": "背景故事标题"},
               "setting_description": {"type": "string", "description": "背景设定"},
               "incident_description": {"type": "string", "description": "案件经过描述"},
               "victim_background": {"type": "string", "description": "受害者背景"},
               "investigation_scope": {"type": "string", "description": "调查范围"},
               "rules_reminder": {"type": "string", "description": "规则提醒"},
               "murder_method": {"type": "string", "description": "作案手法"},
               "murder_location": {"type": "string", "description": "作案地点"},
               "discovery_time": {"type": "string", "description": "发现时间"},
               "victory_conditions": {"type": "object", "description": "胜利条件"},
           }, []),
        fn("add_game_phase", "添加一个游戏阶段（追加到末尾）",
           {
               "name": {"type": "string", "description": "阶段名称"},
               "description": {"type": "string", "description": "阶段描述"},
               "phase": {"type": "string", "description": "阶段标识：BACKGROUND/INTRODUCTION/EVIDENCE_COLLECTION/INVESTIGATION/DISCUSSION/VOTING/REVELATION/ENDED（缺省按名称推断）"},
           }, ["name"]),
        fn("update_game_phase", "按名称更新游戏阶段描述",
           {
               "name": {"type": "string", "description": "阶段名称"},
               "description": {"type": "string", "description": "阶段描述"},
           }, ["name", "description"]),
        fn("delete_game_phase", "按名称删除游戏阶段",
           {"name": {"type": "string", "description": "阶段名称"}}, ["name"]),
        fn("reorder_game_phases", "重排游戏阶段顺序（须包含全部现有阶段名称）",
           {"ordered_names": {"type": "array", "items": {"type": "string"},
                              "description": "按新顺序排列的全部阶段名称"}}, ["ordered_names"]),
        fn("bind_character_voice", "为角色绑定 TTS 音色（按 voice_id/名称/性别模糊匹配）",
           {
               "character_name": {"type": "string", "description": "角色姓名"},
               "voice_query": {"type": "string", "description": "音色关键词：voice_id、名称或性别（男/女/male/female）"},
           }, ["character_name", "voice_query"]),
        fn("finish", "全部修改完成后调用，结束编辑",
           {"summary": {"type": "string", "description": "修改总结"}}, ["summary"]),
    ]


class ScriptEditingAgent:
    """剧本编辑 ReAct Agent：规划 → 工具调用 → 观察 的循环直到 finish。"""

    def __init__(
        self,
        script_id: int,
        instruction: str,
        db_session,
        event_callback: Optional[EventCallback] = None,
        llm: Optional[BaseLLMService] = None,
        max_iterations: int = 12,
        plan_only: bool = False,
    ):
        self.script_id = script_id
        self.instruction = instruction
        self.db = db_session
        self.event_callback = event_callback
        self.max_iterations = max_iterations
        # plan_only：ReAct 循环照跑，工具在 SAVEPOINT 内执行并回滚（只校验不落库），
        # 收集到的工具调用序列作为解析结果返回（供 HTTP /parse-instruction 使用）
        self.plan_only = plan_only
        self._cancel_event = asyncio.Event()
        self._tools_supported = True  # provider 不支持工具调用时降级为 JSON 行动模式
        self._iteration = 0
        self.finish_summary: str = ""
        self.tool_results: List[Dict[str, Any]] = []
        self.planned_instructions: List[EditInstruction] = []

        from ..db.repositories.script_repository import ScriptRepository
        self.repo = ScriptRepository(db_session)
        self.editor = ScriptEditorService(self.repo)

        if llm is not None:
            self.llm = llm
        else:
            from ..services.llm_service import get_llm_service
            self.llm = get_llm_service()

    # ------------------------------------------------------------------
    # 事件
    # ------------------------------------------------------------------
    async def _emit(self, event_type: str, content: str = "", step: Optional[str] = None,
                    kind: Optional[str] = None, data: Optional[Dict[str, Any]] = None):
        """发送编辑事件给回调（前端展示用），回调异常不影响主流程"""
        if self.event_callback is None:
            return
        try:
            await self.event_callback(
                _make_edit_event(event_type, step or "", content, kind, data)
            )
        except Exception as e:
            logger.error(f"[EDIT_AGENT] 事件回调失败: {e}")

    # ------------------------------------------------------------------
    # 主循环
    # ------------------------------------------------------------------
    def cancel(self):
        """请求取消编辑（在下一次循环检查时生效）"""
        self._cancel_event.set()

    @property
    def successful_ops(self) -> int:
        return sum(1 for r in self.tool_results if r["success"])

    async def run(self) -> Dict[str, Any]:
        """执行 ReAct 编辑循环，返回最终状态与逐项操作结果"""
        messages: List[LLMMessage] = [
            LLMMessage(role="system", content=SYSTEM_PROMPT),
            LLMMessage(role="user", content=self._build_task_message()),
        ]
        try:
            while self._iteration < self.max_iterations:
                if self._cancel_event.is_set():
                    await self._emit("cancelled", content="用户取消了编辑")
                    return self._result("cancelled")

                self._iteration += 1
                logger.info(f"[EDIT_AGENT] 第 {self._iteration} 轮循环: 剧本={self.script_id}")

                response = await self._call_llm(messages)

                # 透出思考过程
                if response.reasoning_content:
                    await self._emit("thought", content=response.reasoning_content, kind="reasoning")
                for chunk in split_think_tags(response.content):
                    await self._emit("thought", content=chunk.text,
                                     kind="reasoning" if chunk.type == "reasoning" else "text")

                tool_calls = response.tool_calls or []
                if not tool_calls and not self._tools_supported:
                    parsed = self._parse_fallback_action(response.content)
                    if parsed:
                        tool_calls = [parsed]

                if tool_calls:
                    messages.append(LLMMessage(role="assistant", content=response.content or "（调用工具）"))
                    for tc in tool_calls:
                        if self._cancel_event.is_set():
                            break
                        await self._run_tool_call(tc, messages)
                    if self.finish_summary:
                        break
                else:
                    messages.append(LLMMessage(role="assistant", content=response.content or ""))
                    if self.tool_results:
                        failed = [r for r in self.tool_results if not r["success"]]
                        if failed:
                            # 有失败操作时模型却用文本收尾：回喂失败原因要求修正重试，而非按完成处理
                            last_fail = failed[-1]
                            messages.append(LLMMessage(
                                role="user",
                                content=f"操作「{last_fail['description']}」失败：{last_fail['message']}。"
                                        "请分析原因并修正参数后重试；若确认无法完成，请调用 finish 并说明原因。",
                            ))
                            continue
                        # 模型文本收尾但未调用 finish，按完成处理
                        self.finish_summary = response.content or "编辑完成"
                        break
                    messages.append(LLMMessage(
                        role="user",
                        content="尚未执行任何编辑操作。请通过工具完成用户要求的修改，完成后调用 finish；"
                                "如果指令无法落实为编辑操作，请说明原因并调用 finish。",
                    ))

            if not self.finish_summary:
                if self.tool_results and self.successful_ops > 0:
                    # 达到最大轮次但已有成功操作：正常收尾
                    self.finish_summary = "编辑完成（达到最大轮次）"
                else:
                    await self._emit("error", content=f"达到最大轮次({self.max_iterations})，编辑未完成")
                    result = self._result("error")
                    result["message"] = f"达到最大轮次({self.max_iterations})，编辑未完成"
                    return result

            await self._emit("done", content=self.finish_summary, data={
                "script_id": self.script_id,
                "successful_ops": self.successful_ops,
                "total_ops": len(self.tool_results),
            })
            return self._result("done")

        except asyncio.CancelledError:
            await self._emit("cancelled", content="编辑任务被取消")
            return self._result("cancelled")
        except Exception as e:
            logger.error(f"[EDIT_AGENT] 编辑循环异常: 剧本={self.script_id}, 错误={e}", exc_info=True)
            await self._emit("error", content=f"编辑失败: {e}")
            result = self._result("error")
            result["message"] = str(e)
            return result

    def _result(self, status: str) -> Dict[str, Any]:
        result: Dict[str, Any] = {
            "status": status,
            "summary": self.finish_summary,
            "tool_results": self.tool_results,
            "successful_ops": self.successful_ops,
        }
        if self.plan_only:
            result["planned_instructions"] = self.planned_instructions
        return result

    async def _call_llm(self, messages: List[LLMMessage]):
        """调用 LLM；provider 不支持工具调用时降级为 JSON 行动模式"""
        if self._tools_supported:
            try:
                return await self.llm.chat_completion(
                    messages, tools=_build_tools_schema(), tool_choice="auto"
                )
            except Exception as e:
                logger.warning(f"[EDIT_AGENT] 工具调用模式失败，降级为JSON行动模式: {e}")
                self._tools_supported = False
                messages.append(LLMMessage(role="user", content=FALLBACK_ACTION_PROMPT))
        # JSON 行动模式：无工具参数的普通调用
        return await self.llm.chat_completion(messages)

    def _parse_fallback_action(self, content: str) -> Optional[ToolCall]:
        """从文本内容中解析 JSON 行动（降级模式）"""
        if not content:
            return None
        text = content.strip()
        # 去掉 markdown 代码块
        if text.startswith("```"):
            lines = text.split("\n")
            text = "\n".join(lines[1:-1] if lines[-1].startswith("```") else lines[1:])
        start = text.find("{")
        if start == -1:
            return None
        # 平衡括号提取
        depth = 0
        for i in range(start, len(text)):
            if text[i] == "{":
                depth += 1
            elif text[i] == "}":
                depth -= 1
                if depth == 0:
                    try:
                        payload = json.loads(text[start:i + 1])
                    except json.JSONDecodeError:
                        return None
                    action = payload.get("action")
                    if action:
                        return ToolCall(name=action, arguments=payload.get("arguments") or {})
                    return None
        return None

    async def _run_tool_call(self, tc: ToolCall, messages: List[LLMMessage]):
        """执行一次工具调用并产出 step_start/action/observation/step_end 事件"""
        step = TOOL_STEP.get(tc.name)
        if step:
            await self._emit("step_start", step=step)

        args_summary = self._summarize_args(tc.name, tc.arguments)
        await self._emit("action", step=step, content=args_summary,
                         data={"tool": tc.name, "arguments": tc.arguments})

        ok, observation = await self._execute_tool(tc.name, tc.arguments)
        await self._emit("observation", step=step, content=observation,
                         data={"tool": tc.name, "success": ok})

        if step:
            await self._emit("step_end", step=step, content=observation)

        # 记录逐项操作结果（供 handler 广播既有 edit_result 消息）
        if tc.name not in _NON_RESULT_TOOLS:
            action, target = TOOL_ACTION_TARGET.get(tc.name, (tc.name, ""))
            self.tool_results.append({
                "action": action,
                "target": target,
                "description": args_summary,
                "success": ok,
                "message": observation,
            })
            if self.plan_only:
                self.planned_instructions.append(EditInstruction(
                    action=action, target=target,
                    content=dict(tc.arguments), description=args_summary,
                ))

        messages.append(LLMMessage(
            role="user",
            content=f"【工具结果】{tc.name}: {'成功' if ok else '失败'} — {observation}",
        ))

    @staticmethod
    def _summarize_args(tool_name: str, arguments: Dict[str, Any]) -> str:
        """生成工具调用的简短中文摘要"""
        name = arguments.get("name") or arguments.get("character_name") or "?"
        if tool_name == "plan":
            return f"规划：{arguments.get('plan', '')}"
        if tool_name == "add_character":
            return f"添加角色：{name}"
        if tool_name == "update_character":
            fields = "、".join(k for k in arguments if k != "name")
            return f"更新角色：{name}（{fields or '无字段'}）"
        if tool_name == "delete_character":
            return f"删除角色：{name}"
        if tool_name == "add_evidence":
            return f"添加证据：{name}"
        if tool_name == "update_evidence":
            return f"更新证据：{name}"
        if tool_name == "delete_evidence":
            return f"删除证据：{name}"
        if tool_name == "add_location":
            return f"添加场景：{name}"
        if tool_name == "update_location":
            return f"更新场景：{name}"
        if tool_name == "delete_location":
            return f"删除场景：{name}"
        if tool_name == "update_script_info":
            fields = "、".join(arguments.keys())
            return f"更新剧本信息（{fields or '无字段'}）"
        if tool_name == "update_background_story":
            fields = "、".join(arguments.keys())
            return f"更新背景故事（{fields or '无字段'}）"
        if tool_name == "add_game_phase":
            return f"添加游戏阶段：{name}"
        if tool_name == "update_game_phase":
            return f"更新游戏阶段：{name}"
        if tool_name == "delete_game_phase":
            return f"删除游戏阶段：{name}"
        if tool_name == "reorder_game_phases":
            names = arguments.get("ordered_names") or []
            return f"重排游戏阶段：{' → '.join(str(n) for n in names)}"
        if tool_name == "bind_character_voice":
            return f"为角色 {name} 绑定音色（{arguments.get('voice_query', '?')}）"
        if tool_name == "finish":
            return "完成编辑"
        return f"调用工具 {tool_name}"

    # ------------------------------------------------------------------
    # 提示词构建
    # ------------------------------------------------------------------
    def _build_task_message(self) -> str:
        """任务消息 = 当前剧本状态摘要 + 用户指令"""
        parts: List[str] = []
        script = self.repo.get_script_by_id(self.script_id)
        if not script:
            return f"【编辑任务】剧本ID={self.script_id}\n【用户指令】{self.instruction}"

        summary = self.editor._get_script_state_summary(script)
        parts.append("【当前剧本】")
        parts.append(f"标题：{summary['title']}（玩家人数：{script.info.player_count}）")
        parts.append(f"简介：{summary['description']}")
        parts.append(f"角色（{summary['character_count']}）："
                     + ("、".join(summary["character_names"]) or "无"))
        if script.characters:
            parts.append(self.editor._format_characters(script.characters))
        parts.append(f"证据（{summary['evidence_count']}）："
                     + ("、".join(summary["evidence_names"]) or "无"))
        if script.evidence:
            parts.append(self.editor._format_evidence(script.evidence))
        parts.append(f"场景（{summary['location_count']}）："
                     + ("、".join(summary["location_names"]) or "无"))
        if script.locations:
            parts.append(self.editor._format_locations(script.locations))
        if script.background_story:
            parts.append(f"背景故事：{script.background_story.title or '（无标题）'}")
        phases = self.repo.get_game_phases(self.script_id)
        phase_names = [p.name for p in phases]
        parts.append(f"游戏阶段（{len(phase_names)}）：" + (" → ".join(phase_names) or "无"))
        murderer = next((c.name for c in script.characters if c.is_murderer), None)
        victim = next((c.name for c in script.characters if c.is_victim), None)
        if murderer or victim:
            parts.append(f"当前设定：凶手={murderer or '未定'}，受害者={victim or '未定'}")
        parts.append("")
        parts.append(f"【用户指令】{self.instruction}")
        parts.append("请先调用 plan 简要规划，再逐个调用工具完成修改。")
        return "\n".join(parts)

    # ------------------------------------------------------------------
    # 工具执行（校验 + 落库；plan_only 下 SAVEPOINT 回滚）
    # ------------------------------------------------------------------
    async def _execute_tool(self, name: str, args: Dict[str, Any]) -> Tuple[bool, str]:
        """执行工具，返回 (是否成功, 观察结果描述)"""
        try:
            if name == "finish":
                self.finish_summary = (args.get("summary") or "编辑完成").strip()
                return True, self.finish_summary
            if self.plan_only and name not in ("plan",):
                # 计划模式：SAVEPOINT 内执行并回滚，只校验不落库
                nested = self.db.begin_nested()
                try:
                    ok, observation = await self._dispatch_tool(name, args)
                finally:
                    nested.rollback()
                self.db.expire_all()
                return ok, observation
            return await self._dispatch_tool(name, args)
        except Exception as e:
            logger.error(f"[EDIT_AGENT] 工具执行异常 {name}: {e}", exc_info=True)
            return False, f"工具执行异常: {e}"

    async def _dispatch_tool(self, name: str, args: Dict[str, Any]) -> Tuple[bool, str]:
        if name == "plan":
            plan_text = (args.get("plan") or "").strip()
            if not plan_text:
                return False, "计划内容不能为空"
            return True, "计划已记录"
        if name in _EDITOR_TOOLS:
            return await self._execute_via_editor(name, args)
        if name == "add_game_phase":
            return self._tool_add_game_phase(args)
        if name == "update_game_phase":
            return self._tool_update_game_phase(args)
        if name == "delete_game_phase":
            return self._tool_delete_game_phase(args)
        if name == "reorder_game_phases":
            return self._tool_reorder_game_phases(args)
        if name == "bind_character_voice":
            return await self._tool_bind_character_voice(args)
        return False, f"未知工具: {name}"

    async def _execute_via_editor(self, name: str, args: Dict[str, Any]) -> Tuple[bool, str]:
        """构造 EditInstruction 复用 ScriptEditorService 的校验与增量落库"""
        action, target = TOOL_ACTION_TARGET[name]
        content = dict(args)
        if name == "update_script_info":
            content = {
                mapped: value for key, value in args.items()
                if (mapped := _SCRIPT_INFO_FIELD_MAP.get(key)) is not None
            }
            if not content:
                return False, ("未提供可更新的字段，可选: "
                               + "、".join(_SCRIPT_INFO_FIELD_MAP.keys()))
        instruction = EditInstruction(
            action=action, target=target, content=content,
            description=self._summarize_args(name, args),
        )
        result = await self.editor.execute_instruction(instruction, self.script_id)
        return result.success, result.message

    # ------------------------------------------------------------------
    # 游戏阶段工具（直接走 ScriptRepository 增量方法）
    # ------------------------------------------------------------------
    def _existing_phase_names(self) -> List[str]:
        return [p.name for p in self.repo.get_game_phases(self.script_id)]

    @staticmethod
    def _infer_phase_enum(name: str):
        from ..schemas.game_phase import GamePhaseEnum
        for keywords, value in _PHASE_NAME_HINTS:
            if any(k in name for k in keywords):
                return GamePhaseEnum(value)
        return GamePhaseEnum.DISCUSSION

    def _tool_add_game_phase(self, args: Dict[str, Any]) -> Tuple[bool, str]:
        name = (args.get("name") or "").strip()
        if not name:
            return False, "阶段名称不能为空"
        if name in self._existing_phase_names():
            return False, f"已存在同名阶段: {name}"

        from ..schemas.game_phase import GamePhase, GamePhaseEnum
        raw_phase = str(args.get("phase") or "").upper()
        if raw_phase:
            try:
                phase_enum = GamePhaseEnum(raw_phase)
            except ValueError:
                return False, (f"无效的阶段标识「{args.get('phase')}」，可选: "
                               + "/".join(e.value for e in GamePhaseEnum))
        else:
            phase_enum = self._infer_phase_enum(name)

        existing = self.repo.get_game_phases(self.script_id)
        next_order = max((p.order_index for p in existing), default=-1) + 1
        self.repo.add_game_phase(GamePhase(
            script_id=self.script_id,
            phase=phase_enum,
            name=name,
            description=(args.get("description") or "").strip(),
            order_index=next_order,
        ))
        return True, f"已添加游戏阶段: {name}（第 {next_order + 1} 步）"

    def _tool_update_game_phase(self, args: Dict[str, Any]) -> Tuple[bool, str]:
        name = (args.get("name") or "").strip()
        if not name:
            return False, "阶段名称不能为空"
        update_data: Dict[str, Any] = {}
        if "description" in args:
            update_data["description"] = (args.get("description") or "").strip()
        if not update_data:
            return False, "未提供可更新的字段（支持 description）"
        updated = self.repo.update_game_phase_by_name(self.script_id, name, update_data)
        if not updated:
            return False, f"未找到游戏阶段: {name}（现有: {'、'.join(self._existing_phase_names()) or '无'}）"
        return True, f"已更新游戏阶段: {name}"

    def _tool_delete_game_phase(self, args: Dict[str, Any]) -> Tuple[bool, str]:
        name = (args.get("name") or "").strip()
        if not name:
            return False, "阶段名称不能为空"
        if not self.repo.delete_game_phase_by_name(self.script_id, name):
            return False, f"未找到游戏阶段: {name}（现有: {'、'.join(self._existing_phase_names()) or '无'}）"
        return True, f"已删除游戏阶段: {name}"

    def _tool_reorder_game_phases(self, args: Dict[str, Any]) -> Tuple[bool, str]:
        ordered_names = args.get("ordered_names") or []
        if not isinstance(ordered_names, list) or not ordered_names:
            return False, "ordered_names 不能为空"
        ordered = [str(n).strip() for n in ordered_names]
        existing = self._existing_phase_names()
        unknown = [n for n in ordered if n not in existing]
        if unknown:
            return False, (f"阶段名称不存在: {'、'.join(unknown)}"
                           f"（现有: {'、'.join(existing) or '无'}）")
        missing = [n for n in existing if n not in ordered]
        if missing:
            return False, f"重排列表缺少现有阶段: {'、'.join(missing)}，请包含全部阶段"
        self.repo.reorder_game_phases(self.script_id, ordered)
        return True, f"游戏阶段顺序已更新: {' → '.join(ordered)}"

    # ------------------------------------------------------------------
    # 音色绑定工具
    # ------------------------------------------------------------------
    async def _tool_bind_character_voice(self, args: Dict[str, Any]) -> Tuple[bool, str]:
        character_name = (args.get("character_name") or "").strip()
        voice_query = (args.get("voice_query") or "").strip()
        if not character_name:
            return False, "角色姓名不能为空"
        if not voice_query:
            return False, "音色关键词不能为空"

        script = self.repo.get_script_by_id(self.script_id)
        if not script:
            return False, f"剧本不存在: ID={self.script_id}"
        if character_name not in [c.name for c in script.characters]:
            return False, (f"未找到角色: {character_name}"
                           f"（现有: {'、'.join(c.name for c in script.characters) or '无'}）")

        from ..services.tts_voices import list_available_voices
        ok, voices, error = await list_available_voices()
        if not ok:
            return False, f"获取音色列表失败: {error}"

        matched = self._match_voice(voices, voice_query)
        if not matched:
            sample = "、".join(v["name"] for v in voices[:5])
            return False, f"未找到匹配「{voice_query}」的音色（可选示例: {sample}…）"

        update_data = {"voice_id": matched["voice_id"], "voice_preference": matched["name"]}
        updated = self.repo.update_character_by_name(self.script_id, character_name, update_data)
        if not updated:
            return False, f"未找到角色: {character_name}"
        return True, f"已为角色 {character_name} 绑定音色 {matched['name']}（{matched['voice_id']}）"

    @staticmethod
    def _match_voice(voices: List[Dict[str, Any]], query: str) -> Optional[Dict[str, Any]]:
        """按 voice_id 精确匹配 → 名称包含 → 性别 的顺序模糊匹配"""
        q = query.lower()
        # 1) voice_id 精确匹配
        for v in voices:
            if v["voice_id"].lower() == q:
                return v
        # 2) 名称包含（双向）
        for v in voices:
            if q in v["name"].lower() or v["name"].lower() in q:
                return v
        # 3) 性别匹配
        gender_alias = {"男": "male", "女": "female", "男性": "male", "女性": "female"}
        gender = gender_alias.get(q, q)
        if gender in ("male", "female"):
            for v in voices:
                if (v.get("gender") or "").lower() == gender:
                    return v
        return None
