"""剧本编辑 Agent（ReAct 循环）单元测试

不依赖真实数据库与真实 LLM：
- LLM 用 FakeLLM 按脚本返回 tool_calls 序列
- 数据库为内存 SQLite（复用 test_script_editor_incremental.py 的基建模式）

覆盖：
a) 脚本化多轮逐个创建 + 事件序列 + tool_results/successful_ops
b) 校验失败作为 observation 回喂 LLM 自我修正
c) game_phases 四工具
d) bind_character_voice（mock 音色列表）
e) JSON 行动降级模式
f) 事件回调抛异常不影响主流程
另含 plan_only 计划模式（HTTP /parse-instruction 依赖）
"""
import asyncio
import os
import sys
from typing import Any, Dict, List
from unittest.mock import patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.db.base import SQLAlchemyBase
from src.db import models  # noqa: F401  # 确保全部ORM模型注册到metadata
from src.db.models.script_model import ScriptDBModel
from src.db.models.character import CharacterDBModel
from src.db.models.evidence import EvidenceDBModel
from src.db.models.location import LocationDBModel
from src.db.models.game_phase import GamePhaseDBModel
from src.agents.script_editing_agent import ScriptEditingAgent
from src.schemas.game_phase import GamePhaseEnum
from src.services.llm_service import LLMResponse, ToolCall

pytestmark = pytest.mark.unit


# ---------------------------------------------------------------------------
# Fakes / fixtures
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
        if callable(result):
            return result(kwargs)
        return result


@pytest.fixture
def db_session():
    """内存 SQLite 会话，用于验证真实 SQL 行为"""
    engine = create_engine("sqlite:///:memory:")
    SQLAlchemyBase.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine)
    session = session_factory()
    yield session
    session.close()


@pytest.fixture
def script_id(db_session):
    """创建带基础子实体的测试剧本"""
    db_script = ScriptDBModel(title="测试剧本", description="测试描述", player_count=4)
    db_session.add(db_script)
    db_session.flush()
    db_session.add(CharacterDBModel(
        script_id=db_script.id, name="张三", profession="侦探",
        background="一个经验丰富的侦探", secret="隐藏的秘密", objective="找出真相", gender="男"
    ))
    db_session.add(EvidenceDBModel(
        script_id=db_script.id, name="血迹", description="地毯上的血迹",
        location="书房", evidence_type="PHYSICAL"
    ))
    db_session.add(LocationDBModel(script_id=db_script.id, name="书房", description="堆满书籍的房间"))
    db_session.add_all([
        GamePhaseDBModel(script_id=db_script.id, phase=GamePhaseEnum.BACKGROUND,
                         name="背景介绍", description="背景阶段", order_index=0),
        GamePhaseDBModel(script_id=db_script.id, phase=GamePhaseEnum.DISCUSSION,
                         name="自由讨论", description="讨论阶段", order_index=1),
        GamePhaseDBModel(script_id=db_script.id, phase=GamePhaseEnum.VOTING,
                         name="投票表决", description="投票阶段", order_index=2),
    ])
    db_session.commit()
    return db_script.id


def _tc(name: str, arguments: Dict[str, Any]) -> ToolCall:
    return ToolCall(name=name, arguments=arguments)


def _character_args(name: str, **overrides) -> Dict[str, Any]:
    """可通过必填与内容质量校验的角色参数"""
    args = {
        "name": name,
        "profession": "律师",
        "background": f"{name}是一名从业二十年的资深律师，经手过大量刑事案件，逻辑缜密，言辞犀利，在业内享有很高的声誉，深受同行尊敬。",
        "secret": f"{name}曾经为真正的凶手辩护过，这件事一直是他心中的阴影和负担。",
        "objective": "找出案件真相，弥补自己当年辩护失误造成的遗憾。",
        "gender": "男",
        "age": 45,
        "personality_traits": ["冷静", "敏锐", "固执"],
        "is_murderer": False,
        "is_victim": False,
    }
    args.update(overrides)
    return args


