"""WebSocket剧本编辑权限校验与并发控制测试

覆盖两项修复：
1. start_script_editing 在进入编辑模式前校验剧本作者权限（与HTTP编辑接口一致）
2. handle_edit_instruction 通过按剧本ID的asyncio.Lock串行化编辑指令
"""
import asyncio
import json
from types import SimpleNamespace
from unittest.mock import Mock, AsyncMock, patch

from src.core.websocket_server import GameWebSocketServer, GameSession, EditModeHandler
from src.services.script_editor_service import ScriptEditorService, EditInstruction, EditResult


def _make_server_and_session(script_id: int = 1, username: str | None = "author"):
    """构造内存中的服务器与会话（不依赖真实数据库）"""
    server = GameWebSocketServer()
    server.broadcast = AsyncMock()
    session = GameSession("test-session", script_id)
    session.username = username
    server.sessions["test-session"] = session
    return server, session


def _broadcast_types(server):
    """提取已广播消息的类型列表"""
    return [c.args[0].get("type") for c in server.broadcast.await_args_list]


def test_start_editing_permission_granted_for_author():
    """作者本人可以进入编辑模式"""
    server, session = _make_server_and_session(script_id=1, username="author")
    fake_script = SimpleNamespace(info=SimpleNamespace(author="author"))

    with patch("src.core.websocket_server.db_manager") as mock_db_manager, \
         patch("src.core.websocket_server.ScriptRepository") as mock_repo_cls:
        mock_repo_cls.return_value.get_script_by_id.return_value = fake_script
        asyncio.run(EditModeHandler.start_script_editing(server, "test-session", 1))

    assert session.is_editing_mode is True
    assert session.editor_service is not None
    assert "script_editing_started" in _broadcast_types(server)


def test_start_editing_permission_denied_for_other_user():
    """非作者用户被拒绝，且不进入编辑模式"""
    server, session = _make_server_and_session(script_id=1, username="other_user")
    fake_script = SimpleNamespace(info=SimpleNamespace(author="author"))
    mock_db = Mock()

    with patch("src.core.websocket_server.db_manager") as mock_db_manager, \
         patch("src.core.websocket_server.ScriptRepository") as mock_repo_cls:
        mock_db_manager.get_session.return_value = mock_db
        mock_repo_cls.return_value.get_script_by_id.return_value = fake_script
        asyncio.run(EditModeHandler.start_script_editing(server, "test-session", 1))

    assert session.is_editing_mode is False
    assert session.editor_service is None
    assert session.db_session is None
    mock_db.close.assert_called_once()
    error_msgs = [c.args[0] for c in server.broadcast.await_args_list if c.args[0].get("type") == "error"]
    assert any("无权编辑该剧本" == m.get("message") for m in error_msgs)


def test_start_editing_permission_denied_without_user():
    """未绑定用户信息的会话（匿名/临时会话）被拒绝"""
    server, session = _make_server_and_session(script_id=1, username=None)
    fake_script = SimpleNamespace(info=SimpleNamespace(author="author"))

    with patch("src.core.websocket_server.db_manager"), \
         patch("src.core.websocket_server.ScriptRepository") as mock_repo_cls:
        mock_repo_cls.return_value.get_script_by_id.return_value = fake_script
        asyncio.run(EditModeHandler.start_script_editing(server, "test-session", 1))

    assert session.is_editing_mode is False
    assert session.editor_service is None


def test_start_editing_script_not_found():
    """剧本不存在时不进入编辑模式"""
    server, session = _make_server_and_session(script_id=1, username="author")
    mock_db = Mock()

    with patch("src.core.websocket_server.db_manager") as mock_db_manager, \
         patch("src.core.websocket_server.ScriptRepository") as mock_repo_cls:
        mock_db_manager.get_session.return_value = mock_db
        mock_repo_cls.return_value.get_script_by_id.return_value = None
        asyncio.run(EditModeHandler.start_script_editing(server, "test-session", 999))

    assert session.is_editing_mode is False
    assert session.editor_service is None
    mock_db.close.assert_called_once()
    assert "error" in _broadcast_types(server)


def test_register_client_records_user_info():
    """注册客户端时会话记录用户ID与用户名（供编辑权限校验使用）"""
    server = GameWebSocketServer()
    server.send_to_client = AsyncMock()
    websocket = Mock()
    mock_db = Mock()
    mock_db.query.return_value.filter.return_value.first.return_value = SimpleNamespace(username="alice")

    with patch("src.core.websocket_server.db_manager") as mock_db_manager, \
         patch("src.core.websocket_server.GameSessionRepository") as mock_repo_cls:
        mock_db_manager.session_scope.return_value.__enter__.return_value = mock_db
        mock_repo_cls.return_value.create_or_resume_session.return_value = SimpleNamespace(
            session_id="sess-1", status="ACTIVE"
        )
        asyncio.run(server.register_client(websocket, script_id=3, user_id=42))

    session = server.sessions["sess-1"]
    assert session.user_id == 42
    assert session.username == "alice"


