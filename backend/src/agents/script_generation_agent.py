"""剧本生成 Agent（ReAct 循环）

以「思考 → 调用工具 → 观察结果 → 再思考」的循环方式分步生成完整剧本。
每个生成步骤对应一个工具（save_script_info / save_background_story /
save_characters / save_locations / save_evidence / save_game_phases），
工具执行成功即落库（独立事务提交），校验失败会作为观察结果反馈给
LLM 进行自我修正。全部过程通过 event_callback 以事件形式实时透出，
供 WebSocket 推送给前端展示执行过程与思考过程。
"""
import asyncio
import json
import logging
from datetime import datetime
from typing import Any, Awaitable, Callable, Dict, List, Optional, Tuple

from ..services.llm_service import BaseLLMService, LLMMessage, ToolCall, split_think_tags

logger = logging.getLogger(__name__)

# 生成步骤定义：(步骤key, 中文名)。顺序即推荐执行顺序。
GENERATION_STEPS: List[Tuple[str, str]] = [
    ("script_info", "基础信息"),
    ("background_story", "背景故事"),
    ("characters", "角色设计"),
    ("locations", "场景设计"),
    ("evidence", "证据设计"),
    ("game_phases", "游戏阶段"),
]
STEP_INDEX: Dict[str, int] = {key: i for i, (key, _) in enumerate(GENERATION_STEPS)}
STEP_NAME: Dict[str, str] = dict(GENERATION_STEPS)

# finish 之前必须完成的步骤（game_phases 缺失时自动补默认计划）
REQUIRED_STEPS = ["script_info", "background_story", "characters", "locations", "evidence"]

# 工具名 → 步骤key
TOOL_STEP: Dict[str, str] = {
    "save_script_info": "script_info",
    "save_background_story": "background_story",
    "save_characters": "characters",
    "save_locations": "locations",
    "save_evidence": "evidence",
    "save_game_phases": "game_phases",
}

EventCallback = Callable[[Dict[str, Any]], Awaitable[None]]


def _clamp(text: Any, max_len: int) -> str:
    """按数据库列长度上限截断字符串，避免 StringDataRightTruncation"""
    s = str(text or "").strip()
    return s[:max_len]

SYSTEM_PROMPT = """你是一名资深剧本杀编剧 Agent，正在通过工具调用分步创作一个完整的剧本杀剧本。

【工作方式】
- 你必须通过调用工具来保存每一步的创作成果，只在文本里输出内容是无效的。
- 推荐按以下顺序执行，每一步先思考（剧情如何自洽）再调用对应工具：
  1. save_script_info —— 确定标题、简介、难度、标签
  2. save_background_story —— 构思案件背景、作案手法、受害者等核心设定
  3. save_characters —— 设计全部角色（必须恰好 1 名凶手、恰好 1 名受害者）
  4. save_locations —— 设计场景（至少 1 个案发现场）
  5. save_evidence —— 设计证据（发现地点必须与已创建的场景对应）
  6. save_game_phases —— 设计游戏流程阶段
  7. finish —— 全部完成后收尾
- 如果工具返回校验失败，请根据失败原因修正后重新调用，不要放弃。
- 世界观必须自洽：凶手/受害者在角色、背景故事、证据中的指向要一致；证据要有误导性线索与关键线索的搭配。

【输出要求】
- 每次回复先简要说明你的创作思路，然后调用工具。
- 所有创作内容使用中文。"""

FALLBACK_ACTION_PROMPT = """当前模型不支持工具调用，请改用 JSON 格式输出你的下一步行动：
{"action": "工具名", "arguments": {工具参数}}
每次只输出一个 JSON，不要输出其他内容。可用工具同上。"""