def _make_agent(llm, db_session, script_id, instruction="帮我设计角色", **kwargs):
    events: List[Dict[str, Any]] = []

    async def callback(event):
        events.append(event)

    agent = ScriptEditingAgent(
        script_id=script_id,
        instruction=instruction,
        db_session=db_session,
        event_callback=callback,
        llm=llm,
        **kwargs,
    )
    return agent, events


def _run(coro):
    return asyncio.run(coro)


# ---------------------------------------------------------------------------
# a) 脚本化多轮：逐个创建 + 事件序列 + 结果汇总
# ---------------------------------------------------------------------------
class TestScriptedMultiRound:
    def test_batch_create_characters_one_by_one(self, db_session, script_id):
        """"帮我设计两个角色" → 逐轮 add_character → finish，逐个落库"""
        llm = FakeLLM([
            LLMResponse(content="先规划一下", tool_calls=[_tc("plan", {"plan": "添加两个角色"})]),
            LLMResponse(content="添加第一个角色", tool_calls=[_tc("add_character", _character_args("王五"))]),
            LLMResponse(content="添加第二个角色", tool_calls=[_tc("add_character", _character_args("赵六", gender="女"))]),
            LLMResponse(content="收尾", tool_calls=[_tc("finish", {"summary": "已添加 2 个角色"})]),
        ])
        agent, events = _make_agent(llm, db_session, script_id, instruction="帮我设计两个角色")

        result = _run(agent.run())

        assert result["status"] == "done"
        assert result["summary"] == "已添加 2 个角色"
        assert result["successful_ops"] == 2
        # tool_results 不含 plan/finish
        assert [tr["description"] for tr in result["tool_results"]] == ["添加角色：王五", "添加角色：赵六"]
        assert all(tr["action"] == "add" and tr["target"] == "character" for tr in result["tool_results"])
        assert all(tr["success"] for tr in result["tool_results"])
        # 逐个落库（flush 后同会话可见）
        names = {c.name for c in db_session.query(CharacterDBModel).filter_by(script_id=script_id).all()}
        assert {"张三", "王五", "赵六"}.issubset(names)

        # 事件序列：每次工具调用都是 step_start → action → observation → step_end
        char_events = [e for e in events if e.get("step") == "characters"]
        assert [e["type"] for e in char_events] == (
            ["step_start", "action", "observation", "step_end"] * 2
        )
        assert char_events[0]["step_name"] == "角色管理"
        assert all(e["timestamp"] for e in events)
        # plan 步骤与 thought、done 事件
        assert any(e["type"] == "step_start" and e.get("step") == "plan" for e in events)
        assert any(e["type"] == "thought" for e in events)
        assert events[-1]["type"] == "done"
        # finish 只有 action/observation，不占步骤
        finish_events = [e for e in events if e.get("data") and e["data"].get("tool") == "finish"]
        assert [e["type"] for e in finish_events] == ["action", "observation"]

    def test_thought_emitted_from_reasoning_and_think_tags(self, db_session, script_id):
        """reasoning_content 与 <think> 标签都以 thought 事件透出"""
        llm = FakeLLM([
            LLMResponse(
                content="<think>先想想要改谁</think>删除血迹",
                reasoning_content="深度推理过程……",
                tool_calls=[_tc("delete_evidence", {"name": "血迹"})],
            ),
            LLMResponse(content="", tool_calls=[_tc("finish", {"summary": "完成"})]),
        ])
        agent, events = _make_agent(llm, db_session, script_id)

        result = _run(agent.run())

        assert result["status"] == "done"
        thoughts = [e for e in events if e["type"] == "thought"]
        reasoning_texts = [t["content"] for t in thoughts if t.get("kind") == "reasoning"]
        text_thoughts = [t["content"] for t in thoughts if t.get("kind") == "text"]
        assert "深度推理过程……" in reasoning_texts
        assert any("先想想要改谁" in t for t in reasoning_texts)
        assert any("删除血迹" in t for t in text_thoughts)
        assert db_session.query(EvidenceDBModel).filter_by(script_id=script_id).count() == 0


