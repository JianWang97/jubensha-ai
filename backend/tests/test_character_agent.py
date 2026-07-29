"""P0 单元测试：结构化 Agent 输出、真实投票解析、证据私有化与选择性公开。

覆盖范围：
  - parse_agent_response：JSON 提取与降级（围栏 / 夹杂散文 / 非法输入）
  - CharacterAgent.respond：返回 AgentResponse，LLM 异常时降级发言
  - CharacterAgentManager.respond：只广播 say，不泄露 vote 等内部字段
  - GameEngine._resolve_vote / process_voting：vote 字段 → 发言提名 → 随机兜底
  - 证据私有化：发现者私有 knowledge、reveal_evidence 公开、提示词不泄露未公开证据
"""
import asyncio
from unittest.mock import AsyncMock, Mock

import pytest

from src.agents.character_agent import (
    AgentResponse,
    CharacterAgent,
    parse_agent_response,
)
from src.agents.character_agent_manager import CharacterAgentManager
from src.agents.phase_director import PhaseDirector
from src.core.game_engine import GameEngine
from src.core.voting_manager import VotingManager
from src.schemas.game_phase import GamePhaseEnum
from src.schemas.script_character import ScriptCharacter

pytestmark = pytest.mark.unit


# ---------------------------------------------------------------------------
# 测试辅助
# ---------------------------------------------------------------------------

def make_character(name: str, is_murderer: bool = False) -> ScriptCharacter:
    """构造测试角色"""
    return ScriptCharacter(
        script_id=1,
        name=name,
        background=f"{name}的背景",
        secret=f"{name}的秘密",
        objective="找出真凶",
        is_murderer=is_murderer,
    )


def make_llm(content: str) -> Mock:
    """构造返回固定内容的 mock LLM 服务"""
    llm = Mock()
    llm.chat_completion = AsyncMock(return_value=Mock(content=content))
    return llm


def make_agent(name: str, llm_content: str = "", is_murderer: bool = False) -> CharacterAgent:
    return CharacterAgent(make_character(name, is_murderer), make_llm(llm_content))


def make_manager(*agents: CharacterAgent) -> CharacterAgentManager:
    """构造注入了测试 Agent 的管理器（共享 LLM 不会被实际调用）"""
    manager = CharacterAgentManager()
    manager._agents = {agent.name: agent for agent in agents}
    return manager


def make_engine(*agents: CharacterAgent) -> GameEngine:
    """构造投票/证据测试用的游戏引擎（绕过剧本加载，直接装配组件）"""
    engine = GameEngine(script_id=1)
    engine.session_id = None  # 关闭 TTS 事件
    engine.characters = [make_character(agent.name) for agent in agents]
    engine.agents = make_manager(*agents)
    engine.voting_manager = VotingManager(engine.characters)
    return engine


# ---------------------------------------------------------------------------
# JSON 解析与降级
# ---------------------------------------------------------------------------

class TestParseAgentResponse:
    """结构化输出的解析与降级"""

    def test_clean_json(self):
        text = (
            '{"say": "我昨晚一直在书房。", '
            '"action": {"type": "search", "target": "书房"}, '
            '"reveal_evidence": ["血迹"], "vote": "李四", "emotion": "平静"}'
        )
        resp = parse_agent_response(text)
        assert resp.say == "我昨晚一直在书房。"
        assert resp.action == {"type": "search", "target": "书房"}
        assert resp.reveal_evidence == ["血迹"]
        assert resp.vote == "李四"
        assert resp.emotion == "平静"

    def test_fenced_json(self):
        text = '```json\n{"say": "大家好", "vote": null}\n```'
        resp = parse_agent_response(text)
        assert resp.say == "大家好"
        assert resp.vote is None

    def test_json_amid_prose(self):
        text = '好的，我想一下。\n{"say": "我怀疑王五", "vote": "王五"}\n以上就是我的发言。'
        resp = parse_agent_response(text)
        assert resp.say == "我怀疑王五"
        assert resp.vote == "王五"

    def test_plain_text_fallback(self):
        """完全无法解析时，整段文本作为 say，其余字段为空"""
        resp = parse_agent_response("呃，让我想想，我什么都不知道。")
        assert resp.say == "呃，让我想想，我什么都不知道。"
        assert resp.action is None
        assert resp.reveal_evidence == []
        assert resp.vote is None
        assert resp.emotion is None

    def test_empty_text_fallback(self):
        resp = parse_agent_response("")
        assert resp.say == "……"

    def test_json_without_say_uses_full_text(self):
        text = '{"vote": "李四"}'
        resp = parse_agent_response(text)
        assert resp.say == text
        assert resp.vote == "李四"

    def test_invalid_action_type_normalized(self):
        resp = parse_agent_response('{"say": "x", "action": {"type": "kill", "target": "李四"}}')
        assert resp.action == {"type": "none", "target": "李四"}

    def test_vote_placeholder_values(self):
        for placeholder in ("null", "无", "暂无", "none", ""):
            resp = parse_agent_response(f'{{"say": "x", "vote": "{placeholder}"}}')
            assert resp.vote is None, f"占位值 {placeholder!r} 应视为未投票"

    def test_reveal_evidence_string_to_list(self):
        resp = parse_agent_response('{"say": "x", "reveal_evidence": "血迹"}')
        assert resp.reveal_evidence == ["血迹"]


