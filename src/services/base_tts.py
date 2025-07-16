"""TTS服务基类模块"""
from abc import ABC, abstractmethod
from typing import AsyncGenerator, Optional, Dict, Any
from dataclasses import dataclass


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
    async def synthesize_stream(self, request: TTSRequest) -> AsyncGenerator[Dict[str, Any], None]:
        """流式合成语音"""
        pass