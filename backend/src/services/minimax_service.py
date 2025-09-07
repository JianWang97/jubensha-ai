"""MiniMax API客户端代理服务"""
from typing import Optional, Dict, Any, AsyncGenerator, Coroutine, cast
import asyncio
import json
import ssl
import base64
import logging
import aiohttp
from dataclasses import dataclass
from typing import List, Optional
import os

from .base_tts import BaseTTSService, TTSRequest, TTSResponse

# 配置日志
logger = logging.getLogger(__name__)


class MiniMaxConstants:
    """MiniMax API 常量定义"""
    DEFAULT_MODEL = "speech-02-turbo"
    DEFAULT_VOICE = "male-qn-qingse"
    DEFAULT_SAMPLE_RATE = 32000
    DEFAULT_BITRATE = 128000
    DEFAULT_CHANNEL = 1
    STREAM_TIMEOUT = 60
    MAX_CONNECTIONS = 100  # 最大连接数
    MAX_CONNECTIONS_PER_HOST = 30  # 每个主机最大连接数


@dataclass
class MiniMaxTTSRequest:
    """MiniMax TTS请求"""
    text: str
    voice_id: Optional[str] = None
    model: str = MiniMaxConstants.DEFAULT_MODEL
    speed: Optional[float] = None
    volume: Optional[float] = None
    pitch: Optional[float] = None
    audio_sample_rate: Optional[int] = None
    bitrate: Optional[int] = None
    format: str = "mp3"
    channel: Optional[int] = None
    extra_params: Optional[Dict[str, Any]] = None
    stream: bool = False

    def __post_init__(self):
        if not self.text.strip():
            raise ValueError("Text cannot be empty")


@dataclass
class MiniMaxImageRequest:
    """MiniMax图像生成请求"""
    prompt: str
    model: str = "image-01"
    aspect_ratio: str = "1:1"
    response_format: str = "url"
    n: int = 1
    prompt_optimizer: bool = False
    width: Optional[int] = None
    height: Optional[int] = None
    seed: Optional[int] = None
    aigc_watermark: bool = False

    def __post_init__(self):
        if not self.prompt.strip():
            raise ValueError("Prompt cannot be empty")


@dataclass
class MiniMaxResponse:
    """MiniMax响应基类"""
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    task_id: Optional[str] = None


