"""LLM服务抽象层"""
import json
import logging
import re
from abc import ABC, abstractmethod
from typing import List, Dict, Any, AsyncGenerator, Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class LLMMessage:
    """LLM消息"""
    role: str  # system, user, assistant
    content: str

@dataclass
class ToolCall:
    """一次工具调用（OpenAI function calling 范式）"""
    name: str
    arguments: Dict[str, Any]

@dataclass
class LLMResponse:
    """LLM响应"""
    content: str
    usage: Optional[Dict[str, int]] = None
    model: Optional[str] = None
    tool_calls: Optional[List[ToolCall]] = None
    reasoning_content: Optional[str] = None  # 推理模型的思考过程（DeepSeek/Kimi 等 reasoning_content 字段）

@dataclass
class StreamChunk:
    """流式输出片段，区分思考过程与正式内容"""
    type: str  # "reasoning" | "content"
    text: str


_THINK_TAG_RE = re.compile(r"<think>(.*?)</think>", re.DOTALL)


def split_think_tags(text: str) -> List[StreamChunk]:
    """把包含 <think>...</think> 标签的文本拆分为 reasoning/content 片段。

    模型把思考过程内联在 content 里时（无 reasoning_content 字段），
    用此函数拆出思考部分以便前端区分展示。无标签时整体视为 content。
    """
    if not text or "<think>" not in text:
        return [StreamChunk(type="content", text=text)] if text else []
    chunks: List[StreamChunk] = []
    pos = 0
    for match in _THINK_TAG_RE.finditer(text):
        before = text[pos:match.start()].strip()
        if before:
            chunks.append(StreamChunk(type="content", text=before))
        thinking = match.group(1).strip()
        if thinking:
            chunks.append(StreamChunk(type="reasoning", text=thinking))
        pos = match.end()
    rest = text[pos:].strip()
    if rest:
        chunks.append(StreamChunk(type="content", text=rest))
    return chunks

def _parse_openai_tool_calls(message) -> Optional[List[ToolCall]]:
    """把 OpenAI 响应 message.tool_calls 解析为 ToolCall 列表。

    单个调用的 arguments JSON 解析失败时降级为 {"_raw": 原始字符串}，
    不中断其余调用的解析。
    """
    raw_calls = getattr(message, "tool_calls", None)
    if not raw_calls:
        return None
    tool_calls: List[ToolCall] = []
    for tc in raw_calls:
        raw_arguments = getattr(tc.function, "arguments", None) or "{}"
        try:
            arguments = json.loads(raw_arguments)
        except (json.JSONDecodeError, ValueError):
            arguments = {"_raw": raw_arguments}
        if not isinstance(arguments, dict):
            arguments = {"_raw": raw_arguments}
        tool_calls.append(ToolCall(name=tc.function.name, arguments=arguments))
    return tool_calls

class BaseLLMService(ABC):
    """LLM服务基类"""
    
    @abstractmethod
    async def chat_completion(self, messages: List[LLMMessage], **kwargs) -> LLMResponse:
        """聊天补全"""
        pass
    
    @abstractmethod
    async def chat_completion_stream(self, messages: List[LLMMessage], **kwargs) -> AsyncGenerator[str, None]:
        """流式聊天补全"""
        pass

    async def chat_completion_stream_chunks(self, messages: List[LLMMessage], **kwargs) -> AsyncGenerator[StreamChunk, None]:
        """流式聊天补全（区分思考/内容）。默认实现把全部输出视为 content。"""
        async for text in self.chat_completion_stream(messages, **kwargs):
            if text:
                yield StreamChunk(type="content", text=text)

