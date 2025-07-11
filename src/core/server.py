from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import asyncio
import json
from src.core.websocket_server import game_server
import os
from dotenv import load_dotenv

# 导入剧本管理API路由
from src.api.script_routes import router as script_router
# 导入新的服务抽象层
from src.services import TTSService
from src.services.tts_service import TTSRequest as ServiceTTSRequest
from src.core.config import config
# 导入数据库相关
from src.core.database import db_manager
from src.core.script_repository import script_repository

load_dotenv()

app = FastAPI(title="AI剧本杀游戏",docs_url="/docs",redoc_url="/redoc")

# 添加CORS中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 在生产环境中应该设置具体的域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TTSRequest(BaseModel):
    text: str
    character: str = "default"


# 挂载静态文件目录
app.mount("/static", StaticFiles(directory="static"), name="static")

# 注册剧本管理API路由
app.include_router(script_router)

@app.get("/")
async def get_index():
    """返回主页面"""
    return HTMLResponse(content=open("static/index.html", "r", encoding="utf-8").read())

@app.get("/script-manager")
async def get_script_manager():
    """返回剧本管理页面"""
    return HTMLResponse(content=open("static/script_manager.html", "r", encoding="utf-8").read())

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, session_id: str = None, script_id: int = 1):
    """WebSocket端点"""
    await websocket.accept()
    await game_server.register_client(websocket, session_id, script_id)
    
    try:
        while True:
            data = await websocket.receive_text()
            await game_server.handle_client_message(websocket, data)
    except WebSocketDisconnect:
        await game_server.unregister_client(websocket)

@app.get("/api/game/status")
async def get_game_status(session_id: str = None):
    """获取游戏状态API"""
    try:
        # 如果没有提供session_id，使用默认会话
        if session_id is None:
            session_id = "default"
        
        # 获取或创建会话
        session = game_server.get_or_create_session(session_id)
        
        # 确保游戏已初始化
        if not session._game_initialized:
            await game_server._initialize_game(session)
        
        return {
            "success": True,
            "message": "获取游戏状态成功",
            "data": session.game_engine.game_state
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Failed to get game status: {str(e)}"
        }

@app.post("/api/game/start")
async def start_game(session_id: str = None, script_id: int = 1):
    """启动游戏API"""
    try:
        # 如果没有提供session_id，使用默认会话
        if session_id is None:
            session_id = "default"
        
        await game_server.start_game(session_id, script_id)
        return create_response(True, "游戏启动中...")
    except Exception as e:
        return create_response(False, f"Failed to start game: {str(e)}")

@app.post("/api/game/reset")
async def reset_game(session_id: str = None):
    """重置游戏API"""
    try:
        # 如果没有提供session_id，使用默认会话
        if session_id is None:
            session_id = "default"
        
        await game_server.reset_game(session_id)
        return create_response(True, "游戏已重置")
    except Exception as e:
        return create_response(False, f"Failed to reset game: {str(e)}")

@app.get("/api/scripts")
async def get_scripts():
    """获取剧本列表API"""
    try:
        scripts = await script_repository.get_all_scripts()
        return create_response(True, "获取剧本列表成功", scripts)
    except Exception as e:
        return create_response(False, f"Failed to get scripts: {str(e)}")

@app.get("/api/characters/{script_id}")
async def get_characters(script_id: int):
    """获取指定剧本的角色信息API"""
    try:
        characters = await script_repository.get_script_characters(script_id)
        return create_response(True, "获取角色列表成功", characters)
    except Exception as e:
        return create_response(False, f"Failed to get characters: {str(e)}")

@app.get("/api/background/{script_id}")
async def get_background_by_script(script_id: int):
    """获取指定剧本的背景故事API"""
    try:
        background = await script_repository.get_script_background(script_id)
        return create_response(True, "获取背景故事成功", background)
    except Exception as e:
        return create_response(False, f"Failed to get background: {str(e)}")

@app.get("/api/background")
async def get_background():
    """获取背景故事API（兼容旧版本）"""
    try:
        # 尝试从数据库获取第一个剧本的背景故事
        scripts = await script_repository.get_all_scripts()
        if scripts:
            background = await script_repository.get_script_background(scripts[0]['id'])
            return create_response(True, "获取背景故事成功", background)
        else:
            # 如果数据库中没有剧本，使用游戏引擎的默认背景
            try:
                session = game_server.get_or_create_session("default")
                if not session._game_initialized:
                    await game_server._initialize_game(session)
                background = session.game_engine.get_background_story()
                return create_response(True, "获取背景故事成功", background)
            except Exception as engine_error:
                return create_response(False, f"Failed to get background: {str(engine_error)}")
    except Exception as e:
        # 出错时回退到游戏引擎的默认背景
        try:
            session = game_server.get_or_create_session("default")
            if not session._game_initialized:
                await game_server._initialize_game(session)
            background = session.game_engine.get_background_story()
            return create_response(True, "获取背景故事成功", background)
        except Exception as engine_error:
            return create_response(False, f"Failed to get background: {str(engine_error)}")

@app.get("/api/voices")
async def get_voice_assignments(session_id: str = None):
    """获取声音分配信息API"""
    try:
        # 如果没有提供session_id，创建一个默认会话
        if session_id is None:
            session_id = "default"
        
        # 获取或创建会话
        session = game_server.get_or_create_session(session_id)
        
        # 确保游戏已初始化
        if not session._game_initialized:
            await game_server._initialize_game(session)
        
        voice_mapping = session.game_engine.get_voice_mapping()
        voice_info = session.game_engine.get_voice_assignment_info()
        
        return {
            "success": True,
            "message": "获取声音分配成功",
            "data": {
                "mapping": voice_mapping,
                "details": voice_info
            }
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Failed to get voice assignments: {str(e)}"
        }

@app.post("/api/tts/stream")
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

@app.on_event("startup")
async def startup_event():
    """应用启动时的初始化"""
    try:
        # 初始化数据库
        await db_manager.initialize()
        print("数据库初始化完成")
    except Exception as e:
        print(f"数据库初始化失败: {e}")

@app.on_event("shutdown")
async def shutdown_event():
    """应用关闭时的清理"""
    try:
        await db_manager.close()
        print("数据库连接已关闭")
    except Exception as e:
        print(f"数据库关闭失败: {e}")

def create_response(success: bool, message: str, data=None):
    return {
        "success": success,
        "message": message,
        "data": data
    }

if __name__ == "__main__":
    import uvicorn
    
    host = os.getenv("HOST", "localhost")
    port = int(os.getenv("PORT", 8000))
    
    print(f"Starting server on http://{host}:{port}")
    uvicorn.run(app, host=host, port=port)