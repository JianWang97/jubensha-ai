"""MiniMax API客户端代理服务"""
from typing import Optional, Dict, Any, AsyncGenerator, Coroutine, cast
from dataclasses import dataclass
import asyncio
import json
import ssl
import base64
import logging
import aiohttp

from .base_tts import BaseTTSService, TTSRequest

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
                return TTSResponse(
                    success=False,
                    audio_data="",
                    format="mp3",
                    error=resp.error or "MiniMax TTS failed"
                )
            
            data_dict = cast(Dict[str, Any], resp.data) if isinstance(resp.data, dict) else {}
            audio_b64 = data_dict.get("audio_base64", "")
            fmt = data_dict.get("format", "mp3")
            
            return TTSResponse(
                success=True,
                audio_data=audio_b64,
                format=fmt,
                error=None
            )
        except Exception as e:
            logger.error(f"MiniMax text_to_speech error: {e}", exc_info=True)
            return TTSResponse(
                success=False,
                audio_data="",
                format="mp3",
                error=str(e)
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