def test_edit_locks_are_per_script():
    """同一剧本复用同一把锁，不同剧本使用不同的锁"""
    server = GameWebSocketServer()
    lock1 = server.get_edit_lock(1)
    assert server.get_edit_lock(1) is lock1
    assert server.get_edit_lock(2) is not lock1


def test_edit_instructions_serialized_per_script():
    """同一剧本的并发编辑指令被串行执行（不交错）"""
    server, session = _make_server_and_session(script_id=1)
    session.is_editing_mode = True
    session.db_session = Mock()

    call_order = []

    async def fake_parse(instruction, script_id, event_callback=None):
        call_order.append(f"start:{instruction}")
        await asyncio.sleep(0.02)
        call_order.append(f"end:{instruction}")
        return []

    editor = Mock()
    editor.parse_user_instruction = fake_parse
    session.editor_service = editor

    async def run_two_instructions():
        await asyncio.gather(
            EditModeHandler.handle_edit_instruction(server, "test-session", "指令A"),
            EditModeHandler.handle_edit_instruction(server, "test-session", "指令B"),
        )

    asyncio.run(run_two_instructions())

    # 若未加锁，两条指令会交错为 start:A, start:B, end:A, end:B
    assert call_order == ["start:指令A", "end:指令A", "start:指令B", "end:指令B"]


def test_edit_instruction_rejected_when_not_editing():
    """未进入编辑模式时指令被拒绝（权限校验只挡在进入编辑模式前）"""
    server, _session = _make_server_and_session(script_id=1)

    asyncio.run(EditModeHandler.handle_edit_instruction(server, "test-session", "任意指令"))

    assert "error" in _broadcast_types(server)
    server.broadcast.assert_awaited_once()


def test_edit_instruction_unparseable_returns_error_without_write():
    """指令无法解析（LLM重试后返回空列表）时明确反馈错误且不写库"""
    server, session = _make_server_and_session(script_id=1)
    session.is_editing_mode = True
    session.db_session = Mock()

    async def fake_parse(instruction, script_id, event_callback=None):
        return []

    editor = Mock()
    editor.parse_user_instruction = fake_parse
    session.editor_service = editor

    asyncio.run(EditModeHandler.handle_edit_instruction(server, "test-session", "胡言乱语"))

    types = _broadcast_types(server)
    assert "error" in types
    assert "edit_result" not in types
    error_msgs = [c.args[0] for c in server.broadcast.await_args_list if c.args[0].get("type") == "error"]
    assert any("无法理解该指令" in m.get("message", "") for m in error_msgs)
    editor.execute_instruction.assert_not_called()
    session.db_session.commit.assert_not_called()


# ---------------------------------------------------------------------------
# 编辑过程事件透出（script_edit_event）
# ---------------------------------------------------------------------------

def _make_editor_service():
    """构造内存中的编辑服务（不依赖真实数据库与LLM）"""
    fake_script = SimpleNamespace(
        info=SimpleNamespace(title="测试剧本", description="描述", category="推理",
                             difficulty="中等", tags=[]),
        characters=[], evidence=[], locations=[],
    )
    repo = Mock()
    repo.get_script_by_id.return_value = fake_script
    return ScriptEditorService(repo)


def _categorize_response(reasoning="先判断目标对象"):
    return SimpleNamespace(
        content=json.dumps({"category": "character", "confidence": 0.9, "reasoning": "r"}),
        reasoning_content=reasoning,
    )


def test_parse_emits_full_event_sequence():
    """parse_user_instruction 按序透出 classify/parse 全阶段事件"""
    service = _make_editor_service()
    parse_resp = SimpleNamespace(
        content=json.dumps([
            {"action": "add", "target": "character", "content": {"name": "张三"}, "description": "添加角色张三"},
            {"action": "update", "target": "character", "content": {"name": "李四"}, "description": "更新角色李四"},
        ]),
        reasoning_content="需要拆成两步操作",
    )
    events = []

    async def cb(event):
        events.append(event)

    with patch("src.services.script_editor_service.llm_service") as mock_llm:
        mock_llm.chat_completion = AsyncMock(side_effect=[_categorize_response(), parse_resp])
        result = asyncio.run(service.parse_user_instruction("调整角色", 1, event_callback=cb))

    assert len(result) == 2
    seq = [(e["type"], e["step"]) for e in events]
    assert seq == [
        ("step_start", "classify"),
        ("thought", "classify"),
        ("action", "classify"),
        ("step_end", "classify"),
        ("step_start", "parse"),
        ("thought", "parse"),
        ("action", "parse"),
        ("step_end", "parse"),
    ]
    # 关键内容与字段
    assert events[0]["step_name"] == "理解指令"
    assert events[4]["step_name"] == "解析编辑操作"
    assert events[1]["kind"] == "reasoning" and events[1]["content"] == "先判断目标对象"
    assert events[2]["content"] == "指令分类：角色"
    assert events[2]["data"] == {"category": "character"}
    assert events[5]["kind"] == "reasoning" and events[5]["content"] == "需要拆成两步操作"
    assert events[6]["content"] == "解析出 2 项编辑操作"
    assert [op["action"] for op in events[6]["data"]["operations"]] == ["add", "update"]
    assert all(e["timestamp"] for e in events)


