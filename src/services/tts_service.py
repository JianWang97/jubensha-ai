"""TTS服务抽象层"""
from typing import AsyncGenerator, Optional, Dict, Any
import json
import base64
from .base_tts import BaseTTSService, TTSRequest, TTSResponse

class DashScopeTTSService(BaseTTSService):
    """DashScope TTS服务"""
    
    def __init__(self, api_key: str, model: str = "qwen-tts-latest", **kwargs):
        self.api_key = api_key
        self.model = model
        self.extra_params = kwargs
    
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



class TTSService:
    """TTS服务工厂"""
    
    @staticmethod
    def create_service(provider: str, **config) -> BaseTTSService:
        """创建TTS服务实例"""
        if not provider:
            raise ValueError("TTS provider cannot be None or empty")
        
        provider_lower = provider.lower()
        if provider_lower == "dashscope":
            return DashScopeTTSService(**config)
        elif provider_lower == "minimax":
            # 延迟导入避免循环依赖
            from .minimax_service import MiniMaxTTSService
            return MiniMaxTTSService(**config)
        else:
            raise ValueError(f"Unsupported TTS provider: {provider}")
    
    @staticmethod
    def from_config(config) -> BaseTTSService:
        """从配置创建TTS服务"""
        return TTSService.create_service(
            provider=config.provider,
            api_key=config.api_key,
            model=config.model,
            **(config.extra_params or {})
        )