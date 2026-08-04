"""剧本生成 Agent（ReAct 循环）单元测试

不依赖真实数据库与真实 LLM：
- LLM 用 FakeLLM 按脚本返回 tool_calls 序列
- 数据库通过注入的 db_session_factory + monkeypatch 的仓储类接管
"""
import asyncio
from contextlib import contextmanager
from typing import Any, Dict, List
from unittest.mock import Mock

import pytest

from src.agents.script_generation_agent import (
    ScriptGenerationAgent,
    GENERATION_STEPS,
    REQUIRED_STEPS,
)
from src.services.llm_service import LLMResponse, ToolCall


# ---------------------------------------------------------------------------
# Fakes
# ---------------------------------------------------------------------------
class FakeLLM:
    """按预设脚本返回响应的假 LLM"""

    def __init__(self, responses: List[Any]):
        self.responses = list(responses)
        self.calls: List[Dict[str, Any]] = []

    async def chat_completion(self, messages, **kwargs):
        self.calls.append({"messages": list(messages), "kwargs": kwargs})
        if not self.responses:
            return LLMResponse(content="（无更多响应）")
        result = self.responses.pop(0)
        if isinstance(result, Exception):
            raise result
        return result


class FakeQuery:
    def __init__(self, script):
        self._script = script

    def filter(self, *args, **kwargs):
        return self

    def first(self):
        return self._script


class FakeDB:
    """假数据库会话，仅支持 script 主表的 query 链"""

    def __init__(self, script):
        self._script = script

    def query(self, model):
        return FakeQuery(self._script)


@contextmanager
def _noop_commit_scope(db):
    yield db


def _make_db_factory(saved: Dict[str, Any]):
    """生成 db_session_factory；saved['script'] 为假剧本主表行"""
    script = saved.setdefault("script", Mock(
        id=1, title="", description="", player_count=4,
        difficulty_level="medium", category="推理", tags=[],
    ))
    db = FakeDB(script)
    return lambda: _noop_commit_scope(db)


class FakeBackgroundStoryRepo:
    saved: List[Any] = []

    def __init__(self, db):
        pass

    def get_background_story_by_script(self, script_id):
        return None

    def add_background_story(self, story):
        FakeBackgroundStoryRepo.saved.append(story)
        return story


class FakeCharacterRepo:
    saved: List[Any] = []
    deleted: List[int] = []

    def __init__(self, db):
        pass

    def delete_characters_by_script(self, script_id):
        FakeCharacterRepo.deleted.append(script_id)
        return True

    def add_character(self, character):
        FakeCharacterRepo.saved.append(character)
        return character


class FakeLocationRepo:
    saved: List[Any] = []

    def __init__(self, db):
        pass

    def delete_locations_by_script(self, script_id):
        return True

    def add_location(self, location):
        FakeLocationRepo.saved.append(location)
        return location


class FakeEvidenceRepo:
    saved: List[Any] = []

    def __init__(self, db):
        pass

    def delete_evidence_by_script(self, script_id):
        return True

    def add_evidence(self, evidence):
        FakeEvidenceRepo.saved.append(evidence)
        return evidence


class FakeGamePhaseRepo:
    saved: List[Any] = []

    def __init__(self, db):
        pass

    def delete_game_phases_by_script(self, script_id):
        return True

    def add_game_phase(self, phase):
        FakeGamePhaseRepo.saved.append(phase)
        return phase


@pytest.fixture(autouse=True)
def patch_repositories(monkeypatch):
    """用假仓储替换真实仓储（Agent 内为函数级延迟 import，补丁在调用时生效）"""
    for cls in (FakeBackgroundStoryRepo, FakeCharacterRepo, FakeLocationRepo,
                FakeEvidenceRepo, FakeGamePhaseRepo):
        cls.saved = []
    FakeCharacterRepo.deleted = []

    monkeypatch.setattr(
        "src.db.repositories.background_story_repository.BackgroundStoryRepository",
        FakeBackgroundStoryRepo)
    monkeypatch.setattr(
        "src.db.repositories.character_repository.CharacterRepository",
        FakeCharacterRepo)
    monkeypatch.setattr(
        "src.db.repositories.location_repository.LocationRepository",
        FakeLocationRepo)
    monkeypatch.setattr(
        "src.db.repositories.evidence_repository.EvidenceRepository",
        FakeEvidenceRepo)
    monkeypatch.setattr(
        "src.db.repositories.game_phase_repository.GamePhaseRepository",
        FakeGamePhaseRepo)


