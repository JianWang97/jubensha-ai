# 服务抽象层架构文档

## 概述

本项目已重构为使用服务抽象层架构，将所有第三方API接口（LLM和TTS）抽象化，便于扩展到其他平台和服务提供商。

## 架构设计

### 1. 配置管理 (`src/core/config.py`)

集中管理所有服务配置，支持从环境变量加载：

```python
from src.core.config import config

# 访问LLM配置
llm_config = config.llm_config

# 访问TTS配置
tts_config = config.tts_config
```

### 2. LLM服务抽象层 (`src/services/llm_service.py`)

支持多种LLM提供商：
- OpenAI (直接API)
- LangChain (兼容现有代码)
- 可扩展到其他提供商

```python
from src.services import LLMService
from src.core.config import config

# 创建LLM服务实例
llm_service = LLMService.from_config(config.llm_config)

# 使用聊天补全
response = await llm_service.chat_completion(messages)
```

### 3. TTS服务抽象层 (`src/services/tts_service.py`)

支持多种TTS提供商：
- DashScope (阿里云)
- OpenAI TTS
- 可扩展到其他提供商

```python
from src.services import TTSService
from src.core.config import config

# 创建TTS服务实例
tts_service = TTSService.from_config(config.tts_config)

# 使用语音合成
response = await tts_service.synthesis(request)
```

## 环境配置

### LLM配置

```env
# LLM服务提供商
LLM_PROVIDER=openai  # openai, langchain

# OpenAI配置
OPENAI_API_KEY=your_api_key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-3.5-turbo

# LLM参数
DEFAULT_MODEL=gpt-3.5-turbo
LLM_MAX_TOKENS=2000
LLM_TEMPERATURE=0.7
```

### TTS配置

```env
# TTS服务提供商
TTS_PROVIDER=dashscope  # dashscope, openai

# DashScope配置
DASHSCOPE_API_KEY=your_dashscope_key

# TTS参数
TTS_MODEL=qwen-tts-latest
TTS_DEFAULT_VOICE=Ethan
TTS_BASE_URL=https://dashscope.aliyuncs.com
```

## 扩展新的服务提供商

### 添加新的LLM提供商

1. 在 `src/services/llm_service.py` 中创建新的服务类：

```python
class NewLLMService(BaseLLMService):
    """新的LLM服务"""
    
    async def chat_completion(self, messages: List[LLMMessage]) -> LLMResponse:
        # 实现具体的API调用逻辑
        pass
```

2. 在 `LLMService.from_config()` 方法中添加新的提供商：

```python
elif provider.lower() == "new_provider":
    return NewLLMService(**config)
```

### 添加新的TTS提供商

1. 在 `src/services/tts_service.py` 中创建新的服务类：

```python
class NewTTSService(BaseTTSService):
    """新的TTS服务"""
    
    async def synthesis(self, request: TTSRequest) -> TTSResponse:
        # 实现具体的API调用逻辑
        pass
```

2. 在 `TTSService.from_config()` 方法中添加新的提供商：

```python
elif provider.lower() == "new_provider":
    return NewTTSService(**config)
```

## 迁移指南

### 从旧代码迁移

1. **AI代理类**：已更新为使用新的LLM服务抽象层
2. **TTS API**：已更新为使用新的TTS服务抽象层
3. **配置管理**：所有配置现在通过 `config` 模块统一管理

### 兼容性

- AI代理构造函数仍支持传入 `api_key` 参数（向后兼容）
- 现有的环境变量配置继续有效
- LangChain服务类提供与现有代码的兼容性

## 优势

1. **可维护性**：统一的接口和配置管理
2. **可扩展性**：轻松添加新的服务提供商
3. **可测试性**：可以轻松模拟和测试不同的服务
4. **灵活性**：运行时切换不同的服务提供商
5. **解耦**：业务逻辑与具体的API实现分离