# ---------------------------------------------------------------------------
# b) 校验失败回喂 LLM 自我修正
# ---------------------------------------------------------------------------
class TestValidationFeedback:
    def test_validation_failure_fed_back_and_corrected(self, db_session, script_id):
        """add_character 缺必填 → observation 失败 → LLM 修正后重试成功"""
        llm = FakeLLM([
            LLMResponse(content="", tool_calls=[_tc("add_character", {"name": "缺字段"})]),
            LLMResponse(content="补齐字段重试", tool_calls=[_tc("add_character", _character_args("王五"))]),
            LLMResponse(content="", tool_calls=[_tc("finish", {"summary": "完成"})]),
        ])
        agent, events = _make_agent(llm, db_session, script_id)

        result = _run(agent.run())

        assert result["status"] == "done"
        assert result["successful_ops"] == 1
        assert [tr["success"] for tr in result["tool_results"]] == [False, True]
        # 失败的 observation 携带校验原因
        failed_obs = [e for e in events if e["type"] == "observation"
                      and e.get("data") and e["data"].get("success") is False]
        assert failed_obs and "缺少必填字段" in failed_obs[0]["content"]
        # 失败原因回喂给了 LLM（后续调用的消息历史里可见）
        second_call_messages = llm.calls[1]["messages"]
        assert any("缺少必填字段" in (m.content or "") for m in second_call_messages)
        # 最终只落库修正后的一个角色
        names = {c.name for c in db_session.query(CharacterDBModel).filter_by(script_id=script_id).all()}
        assert names == {"张三", "王五"}

    def test_text_wrapup_after_failure_is_not_treated_as_done(self, db_session, script_id):
        """工具调用失败后模型用文本收尾：回喂要求修正重试，而非按完成处理（真实模型常见行为）"""
        llm = FakeLLM([
            LLMResponse(content="添加角色", tool_calls=[_tc("add_character", {"name": "王五", "profession": "记者"})]),
            # 失败后模型没有用工具重试，而是文本道歉收尾——循环不得在此结束
            LLMResponse(content="抱歉，参数不完整，我来补齐"),
            LLMResponse(content="补齐重试", tool_calls=[_tc("add_character", _character_args("王五"))]),
            LLMResponse(content="", tool_calls=[_tc("finish", {"summary": "完成"})]),
        ])
        agent, events = _make_agent(llm, db_session, script_id)

        result = _run(agent.run())

        assert result["status"] == "done"
        assert result["successful_ops"] == 1
        assert [tr["success"] for tr in result["tool_results"]] == [False, True]
        # 文本收尾后循环继续：第三次调用的消息历史里包含"修正参数后重试"的回喂
        assert len(llm.calls) == 4
        third_call_messages = llm.calls[2]["messages"]
        assert any("修正参数后重试" in (m.content or "") for m in third_call_messages)
        names = {c.name for c in db_session.query(CharacterDBModel).filter_by(script_id=script_id).all()}
        assert names == {"张三", "王五"}

    def test_text_wrapup_after_all_success_still_completes(self, db_session, script_id):
        """全部操作成功后模型文本收尾：仍按完成处理（正常路径不回归）"""
        llm = FakeLLM([
            LLMResponse(content="添加角色", tool_calls=[_tc("add_character", _character_args("王五"))]),
            LLMResponse(content="角色已添加完成"),
        ])
        agent, _events = _make_agent(llm, db_session, script_id)

        result = _run(agent.run())

        assert result["status"] == "done"
        assert result["successful_ops"] == 1
        assert len(llm.calls) == 2


