"""MiniMax API客户端代理服务"""
import aiohttp
import asyncio
import base64
import json
import logging
from typing import Optional, Dict, Any, AsyncGenerator, List
from dataclasses import dataclass, field
from abc import ABC, abstractmethod
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
    CHUNK_SIZE = 8192
    REQUEST_TIMEOUT = 30
    STREAM_TIMEOUT = 60


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
        self.session = None
    
    async def _get_session(self) -> aiohttp.ClientSession:
        """获取HTTP会话"""
        if self.session is None or self.session.closed:
            self.session = aiohttp.ClientSession(
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                }
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
                
                async for chunk in response.content:
                    if not chunk:
                        continue
                    
                    logger.debug(f"Received chunk: {chunk[:50]}...")
                    
                    # 按照官方示例处理数据块
                    if chunk[:5] == b'data:':
                        try:
                            json_data = json.loads(chunk[5:])
                            
                            # 检查是否包含音频数据
                            if "data" in json_data and "extra_info" not in json_data:
                                if "audio" in json_data["data"]:
                                    audio_hex = json_data["data"]["audio"]
                                    if audio_hex and audio_hex.strip():
                                        yield {
                                            "audio": audio_hex,
                                            'encoding': 'hex',
                                            "format": request.format or "mp3"
                                        }
                                        has_yielded_audio = True
                                        logger.debug(f"Yielded audio chunk: {len(audio_hex)} chars")
                            
                            # 检查错误信息
                            elif "error" in json_data:
                                logger.error(f"API error: {json_data['error']}")
                                yield {"error": json_data["error"]}
                                return
                                
                        except json.JSONDecodeError as e:
                            logger.warning(f"Failed to parse JSON: {e}, chunk: {chunk[:100]}")
                            continue
                    
                    # 检查结束标记
                    elif chunk.strip() in [b'data: [DONE]', b'[DONE]']:
                        logger.debug("Received DONE signal")
                        break
                            
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
            yield {"end": True}
    
    async def generate_image(self, request: MiniMaxImageRequest) -> MiniMaxResponse:
        """生成图片"""
        data = {
            "model": request.model,
            "prompt": request.prompt,
            "aspect_ratio": request.aspect_ratio
        }
        
        if request.guidance_scale is not None:
            data["guidance_scale"] = request.guidance_scale
        
        if request.seed is not None:
            data["seed"] = request.seed
        
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
    
    async def synthesize_stream(self, request: TTSRequest) -> AsyncGenerator[Dict[str, Any], None]:
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
        await self.client.close()


if __name__ == "__main__":
    asyncio.run(example_usage())