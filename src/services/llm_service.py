"""LLM服务抽象层"""
from abc import ABC, abstractmethod
from typing import List, Dict, Any, AsyncGenerator, Optional
from dataclasses import dataclass

@dataclass
class LLMMessage:
    """LLM消息"""
    role: str  # system, user, assistant
    content: str

@dataclass
class LLMResponse:
    """LLM响应"""
    content: str
    usage: Optional[Dict[str, int]] = None
    model: Optional[str] = None

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
        
        return LLMResponse(
            content=response.choices[0].message.content,
            usage=response.usage.model_dump() if response.usage else None,
            model=response.model
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
        """聊天补全"""
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
        
        response = await llm.ainvoke(lc_messages)
        
        return LLMResponse(
            content=response.content,
            model=self.model
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
        if provider.lower() == "openai":
            return OpenAILLMService(**config)
        elif provider.lower() == "langchain":
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