class OpenAILLMService(BaseLLMService):
    """OpenAI LLM服务"""
    
    def __init__(self, api_key: str, base_url: Optional[str] = None, model: str = "gpt-3.5-turbo", **kwargs):
        self.api_key = api_key
        self.base_url = base_url
        self.model = model
        self.extra_params = kwargs
        self._client = None
    
    def _get_client(self):
        """获取OpenAI客户端"""
        if self._client is None:
            try:
                from openai import AsyncOpenAI
                self._client = AsyncOpenAI(
                    api_key=self.api_key,
                    base_url=self.base_url
                )
            except ImportError:
                raise ImportError("openai package is required for OpenAI LLM service")
        return self._client
    
    async def chat_completion(self, messages: List[LLMMessage], **kwargs) -> LLMResponse:
        """聊天补全"""
        client = self._get_client()
        
        # 转换消息格式
        openai_messages = [
            {"role": msg.role, "content": msg.content}
            for msg in messages
        ]
        
        # 合并参数
        params = {
            "model": self.model,
            "messages": openai_messages,
            **self.extra_params,
            **kwargs
        }
        
        response = await client.chat.completions.create(**params)
        
        message = response.choices[0].message
        return LLMResponse(
            content=message.content or "",  # 模型只调用工具时 content 可能为 None
            usage=response.usage.model_dump() if response.usage else None,
            model=response.model,
            tool_calls=_parse_openai_tool_calls(message),
            reasoning_content=getattr(message, "reasoning_content", None) or None,
        )
    
    async def chat_completion_stream(self, messages: List[LLMMessage], **kwargs) -> AsyncGenerator[str, None]:
        """流式聊天补全"""
        client = self._get_client()
        
        # 转换消息格式
        openai_messages = [
            {"role": msg.role, "content": msg.content}
            for msg in messages
        ]
        
        # 合并参数
        params = {
            "model": self.model,
            "messages": openai_messages,
            "stream": True,
            **self.extra_params,
            **kwargs
        }
        
        stream = await client.chat.completions.create(**params)
        
        async for chunk in stream:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    async def chat_completion_stream_chunks(self, messages: List[LLMMessage], **kwargs) -> AsyncGenerator[StreamChunk, None]:
        """流式聊天补全，区分 reasoning_content（思考过程）与正式内容。

        - delta.reasoning_content（DeepSeek/Kimi 等 OpenAI 兼容推理字段）→ reasoning chunk
        - delta.content 中内联的 <think>...</think> 标签 → 切分为 reasoning chunk
        """
        client = self._get_client()

        openai_messages = [
            {"role": msg.role, "content": msg.content}
            for msg in messages
        ]

        params = {
            "model": self.model,
            "messages": openai_messages,
            "stream": True,
            **self.extra_params,
            **kwargs
        }

        stream = await client.chat.completions.create(**params)

        in_think_tag = False  # 跟踪 content 内联 <think> 标签状态
        tag_buffer = ""       # 缓存可能跨 chunk 的标签片段
        async for chunk in stream:
            delta = chunk.choices[0].delta
            reasoning = getattr(delta, "reasoning_content", None)
            if reasoning:
                yield StreamChunk(type="reasoning", text=reasoning)
            content = delta.content
            if not content:
                continue
            # 处理内联 <think> 标签（可能跨 chunk 到达）
            tag_buffer += content
            while tag_buffer:
                if in_think_tag:
                    end_idx = tag_buffer.find("</think>")
                    if end_idx == -1:
                        # 未闭合，保留末尾可能是标签前缀的部分
                        keep = max(len(tag_buffer) - 8, 0)
                        if keep:
                            yield StreamChunk(type="reasoning", text=tag_buffer[:keep])
                        tag_buffer = tag_buffer[keep:]
                        break
                    thinking = tag_buffer[:end_idx]
                    if thinking:
                        yield StreamChunk(type="reasoning", text=thinking)
                    tag_buffer = tag_buffer[end_idx + len("</think>"):]
                    in_think_tag = False
                else:
                    start_idx = tag_buffer.find("<think>")
                    if start_idx == -1:
                        keep = max(len(tag_buffer) - 7, 0)
                        if keep:
                            yield StreamChunk(type="content", text=tag_buffer[:keep])
                        tag_buffer = tag_buffer[keep:]
                        break
                    before = tag_buffer[:start_idx]
                    if before:
                        yield StreamChunk(type="content", text=before)
                    tag_buffer = tag_buffer[start_idx + len("<think>"):]
                    in_think_tag = True
        # 冲刷残余缓冲
        if tag_buffer:
            yield StreamChunk(type="reasoning" if in_think_tag else "content", text=tag_buffer)