# ---------------------------------------------------------------------------
# 构造工具
# ---------------------------------------------------------------------------
def _tc(name: str, arguments: Dict[str, Any]) -> ToolCall:
    return ToolCall(name=name, arguments=arguments)


VALID_INFO = {"title": "午夜咖啡馆", "description": "深夜咖啡馆里的命案",
              "player_count": 4, "difficulty": "medium", "tags": ["本格"]}
VALID_BG = {
    "title": "午夜咖啡馆",
    "setting_description": "雨夜的老城区",
    "incident_description": "店主被发现死于吧台后",
    "victim_background": "店主为人和善",
    "murder_method": "毒杀",
    "murder_location": "吧台",
    "discovery_time": "23:00",
}
VALID_CHARACTERS = {"characters": [
    {"name": "林晓", "background": "常客", "secret": "暗恋店主", "objective": "找出真相",
     "is_murderer": False, "is_victim": False},
    {"name": "赵铁", "background": "供货商", "secret": "欠赌债", "objective": "掩盖债务",
     "is_murderer": True, "is_victim": False},
    {"name": "陈老板", "background": "店主", "secret": "知道太多", "objective": "活下去",
     "is_murderer": False, "is_victim": True},
]}
VALID_LOCATIONS = {"locations": [
    {"name": "吧台", "description": "调酒的地方", "is_crime_scene": True},
    {"name": "储藏室", "description": "堆放杂物", "is_crime_scene": False},
]}
VALID_EVIDENCE = {"evidence": [
    {"name": f"证据{i}", "location": "吧台", "description": f"描述{i}",
     "evidence_type": "physical"}  # 小写，测试归一化
    for i in range(5)
]}
VALID_PHASES = {"phases": [
    {"phase": "BACKGROUND", "name": "背景介绍"},
    {"phase": "VOTING", "name": "投票表决"},
]}


def _happy_path_responses() -> List[LLMResponse]:
    return [
        LLMResponse(content="先确定基础信息", tool_calls=[_tc("save_script_info", VALID_INFO)]),
        LLMResponse(content="构思案件", tool_calls=[_tc("save_background_story", VALID_BG)]),
        LLMResponse(content="设计角色", tool_calls=[_tc("save_characters", VALID_CHARACTERS)]),
        LLMResponse(content="设计场景", tool_calls=[_tc("save_locations", VALID_LOCATIONS)]),
        LLMResponse(content="设计证据", tool_calls=[_tc("save_evidence", VALID_EVIDENCE)]),
        LLMResponse(content="设计阶段", tool_calls=[_tc("save_game_phases", VALID_PHASES)]),
        LLMResponse(content="收尾", tool_calls=[_tc("finish", {"summary": "创作完成"})]),
    ]


def _make_agent(llm, saved=None, max_iterations=15):
    events: List[Dict[str, Any]] = []

    async def callback(event):
        events.append(event)

    saved = saved if saved is not None else {}
    agent = ScriptGenerationAgent(
        script_id=1,
        theme="雨夜咖啡馆杀人事件",
        player_count=4,
        llm=llm,
        event_callback=callback,
        db_session_factory=_make_db_factory(saved),
        max_iterations=max_iterations,
    )
    return agent, events, saved


