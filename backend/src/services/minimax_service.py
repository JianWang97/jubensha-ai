"""MiniMax API客户端代理服务"""
import aiohttp
import asyncio
import base64
import json
import logging
import ssl
from typing import Optional, Dict, Any, AsyncGenerator, List
from dataclasses import dataclass, field
from abc import ABC, abstractmethod
from .base_tts import BaseTTSService, TTSRequest
from typing import Coroutine, Any, AsyncGenerator, Dict

# 配置日志
logger = logging.getLogger(__name__)


class MiniMaxConstants:
    """MiniMax API 常量定义"""
    DEFAULT_MODEL = "speech-02-turbo"
    DEFAULT_VOICE = "male-qn-qingse"
    DEFAULT_SAMPLE_RATE = 32000
    DEFAULT_BITRATE = 128000
    DEFAULT_CHANNEL = 1
    CHUNK_SIZE = 8192  # HTTP读取块大小
    MAX_AUDIO_HEX_SIZE = 100000  # 单次处理的最大音频hex数据大小
    AUDIO_CHUNK_SIZE = 50000  # 音频数据分块大小
    REQUEST_TIMEOUT = 30
    STREAM_TIMEOUT = 60
    MAX_CONNECTIONS = 100  # 最大连接数
    MAX_CONNECTIONS_PER_HOST = 30  # 每个主机最大连接数


@dataclass
class MiniMaxTTSRequest:
    """MiniMax TTS请求"""
    text: str
    voice_id: Optional[str] = None
    model: str = "speech-02-turbo"
    speed: Optional[float] = None
    volume: Optional[float] = None
    pitch: Optional[float] = None
    audio_sample_rate: Optional[int] = None
    bitrate: Optional[int] = None
    format: str = "mp3"
    channel: Optional[int] = None
    pronunciation_dict: Optional[Dict[str, Any]] = None
    extra_params: Optional[Dict[str, Any]] = None
    
    def __post_init__(self):
        if not self.text.strip():
            raise ValueError("Text cannot be empty")


@dataclass
class MiniMaxImageRequest:
    """MiniMax图片生成请求"""
    prompt: str
    model: str = "image-01"
    aspect_ratio: str = "1:1"  # 1:1, 16:9, 9:16, 4:3, 3:4
    guidance_scale: Optional[float] = None
    seed: Optional[int] = None
    extra_params: Optional[Dict[str, Any]] = None


@dataclass
class MiniMaxVoiceCloneRequest:
    """MiniMax声音克隆请求"""
    file_id: str
    voice_id: str
    extra_params: Optional[Dict[str, Any]] = None


@dataclass
class MiniMaxResponse:
    """MiniMax响应基类"""
    success: bool
    data: Optional[Any] = None
    error: Optional[str] = None
    task_id: Optional[str] = None