# ---------------------------------------------------------------------------
# CharacterAgent.respond
# ---------------------------------------------------------------------------

class TestCharacterAgentRespond:
    """respond() 返回结构化 AgentResponse"""

    def test_respond_returns_agent_response(self):
        agent = make_agent("张三", '{"say": "我没杀人", "emotion": "紧张"}')
        resp = asyncio.run(agent.respond(GamePhaseEnum.DISCUSSION, {}))
        assert isinstance(resp, AgentResponse)
        assert resp.say == "我没杀人"
        assert resp.emotion == "紧张"
        # 发言写入私有日志
        assert any("我没杀人" in e.content for e in agent.memory._personal_log)

    def test_llm_exception_fallback(self):
        """LLM 抛异常时降级为固定发言，不向游戏循环抛错"""
        agent = make_agent("张三")
        agent._llm.chat_completion = AsyncMock(side_effect=RuntimeError("LLM 服务不可用"))
        resp = asyncio.run(agent.respond(GamePhaseEnum.DISCUSSION, {}))
        assert resp.say == "我现在有点困惑，让我整理一下思路……"

    def test_manager_broadcasts_only_say(self):
        """广播给其他角色的只有 say，vote 等内部字段不外泄"""
        speaker = make_agent("张三", '{"say": "我觉得案件有疑点", "vote": "王五"}')
        listener = make_agent("李四")
        manager = make_manager(speaker, listener)

        resp = asyncio.run(manager.respond("张三", GamePhaseEnum.VOTING, {}))
        assert resp.vote == "王五"

        heard = [s.content for s in listener.memory._working]
        assert heard == ["我觉得案件有疑点"]
        assert all("王五" not in content for content in heard)


# ---------------------------------------------------------------------------
# 真实投票解析
# ---------------------------------------------------------------------------

class TestVoteResolution:
    """投票兜底链：vote 字段 → 发言中提到的名字 → 随机"""

    def setup_method(self):
        self.agents = [make_agent(n) for n in ("张三", "李四", "王五")]
        self.engine = make_engine(*self.agents)
        self.engine._current_phase = GamePhaseEnum.VOTING

    def test_structured_vote_field(self):
        resp = AgentResponse(say="我分析过了", vote="李四")
        assert self.engine._resolve_vote("张三", resp) == "李四"

    def test_vote_field_with_prefix(self):
        """允许 "投票给李四" 这类写法"""
        resp = AgentResponse(say="x", vote="投票给李四")
        assert self.engine._resolve_vote("张三", resp) == "李四"

    def test_name_in_say_fallback(self):
        """vote 缺失时取发言中最先提到的候选人"""
        resp = AgentResponse(say="王五的时间线对不上，李四倒是没问题", vote=None)
        assert self.engine._resolve_vote("张三", resp) == "王五"

    def test_random_fallback_excludes_voter(self):
        resp = AgentResponse(say="我真的不知道是谁", vote=None)
        vote = self.engine._resolve_vote("张三", resp)
        assert vote in ("李四", "王五")

    def test_self_vote_not_allowed(self):
        """vote 指向自己时不生效，进入后续兜底"""
        resp = AgentResponse(say="我投我自己", vote="张三")
        assert self.engine._resolve_vote("张三", resp) != "张三"

    def test_process_voting_wires_into_voting_manager(self):
        responses = {
            "张三": AgentResponse(say="我投李四", vote="李四"),
            "李四": AgentResponse(say="王五有问题", vote=None),   # 发言提名兜底
            "王五": AgentResponse(say="李四才是凶手", vote="李四"),
        }
        asyncio.run(self.engine.process_voting(responses))

        votes = self.engine.voting_manager.votes
        assert votes == {"张三": "李四", "李四": "王五", "王五": "李四"}
        assert self.engine.game_state["votes"] == votes
        # 得票最多者为李四
        assert self.engine.voting_manager.get_most_voted() == "李四"

    def test_process_voting_uses_collected_responses(self):
        """不传参数时使用 run_phase 收集的 _vote_responses，处理后清空"""
        self.engine._vote_responses = {
            "张三": AgentResponse(say="x", vote="李四"),
        }
        asyncio.run(self.engine.process_voting())
        assert self.engine.voting_manager.votes["张三"] == "李四"
        assert self.engine._vote_responses == {}

    def test_process_voting_ignored_outside_voting_phase(self):
        self.engine._current_phase = GamePhaseEnum.DISCUSSION
        asyncio.run(self.engine.process_voting({"张三": AgentResponse(say="x", vote="李四")}))
        assert self.engine.voting_manager.votes == {}