def _build_tools_schema() -> List[Dict[str, Any]]:
    """OpenAI function calling 工具定义"""
    character_schema = {
        "type": "object",
        "properties": {
            "name": {"type": "string", "description": "角色姓名"},
            "age": {"type": "integer", "description": "年龄"},
            "gender": {"type": "string", "description": "性别，如 男/女/中性"},
            "profession": {"type": "string", "description": "职业"},
            "background": {"type": "string", "description": "背景故事"},
            "secret": {"type": "string", "description": "秘密"},
            "objective": {"type": "string", "description": "游戏目标"},
            "is_murderer": {"type": "boolean", "description": "是否为凶手（全部角色中恰好1人）"},
            "is_victim": {"type": "boolean", "description": "是否为受害者（全部角色中恰好1人）"},
            "personality_traits": {"type": "array", "items": {"type": "string"}, "description": "性格特征"},
        },
        "required": ["name", "background", "secret", "objective"],
    }
    location_schema = {
        "type": "object",
        "properties": {
            "name": {"type": "string", "description": "场景名称"},
            "description": {"type": "string", "description": "场景描述"},
            "searchable_items": {"type": "array", "items": {"type": "string"}, "description": "可搜索物品"},
            "is_crime_scene": {"type": "boolean", "description": "是否为案发现场（至少1个）"},
        },
        "required": ["name", "description"],
    }
    evidence_schema = {
        "type": "object",
        "properties": {
            "name": {"type": "string", "description": "证据名称"},
            "location": {"type": "string", "description": "发现地点（须与已创建场景名称一致）"},
            "description": {"type": "string", "description": "证据描述"},
            "related_to": {"type": "string", "description": "关联角色姓名"},
            "significance": {"type": "string", "description": "重要性说明"},
            "evidence_type": {"type": "string", "description": "类型：PHYSICAL/DOCUMENT/VIDEO/AUDIO/IMAGE"},
            "importance": {"type": "string", "description": "重要程度，如 关键证据/重要证据/误导线索"},
            "is_hidden": {"type": "boolean", "description": "是否隐藏证据"},
        },
        "required": ["name", "location", "description"],
    }
    phase_schema = {
        "type": "object",
        "properties": {
            "phase": {"type": "string", "description": "阶段标识：BACKGROUND/INTRODUCTION/EVIDENCE_COLLECTION/INVESTIGATION/DISCUSSION/VOTING/REVELATION"},
            "name": {"type": "string", "description": "阶段名称"},
            "description": {"type": "string", "description": "阶段描述"},
        },
        "required": ["phase", "name"],
    }
    return [
        {"type": "function", "function": {
            "name": "save_script_info",
            "description": "保存剧本基础信息（步骤1）",
            "parameters": {"type": "object", "properties": {
                "title": {"type": "string", "description": "剧本标题"},
                "description": {"type": "string", "description": "剧本简介"},
                "player_count": {"type": "integer", "description": "玩家数量"},
                "difficulty": {"type": "string", "description": "难度：easy/medium/hard"},
                "category": {"type": "string", "description": "分类，如 推理/情感/恐怖"},
                "tags": {"type": "array", "items": {"type": "string"}, "description": "标签"},
            }, "required": ["title", "description"]},
        }},
        {"type": "function", "function": {
            "name": "save_background_story",
            "description": "保存背景故事与案件核心设定（步骤2）",
            "parameters": {"type": "object", "properties": {
                "title": {"type": "string", "description": "背景故事标题"},
                "setting_description": {"type": "string", "description": "背景设定"},
                "incident_description": {"type": "string", "description": "案件经过描述"},
                "victim_background": {"type": "string", "description": "受害者背景"},
                "investigation_scope": {"type": "string", "description": "调查范围"},
                "rules_reminder": {"type": "string", "description": "规则提醒"},
                "murder_method": {"type": "string", "description": "作案手法"},
                "murder_location": {"type": "string", "description": "作案地点"},
                "discovery_time": {"type": "string", "description": "发现时间"},
                "victory_conditions": {"type": "object", "description": "胜利条件，如 {\"good\": \"...\", \"murderer\": \"...\"}"},
            }, "required": ["setting_description", "incident_description", "victim_background", "murder_method", "murder_location", "discovery_time"]},
        }},
        {"type": "function", "function": {
            "name": "save_characters",
            "description": "一次性保存全部角色（步骤3）。恰好1名凶手、恰好1名受害者，数量应等于玩家数+1（受害者）",
            "parameters": {"type": "object", "properties": {
                "characters": {"type": "array", "items": character_schema, "description": "角色列表"},
            }, "required": ["characters"]},
        }},
        {"type": "function", "function": {
            "name": "save_locations",
            "description": "一次性保存全部场景（步骤4）",
            "parameters": {"type": "object", "properties": {
                "locations": {"type": "array", "items": location_schema, "description": "场景列表"},
            }, "required": ["locations"]},
        }},
        {"type": "function", "function": {
            "name": "save_evidence",
            "description": "一次性保存全部证据（步骤5）",
            "parameters": {"type": "object", "properties": {
                "evidence": {"type": "array", "items": evidence_schema, "description": "证据列表"},
            }, "required": ["evidence"]},
        }},
        {"type": "function", "function": {
            "name": "save_game_phases",
            "description": "保存游戏阶段流程（步骤6）",
            "parameters": {"type": "object", "properties": {
                "phases": {"type": "array", "items": phase_schema, "description": "阶段列表，按执行顺序"},
            }, "required": ["phases"]},
        }},
        {"type": "function", "function": {
            "name": "finish",
            "description": "全部步骤完成后调用，结束生成",
            "parameters": {"type": "object", "properties": {
                "summary": {"type": "string", "description": "创作总结"},
            }, "required": ["summary"]},
        }},
    ]