class LangChainLLMService(BaseLLMService):
    """LangChain LLM服务（兼容现有代码）"""
    
    def __init__(self, api_key: str, base_url: Optional[str] = None, model: str = "gpt-3.5-turbo", **kwargs):
        self.api_key = api_key
        self.base_url = base_url
        self.model = model
        self.extra_params = kwargs
        self._llm = None
    
    def _get_llm(self):
        """获取LangChain LLM实例"""
        if self._llm is None:
            try:
                from langchain_openai import ChatOpenAI
                self._llm = ChatOpenAI(
                    api_key=self.api_key,
                    base_url=self.base_url,
                    model=self.model,
                    **self.extra_params
                )
            except ImportError:
                raise ImportError("langchain-openai package is required for LangChain LLM service")
        return self._llm
    
    async def chat_completion(self, messages: List[LLMMessage], **kwargs) -> LLMResponse:
        """聊天补全（尽力支持 tool calling：kwargs 带 tools 时通过 bind_tools 绑定）"""
        llm = self._get_llm()
        
        # 转换为LangChain消息格式
        from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
        
        lc_messages = []
        for msg in messages:
            if msg.role == "system":
                lc_messages.append(SystemMessage(content=msg.content))
            elif msg.role == "user":
                lc_messages.append(HumanMessage(content=msg.content))
            elif msg.role == "assistant":
                lc_messages.append(AIMessage(content=msg.content))
        
        tools = kwargs.pop("tools", None)
        tool_choice = kwargs.pop("tool_choice", None)
        if tools:
            try:
                llm = llm.bind_tools(tools, tool_choice=tool_choice or "auto")
            except Exception as exc:
                # 底层模型不支持工具绑定时退回普通调用（调用方走 JSON 兜底解析）
                logger.warning(f"LangChain bind_tools 失败，按无工具调用处理: {exc}")
                llm = self._get_llm()
        
        response = await llm.ainvoke(lc_messages)
        
        # LangChain tool_calls 格式：[{"name": ..., "args": {...}, "id": ...}]
        tool_calls = [
            ToolCall(name=tc.get("name", ""), arguments=tc.get("args") or {})
            for tc in (getattr(response, "tool_calls", None) or [])
        ]
        content = response.content if isinstance(response.content, str) else ""
        
        return LLMResponse(
            content=content,
            model=self.model,
            tool_calls=tool_calls or None,
        )
    
    async def chat_completion_stream(self, messages: List[LLMMessage], **kwargs) -> AsyncGenerator[str, None]:
        """流式聊天补全"""
        llm = self._get_llm()
        
        # 转换为LangChain消息格式
        from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
        
        lc_messages = []
        for msg in messages:
            if msg.role == "system":
                lc_messages.append(SystemMessage(content=msg.content))
            elif msg.role == "user":
                lc_messages.append(HumanMessage(content=msg.content))
            elif msg.role == "assistant":
                lc_messages.append(AIMessage(content=msg.content))
        
        async for chunk in llm.astream(lc_messages):
            if chunk.content:
                yield chunk.content

class LLMService:
    """LLM服务工厂"""
    
    @staticmethod
    def create_service(provider: str, **config) -> BaseLLMService:
        """创建LLM服务实例"""
        if not provider:
            raise ValueError("LLM provider cannot be None or empty")
        
        provider_lower = provider.lower()
        if provider_lower == "openai":
            return OpenAILLMService(**config)
        elif provider_lower == "langchain":
            return LangChainLLMService(**config)
        else:
            raise ValueError(f"Unsupported LLM provider: {provider}")
    
    @staticmethod
    def from_config(config) -> BaseLLMService:
        """从配置创建LLM服务"""
        return LLMService.create_service(
            provider=config.provider,
            api_key=config.api_key,
            base_url=config.base_url,
            model=config.model,
            max_tokens=config.max_tokens,
            temperature=config.temperature,
            **(config.extra_params or {})
        )

# 创建全局LLM服务实例
def _create_llm_service() -> BaseLLMService:
    """创建LLM服务实例"""
    try:
        from ..core.config import config
        return LLMService.from_config(config.llm_config)
    except Exception as e:
        # 如果配置加载失败，返回一个默认的服务实例
        print(f"Warning: Failed to load LLM config, using default: {e}")
        return OpenAILLMService(
            api_key="",
            model="gpt-3.5-turbo"
        )

# 模块级缓存，保证容器单例与兼容别名始终是同一实例
_llm_service_instance: Optional[BaseLLMService] = None


def _get_or_create_llm_service() -> BaseLLMService:
    """创建或返回缓存的LLM服务实例（作为DI容器的注册工厂）"""
    global _llm_service_instance
    if _llm_service_instance is None:
        _llm_service_instance = _create_llm_service()
    return _llm_service_instance


def get_llm_service() -> BaseLLMService:
    """获取全局LLM服务实例

    优先从DI容器解析（需先调用 configure_services()）；
    容器未配置时回退到本地创建，保持与旧模块级单例一致的行为。
    """
    global _llm_service_instance
    if _llm_service_instance is not None:
        return _llm_service_instance
    try:
        from ..core.dependency_container import container
        service = container.resolve(LLMService)
    except Exception:
        service = _get_or_create_llm_service()
    _llm_service_instance = service
    return service


def __getattr__(name: str):
    # 向后兼容：保留模块级 `llm_service` 别名，改为惰性解析
    if name == "llm_service":
        return get_llm_service()
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")