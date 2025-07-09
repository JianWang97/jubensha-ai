"""TTS服务抽象层"""
from abc import ABC, abstractmethod
from typing import AsyncGenerator, Optional, Dict, Any
from dataclasses import dataclass
import json
import base64

@dataclass
class TTSRequest:
    """TTS请求"""
    text: str
    voice: Optional[str] = None
    speed: Optional[float] = None
    pitch: Optional[float] = None
    extra_params: Optional[Dict[str, Any]] = None

@dataclass
class TTSResponse:
    """TTS响应"""
    audio_data: str  # base64编码的音频数据
    format: str = "mp3"
    sample_rate: Optional[int] = None

class BaseTTSService(ABC):
    """TTS服务基类"""
    
    @abstractmethod
    async def synthesize(self, request: TTSRequest) -> TTSResponse:
        """合成语音"""
        pass
    
    @abstractmethod
    async def synthesize_stream(self, request: TTSRequest) -> AsyncGenerator[Dict[str, Any], None]:
        """流式合成语音"""
        pass

class DashScopeTTSService(BaseTTSService):
    """DashScope TTS服务"""
    
    def __init__(self, api_key: str, model: str = "qwen-tts-latest", **kwargs):
        self.api_key = api_key
        self.model = model
        self.extra_params = kwargs
    
    async def synthesize(self, request: TTSRequest) -> TTSResponse:
        """合成语音"""
        try:
            import dashscope
        except ImportError:
            raise ImportError("dashscope package is required for DashScope TTS service")
        
        # 准备参数
        params = {
            "model": self.model,
            "api_key": self.api_key,
            "text": request.text,
            "voice": request.voice or "Ethan",
            **self.extra_params
        }
        
        if request.extra_params:
            params.update(request.extra_params)
        
        response = dashscope.audio.qwen_tts.SpeechSynthesizer.call(**params)
        
        if "output" in response and "audio" in response["output"]:
            audio_info = response["output"]["audio"]
            if audio_info and "data" in audio_info:
                return TTSResponse(
                    audio_data=audio_info["data"],
                    format="mp3"
                )
        
        raise Exception("Failed to synthesize speech")
    
    async def synthesize_stream(self, request: TTSRequest) -> AsyncGenerator[Dict[str, Any], None]:
        """流式合成语音"""
        try:
            import dashscope
        except ImportError:
            raise ImportError("dashscope package is required for DashScope TTS service")
        
        # 准备参数
        params = {
            "model": self.model,
            "api_key": self.api_key,
            "text": request.text,
            "voice": request.voice or "Ethan",
            "stream": True,
            **self.extra_params
        }
        
        if request.extra_params:
            params.update(request.extra_params)
        
        try:
            responses = dashscope.audio.qwen_tts.SpeechSynthesizer.call(**params)
            
            for chunk in responses:
                if "output" in chunk and "audio" in chunk["output"]:
                    audio_info = chunk["output"]["audio"]
                    if audio_info and "data" in audio_info and audio_info["data"]:
                        audio_data = audio_info["data"]
                        # 验证音频数据是否为有效的base64
                        try:
                            base64.b64decode(audio_data)
                            yield {
                                "audio": audio_data,
                                "format": "mp3"
                            }
                        except Exception:
                            continue
        except Exception as e:
            yield {"error": str(e)}
        
        # 发送结束标记
        yield {"end": True}

class OpenAITTSService(BaseTTSService):
    """OpenAI TTS服务"""
    
    def __init__(self, api_key: str, base_url: Optional[str] = None, model: str = "tts-1", **kwargs):
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
                raise ImportError("openai package is required for OpenAI TTS service")
        return self._client
    
    async def synthesize(self, request: TTSRequest) -> TTSResponse:
        """合成语音"""
        client = self._get_client()
        
        params = {
            "model": self.model,
            "input": request.text,
            "voice": request.voice or "alloy",
            **self.extra_params
        }
        
        if request.extra_params:
            params.update(request.extra_params)
        
        response = await client.audio.speech.create(**params)
        
        # 将音频数据转换为base64
        audio_bytes = response.content
        audio_base64 = base64.b64encode(audio_bytes).decode('utf-8')
        
        return TTSResponse(
            audio_data=audio_base64,
            format="mp3"
        )
    
    async def synthesize_stream(self, request: TTSRequest) -> AsyncGenerator[Dict[str, Any], None]:
        """流式合成语音（OpenAI不支持流式，返回完整音频）"""
        try:
            response = await self.synthesize(request)
            yield {
                "audio": response.audio_data,
                "format": response.format
            }
        except Exception as e:
            yield {"error": str(e)}
        
        yield {"end": True}

class TTSService:
    """TTS服务工厂"""
    
    @staticmethod
    def create_service(provider: str, **config) -> BaseTTSService:
        """创建TTS服务实例"""
        if provider.lower() == "dashscope":
            return DashScopeTTSService(**config)
        elif provider.lower() == "openai":
            return OpenAITTSService(**config)
        else:
            raise ValueError(f"Unsupported TTS provider: {provider}")
    
    @staticmethod
    def from_config(config) -> BaseTTSService:
        """从配置创建TTS服务"""
        return TTSService.create_service(
            provider=config.provider,
            api_key=config.api_key,
            base_url=config.base_url,
            model=config.model,
            **(config.extra_params or {})
        )