class MiniMaxClient:
    """MiniMax API客户端"""

    def __init__(self, api_key: str, group_id: str):
        super().__init__()
        self.api_key = api_key
        self.group_id = group_id
        self.base_url = "https://api.minimaxi.com"
        self.session: Optional[aiohttp.ClientSession] = None

    async def _get_session(self) -> aiohttp.ClientSession:
        """获取HTTP会话"""
        if self.session is None or self.session.closed:
            ssl_context = ssl.create_default_context()
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE
            connector = aiohttp.TCPConnector(
                limit=MiniMaxConstants.MAX_CONNECTIONS,
                limit_per_host=MiniMaxConstants.MAX_CONNECTIONS_PER_HOST,
                ttl_dns_cache=300,
                use_dns_cache=True,
                ssl=ssl_context,
            )
            self.session = aiohttp.ClientSession(
                connector=connector,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                },
                timeout=aiohttp.ClientTimeout(
                    total=MiniMaxConstants.STREAM_TIMEOUT,
                    connect=10,
                    sock_read=30
                )
            )
        return self.session

    async def close(self):
        if self.session and not self.session.closed:
            await self.session.close()
            self.session = None

    async def _make_request(self, method: str, endpoint: str, data: Optional[Dict[str, Any]] = None,
                            params: Optional[Dict[str, Any]] = None, notNeedGroupId: bool = False) -> Dict[str, Any]:
        """发送HTTP请求"""
        session = await self._get_session()
        url = f"{self.base_url}{endpoint}"
        if params:
            params["GroupId"] = self.group_id
        else:
            params = {"GroupId": self.group_id}
        if notNeedGroupId:
            params.pop("GroupId", None)
        try:
            async with session.request(method, url, json=data, params=params) as response:
                text = await response.text()
                try:
                    response_data: Dict[str, Any] = json.loads(text) if text else {}
                except Exception:
                    response_data = {"raw": text}
                if response.status >= 400:
                    raise Exception(f"HTTP {response.status}: {response_data}")
                return response_data
        except aiohttp.ClientError as e:
            raise Exception(f"Network Error: {str(e)}")

    async def text_to_speech(self, request: MiniMaxTTSRequest) -> MiniMaxResponse:
        """非流式文本转语音，返回hex音频并转换为base64"""
        data: Dict[str, Any] = {
            "model": request.model,
            "text": request.text,
            "stream": False,
            "language_boost": "auto",
            "output_format": "hex",
            "voice_setting": {
                "voice_id": request.voice_id or MiniMaxConstants.DEFAULT_VOICE,
                "speed": request.speed or 1.0,
                "vol": request.volume or 1.0,
                "pitch": request.pitch or 0,
            },
            "audio_setting": {
                "sample_rate": request.audio_sample_rate or MiniMaxConstants.DEFAULT_SAMPLE_RATE,
                "bitrate": request.bitrate or MiniMaxConstants.DEFAULT_BITRATE,
                "format": request.format,
            }
        }
        if request.extra_params:
            data.update(request.extra_params)
        try:
            response = await self._make_request("POST", "/v1/t2a_v2", data)
            logger.debug(f"MiniMax TTS response: {str(response)[:400]}")
            base_resp = response.get("base_resp", {})
            if base_resp.get("status_code") != 0:
                return MiniMaxResponse(success=False, error=base_resp.get("status_msg", "Unknown error"))
            audio_hex = response.get("data", {}).get("audio")
            if not audio_hex:
                return MiniMaxResponse(success=False, error="No audio field in response")
            try:
                audio_bytes = bytes.fromhex(audio_hex)
            except ValueError:
                return MiniMaxResponse(success=False, error="Invalid hex audio data")
            audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
            extra_info = response.get("extra_info", {})
            return MiniMaxResponse(success=True, data={
                "audio_base64": audio_b64,
                "format": data["audio_setting"]["format"],
                "meta": extra_info
            })
        except Exception as e:
            return MiniMaxResponse(success=False, error=str(e))

    async def generate_image(self, request: MiniMaxImageRequest) -> MiniMaxResponse:
        """生成图像"""
        data: Dict[str, Any] = {
            "model": request.model,
            "prompt": request.prompt,
            "aspect_ratio": request.aspect_ratio,
            "response_format": request.response_format,
            "n": request.n,
            "prompt_optimizer": request.prompt_optimizer,
            "aigc_watermark": request.aigc_watermark
        }
        
        # 添加可选参数
        if request.width is not None:
            data["width"] = request.width
            
        if request.height is not None:
            data["height"] = request.height
            
        if request.seed is not None:
            data["seed"] = request.seed

        try:
            response = await self._make_request("POST", "/v1/image_generation", data, notNeedGroupId=True)
            logger.debug(f"MiniMax Image Generation response: {str(response)[:400]}")
            
            base_resp = response.get("base_resp", {})
            if base_resp.get("status_code") != 0:
                return MiniMaxResponse(success=False, error=base_resp.get("status_msg", "Unknown error"))
            
            image_data = response.get("data", {})
            metadata = response.get("metadata", {})
            
            return MiniMaxResponse(
                success=True,
                data={
                    "images": image_data.get("image_urls", []) if request.response_format == "url" 
                              else image_data.get("image_base64", []),
                    "metadata": metadata
                },
                task_id=response.get("id")
            )
        except Exception as e:
            logger.error(f"MiniMax image generation error: {e}", exc_info=True)
            return MiniMaxResponse(success=False, error=str(e))

    async def get_voice_list(self) -> MiniMaxResponse:
        """获取可用声音列表"""
        try:
            data = {"voice_type": "all"}
            response = await self._make_request("POST", "/v1/get_voice", data)
            return MiniMaxResponse(success=True, data=response)
        except Exception as e:
            logger.error(f"Failed to get voice list from MiniMax: {e}", exc_info=True)
            return MiniMaxResponse(success=False, error=str(e))