class ScriptGenerationAgent:
    """剧本生成 ReAct Agent：思考 → 工具调用 → 观察 的循环直到完成。"""

    def __init__(
        self,
        script_id: int,
        theme: str,
        player_count: int = 4,
        script_type: str = "推理",
        llm: Optional[BaseLLMService] = None,
        event_callback: Optional[EventCallback] = None,
        db_session_factory: Optional[Callable[[], Any]] = None,
        max_iterations: int = 15,
    ):
        self.script_id = script_id
        self.theme = theme
        self.player_count = player_count
        self.script_type = script_type
        self.max_iterations = max_iterations
        self.event_callback = event_callback
        self._cancel_event = asyncio.Event()
        self._tools_supported = True  # provider 不支持工具调用时降级为 JSON 行动模式
        self._iteration = 0
        self.completed_steps: List[str] = []
        self.finish_summary: str = ""

        if llm is not None:
            self.llm = llm
        else:
            from ..services.llm_service import get_llm_service
            self.llm = get_llm_service()

        if db_session_factory is not None:
            self._db_session_factory = db_session_factory
        else:
            from ..db.session import db_manager
            self._db_session_factory = db_manager.session_scope

        # 已生成内容的一致性上下文摘要
        self._context: Dict[str, Any] = {"locations": [], "characters": []}

    # ------------------------------------------------------------------
    # 事件
    # ------------------------------------------------------------------
    async def _emit(self, event_type: str, content: str = "", step: Optional[str] = None,
                    kind: Optional[str] = None, data: Optional[Dict[str, Any]] = None):
        """发送生成事件给回调（前端展示用），回调异常不影响主流程"""
        event = {
            "type": event_type,
            "step": step,
            "step_name": STEP_NAME.get(step) if step else None,
            "step_index": STEP_INDEX.get(step) if step else None,
            "iteration": self._iteration,
            "content": content,
            "kind": kind,
            "data": data,
            "completed_steps": list(self.completed_steps),
            "timestamp": datetime.now().isoformat(),
        }
        if self.event_callback is None:
            return
        try:
            await self.event_callback(event)
        except Exception as e:
            logger.error(f"[GEN_AGENT] 事件回调失败: {e}")

    # ------------------------------------------------------------------
    # 主循环
    # ------------------------------------------------------------------
    def cancel(self):
        """请求取消生成（在下一次循环检查时生效）"""
        self._cancel_event.set()

    async def run(self) -> Dict[str, Any]:
        """执行 ReAct 生成循环，返回最终状态"""
        messages: List[LLMMessage] = [
            LLMMessage(role="system", content=SYSTEM_PROMPT),
            LLMMessage(role="user", content=self._build_task_message()),
        ]
        try:
            while self._iteration < self.max_iterations:
                if self._cancel_event.is_set():
                    await self._emit("cancelled", content="用户取消了生成")
                    return {"status": "cancelled", "completed_steps": self.completed_steps}

                self._iteration += 1
                logger.info(f"[GEN_AGENT] 第 {self._iteration} 轮循环: 剧本={self.script_id}")

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
                    messages.append(LLMMessage(role="user", content=self._build_progress_message()))
                    if self.finish_summary:
                        break
                else:
                    messages.append(LLMMessage(role="assistant", content=response.content or ""))
                    missing = self._missing_required_steps()
                    if not missing:
                        # 模型文本收尾但未调用 finish，按完成处理
                        self.finish_summary = response.content or "生成完成"
                        break
                    messages.append(LLMMessage(
                        role="user",
                        content=f"尚未完成的步骤: {self._format_steps(missing)}。请继续调用工具完成，全部完成后调用 finish。",
                    ))

            if not self.finish_summary and self._iteration >= self.max_iterations:
                missing = self._missing_required_steps()
                if missing:
                    await self._emit("error", content=f"达到最大轮次({self.max_iterations})，未完成步骤: {self._format_steps(missing)}")
                    return {"status": "error", "completed_steps": self.completed_steps,
                            "message": f"达到最大轮次，未完成: {missing}"}
                self.finish_summary = "生成完成（达到最大轮次）"

            await self._emit("done", content=self.finish_summary, data={
                "script_id": self.script_id,
                "completed_steps": self.completed_steps,
            })
            return {"status": "done", "completed_steps": self.completed_steps,
                    "summary": self.finish_summary}

        except asyncio.CancelledError:
            await self._emit("cancelled", content="生成任务被取消")
            return {"status": "cancelled", "completed_steps": self.completed_steps}
        except Exception as e:
            logger.error(f"[GEN_AGENT] 生成循环异常: 剧本={self.script_id}, 错误={e}", exc_info=True)
            await self._emit("error", content=f"生成失败: {e}")
            return {"status": "error", "completed_steps": self.completed_steps, "message": str(e)}

    async def _call_llm(self, messages: List[LLMMessage]):
        """调用 LLM；provider 不支持工具调用时降级为 JSON 行动模式"""
        if self._tools_supported:
            try:
                return await self.llm.chat_completion(
                    messages, tools=_build_tools_schema(), tool_choice="auto"
                )
            except Exception as e:
                logger.warning(f"[GEN_AGENT] 工具调用模式失败，降级为JSON行动模式: {e}")
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
        """执行一次工具调用并产出 action/observation 事件"""
        step = TOOL_STEP.get(tc.name)
        if step and step not in self.completed_steps:
            await self._emit("step_start", step=step)

        args_summary = self._summarize_args(tc.name, tc.arguments)
        await self._emit("action", step=step, content=args_summary,
                         data={"tool": tc.name, "arguments": tc.arguments})

        ok, observation = await self._execute_tool(tc.name, tc.arguments)
        await self._emit("observation", step=step, content=observation,
                         data={"tool": tc.name, "success": ok})

        if ok and step and step not in self.completed_steps:
            self.completed_steps.append(step)
            await self._emit("step_end", step=step,
                             content=f"{STEP_NAME[step]}完成")

        messages.append(LLMMessage(
            role="user",
            content=f"【工具结果】{tc.name}: {'成功' if ok else '失败'} — {observation}",
        ))

    @staticmethod
    def _summarize_args(tool_name: str, arguments: Dict[str, Any]) -> str:
        """生成工具调用的简短中文摘要"""
        if tool_name == "save_script_info":
            return f"保存基础信息：《{arguments.get('title', '?')}》"
        if tool_name == "save_background_story":
            return "保存背景故事与案件设定"
        if tool_name == "save_characters":
            chars = arguments.get("characters") or []
            names = "、".join(c.get("name", "?") for c in chars[:10])
            return f"保存 {len(chars)} 个角色：{names}"
        if tool_name == "save_locations":
            locs = arguments.get("locations") or []
            names = "、".join(l.get("name", "?") for l in locs[:10])
            return f"保存 {len(locs)} 个场景：{names}"
        if tool_name == "save_evidence":
            evs = arguments.get("evidence") or []
            return f"保存 {len(evs)} 条证据"
        if tool_name == "save_game_phases":
            phases = arguments.get("phases") or []
            return f"保存 {len(phases)} 个游戏阶段"
        if tool_name == "finish":
            return "完成生成"
        return f"调用工具 {tool_name}"

    # ------------------------------------------------------------------
    # 提示词构建
    # ------------------------------------------------------------------
    def _build_task_message(self) -> str:
        return (
            f"【创作任务】\n"
            f"主题：{self.theme}\n"
            f"类型：{self.script_type}\n"
            f"玩家数量：{self.player_count} 人（另需 1 名受害者，角色总数通常为 {self.player_count + 1}）\n"
            f"请开始创作，先调用 save_script_info 确定基础信息。"
        )

    def _build_progress_message(self) -> str:
        done_names = self._format_steps(self.completed_steps) if self.completed_steps else "无"
        missing = self._missing_required_steps()
        parts = [f"【当前进度】已完成: {done_names}"]
        if missing:
            parts.append(f"剩余步骤: {self._format_steps(missing)}，请继续。")
        elif "game_phases" not in self.completed_steps:
            parts.append("仅剩游戏阶段（也可直接 finish 使用默认流程）。")
        else:
            parts.append("全部步骤已完成，请调用 finish 收尾。")
        # 一致性上下文
        if self._context.get("characters"):
            parts.append("【已确定角色】" + "、".join(self._context["characters"]))
        if self._context.get("locations"):
            parts.append("【已创建场景】" + "、".join(self._context["locations"]))
        return "\n".join(parts)

    def _missing_required_steps(self) -> List[str]:
        return [s for s in REQUIRED_STEPS if s not in self.completed_steps]

    @staticmethod
    def _format_steps(steps: List[str]) -> str:
        return "、".join(STEP_NAME.get(s, s) for s in steps)

    # ------------------------------------------------------------------
    # 工具执行（校验 + 落库）
    # ------------------------------------------------------------------
    async def _execute_tool(self, name: str, args: Dict[str, Any]) -> Tuple[bool, str]:
        """执行工具，返回 (是否成功, 观察结果描述)"""
        try:
            if name == "save_script_info":
                return self._tool_save_script_info(args)
            if name == "save_background_story":
                return self._tool_save_background_story(args)
            if name == "save_characters":
                return self._tool_save_characters(args)
            if name == "save_locations":
                return self._tool_save_locations(args)
            if name == "save_evidence":
                return self._tool_save_evidence(args)
            if name == "save_game_phases":
                return self._tool_save_game_phases(args)
            if name == "finish":
                return await self._tool_finish(args)
            return False, f"未知工具: {name}"
        except Exception as e:
            logger.error(f"[GEN_AGENT] 工具执行异常 {name}: {e}", exc_info=True)
            return False, f"工具执行异常: {e}"

    def _tool_save_script_info(self, args: Dict[str, Any]) -> Tuple[bool, str]:
        title = (args.get("title") or "").strip()
        description = (args.get("description") or "").strip()
        if not title:
            return False, "标题不能为空"
        if not description:
            return False, "简介不能为空"

        from ..db.models.script_model import ScriptDBModel
        with self._db_session_factory() as db:
            script = db.query(ScriptDBModel).filter(ScriptDBModel.id == self.script_id).first()
            if not script:
                return False, f"剧本不存在: ID={self.script_id}"
            script.title = _clamp(title, 255)
            script.description = description
            if args.get("player_count"):
                script.player_count = int(args["player_count"])
            if args.get("difficulty"):
                script.difficulty_level = _clamp(args["difficulty"], 20)
            if args.get("category"):
                script.category = _clamp(args["category"], 50)
            if args.get("tags"):
                script.tags = [str(t) for t in args["tags"]]
        self._context["title"] = title
        return True, f"基础信息已保存：《{title}》"

    def _tool_save_background_story(self, args: Dict[str, Any]) -> Tuple[bool, str]:
        required = ["setting_description", "incident_description", "victim_background",
                    "murder_method", "murder_location", "discovery_time"]
        missing = [k for k in required if not (args.get(k) or "").strip()]
        if missing:
            return False, f"背景故事缺少必要字段: {', '.join(missing)}"

        from ..schemas.background_story import BackgroundStory
        from ..db.repositories.background_story_repository import BackgroundStoryRepository
        story = BackgroundStory(
            script_id=self.script_id,
            title=_clamp(args.get("title") or self._context.get("title") or "案件背景", 255),
            setting_description=args["setting_description"].strip(),
            incident_description=args["incident_description"].strip(),
            victim_background=args["victim_background"].strip(),
            investigation_scope=(args.get("investigation_scope") or "").strip(),
            rules_reminder=(args.get("rules_reminder") or "").strip(),
            murder_method=_clamp(args["murder_method"], 100),
            murder_location=_clamp(args["murder_location"], 255),
            discovery_time=_clamp(args["discovery_time"], 100),
            victory_conditions=args.get("victory_conditions") or {},
        )
        with self._db_session_factory() as db:
            repo = BackgroundStoryRepository(db)
            existing = repo.get_background_story_by_script(self.script_id)
            if existing and getattr(existing, "id", None):
                repo.update_background_story(existing.id, story)
            else:
                repo.add_background_story(story)
        self._context["murder_method"] = story.murder_method
        return True, "背景故事已保存"

    def _tool_save_characters(self, args: Dict[str, Any]) -> Tuple[bool, str]:
        characters = args.get("characters") or []
        if not isinstance(characters, list) or not characters:
            return False, "角色列表不能为空"

        murderers = [c for c in characters if c.get("is_murderer")]
        victims = [c for c in characters if c.get("is_victim")]
        if len(murderers) != 1:
            return False, f"必须恰好1名凶手，当前{len(murderers)}名"
        if len(victims) != 1:
            return False, f"必须恰好1名受害者，当前{len(victims)}名"
        if murderers[0] is victims[0] or murderers[0].get("name") == victims[0].get("name"):
            return False, "凶手和受害者不能是同一人"
        participants = [c for c in characters if not c.get("is_victim")]
        if len(participants) < 2:
            return False, "除受害者外至少需要2名可参与角色"
        names = [c.get("name", "").strip() for c in characters]
        if any(not n for n in names):
            return False, "存在未命名的角色"
        if len(set(names)) != len(names):
            return False, "角色姓名不能重复"
        for c in characters:
            for field in ("background", "secret", "objective"):
                if not (c.get(field) or "").strip():
                    return False, f"角色「{c.get('name', '?')}」缺少字段: {field}"

        from ..schemas.script_character import ScriptCharacter
        from ..db.repositories.character_repository import CharacterRepository
        with self._db_session_factory() as db:
            repo = CharacterRepository(db)
            repo.delete_characters_by_script(self.script_id)
            for c in characters:
                repo.add_character(ScriptCharacter(
                    script_id=self.script_id,
                    name=_clamp(c["name"], 100),
                    age=c.get("age"),
                    gender=_clamp(c.get("gender") or "中性", 10),
                    profession=_clamp(c.get("profession"), 100),
                    background=c["background"].strip(),
                    secret=c["secret"].strip(),
                    objective=c["objective"].strip(),
                    is_murderer=bool(c.get("is_murderer")),
                    is_victim=bool(c.get("is_victim")),
                    personality_traits=[str(t) for t in (c.get("personality_traits") or [])],
                ))
        self._context["characters"] = names
        self._context["murderer"] = murderers[0].get("name")
        self._context["victim"] = victims[0].get("name")
        return True, f"已保存 {len(characters)} 个角色（凶手: {murderers[0].get('name')}, 受害者: {victims[0].get('name')}）"

    def _tool_save_locations(self, args: Dict[str, Any]) -> Tuple[bool, str]:
        locations = args.get("locations") or []
        if not isinstance(locations, list) or not locations:
            return False, "场景列表不能为空"
        names = [(l.get("name") or "").strip() for l in locations]
        if any(not n for n in names):
            return False, "存在未命名的场景"
        if len(set(names)) != len(names):
            return False, "场景名称不能重复"
        if not any(l.get("is_crime_scene") for l in locations):
            return False, "至少需要1个案发现场"

        from ..schemas.script_location import ScriptLocation
        from ..db.repositories.location_repository import LocationRepository
        with self._db_session_factory() as db:
            repo = LocationRepository(db)
            repo.delete_locations_by_script(self.script_id)
            for l in locations:
                repo.add_location(ScriptLocation(
                    script_id=self.script_id,
                    name=_clamp(l["name"], 255),
                    description=(l.get("description") or "").strip(),
                    searchable_items=[str(i) for i in (l.get("searchable_items") or [])],
                    is_crime_scene=bool(l.get("is_crime_scene")),
                ))
        self._context["locations"] = names
        return True, f"已保存 {len(locations)} 个场景：{'、'.join(names)}"

    def _tool_save_evidence(self, args: Dict[str, Any]) -> Tuple[bool, str]:
        evidence_list = args.get("evidence") or []
        if not isinstance(evidence_list, list) or not evidence_list:
            return False, "证据列表不能为空"
        min_count = 5
        if len(evidence_list) < min_count:
            return False, f"证据数量不足，至少需要{min_count}条（当前{len(evidence_list)}条），请补充误导性线索"

        known_locations = set(self._context.get("locations") or [])
        from ..schemas.script_evidence import ScriptEvidence
        from ..schemas.evidence_type import EvidenceType
        normalized = []
        for e in evidence_list:
            if not (e.get("name") or "").strip():
                return False, "存在未命名的证据"
            if not (e.get("description") or "").strip():
                return False, f"证据「{e.get('name', '?')}」缺少描述"
            if not (e.get("location") or "").strip():
                return False, f"证据「{e.get('name', '?')}」缺少发现地点"
            if known_locations and e["location"].strip() not in known_locations:
                return False, f"证据「{e.get('name')}」的发现地点「{e['location']}」不在已创建的场景中（可选: {'、'.join(known_locations)}）"
            raw_type = str(e.get("evidence_type") or "PHYSICAL").upper()
            try:
                ev_type = EvidenceType(raw_type)
            except ValueError:
                ev_type = EvidenceType.PHYSICAL
            normalized.append((e, ev_type))

        from ..db.repositories.evidence_repository import EvidenceRepository
        with self._db_session_factory() as db:
            repo = EvidenceRepository(db)
            repo.delete_evidence_by_script(self.script_id)
            for e, ev_type in normalized:
                repo.add_evidence(ScriptEvidence(
                    script_id=self.script_id,
                    name=_clamp(e["name"], 255),
                    location=_clamp(e["location"], 255),
                    description=e["description"].strip(),
                    related_to=_clamp(e.get("related_to"), 100),
                    significance=(e.get("significance") or "").strip(),
                    evidence_type=ev_type,
                    importance=_clamp(e.get("importance") or "重要证据", 20),
                    is_hidden=bool(e.get("is_hidden")),
                ))
        return True, f"已保存 {len(normalized)} 条证据"

    def _tool_save_game_phases(self, args: Dict[str, Any]) -> Tuple[bool, str]:
        phases = args.get("phases") or []
        if not isinstance(phases, list) or not phases:
            return False, "阶段列表不能为空"

        from ..schemas.game_phase import GamePhase, GamePhaseEnum
        valid = []
        for i, p in enumerate(phases):
            raw = str(p.get("phase") or "").upper()
            try:
                phase_enum = GamePhaseEnum(raw)
            except ValueError:
                return False, f"无效的阶段标识「{p.get('phase')}」，可选: {'/'.join(e.value for e in GamePhaseEnum)}"
            if not (p.get("name") or "").strip():
                return False, f"阶段 {raw} 缺少名称"
            valid.append(GamePhase(
                script_id=self.script_id,
                phase=phase_enum,
                name=_clamp(p["name"], 100),
                description=(p.get("description") or "").strip(),
                order_index=i,
            ))
        self._persist_game_phases(valid)
        return True, f"已保存 {len(valid)} 个游戏阶段"

    def _persist_game_phases(self, phases: List[Any]):
        from ..db.repositories.game_phase_repository import GamePhaseRepository
        with self._db_session_factory() as db:
            repo = GamePhaseRepository(db)
            repo.delete_game_phases_by_script(self.script_id)
            for p in phases:
                repo.add_game_phase(p)

    async def _tool_finish(self, args: Dict[str, Any]) -> Tuple[bool, str]:
        missing = self._missing_required_steps()
        if missing:
            return False, f"尚有必需步骤未完成: {self._format_steps(missing)}，请先完成再 finish"

        # 游戏阶段缺失时补默认流程，保证剧本可直接游玩
        if "game_phases" not in self.completed_steps:
            from ..schemas.game_phase import GamePhase, GamePhaseEnum
            defaults = [
                (GamePhaseEnum.BACKGROUND, "背景介绍", "主持人介绍案件背景"),
                (GamePhaseEnum.INTRODUCTION, "自我介绍", "玩家角色依次自我介绍"),
                (GamePhaseEnum.EVIDENCE_COLLECTION, "搜证阶段", "在各场景中搜集证据"),
                (GamePhaseEnum.DISCUSSION, "自由讨论", "玩家讨论线索、互相质询"),
                (GamePhaseEnum.VOTING, "投票表决", "投票指认凶手"),
                (GamePhaseEnum.REVELATION, "真相揭晓", "公布真相与结局"),
            ]
            self._persist_game_phases([
                GamePhase(script_id=self.script_id, phase=p, name=n, description=d, order_index=i)
                for i, (p, n, d) in enumerate(defaults)
            ])
            self.completed_steps.append("game_phases")
            await self._emit("step_start", step="game_phases")
            await self._emit("step_end", step="game_phases", content="游戏阶段已使用默认流程")

        self.finish_summary = (args.get("summary") or "剧本生成完成").strip()
        return True, self.finish_summary