# ---------------------------------------------------------------------------
# c) game_phases 四工具
# ---------------------------------------------------------------------------
class TestGamePhaseTools:
    def test_add_update_reorder_delete_game_phases(self, db_session, script_id):
        llm = FakeLLM([
            LLMResponse(content="", tool_calls=[
                _tc("add_game_phase", {"name": "搜证阶段", "description": "在各场景搜集证据"}),
            ]),
            LLMResponse(content="", tool_calls=[
                _tc("update_game_phase", {"name": "自由讨论", "description": "玩家互相质询"}),
            ]),
            LLMResponse(content="", tool_calls=[
                _tc("reorder_game_phases", {"ordered_names": ["背景介绍", "搜证阶段", "自由讨论", "投票表决"]}),
            ]),
            LLMResponse(content="", tool_calls=[
                _tc("delete_game_phase", {"name": "投票表决"}),
            ]),
            LLMResponse(content="", tool_calls=[_tc("finish", {"summary": "阶段调整完成"})]),
        ])
        agent, events = _make_agent(llm, db_session, script_id)

        result = _run(agent.run())

        assert result["status"] == "done"
        assert result["successful_ops"] == 4
        phases = db_session.query(GamePhaseDBModel).filter_by(script_id=script_id)\
            .order_by(GamePhaseDBModel.order_index).all()
        assert [p.name for p in phases] == ["背景介绍", "搜证阶段", "自由讨论"]
        assert [p.order_index for p in phases] == [0, 1, 2]
        assert phases[2].description == "玩家互相质询"
        # 新增阶段按名称推断出 EVIDENCE_COLLECTION 标识
        assert phases[1].phase == GamePhaseEnum.EVIDENCE_COLLECTION
        # 事件步骤域
        phase_events = [e for e in events if e.get("step") == "game_phases"]
        assert phase_events and phase_events[0]["step_name"] == "游戏阶段"

    def test_add_duplicate_phase_rejected(self, db_session, script_id):
        ok, msg = _run(ScriptEditingAgent(
            script_id=script_id, instruction="x", db_session=db_session, llm=FakeLLM([])
        )._execute_tool("add_game_phase", {"name": "自由讨论"}))
        assert ok is False and "同名" in msg

    def test_reorder_with_unknown_name_rejected(self, db_session, script_id):
        ok, msg = _run(ScriptEditingAgent(
            script_id=script_id, instruction="x", db_session=db_session, llm=FakeLLM([])
        )._execute_tool("reorder_game_phases", {"ordered_names": ["背景介绍", "不存在的阶段"]}))
        assert ok is False and "不存在" in msg

    def test_reorder_missing_phase_rejected(self, db_session, script_id):
        ok, msg = _run(ScriptEditingAgent(
            script_id=script_id, instruction="x", db_session=db_session, llm=FakeLLM([])
        )._execute_tool("reorder_game_phases", {"ordered_names": ["自由讨论", "背景介绍", "投票表决"]}))
        # 顺序重排合法（覆盖全部阶段）
        assert ok is True
        ok2, msg2 = _run(ScriptEditingAgent(
            script_id=script_id, instruction="x", db_session=db_session, llm=FakeLLM([])
        )._execute_tool("reorder_game_phases", {"ordered_names": ["背景介绍"]}))
        assert ok2 is False and "缺少" in msg2


