from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, StreamingResponse
from pydantic import BaseModel
import asyncio
import json
from websocket_server import game_server
import os
from dotenv import load_dotenv
import dashscope
import base64

load_dotenv()

app = FastAPI(title="AI剧本杀游戏")

class TTSRequest(BaseModel):
    text: str
    character: str = "default"

# 挂载静态文件目录
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
async def get_index():
    """返回主页面"""
    return HTMLResponse(content=open("static/index.html", "r", encoding="utf-8").read())

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket端点"""
    await websocket.accept()
    await game_server.register_client(websocket)
    
    try:
        while True:
            data = await websocket.receive_text()
            await game_server.handle_client_message(websocket, data)
    except WebSocketDisconnect:
        await game_server.unregister_client(websocket)

@app.get("/api/game/status")
async def get_game_status():
    """获取游戏状态API"""
    return {
        "status": "success",
        "data": game_server.game_engine.game_state
    }

@app.post("/api/game/start")
async def start_game():
    """启动游戏API"""
    await game_server.start_game()
    return {"status": "success", "message": "游戏启动中..."}

@app.post("/api/game/reset")
async def reset_game():
    """重置游戏API"""
    await game_server.reset_game()
    return {"status": "success", "message": "游戏已重置"}

@app.get("/api/characters")
async def get_characters():
    """获取角色信息API"""
    characters = []
    for char in game_server.game_engine.characters:
        characters.append({
            "name": char.name,
            "background": char.background,
            "is_victim": char.is_victim,
            "is_murderer": char.is_murderer  # 在实际游戏中不应该暴露这个信息
        })
    return {"status": "success", "data": characters}

@app.post("/api/tts/stream")
async def stream_tts(request: TTSRequest):
    """TTS流式音频生成API"""
    text = request.text
    character = request.character
    
    # 根据角色选择不同的声音
    # 可用音色: Cherry, Serena, Ethan, Chelsie, Dylan, Jada, Sunny
    voice_mapping = {
        "张医生": "Dylan",
        "李秘书": "Serena", 
        "王律师": "Dylan",
        "陈老板": "Cherry",
        "系统": "Chelsie",
        "default": "Ethan"
    }
    
    voice = voice_mapping.get(character, "Ethan")
    print(f"Using voice: {voice}")
    async def generate_audio():
        try:
            api_key = os.getenv("DASHSCOPE_API_KEY")
            if not api_key:
                error_msg = json.dumps({"error": "DASHSCOPE_API_KEY not configured"})
                yield f"data: {error_msg}\n\n".encode()
                return
                
            responses = dashscope.audio.qwen_tts.SpeechSynthesizer.call(
                model="qwen-tts-latest",
                api_key=api_key,
                text=text,
                voice=voice,
                stream=True
            )
            
            for chunk in responses:
                if "output" in chunk and "audio" in chunk["output"]:
                    audio_info = chunk["output"]["audio"]
                    if audio_info and "data" in audio_info and audio_info["data"]:
                        audio_data = audio_info["data"]
                        # 验证音频数据是否为有效的base64
                        try:
                            # 测试base64解码
                            base64.b64decode(audio_data)
                            # 使用json.dumps确保正确的JSON格式
                            response_data = json.dumps({
                                "audio": audio_data,
                                "character": character
                            })
                            yield f"data: {response_data}\n\n".encode()
                        except Exception as decode_error:
                            print(f"Invalid audio data: {decode_error}")
                            continue
                    
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

if __name__ == "__main__":
    import uvicorn
    
    host = os.getenv("HOST", "localhost")
    port = int(os.getenv("PORT", 8000))
    
    print(f"Starting server on http://{host}:{port}")
    uvicorn.run(app, host=host, port=port)