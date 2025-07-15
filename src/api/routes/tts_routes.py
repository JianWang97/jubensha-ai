"""TTS语音合成相关的API路由"""
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import json

from ...core.websocket_server import game_server
from ...services import TTSService
from ...services.tts_service import TTSRequest as ServiceTTSRequest
from ...core.config import config

router = APIRouter(prefix="/api/tts", tags=["语音合成"])

class TTSRequest(BaseModel):
    text: str
    character: str = "default"

@router.post("/stream")
async def stream_tts(request: TTSRequest):
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
    
    # 使用智能声音分配系统
    try:
        # 获取默认会话的声音映射
        session = game_server.get_or_create_session("default")
        if not session._game_initialized:
            await game_server._initialize_game(session)
        voice_mapping = session.game_engine.get_voice_mapping()
        voice = voice_mapping.get(character, "Ethan")
    except Exception as e:
        print(f"Failed to get voice mapping: {e}, using default voice")
        voice = "Ethan"
    
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
                        "character": character
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