# ---------------------------------------------------------------------------
# d) bind_character_voice
# ---------------------------------------------------------------------------
class TestBindCharacterVoice:
    def _patch_voices(self, voices):
        return patch(
            "src.services.tts_voices.list_available_voices",
            new=lambda: asyncio.sleep(0, result=(True, voices, "")),
        )

    def test_bind_voice_by_name(self, db_session, script_id):
        voices = [
            {"voice_id": "v-male-1", "name": "沉稳男声", "gender": "male"},
            {"voice_id": "v-female-1", "name": "甜美女声", "gender": "female"},
        ]
        llm = FakeLLM([
            LLMResponse(content="", tool_calls=[
                _tc("bind_character_voice", {"character_name": "张三", "voice_query": "沉稳男声"}),
            ]),
            LLMResponse(content="", tool_calls=[_tc("finish", {"summary": "音色绑定完成"})]),
        ])
        agent, events = _make_agent(llm, db_session, script_id)

        with self._patch_voices(voices):
            result = _run(agent.run())

        assert result["status"] == "done"
        assert result["successful_ops"] == 1
        row = db_session.query(CharacterDBModel).filter_by(script_id=script_id, name="张三").first()
        assert row.voice_id == "v-male-1"
        assert row.voice_preference == "沉稳男声"
        voice_events = [e for e in events if e.get("step") == "voice"]
        assert voice_events and voice_events[0]["step_name"] == "音色绑定"

    def test_bind_voice_by_gender_alias(self, db_session, script_id):
        voices = [
            {"voice_id": "v-female-1", "name": "甜美女声", "gender": "female"},
        ]
        agent = ScriptEditingAgent(script_id=script_id, instruction="x",
                                   db_session=db_session, llm=FakeLLM([]))
        with self._patch_voices(voices):
            ok, msg = _run(agent._execute_tool(
                "bind_character_voice", {"character_name": "张三", "voice_query": "女"}))
        assert ok is True
        row = db_session.query(CharacterDBModel).filter_by(script_id=script_id, name="张三").first()
        assert row.voice_id == "v-female-1"

    def test_bind_voice_no_match_returns_failure(self, db_session, script_id):
        voices = [{"voice_id": "v1", "name": "沉稳男声", "gender": "male"}]
        agent = ScriptEditingAgent(script_id=script_id, instruction="x",
                                   db_session=db_session, llm=FakeLLM([]))
        with self._patch_voices(voices):
            ok, msg = _run(agent._execute_tool(
                "bind_character_voice", {"character_name": "张三", "voice_query": "萝莉音"}))
        assert ok is False and "未找到匹配" in msg

    def test_bind_voice_tts_unavailable_returns_failure(self, db_session, script_id):
        agent = ScriptEditingAgent(script_id=script_id, instruction="x",
                                   db_session=db_session, llm=FakeLLM([]))
        with patch("src.services.tts_voices.list_available_voices",
                   new=lambda: asyncio.sleep(0, result=(False, [], "服务不可用"))):
            ok, msg = _run(agent._execute_tool(
                "bind_character_voice", {"character_name": "张三", "voice_query": "男"}))
        assert ok is False and "获取音色列表失败" in msg

    def test_bind_voice_unknown_character(self, db_session, script_id):
        agent = ScriptEditingAgent(script_id=script_id, instruction="x",
                                   db_session=db_session, llm=FakeLLM([]))
        ok, msg = _run(agent._execute_tool(
            "bind_character_voice", {"character_name": "不存在的人", "voice_query": "男"}))
        assert ok is False and "未找到角色" in msg


# ---------------------------------------------------------------------------
# e) JSON 行动降级模式
# ---------------------------------------------------------------------------
class TestFallbackJsonActionMode:
    def test_fallback_when_tools_unsupported(self, db_session, script_id):
        """provider 不支持工具调用 → 降级 JSON 行动模式，仍能完成编辑"""

        def reject_tools(kwargs):
            if "tools" in kwargs:
                raise RuntimeError("tools is not supported in this model")
            return LLMResponse(content='{"action": "delete_location", "arguments": {"name": "书房"}}')

        llm = FakeLLM([
            reject_tools,
            LLMResponse(content='{"action": "delete_location", "arguments": {"name": "书房"}}'),
            LLMResponse(content='{"action": "finish", "arguments": {"summary": "降级模式完成"}}'),
        ])
        agent, events = _make_agent(llm, db_session, script_id)

        result = _run(agent.run())

        assert agent._tools_supported is False
        assert result["status"] == "done"
        assert result["successful_ops"] == 1
        assert db_session.query(LocationDBModel).filter_by(script_id=script_id).count() == 0
        actions = [e for e in events if e["type"] == "action"]
        assert actions and actions[0]["data"]["tool"] == "delete_location"


