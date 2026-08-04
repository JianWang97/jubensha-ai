"""WebSocket剧本编辑权限校验与并发控制测试

覆盖：
1. start_script_editing 在进入编辑模式前校验剧本作者权限（与HTTP编辑接口一致）
2. handle_edit_instruction 通过按剧本ID的asyncio.Lock串行化编辑指令
3. 编辑链路改由 ScriptEditingAgent（ReAct）驱动后的 handler 行为：
   Agent 事件透传、edit_result 消息映射、空操作 error 分支、成功才 commit
"""
import asyncio
from types import SimpleNamespace
from unittest.mock import Mock, AsyncMock, patch

from src.core.websocket_server import GameWebSocketServer, GameSession, EditModeHandler
from src.services.script_editor_service import ScriptEditorService, _make_edit_event


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
    session.editor_service = Mock()  # handle_edit_instruction 要求编辑服务已初始化

    call_order = []

    class FakeAgent:
        def __init__(self, script_id, instruction, db_session, event_callback=None):
            self.instruction = instruction

        async def run(self):
            call_order.append(f"start:{self.instruction}")
            await asyncio.sleep(0.02)
            call_order.append(f"end:{self.instruction}")
            return {"status": "done", "summary": "", "tool_results": [], "successful_ops": 0}

    with patch("src.agents.script_editing_agent.ScriptEditingAgent", FakeAgent):
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
    """Agent 未落实任何编辑操作（tool_results 为空）时明确反馈错误且不写库"""
    server, session = _make_server_and_session(script_id=1)
    session.is_editing_mode = True
    session.db_session = Mock()
    session.editor_service = Mock()

    class FakeAgent:
        def __init__(self, script_id, instruction, db_session, event_callback=None):
            pass

        async def run(self):
            return {"status": "done", "summary": "", "tool_results": [], "successful_ops": 0}

    with patch("src.agents.script_editing_agent.ScriptEditingAgent", FakeAgent):
        asyncio.run(EditModeHandler.handle_edit_instruction(server, "test-session", "胡言乱语"))

    types = _broadcast_types(server)
    assert "error" in types
    assert "edit_result" not in types
    error_msgs = [c.args[0] for c in server.broadcast.await_args_list if c.args[0].get("type") == "error"]
    assert any("无法理解该指令" in m.get("message", "") for m in error_msgs)
    session.db_session.commit.assert_not_called()


# ---------------------------------------------------------------------------
# 编辑过程事件透出（script_edit_event）
# ---------------------------------------------------------------------------

def test_edit_instruction_emits_agent_events_and_results():
    """handler 层透传 Agent 事件、按 tool_results 广播 edit_result、成功才 commit"""
    server, session = _make_server_and_session(script_id=1)
    session.is_editing_mode = True
    session.db_session = Mock()
    session.editor_service = Mock()  # commit 后 get_script_data 依赖编辑服务

    tool_results = [
        {"action": "add", "target": "character", "description": "添加角色：张三",
         "success": True, "message": "成功添加角色: 张三"},
        {"action": "delete", "target": "evidence", "description": "删除证据：血迹",
         "success": False, "message": "未找到证据: 血迹"},
    ]

    class FakeAgent:
        def __init__(self, script_id, instruction, db_session, event_callback=None):
            self._cb = event_callback

        async def run(self):
            # 模拟 Agent 透出 plan/characters 步骤事件与思考过程
            await self._cb(_make_edit_event("step_start", "plan"))
            await self._cb(_make_edit_event("action", "plan", content="规划：先加角色再删证据"))
            await self._cb(_make_edit_event("observation", "plan", content="计划已记录"))
            await self._cb(_make_edit_event("step_end", "plan"))
            await self._cb(_make_edit_event("thought", "", content="深度思考", kind="reasoning"))
            await self._cb(_make_edit_event("step_start", "characters"))
            await self._cb(_make_edit_event("action", "characters", content="添加角色：张三"))
            await self._cb(_make_edit_event("observation", "characters", content="成功添加角色: 张三"))
            await self._cb(_make_edit_event("step_end", "characters"))
            await self._cb(_make_edit_event("done", "", content="编辑完成"))
            return {"status": "done", "summary": "编辑完成",
                    "tool_results": tool_results, "successful_ops": 1}

    with patch("src.agents.script_editing_agent.ScriptEditingAgent", FakeAgent):
        asyncio.run(EditModeHandler.handle_edit_instruction(server, "test-session", "整理证据"))

    # Agent 事件原样透传为 script_edit_event，且均携带 session_id
    edit_events = [c.args[0]["data"] for c in server.broadcast.await_args_list
                   if c.args[0].get("type") == "script_edit_event"]
    assert [e["type"] for e in edit_events] == [
        "step_start", "action", "observation", "step_end",  # plan
        "thought",
        "step_start", "action", "observation", "step_end",  # characters
        "done",
    ]
    for c in server.broadcast.await_args_list:
        if c.args[0].get("type") == "script_edit_event":
            assert c.args[0].get("session_id") == "test-session"
    assert edit_events[0]["step_name"] == "规划"
    assert edit_events[5]["step_name"] == "角色管理"

    # 既有消息序列保持不变：instruction_processing → edit_result×2 → instruction_completed
    types = _broadcast_types(server)
    assert "instruction_processing" in types
    assert types.count("edit_result") == 2
    assert "instruction_completed" in types

    # edit_result 结构：data.instruction={action,target,description}, data.result={success,message}
    edit_results = [c.args[0]["data"] for c in server.broadcast.await_args_list
                    if c.args[0].get("type") == "edit_result"]
    assert edit_results[0]["instruction"] == {
        "action": "add", "target": "character", "description": "添加角色：张三"}
    assert edit_results[0]["result"] == {"success": True, "message": "成功添加角色: 张三"}
    assert edit_results[1]["result"] == {"success": False, "message": "未找到证据: 血迹"}

    # instruction_completed 汇总
    completed = [c.args[0]["data"] for c in server.broadcast.await_args_list
                 if c.args[0].get("type") == "instruction_completed"][0]
    assert completed["instruction"] == "整理证据"
    assert completed["success_count"] == 1
    assert completed["results"] == [
        {"success": True, "message": "成功添加角色: 张三"},
        {"success": False, "message": "未找到证据: 血迹"},
    ]

    # 有 1 项成功操作 → commit 一次并推送剧本数据
    session.db_session.commit.assert_called_once()
    assert "script_data_update" in types


def test_edit_instruction_all_failed_does_not_commit():
    """全部操作失败时不 commit、不推送剧本更新"""
    server, session = _make_server_and_session(script_id=1)
    session.is_editing_mode = True
    session.db_session = Mock()
    session.editor_service = Mock()

    class FakeAgent:
        def __init__(self, script_id, instruction, db_session, event_callback=None):
            pass

        async def run(self):
            return {"status": "done", "summary": "编辑完成", "successful_ops": 0,
                    "tool_results": [
                        {"action": "delete", "target": "evidence", "description": "删除证据：血迹",
                         "success": False, "message": "未找到证据: 血迹"},
                    ]}

    with patch("src.agents.script_editing_agent.ScriptEditingAgent", FakeAgent):
        asyncio.run(EditModeHandler.handle_edit_instruction(server, "test-session", "删除血迹"))

    types = _broadcast_types(server)
    assert types.count("edit_result") == 1
    assert "instruction_completed" in types
    session.db_session.commit.assert_not_called()
    assert "script_data_update" not in types