class MiniMaxClient:
    """MiniMax API客户端"""
    
    def __init__(self, api_key: str, group_id: str):
        self.api_key = api_key
        self.group_id = group_id
        self.base_url ="https://api.minimaxi.com"
        self.session: Optional[aiohttp.ClientSession] = None
    
    async def _get_session(self) -> aiohttp.ClientSession:
        """获取HTTP会话"""
        if self.session is None or self.session.closed:
            # 创建SSL上下文，处理证书验证问题
            ssl_context = ssl.create_default_context()
            # 在开发环境中，可以选择性地禁用证书验证
            # 注意：在生产环境中应该使用正确的证书验证
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE
            
            # 创建连接器，增加限制以避免"Chunk too big"错误
            connector = aiohttp.TCPConnector(
                limit=MiniMaxConstants.MAX_CONNECTIONS,  # 总连接数限制
                limit_per_host=MiniMaxConstants.MAX_CONNECTIONS_PER_HOST,  # 每个主机的连接数限制
                ttl_dns_cache=300,  # DNS缓存时间
                use_dns_cache=True,
                ssl=ssl_context,  # 使用自定义SSL上下文
            )
            
            self.session = aiohttp.ClientSession(
                connector=connector,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                },
                # 增加超时配置
                timeout=aiohttp.ClientTimeout(
                    total=MiniMaxConstants.STREAM_TIMEOUT,
                    connect=10,
                    sock_read=30
                )
            )
        return self.session
    
    async def close(self):
        """关闭客户端"""
        if self.session and not self.session.closed:
            await self.session.close()
    
    async def __aenter__(self):
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()
    
    async def _make_request(self, method: str, endpoint: str, data: Optional[Dict] = None, 
                           params: Optional[Dict] = None, notNeedGroupId:bool = False) -> Dict[str, Any]:

        """发送HTTP请求"""
        session = await self._get_session()
        url = f"{self.base_url}{endpoint}"
        
        if params:
            params["GroupId"] = self.group_id
        else:
            params = {"GroupId": self.group_id}
        
        if not notNeedGroupId:
            params["GroupId"] = self.group_id
        else:
            params.pop("GroupId")
        
        try:
            async with session.request(method, url, json=data, params=params) as response:
                response_data = await response.json()
                
                if response.status >= 400:
                    raise Exception(f"API Error: {response.status} - {response_data.get('message', 'Unknown error')}")
                
                return response_data
        except aiohttp.ClientError as e:
            raise Exception(f"Network Error: {str(e)}")
    
    async def text_to_speech(self, request: MiniMaxTTSRequest) -> MiniMaxResponse:
        """文本转语音"""
        data = {
            "model": request.model,
            "text": request.text,
            "stream": False,
            "voice_setting": {
                "voice_id": request.voice_id or "male-qn-qingse",
                "speed": request.speed or 1.0,
                "vol": request.volume or 1.0,
                "pitch": request.pitch or 0
            },
            "audio_setting": {
                "sample_rate": request.audio_sample_rate or 32000,
                "bitrate": request.bitrate or 128000,
                "format": request.format
            }
        }
        
        if request.extra_params:
            data.update(request.extra_params)
        
        try:
            response = await self._make_request("POST", "/v1/t2a_v2", data)
            print(response)
            if "data" in response and "audio" in response["data"]:
                return MiniMaxResponse(
                    success=True,
                    data={
                        "audio_data": response["data"]["audio"],
                        "format": request.format,
                        "sample_rate": request.audio_sample_rate
                    },
                    task_id=response.get("task_id")
                )
            else:
                return MiniMaxResponse(
                    success=False,
                    error="No audio data in response"
                )
        except Exception as e:
            return MiniMaxResponse(
                success=False,
                error=str(e)
            )
    
    async def text_to_speech_stream(self, request: MiniMaxTTSRequest) -> AsyncGenerator[Dict[str, Any], None]:
        """流式文本转语音"""
        data = {
            "model": request.model,
            "text": request.text,
            "stream": True,
            "voice_setting": {
                "voice_id": request.voice_id or MiniMaxConstants.DEFAULT_VOICE,
                "speed": request.speed or 1.0,
                "vol": request.volume or 1.0,
                "pitch": request.pitch or 0
            },
            "audio_setting": {
                "sample_rate": request.audio_sample_rate or MiniMaxConstants.DEFAULT_SAMPLE_RATE,
                "bitrate": request.bitrate or MiniMaxConstants.DEFAULT_BITRATE,
                "format": request.format or "mp3",
                "channel": request.channel or MiniMaxConstants.DEFAULT_CHANNEL
            }
        }
        
        # 添加发音字典支持
        if request.pronunciation_dict:
            data["pronunciation_dict"] = request.pronunciation_dict
            
        if request.extra_params:
            data.update(request.extra_params)
            
        logger.debug(f"TTS request data: {json.dumps(data, ensure_ascii=False)[:200]}...")
        
        session = await self._get_session()
        url = f"{self.base_url}/v1/t2a_v2"
        params = {"GroupId": self.group_id}
        
        has_yielded_audio = False
        
        try:
            timeout = aiohttp.ClientTimeout(total=MiniMaxConstants.STREAM_TIMEOUT)
            async with session.post(url, json=data, params=params, timeout=timeout) as response:
                if response.status >= 400:
                    try:
                        error_data = await response.json()
                        yield {"error": f"API Error: {response.status} - {error_data.get('message', 'Unknown error')}"}
                    except:
                        yield {"error": f"API Error: {response.status}"}
                    return
                
                # 检查响应头
                content_type = response.headers.get('content-type', '')
                if 'text/event-stream' not in content_type and 'application/octet-stream' not in content_type:
                    # 可能是非流式响应，尝试作为普通JSON处理
                    try:
                        json_data = await response.json()
                        if "data" in json_data and "audio" in json_data["data"]:
                            yield {
                                "audio": json_data["data"]["audio"],
                                "format": request.format or "mp3"
                            }
                            has_yielded_audio = True
                        elif "error" in json_data:
                            yield {"error": json_data["error"]}
                        return
                    except:
                        pass
                
                # 使用官方推荐的流式处理方式
                logger.debug(f"Processing stream response, content-type: {content_type}")
                
                # 缓冲区用于累积不完整的数据
                buffer = b''
                
                # 使用较小的块大小读取，避免"Chunk too big"错误
                async for chunk in response.content.iter_chunked(MiniMaxConstants.CHUNK_SIZE):
                    if not chunk:
                        continue
                    
                    # 将新数据添加到缓冲区
                    buffer += chunk
                    logger.debug(f"Buffer size: {len(buffer)}, new chunk: {len(chunk)}")
                    
                    # 处理缓冲区中的完整行
                    while b'\n' in buffer:
                        line, buffer = buffer.split(b'\n', 1)
                        line = line.strip()
                        
                        if not line:
                            continue
                            
                        logger.debug(f"Processing line: {line[:50]!r}")
                        
                        # 按照官方示例处理数据块
                        if line.startswith(b'data:'):
                            try:
                                json_str = line[5:].strip()
                                if not json_str:
                                    continue
                                    
                                json_data = json.loads(json_str)
                                
                                # 检查是否包含音频数据
                                if "data" in json_data and "extra_info" not in json_data:
                                    if "audio" in json_data["data"]:
                                        audio_hex = json_data["data"]["audio"]
                                        # 限制单次处理的音频数据大小，避免内存问题
                                        if len(audio_hex) > MiniMaxConstants.MAX_AUDIO_HEX_SIZE:  # 如果hex数据太大，分块处理
                                            logger.warning(f"Large audio chunk detected: {len(audio_hex)} chars, splitting...")
                                            # 分块处理大的音频数据
                                            chunk_size = MiniMaxConstants.AUDIO_CHUNK_SIZE
                                            for i in range(0, len(audio_hex), chunk_size):
                                                hex_chunk = audio_hex[i:i+chunk_size]
                                                try:
                                                    audio_base64 = base64.b64encode(bytes.fromhex(hex_chunk)).decode('utf-8')
                                                    if audio_base64 and audio_base64.strip():
                                                        yield {
                                                            "audio": audio_base64,
                                                            "encoding": "base64",
                                                            "format": request.format or "mp3",
                                                            "chunk_index": i // chunk_size
                                                        }
                                                        has_yielded_audio = True
                                                        logger.debug(f"Yielded audio chunk {i // chunk_size}: {len(audio_base64)} chars")
                                                except ValueError as e:
                                                    logger.error(f"Invalid hex data in chunk {i // chunk_size}: {e}")
                                                    continue
                                        else:
                                            try:
                                                audio_base64 = base64.b64encode(bytes.fromhex(audio_hex)).decode('utf-8')
                                                if audio_base64 and audio_base64.strip():
                                                    yield {
                                                        "audio": audio_base64,
                                                        "encoding": "base64",
                                                        "format": request.format or "mp3"
                                                    }
                                                    has_yielded_audio = True
                                                    logger.debug(f"Yielded audio chunk: {len(audio_base64)} chars")
                                            except ValueError as e:
                                                logger.error(f"Invalid hex data: {e}")
                                                continue
                                
                                # 检查错误信息
                                elif "error" in json_data:
                                    print(json_data)
                                    logger.error(f"API error: {json_data['error']}")
                                    yield {"error": json_data["error"]}
                                    return
                                    
                            except json.JSONDecodeError as e:
                                logger.warning(f"Failed to parse JSON: {e}, line: {line[:100]!r}")
                                continue
                            except Exception as e:
                                logger.error(f"Error processing line: {e}")
                                continue
                        
                        # 检查结束标记
                        elif line.strip() in [b'data: [DONE]', b'[DONE]']:
                            logger.debug("Received DONE signal")
                            return
                            
        except asyncio.TimeoutError:
            logger.error("TTS stream request timeout")
            yield {"error": "Request timeout"}
        except aiohttp.ClientError as e:
            logger.error(f"HTTP client error: {e}")
            yield {"error": f"Network error: {str(e)}"}
        except Exception as e:
            logger.error(f"Unexpected error in TTS stream: {e}")
            yield {"error": f"Stream processing error: {str(e)}"}
        finally:
            # 如果没有收到任何音频数据，报告错误
            if not has_yielded_audio:
                logger.warning("No audio data received from MiniMax API")
                yield {"error": "No audio data received from MiniMax API"}
            # 发送结束标记
            logger.debug("Sending end marker")
            await self.close()
            yield {"end": True}
    
    async def generate_image(self, request: MiniMaxImageRequest) -> MiniMaxResponse:
        """生成图片"""
        data = {
            "model": request.model,
            "prompt": request.prompt,
            "aspect_ratio": request.aspect_ratio
        }
        
        if request.guidance_scale is not None:
            data["guidance_scale"] = str(request.guidance_scale)
        
        if request.seed is not None:
            data["seed"] = str(request.seed)
        
        if request.extra_params:
            data.update(request.extra_params)
        
        try:
            response = await self._make_request("POST", "/v1/image_generation", data)
            
            if "data" in response and "images" in response["data"]:
                images = response["data"]["images"]
                return MiniMaxResponse(
                    success=True,
                    data={
                        "images": images,
                        "prompt": request.prompt
                    },
                    task_id=response.get("task_id")
                )
            else:
                return MiniMaxResponse(
                    success=False,
                    error="No image data in response"
                )
        except Exception as e:
            return MiniMaxResponse(
                success=False,
                error=str(e)
            )
    
    async def upload_file(self, file_path: str, purpose: str = "voice_clone") -> MiniMaxResponse:
        """上传文件"""
        session = await self._get_session()
        url = f"{self.base_url}/v1/files/upload"
        params = {"GroupId": self.group_id}
        
        try:
            with open(file_path, 'rb') as f:
                data = aiohttp.FormData()
                data.add_field('file', f, filename=file_path.split('/')[-1])
                data.add_field('purpose', purpose)
                
                # 临时移除Content-Type头，让aiohttp自动设置multipart
                headers = {"Authorization": f"Bearer {self.api_key}"}
                
                async with session.post(url, data=data, params=params, headers=headers) as response:
                    response_data = await response.json()
                    
                    if response.status >= 400:
                        return MiniMaxResponse(
                            success=False,
                            error=f"Upload failed: {response.status} - {response_data.get('message', 'Unknown error')}"
                        )
                    
                    return MiniMaxResponse(
                        success=True,
                        data=response_data
                    )
        except Exception as e:
            return MiniMaxResponse(
                success=False,
                error=str(e)
            )
    
    async def clone_voice(self, request: MiniMaxVoiceCloneRequest) -> MiniMaxResponse:
        """克隆声音"""
        data = {
            "file_id": request.file_id,
            "voice_id": request.voice_id
        }
        
        if request.extra_params:
            data.update(request.extra_params)
        
        try:
            response = await self._make_request("POST", "/v1/voice_clone", data)
            
            return MiniMaxResponse(
                success=True,
                data=response,
                task_id=response.get("task_id")
            )
        except Exception as e:
            return MiniMaxResponse(
                success=False,
                error=str(e)
            )
    
    async def get_voice_list(self) -> MiniMaxResponse:
        """获取可用声音列表"""
        try:
            # 添加voice_type参数获取所有类型的声音
            data = {
                'voice_type': 'all'
            }
            response = await self._make_request("POST", "/v1/get_voice",data)
            
            return MiniMaxResponse(
                success=True,
                data=response
            )
        except Exception as e:
            logger.error(f"Failed to get voice list from MiniMax: {str(e)}", exc_info=True)
            return MiniMaxResponse(
                success=False,
                error=str(e)
            )