# ---------------------------------------------------------------------------
# f) 事件回调异常不影响主流程
# ---------------------------------------------------------------------------
class TestEventCallbackError:
    def test_callback_exception_does_not_break_flow(self, db_session, script_id):
        llm = FakeLLM([
            LLMResponse(content="", tool_calls=[_tc("add_character", _character_args("王五"))]),
            LLMResponse(content="", tool_calls=[_tc("finish", {"summary": "完成"})]),
        ])

        async def bad_cb(event):
            raise RuntimeError("广播失败")

        agent = ScriptEditingAgent(
            script_id=script_id, instruction="添加角色", db_session=db_session,
            event_callback=bad_cb, llm=llm,
        )

        result = _run(agent.run())

        assert result["status"] == "done"
        assert result["successful_ops"] == 1
        assert db_session.query(CharacterDBModel).filter_by(script_id=script_id, name="王五").count() == 1


# ---------------------------------------------------------------------------
# plan_only 计划模式（HTTP /parse-instruction 依赖）
# ---------------------------------------------------------------------------
class TestPlanOnlyMode:
    def test_plan_only_collects_instructions_without_persisting(self, db_session, script_id):
        """ReAct 循环照跑、工具只校验不落库，返回工具调用序列作为解析结果"""
        llm = FakeLLM([
            LLMResponse(content="", tool_calls=[
                _tc("add_character", {"name": "缺字段"}),  # 校验失败也会出现在计划中
            ]),
            LLMResponse(content="", tool_calls=[_tc("add_character", _character_args("王五"))]),
            LLMResponse(content="", tool_calls=[_tc("delete_evidence", {"name": "血迹"})]),
            LLMResponse(content="", tool_calls=[_tc("finish", {"summary": "计划完成"})]),
        ])
        agent, events = _make_agent(llm, db_session, script_id, plan_only=True)

        result = _run(agent.run())

        assert result["status"] == "done"
        planned = result["planned_instructions"]
        assert [(p.action, p.target) for p in planned] == [
            ("add", "character"), ("add", "character"), ("delete", "evidence"),
        ]
        assert planned[0].content["name"] == "缺字段"
        # 不落库：角色/证据数量保持不变
        assert db_session.query(CharacterDBModel).filter_by(script_id=script_id).count() == 1
        assert db_session.query(EvidenceDBModel).filter_by(script_id=script_id).count() == 1


# ---------------------------------------------------------------------------
# 其他循环行为
# ---------------------------------------------------------------------------
class TestLoopBehavior:
    def test_max_iterations_without_ops_returns_error(self, db_session, script_id):
        """模型始终不调用工具 → 达到最大轮次且无成功操作 → error"""
        llm = FakeLLM([LLMResponse(content="我在想……") for _ in range(10)])
        agent, events = _make_agent(llm, db_session, script_id, max_iterations=3)

        result = _run(agent.run())

        assert result["status"] == "error"
        assert "最大轮次" in result["message"]
        assert events[-1]["type"] == "error"

    def test_max_iterations_with_successful_ops_finishes_normally(self, db_session, script_id):
        """达到最大轮次但已有成功操作 → 正常收尾"""
        llm = FakeLLM([LLMResponse(content="", tool_calls=[_tc("delete_evidence", {"name": "血迹"})])])
        agent, _ = _make_agent(llm, db_session, script_id, max_iterations=5)
        # 第一次调用后 FakeLLM 返回无工具响应且 tool_results 非空 → 按完成处理
        result = _run(agent.run())

        assert result["status"] == "done"
        assert result["successful_ops"] == 1

    def test_cancel_stops_loop(self, db_session, script_id):
        llm = FakeLLM([
            LLMResponse(content="", tool_calls=[_tc("delete_evidence", {"name": "血迹"})]),
            LLMResponse(content="", tool_calls=[_tc("finish", {"summary": "完成"})]),
        ])
        agent, events = _make_agent(llm, db_session, script_id)

        original_emit = agent._emit

        async def emit_and_cancel(event_type, *args, **kwargs):
            await original_emit(event_type, *args, **kwargs)
            if event_type == "step_end":
                agent.cancel()

        agent._emit = emit_and_cancel

        result = _run(agent.run())

        assert result["status"] == "cancelled"
        assert events[-1]["type"] == "cancelled"
