"""TTS语音合成相关的API路由"""
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import json

from ...core.websocket_server import game_server
from ...services import TTSService
from ...services.tts_service import TTSRequest as ServiceTTSRequest
from ...core.config import config

router = APIRouter(prefix="/api/tts", tags=["语音合成"])

class TTSRequest(BaseModel):
    text: str
    character: str = "default"
    voice: Optional[str] = None  

@router.post("/stream")
async def stream_tts(request: TTSRequest) -> StreamingResponse:
    """TTS流式音频生成API"""
    text = request.text
    character = request.character
    
    # 验证和清理文本输入
    if not text or not isinstance(text, str):
        return StreamingResponse(
            iter([f"data: {json.dumps({'error': '无效的文本输入'})}".encode()]),
            media_type="text/plain"
        )
    
    # 检查是否是JSON字符串，如果是则拒绝处理
    text = text.strip()
    if text.startswith('{') and text.endswith('}'):
        try:
            json.loads(text)
            # 如果成功解析为JSON，说明传入的是JSON数据，应该拒绝
            return StreamingResponse(
                iter([f"data: {json.dumps({'error': '不支持JSON格式的文本输入'})}".encode()]),
                media_type="text/plain"
            )
        except json.JSONDecodeError:
            # 不是有效的JSON，可以继续处理
            pass
    
    # 限制文本长度，避免过长的输入
    if len(text) > 1000:
        text = text[:1000] + "..."
    
    # 确定使用的voice_id
    voice = request.voice

    print(f"TTS Request - Character: {character}, Voice: {voice}, Text: {text[:50]}...")
    
    # 创建TTS服务实例
    tts_service = TTSService.from_config(config.tts_config)
    
    async def generate_audio():
        try:
            # 创建TTS请求
            tts_request = ServiceTTSRequest(
                text=text,
                voice=voice
            )
            
            # 使用流式TTS服务
            async for chunk in tts_service.synthesize_stream(tts_request):
                if chunk.get('audio'):
                    response_data = json.dumps({
                        "audio": chunk['audio'],
                        "character": character,
                        "encoding": chunk['encoding']
                    })
                    yield f"data: {response_data}\n\n".encode()
                    
        except Exception as e:
            error_msg = json.dumps({"error": str(e)})
            yield f"data: {error_msg}\n\n".encode()
        
        # 发送结束标记
        end_msg = json.dumps({"end": True})
        yield f"data: {end_msg}\n\n".encode()
    
    return StreamingResponse(
        generate_audio(),
        media_type="text/plain",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*"
        }
    )


@router.get("/voices")
async def get_available_voices() -> Dict[str, Any]:
    """获取可用的TTS声音列表"""
    try:
        # 创建TTS服务实例
        tts_service = TTSService.from_config(config.tts_config)
        
        # 根据不同的TTS提供商返回不同的声音列表
        provider = config.tts_config.provider.lower()
        
        if provider == "dashscope":
            # DashScope使用固定的声音列表
            voices = [
                {"voice_id": "Ethan", "name": "Ethan", "gender": "male", "language": "en"},
                {"voice_id": "Emma", "name": "Emma", "gender": "female", "language": "en"},
                {"voice_id": "Liam", "name": "Liam", "gender": "male", "language": "en"},
                {"voice_id": "Olivia", "name": "Olivia", "gender": "female", "language": "en"},
                {"voice_id": "Noah", "name": "Noah", "gender": "male", "language": "en"},
                {"voice_id": "Ava", "name": "Ava", "gender": "female", "language": "en"},
                {"voice_id": "William", "name": "William", "gender": "male", "language": "en"},
                {"voice_id": "Sophia", "name": "Sophia", "gender": "female", "language": "en"}
            ]
            return {
                "success": True,
                "provider": "dashscope",
                "voices": voices
            }
        
        elif provider == "minimax":
            # MiniMax需要调用API获取声音列表
            if hasattr(tts_service, 'get_voice_list'):
                voice_response = await tts_service.get_voice_list()
                if voice_response and voice_response.get('success'):
                    data = voice_response.get('data', {})
                    return {
                        "success": True,
                        "provider": "minimax",
                        "data": data,
                    }
            return {
                "success": False,
                "error": "获取Minimax声音列表失败"
            }
        else:
            return {
                "success": False,
                "error": f"不支持的TTS提供商: {provider}"
            }

    except Exception as e:
        return {
            "success": False,
            "error": f"获取声音列表失败: {str(e)}"
        }