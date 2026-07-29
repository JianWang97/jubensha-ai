"""OpenAILLMService 的 tool calling 解析测试。

mock AsyncOpenAI 客户端，验证：
  - message.tool_calls 被解析为 LLMResponse.tool_calls
  - tools / tool_choice 透传到 chat.completions.create
  - 模型只调用工具时 content 为 None → 归一化为空字符串
  - 单个调用的 arguments JSON 损坏时降级为 {"_raw": ...}，不影响其余调用
"""
import asyncio
from unittest.mock import AsyncMock, Mock

import pytest

from src.services.llm_service import LLMMessage, OpenAILLMService, ToolCall

pytestmark = pytest.mark.unit


# ---------------------------------------------------------------------------
# 测试辅助
# ---------------------------------------------------------------------------

def make_tool_call(name: str, arguments: str) -> Mock:
    """构造 OpenAI 风格的 tool_call 对象（注意 Mock(name=...) 是保留参数，不能用）"""
    tc = Mock()
    tc.function.name = name
    tc.function.arguments = arguments
    return tc


def make_openai_response(content=None, tool_calls=None) -> Mock:
    message = Mock()
    message.content = content
    message.tool_calls = tool_calls
    response = Mock()
    response.choices = [Mock(message=message)]
    response.usage = None
    response.model = "test-model"
    return response


def make_service(response: Mock) -> OpenAILLMService:
    """构造注入了 mock AsyncOpenAI 客户端的服务"""
    service = OpenAILLMService(api_key="test-key", model="test-model")
    client = Mock()
    client.chat.completions.create = AsyncMock(return_value=response)
    service._client = client
    return service


def chat(service: OpenAILLMService, **kwargs):
    messages = [LLMMessage(role="user", content="你好")]
    return asyncio.run(service.chat_completion(messages, **kwargs))


# ---------------------------------------------------------------------------
# tool_calls 解析
# ---------------------------------------------------------------------------

class TestOpenAIToolCalls:

    def test_tool_calls_parsed(self):
        response = make_openai_response(
            content=None,
            tool_calls=[make_tool_call("cast_vote", '{"suspect": "李四"}')],
        )
        service = make_service(response)

        result = chat(service, tools=[{"type": "function", "function": {"name": "cast_vote"}}], tool_choice="auto")

        assert result.tool_calls == [ToolCall(name="cast_vote", arguments={"suspect": "李四"})]
        # 模型只调用工具时 content 为 None，归一化为空字符串
        assert result.content == ""

    def test_tools_and_tool_choice_passed_through(self):
        tools = [{"type": "function", "function": {"name": "search_location"}}]
        service = make_service(make_openai_response(content="好的"))

        chat(service, tools=tools, tool_choice="auto")

        kwargs = service._client.chat.completions.create.call_args.kwargs
        assert kwargs["tools"] == tools
        assert kwargs["tool_choice"] == "auto"

    def test_no_tool_calls_returns_none(self):
        service = make_service(make_openai_response(content="普通回复", tool_calls=None))
        result = chat(service)
        assert result.content == "普通回复"
        assert result.tool_calls is None

    def test_bad_arguments_json_tolerated(self):
        """单个调用 arguments 损坏时降级 {"_raw": ...}，其余调用正常解析"""
        response = make_openai_response(
            content=None,
            tool_calls=[
                make_tool_call("search_location", "not-json{"),
                make_tool_call("cast_vote", '{"suspect": "王五"}'),
            ],
        )
        service = make_service(response)

        result = chat(service)

        assert result.tool_calls == [
            ToolCall(name="search_location", arguments={"_raw": "not-json{"}),
            ToolCall(name="cast_vote", arguments={"suspect": "王五"}),
        ]