class MiniMaxTTSService(BaseTTSService):
    """MiniMax TTS服务"""
    def __init__(self, api_key: str, group_id: str, model: str , **kwargs):
        self.api_key = api_key
        self.group_id = group_id
        self.model = model
        self.extra_params = kwargs
        self._client = None
    
    def _get_client(self):
        """获取MiniMax客户端"""
        if self._client is None:
            try:
                self._client = MiniMaxClient(self.api_key, self.group_id)
            except ImportError:
                raise ImportError("minimax_service module is required for MiniMax TTS service")
        return self._client
    
    async def synthesize_stream(self, request: TTSRequest) -> Coroutine[Any, Any, AsyncGenerator[dict[str, Any], None]]: # type: ignore
        """流式合成语音"""
        client = self._get_client()
        
        minimax_request = MiniMaxTTSRequest(
            text=request.text,
            voice_id=request.voice,
            model=self.model,
            speed=request.speed or 1.0,
            pitch=request.pitch or 0,
            extra_params=request.extra_params
        )
        
        try:
            async for chunk in client.text_to_speech_stream(minimax_request):
                yield chunk
        except Exception as e:
            yield {"error": str(e)}
            yield {"end": True}
    
    async def get_voice_list(self) -> Dict[str, Any]:
        """获取可用声音列表"""
        client = self._get_client()
        try:
            response = await client.get_voice_list()
            return {
                "success": response.success,
                "data": response.data if response.success else None,
                "error": response.error if not response.success else None
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    async def close(self):
        """关闭服务"""
        logger.info("Closing MiniMaxTTSService")
        if self._client:
            await self._client.close()
            self._client = None