# ---------------------------------------------------------------------------
# 测试
# ---------------------------------------------------------------------------
@pytest.mark.unit
class TestScriptGenerationAgentLoop:
    def test_full_generation_loop(self):
        """完整流程：六个步骤按序执行并以 done 收尾"""
        llm = FakeLLM(_happy_path_responses())
        agent, events, _ = _make_agent(llm)

        result = asyncio.run(agent.run())

        assert result["status"] == "done"
        assert result["summary"] == "创作完成"
        for step, _ in GENERATION_STEPS:
            assert step in agent.completed_steps

        event_types = [e["type"] for e in events]
        # 每个步骤都有 step_start → action → observation → step_end
        for step, _ in GENERATION_STEPS:
            step_events = [e for e in events if e.get("step") == step]
            types = [e["type"] for e in step_events]
            assert "step_start" in types, f"{step} 缺少 step_start"
            assert "action" in types, f"{step} 缺少 action"
            assert "observation" in types, f"{step} 缺少 observation"
            assert "step_end" in types, f"{step} 缺少 step_end"
        assert event_types[-1] == "done"
        # 思考过程透出
        assert any(e["type"] == "thought" for e in events)
        # 工具按推荐顺序调用
        called_tools = [e["data"]["tool"] for e in events
                        if e["type"] == "action" and e.get("data")]
        assert called_tools == [
            "save_script_info", "save_background_story", "save_characters",
            "save_locations", "save_evidence", "save_game_phases", "finish",
        ]
        # 落库验证
        assert len(FakeCharacterRepo.saved) == 3
        assert len(FakeLocationRepo.saved) == 2
        assert len(FakeEvidenceRepo.saved) == 5
        assert len(FakeGamePhaseRepo.saved) == 2
        assert len(FakeBackgroundStoryRepo.saved) == 1

    def test_validation_failure_triggers_self_correction(self):
        """角色校验失败 → observation 反馈 → LLM 修正后重试成功"""
        bad_characters = {"characters": [
            {"name": "甲", "background": "x", "secret": "x", "objective": "x",
             "is_murderer": True, "is_victim": False},
            {"name": "乙", "background": "x", "secret": "x", "objective": "x",
             "is_murderer": True, "is_victim": False},
            {"name": "丙", "background": "x", "secret": "x", "objective": "x",
             "is_murderer": False, "is_victim": True},
        ]}
        llm = FakeLLM([
            LLMResponse(content="", tool_calls=[_tc("save_characters", bad_characters)]),
            LLMResponse(content="修正凶手数量", tool_calls=[_tc("save_characters", VALID_CHARACTERS)]),
            LLMResponse(content="", tool_calls=[_tc("save_script_info", VALID_INFO)]),
            LLMResponse(content="", tool_calls=[_tc("save_background_story", VALID_BG)]),
            LLMResponse(content="", tool_calls=[_tc("save_locations", VALID_LOCATIONS)]),
            LLMResponse(content="", tool_calls=[_tc("save_evidence", VALID_EVIDENCE)]),
            LLMResponse(content="", tool_calls=[_tc("finish", {"summary": "完成"})]),
        ])
        agent, events, _ = _make_agent(llm)

        result = asyncio.run(agent.run())

        assert result["status"] == "done"
        # 第一次角色保存失败，observation 包含失败原因
        failed_obs = [e for e in events if e["type"] == "observation"
                      and e.get("data") and e["data"].get("success") is False]
        assert failed_obs, "应有失败的 observation"
        assert "凶手" in failed_obs[0]["content"]
        # 失败原因回喂给了 LLM（后续调用的消息历史里可见）
        second_call_messages = llm.calls[1]["messages"]
        assert any("凶手" in (m.content or "") for m in second_call_messages)

    def test_evidence_type_case_normalized(self):
        """evidence_type 小写输入归一化为大写值（schema 存枚举 value 字符串）"""
        llm = FakeLLM(_happy_path_responses())
        agent, _, _ = _make_agent(llm)

        result = asyncio.run(agent.run())

        assert result["status"] == "done"
        assert all(str(ev.evidence_type) == "PHYSICAL"
                   for ev in FakeEvidenceRepo.saved)

    def test_evidence_location_must_match_created_locations(self):
        """证据发现地点不在已创建场景中 → 校验失败"""
        bad_evidence = {"evidence": [
            {"name": f"证据{i}", "location": "不存在的房间", "description": "x"}
            for i in range(5)
        ]}
        llm = FakeLLM([
            LLMResponse(content="", tool_calls=[_tc("save_locations", VALID_LOCATIONS)]),
            LLMResponse(content="", tool_calls=[_tc("save_evidence", bad_evidence)]),
            LLMResponse(content="", tool_calls=[_tc("finish", {"summary": "完成"})]),
        ])
        agent, events, _ = _make_agent(llm, max_iterations=10)

        asyncio.run(agent.run())

        ev_obs = [e for e in events if e["type"] == "observation"
                  and e.get("step") == "evidence"]
        assert ev_obs and ev_obs[0]["data"]["success"] is False
        assert "不存在的房间" in ev_obs[0]["content"]
        assert "evidence" not in agent.completed_steps

    def test_finish_with_missing_steps_rejected(self):
        """必需步骤未完成时 finish 被拒绝"""
        llm = FakeLLM([
            LLMResponse(content="", tool_calls=[_tc("save_script_info", VALID_INFO)]),
            LLMResponse(content="", tool_calls=[_tc("finish", {"summary": "提前收尾"})]),
            LLMResponse(content="继续补完", tool_calls=[_tc("save_background_story", VALID_BG)]),
            LLMResponse(content="", tool_calls=[_tc("save_characters", VALID_CHARACTERS)]),
            LLMResponse(content="", tool_calls=[_tc("save_locations", VALID_LOCATIONS)]),
            LLMResponse(content="", tool_calls=[_tc("save_evidence", VALID_EVIDENCE)]),
            LLMResponse(content="", tool_calls=[_tc("finish", {"summary": "完成"})]),
        ])
        agent, events, _ = _make_agent(llm)

        result = asyncio.run(agent.run())

        assert result["status"] == "done"
        finish_obs = [e for e in events if e["type"] == "observation"
                      and e.get("data") and e["data"].get("tool") == "finish"]
        assert finish_obs[0]["data"]["success"] is False
        assert "未完成" in finish_obs[0]["content"]

    def test_finish_backfills_default_game_phases(self):
        """finish 时缺少游戏阶段 → 自动补默认流程"""
        llm = FakeLLM([
            LLMResponse(content="", tool_calls=[_tc("save_script_info", VALID_INFO)]),
            LLMResponse(content="", tool_calls=[_tc("save_background_story", VALID_BG)]),
            LLMResponse(content="", tool_calls=[_tc("save_characters", VALID_CHARACTERS)]),
            LLMResponse(content="", tool_calls=[_tc("save_locations", VALID_LOCATIONS)]),
            LLMResponse(content="", tool_calls=[_tc("save_evidence", VALID_EVIDENCE)]),
            LLMResponse(content="", tool_calls=[_tc("finish", {"summary": "完成"})]),
        ])
        agent, _, _ = _make_agent(llm)

        result = asyncio.run(agent.run())

        assert result["status"] == "done"
        assert "game_phases" in agent.completed_steps
        assert len(FakeGamePhaseRepo.saved) == 6  # 默认六阶段

    def test_cancel_stops_loop(self):
        """取消后循环在下一次检查时停止"""
        llm = FakeLLM(_happy_path_responses())
        agent, events, _ = _make_agent(llm)

        original_emit = agent._emit

        async def emit_and_cancel(event_type, *args, **kwargs):
            await original_emit(event_type, *args, **kwargs)
            if event_type == "step_end":  # 第一步完成后请求取消
                agent.cancel()

        agent._emit = emit_and_cancel

        result = asyncio.run(agent.run())

        assert result["status"] == "cancelled"
        assert events[-1]["type"] == "cancelled"
        assert len(agent.completed_steps) < len(GENERATION_STEPS)

    def test_max_iterations_with_missing_steps_returns_error(self):
        """模型始终不调用工具 → 达到最大轮次且缺步骤 → error"""
        llm = FakeLLM([LLMResponse(content="我在想……") for _ in range(20)])
        agent, events, _ = _make_agent(llm, max_iterations=3)

        result = asyncio.run(agent.run())

        assert result["status"] == "error"
        assert "最大轮次" in result["message"]
        assert events[-1]["type"] == "error"

    def test_fallback_json_action_mode(self):
        """provider 不支持工具调用 → 降级为 JSON 行动模式"""
        llm = FakeLLM([
            RuntimeError("tools is not supported in this model"),
            LLMResponse(content='{"action": "save_script_info", "arguments": ' +
                                '{"title": "午夜咖啡馆", "description": "深夜命案"}}'),
            LLMResponse(content="", tool_calls=None),  # 无行动，等待后续响应兜底
        ])
        agent, events, _ = _make_agent(llm, max_iterations=2)

        result = asyncio.run(agent.run())

        assert agent._tools_supported is False
        assert "script_info" in agent.completed_steps
        actions = [e for e in events if e["type"] == "action"]
        assert actions and actions[0]["data"]["tool"] == "save_script_info"

    def test_reasoning_content_emitted_as_thought(self):
        """reasoning_content 与 <think> 标签都以 thought 事件透出"""
        llm = FakeLLM([
            LLMResponse(
                content="<think>先想想标题</think>确定基础信息",
                reasoning_content="深度推理过程……",
                tool_calls=[_tc("save_script_info", VALID_INFO)],
            ),
            LLMResponse(content="", tool_calls=[_tc("save_background_story", VALID_BG)]),
            LLMResponse(content="", tool_calls=[_tc("save_characters", VALID_CHARACTERS)]),
            LLMResponse(content="", tool_calls=[_tc("save_locations", VALID_LOCATIONS)]),
            LLMResponse(content="", tool_calls=[_tc("save_evidence", VALID_EVIDENCE)]),
            LLMResponse(content="", tool_calls=[_tc("finish", {"summary": "完成"})]),
        ])
        agent, events, _ = _make_agent(llm)

        asyncio.run(agent.run())

        thoughts = [e for e in events if e["type"] == "thought"]
        reasoning_texts = [t["content"] for t in thoughts if t.get("kind") == "reasoning"]
        text_thoughts = [t["content"] for t in thoughts if t.get("kind") == "text"]
        assert "深度推理过程……" in reasoning_texts
        assert any("先想想标题" in t for t in reasoning_texts)
        assert any("确定基础信息" in t for t in text_thoughts)