# ---------------------------------------------------------------------------
# 证据私有化与选择性公开
# ---------------------------------------------------------------------------

class TestEvidencePrivacy:
    """搜证结果私有化 + reveal_evidence 选择性公开"""

    def setup_method(self):
        self.finder = make_agent("张三")
        self.other = make_agent("李四")
        self.engine = make_engine(self.finder, self.other)
        self.evidence = {"id": 1, "name": "血迹手帕", "description": "书房发现的可疑手帕", "location": "书房"}

    def test_notify_evidence_found_only_finder_knows(self):
        self.engine.agents.notify_evidence_found("张三", self.evidence)
        assert self.finder.memory.known_evidence == [self.evidence]
        assert self.other.memory.known_evidence == []

    def test_reveal_known_evidence(self):
        """公开自己掌握的证据：写入 revealed_evidence、公开聊天与所有角色记忆"""
        self.engine.agents.notify_evidence_found("张三", self.evidence)
        self.engine._handle_evidence_reveal("张三", ["血迹手帕"])

        revealed = self.engine.game_state["revealed_evidence"]
        assert [e["name"] for e in revealed] == ["血迹手帕"]
        assert any("血迹手帕" in c["message"] for c in self.engine.public_chat)
        # 广播后其他角色工作记忆中可见
        assert any("血迹手帕" in s.content for s in self.other.memory._working)

    def test_reveal_unknown_evidence_ignored(self):
        """不能公开自己没搜到的证据（防止凭空编造）"""
        self.engine._handle_evidence_reveal("张三", ["不存在的证据"])
        assert self.engine.game_state["revealed_evidence"] == []
        assert self.engine.public_chat == []

    def test_reveal_is_idempotent(self):
        self.engine.agents.notify_evidence_found("张三", self.evidence)
        self.engine._handle_evidence_reveal("张三", ["血迹手帕"])
        self.engine._handle_evidence_reveal("张三", ["血迹手帕"])
        assert len(self.engine.game_state["revealed_evidence"]) == 1

    def test_prompt_shows_only_visible_evidence(self):
        """提示词：发现者可见私藏证据，其他角色不可见"""
        director = PhaseDirector()
        self.engine.agents.notify_evidence_found("张三", self.evidence)

        finder_msg = director.build_user_message(
            GamePhaseEnum.INVESTIGATION, self.finder.identity, self.finder.memory, {}
        )
        assert "血迹手帕" in finder_msg
        assert "你私下掌握的证据" in finder_msg

        other_msg = director.build_user_message(
            GamePhaseEnum.INVESTIGATION, self.other.identity, self.other.memory, {}
        )
        assert "血迹手帕" not in other_msg

    def test_prompt_after_reveal(self):
        """公开后：所有角色在"已公开"区可见，发现者的私藏区不再重复展示"""
        director = PhaseDirector()
        self.engine.agents.notify_evidence_found("张三", self.evidence)
        self.engine._handle_evidence_reveal("张三", ["血迹手帕"])
        game_state = self.engine.game_state

        finder_msg = director.build_user_message(
            GamePhaseEnum.INVESTIGATION, self.finder.identity, self.finder.memory, game_state
        )
        assert "已公开的证据" in finder_msg
        assert "血迹手帕" in finder_msg
        assert "你私下掌握的证据" not in finder_msg

        other_msg = director.build_user_message(
            GamePhaseEnum.INVESTIGATION, self.other.identity, self.other.memory, game_state
        )
        assert "血迹手帕" in other_msg

    def test_murderer_instructions_allow_withhold_and_lie(self):
        """凶手身份提示包含可隐瞒证据/说谎的策略说明"""
        murderer = make_agent("赵六", is_murderer=True)
        prompt = murderer.identity.to_system_prompt()
        assert "隐瞒" in prompt and "说谎" in prompt