class MiniMaxTTSService(BaseTTSService):
    """封装为与其他TTS一致的流式接口(内部使用非流式)"""
    def __init__(self, api_key: str, group_id: str, model: str, **kwargs: Any):
        super().__init__()
        self.api_key = api_key
        self.group_id = group_id
        self.model = model or MiniMaxConstants.DEFAULT_MODEL
        self.extra_params: Dict[str, Any] = dict(kwargs)
        self._client: Optional[MiniMaxClient] = None

    def _get_client(self) -> MiniMaxClient:
        if self._client is None:
            self._client = MiniMaxClient(self.api_key, self.group_id)
        return self._client

    async def synthesize_stream(self, request: TTSRequest) -> AsyncGenerator[Dict[str, Any], None]:  # type: ignore
        client = self._get_client()
        minimax_request = MiniMaxTTSRequest(
            text=request.text,
            voice_id=request.voice,
            model=self.model,
            speed=request.speed or 1.0,
            pitch=request.pitch or 0,
            extra_params=self.extra_params,
            stream=False,
        )
        try:
            resp = await client.text_to_speech(minimax_request)
            if not resp.success:
                yield {"error": resp.error or "MiniMax TTS failed"}
                yield {"end": True}
                return
            data_dict = cast(Dict[str, Any], resp.data) if isinstance(resp.data, dict) else {}
            audio_b64_val = data_dict.get("audio_base64")
            if not isinstance(audio_b64_val, str):
                yield {"error": "Invalid audio data"}
                yield {"end": True}
                return
            audio_b64: str = audio_b64_val
            chunk_size = 100_000
            fmt = data_dict.get("format", "mp3") if isinstance(data_dict.get("format"), str) else "mp3"
            for i in range(0, len(audio_b64), chunk_size):
                yield {"audio": audio_b64[i:i+chunk_size], "format": fmt}
            yield {"end": True}
        except Exception as e:
            logger.error(f"MiniMax synthesize error: {e}", exc_info=True)
            yield {"error": str(e)}
            yield {"end": True}

    async def close(self):
        if self._client:
            await self._client.close()
            self._client = None

    async def text_to_speech(self, request: TTSRequest) -> TTSResponse:
        """非流式文本转语音"""
        client = self._get_client()
        minimax_request = MiniMaxTTSRequest(
            text=request.text,
            voice_id=request.voice,
            model=self.model,
            speed=request.speed or 1.0,
            pitch=request.pitch or 0,
            extra_params=self.extra_params,
            stream=False,
        )
        try:
            resp = await client.text_to_speech(minimax_request)
            if not resp.success:
                # 修复：TTSResponse不接受success参数
                return TTSResponse(
                    audio_data="",  # 空的音频数据表示失败
                    format="mp3"
                )
            
            data_dict = cast(Dict[str, Any], resp.data) if isinstance(resp.data, dict) else {}
            audio_b64 = data_dict.get("audio_base64", "")
            fmt = data_dict.get("format", "mp3")
            
            # 修复：TTSResponse不接受success和error参数
            return TTSResponse(
                audio_data=audio_b64,
                format=fmt
            )
        except Exception as e:
            logger.error(f"MiniMax text_to_speech error: {e}", exc_info=True)
            # 修复：TTSResponse不接受success和error参数
            return TTSResponse(
                audio_data="",  # 空的音频数据表示失败
                format="mp3"
            )

    async def get_voice_list(self) -> Dict[str, Any]:
        """获取可用声音列表 (包装客户端返回)"""
        client = self._get_client()
        try:
            resp = await client.get_voice_list()
            return {
                "success": resp.success,
                "data": resp.data if resp.success else None,
                "error": resp.error if not resp.success else None
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def __del__(self):
        try:
            if self._client and self._client.session:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    loop.create_task(self._client.close())
                else:
                    loop.run_until_complete(self._client.close())
        except Exception:
            pass


# 图像生成服务
class MiniMaxImageGenerationService:
    """MiniMax图像生成服务"""
    
    def __init__(self):
        self.api_key = os.getenv("MINIMAX_API_KEY")
        self._client: Optional[MiniMaxClient] = None
    
    def _get_client(self) -> Optional[MiniMaxClient]:
        """获取MiniMax客户端实例"""
        if not self.api_key:
            logger.warning("MINIMAX_API_KEY not set, MiniMax image generation service unavailable")
            return None
            
        if self._client is None:
            self._client = MiniMaxClient(self.api_key, "")  # group_id对于图像生成不是必需的
        return self._client
    
    async def generate_image(self, prompt: str, aspect_ratio: str = "1:1", n: int = 1) -> Dict[str, Any]:
        """生成图像"""
        client = self._get_client()
        if not client:
            return {
                "success": False,
                "error": "MiniMax API key not configured"
            }
        
        try:
            request = MiniMaxImageRequest(
                prompt=prompt,
                aspect_ratio=aspect_ratio,
                n=n,
                response_format="url"
            )
            
            response = await client.generate_image(request)
            
            if response.success and response.data:
                return {
                    "success": True,
                    "images": response.data.get("images", []),
                    "metadata": response.data.get("metadata", {}),
                    "task_id": response.task_id
                }
            else:
                return {
                    "success": False,
                    "error": response.error or "Unknown error"
                }
        except Exception as e:
            logger.error(f"Failed to generate image with MiniMax: {e}", exc_info=True)
            return {
                "success": False,
                "error": str(e)
            }
        finally:
            # 确保客户端连接被正确关闭
            if self._client:
                await self._client.close()
    
    async def close(self):
        """关闭服务"""
        if self._client:
            await self._client.close()
            self._client = None

# 全局服务实例
minimax_image_service = MiniMaxImageGenerationService()