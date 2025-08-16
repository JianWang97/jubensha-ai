"""CosyVoice2-Ex TTS服务实现"""
import httpx
import logging
from typing import AsyncGenerator, List, Dict, Any
from gradio_client import Client
from .base_tts import BaseTTSService, TTSRequest, TTSResponse

# 配置日志
logger = logging.getLogger(__name__)





class CosyVoice2ExTTSService(BaseTTSService):
    """CosyVoice2-Ex TTS服务实现"""
    
    def __init__(self, base_url: str = "http://localhost:8189", **kwargs):
        super().__init__()
        self.base_url = base_url.rstrip('/')
        self.client = httpx.AsyncClient(timeout=30.0)
        # 禁用自动下载文件，避免403错误
        self.gradio_client = Client(self.base_url, download_files=False)
        self.session = None  # 初始化session属性
        # 忽略其他不需要的参数（如api_key等）
    
    async def get_voice_list(self) -> Dict[str, Any]:
        """获取可用的音色列表"""
        try:
            # 调用 Gradio API 获取音色列表
            result = self.gradio_client.predict(
                api_name="/refresh_sft_spk",
                fn_index=0
            )
            
            # 处理返回结果
            if isinstance(result, dict) and 'choices' in result:
                choices = result['choices']
            elif isinstance(result, list):
                choices = result
            else:
                logger.error(f"Unexpected result format: {result}")
                return {
                    "success": False,
                    "data": {
                        "system_voice": [],
                        "voice_cloning": [],
                        "voice_generation": [],
                        "music_generation": []
                    },
                    "error": f"Unexpected result format: {result}"
                }
            
            # 转换为MiniMax格式的system_voice列表
            system_voice_list = []
            for choice in choices:
                # 处理choice可能是数组的情况
                if isinstance(choice, list) and len(choice) > 0:
                    voice_name = choice[0]  # 取第一个元素作为音色名称
                else:
                    voice_name = str(choice)
                
                voice_info = {
                    "voice_id": voice_name,
                    "voice_name": voice_name,
                    "description": []
                }
                system_voice_list.append(voice_info)
            
            # 构建与MiniMax一致的data格式
            data = {
                "system_voice": system_voice_list,
                "voice_cloning": [],
                "voice_generation": [],
                "music_generation": []
            }
            
            logger.info(f"获取到 {len(system_voice_list)} 个音色")
            return {
                "success": True,
                "data": data,
                "error": ""
            }
            
        except Exception as e:
            logger.error(f"获取音色列表失败: {e}")
            return {
                "success": False,
                "data": {
                    "system_voice": [],
                    "voice_cloning": [],
                    "voice_generation": [],
                    "music_generation": []
                },
                "error": str(e)
            }
    
    async def text_to_speech(self, request: TTSRequest) -> TTSResponse:
        """文本转语音"""
        try:
            response = self.gradio_client.predict(
                request.text,  # tts_text
                "预训练音色",  # mode_checkbox_group
                request.voice,  # sft_dropdown
                "",  # prompt_text
                None,  # prompt_wav_upload
                None,  # prompt_wav_record
                "",  # instruct_text
                0,  # seed
                "False",  # stream (字符串格式)
                request.speed or 1.0,  # speed
                fn_index=5  # 正确的fn_index
            )
            
            # 检查响应数据
            # 处理禁用下载后的响应格式：返回tuple，第一个元素是音频文件信息
            if response and isinstance(response, (tuple, list)) and len(response) > 0:
                audio_info = response[0]
                if audio_info and isinstance(audio_info, dict) and 'url' in audio_info:
                    # 直接返回音频文件的URL
                    audio_url = audio_info['url']
                    return TTSResponse(
                        audio_data=audio_url,
                        format="wav"
                    )
            
            raise Exception("未获取到音频数据")
                
        except Exception as e:
            raise Exception(f"语音合成失败: {str(e)}")
    
    async def synthesize_stream(self, request: TTSRequest) -> AsyncGenerator[bytes, None]:
        """流式合成语音（适配BaseTTSService接口）"""
        try:
            # 使用Gradio的/api/predict接口调用generate_audio端点（流式模式）
            payload = {
                "fn_index": 2,  # generate_audio的函数索引
                "data": [
                    request.text,  # tts_text
                    ["预训练音色"],  # mode_checkbox_group
                    request.voice,  # sft_dropdown
                    "",  # prompt_text
                    None,  # prompt_wav_upload
                    None,  # prompt_wav_record
                    "",  # instruct_text
                    0,  # seed
                    True,  # stream - 启用流式
                    getattr(request, 'speed', 1.0)  # speed
                ],
                "session_hash": "cosyvoice_stream"
            }
            
            response = await self.client.post(
                f"{self.base_url}/api/predict",
                json=payload
            )
            response.raise_for_status()
            
            result = response.json()
            
            # 从Gradio响应中获取流式音频文件路径
            if "data" in result and len(result["data"]) > 0:
                audio_info = result["data"][0]  # 流式音频在第一个返回值
                if isinstance(audio_info, dict) and "path" in audio_info:
                    # 下载音频文件并流式返回
                    audio_path = audio_info["path"]
                    if audio_path.startswith("/"):
                        file_url = f"{self.base_url}/file={audio_path}"
                    else:
                        file_url = f"{self.base_url}/{audio_path}" if not audio_path.startswith("http") else audio_path
                    
                    async with self.client.stream('GET', file_url) as stream_response:
                        stream_response.raise_for_status()
                        async for chunk in stream_response.aiter_bytes(chunk_size=1024):
                            yield chunk
                            
        except Exception as e:
            logger.error(f"Error in synthesize_stream: {str(e)}", exc_info=True)
            raise e
    
    async def close(self):
        """关闭会话"""
        await self.client.aclose()
        if hasattr(self, 'session') and self.session and not self.session.closed:
            await self.session.close()
            self.session = None
    
    def __del__(self):
        """析构函数"""
        if hasattr(self, 'session') and self.session and not self.session.closed:
            # 在事件循环中关闭会话
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    loop.create_task(self.close())
                else:
                    loop.run_until_complete(self.close())
            except Exception:
                pass