def test_parse_emits_retry_observation_and_failure_step_end():
    """解析重试时透出 observation，三次全失败时 step_end 标记解析失败且不发 action"""
    service = _make_editor_service()
    bad_resp = SimpleNamespace(content="这不是JSON", reasoning_content=None)
    events = []

    async def cb(event):
        events.append(event)

    with patch("src.services.script_editor_service.llm_service") as mock_llm:
        mock_llm.chat_completion = AsyncMock(
            side_effect=[_categorize_response(), bad_resp, bad_resp, bad_resp]
        )
        result = asyncio.run(service.parse_user_instruction("胡言乱语", 1, event_callback=cb))

    assert result == []
    observations = [e for e in events if e["type"] == "observation"]
    assert [o["content"] for o in observations] == ["解析失败，正在重试（1/3）", "解析失败，正在重试（2/3）"]
    assert all(o["step"] == "parse" for o in observations)
    # parse 阶段失败：不发 action，step_end 标记解析失败
    parse_actions = [e for e in events if e["type"] == "action" and e["step"] == "parse"]
    assert parse_actions == []
    last = events[-1]
    assert last["type"] == "step_end" and last["step"] == "parse" and last["content"] == "解析失败"


def test_parse_event_callback_error_does_not_break_flow():
    """事件回调抛异常不影响解析主流程"""
    service = _make_editor_service()
    parse_resp = SimpleNamespace(
        content=json.dumps([
            {"action": "add", "target": "character", "content": {"name": "张三"}, "description": "添加角色张三"},
        ]),
        reasoning_content="思考",
    )

    async def bad_cb(event):
        raise RuntimeError("广播失败")

    with patch("src.services.script_editor_service.llm_service") as mock_llm:
        mock_llm.chat_completion = AsyncMock(side_effect=[_categorize_response(), parse_resp])
        result = asyncio.run(service.parse_user_instruction("添加角色", 1, event_callback=bad_cb))

    assert len(result) == 1
    assert result[0].action == "add"


def test_edit_instruction_emits_execute_events():
    """handler 层透出 execute 阶段事件：action/observation 按序且 index 正确"""
    server, session = _make_server_and_session(script_id=1)
    session.is_editing_mode = True
    session.db_session = Mock()

    instructions = [
        EditInstruction(action="add", target="character",
                        content={"name": "张三"}, description="添加角色张三"),
        EditInstruction(action="delete", target="evidence",
                        content={"name": "血迹"}, description=""),
    ]

    async def fake_parse(instruction, script_id, event_callback=None):
        return instructions

    editor = Mock()
    editor.parse_user_instruction = fake_parse
    editor.execute_instruction = AsyncMock(side_effect=[
        EditResult(success=True, message="成功添加角色: 张三"),
        EditResult(success=False, message="未找到证据: 血迹"),
    ])
    session.editor_service = editor

    asyncio.run(EditModeHandler.handle_edit_instruction(server, "test-session", "整理证据"))

    edit_events = [c.args[0]["data"] for c in server.broadcast.await_args_list
                   if c.args[0].get("type") == "script_edit_event"]
    # 广播均携带 session_id
    for c in server.broadcast.await_args_list:
        if c.args[0].get("type") == "script_edit_event":
            assert c.args[0].get("session_id") == "test-session"

    step_starts = [e for e in edit_events if e["type"] == "step_start" and e["step"] == "execute"]
    assert len(step_starts) == 1 and step_starts[0]["data"] == {"total": 2}
    assert step_starts[0]["step_name"] == "执行修改"

    actions = [e for e in edit_events if e["type"] == "action"]
    assert [a["data"]["index"] for a in actions] == [1, 2]
    assert actions[0]["content"] == "添加角色张三"
    # description 为空时拼接 action/target 作为摘要
    assert actions[1]["content"] == "delete evidence"
    assert actions[0]["data"]["instruction"]["target"] == "character"

    observations = [e for e in edit_events if e["type"] == "observation"]
    assert [o["data"]["index"] for o in observations] == [1, 2]
    assert [o["data"]["success"] for o in observations] == [True, False]
    assert observations[0]["content"] == "成功添加角色: 张三"
    assert observations[1]["content"] == "未找到证据: 血迹"

    step_ends = [e for e in edit_events if e["type"] == "step_end" and e["step"] == "execute"]
    assert step_ends[-1]["content"] == "成功 1/2 项"

    # 事件顺序：step_start → action/observation 交替 → step_end
    seq = [(e["type"], (e.get("data") or {}).get("index")) for e in edit_events]
    assert seq == [("step_start", None), ("action", 1), ("observation", 1),
                   ("action", 2), ("observation", 2), ("step_end", None)]

    # 既有结果消息保持不变
    types = _broadcast_types(server)
    assert "instruction_processing" in types
    assert types.count("edit_result") == 2
    assert "instruction_completed" in types