@pytest.mark.unit
class TestCharacterValidation:
    """角色校验规则"""

    def _run_characters_tool(self, characters):
        agent, _, _ = _make_agent(FakeLLM([]))
        return asyncio.run(agent._execute_tool("save_characters", {"characters": characters}))

    def test_requires_exactly_one_victim(self):
        ok, msg = self._run_characters_tool([
            {"name": "甲", "background": "x", "secret": "x", "objective": "x", "is_murderer": True},
            {"name": "乙", "background": "x", "secret": "x", "objective": "x"},
        ])
        assert ok is False and "受害者" in msg

    def test_murderer_and_victim_cannot_be_same(self):
        ok, msg = self._run_characters_tool([
            {"name": "甲", "background": "x", "secret": "x", "objective": "x",
             "is_murderer": True, "is_victim": True},
            {"name": "乙", "background": "x", "secret": "x", "objective": "x"},
        ])
        assert ok is False and "同一人" in msg

    def test_duplicate_names_rejected(self):
        ok, msg = self._run_characters_tool([
            {"name": "甲", "background": "x", "secret": "x", "objective": "x", "is_murderer": True},
            {"name": "乙", "background": "x", "secret": "x", "objective": "x", "is_victim": True},
            {"name": "丙", "background": "x", "secret": "x", "objective": "x"},
            {"name": "丙", "background": "x", "secret": "x", "objective": "x"},
        ])
        assert ok is False and "重复" in msg

    def test_missing_required_fields_rejected(self):
        ok, msg = self._run_characters_tool([
            {"name": "甲", "background": "", "secret": "x", "objective": "x", "is_murderer": True},
            {"name": "乙", "background": "x", "secret": "x", "objective": "x", "is_victim": True},
            {"name": "丙", "background": "x", "secret": "x", "objective": "x"},
        ])
        assert ok is False and "background" in msg

    def test_old_characters_replaced_on_resave(self):
        ok, _ = self._run_characters_tool(VALID_CHARACTERS["characters"])
        assert ok is True
        assert FakeCharacterRepo.deleted == [1]  # 先删后写
