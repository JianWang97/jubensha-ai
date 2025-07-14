from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, StreamingResponse, FileResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import asyncio
import json
from src.core.websocket_server import game_server
import os
from dotenv import load_dotenv
from src.core.storage import storage_manager
import io
from datetime import timedelta

# 导入剧本管理API路由
from src.api.script_routes import router as script_router
# 导入图像生成API路由
from src.api.routes.image_routes import router as image_router
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

class FileUploadResponse(BaseModel):
    success: bool
    message: str
    file_url: str = None
    file_name: str = None


# 挂载静态文件目录
app.mount("/static", StaticFiles(directory="static"), name="static")

# 注册剧本管理API路由
app.include_router(script_router)
# 注册图像生成API路由
app.include_router(image_router)

@app.get("/")
async def get_index():
    """返回主页面"""
    return HTMLResponse(content=open("static/index.html", "r", encoding="utf-8").read())

@app.get("/script-manager")
async def get_script_manager():
    """返回剧本管理页面"""
    return HTMLResponse(content=open("static/script_manager.html", "r", encoding="utf-8").read())

@app.get("/jubensha-assets/{path:path}")
async def get_assets(path: str):
    """通过storage接口获取MinIO文件"""
    try:
        # 检查存储服务是否可用
        if not storage_manager.is_available:
            raise HTTPException(status_code=503, detail="存储服务不可用")
        
        # 通过storage接口获取文件
        result = await storage_manager.get_file(path)
        
        if result is None:
            raise HTTPException(status_code=404, detail="文件未找到")
        
        file_content, content_type = result
        
        # 返回文件内容
        return Response(
            content=file_content,
            media_type=content_type,
            headers={
                "Cache-Control": "public, max-age=3600",  # 缓存1小时
                "Content-Length": str(len(file_content))
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"文件访问失败: {str(e)}")

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

@app.post("/api/files/upload")
async def upload_file(file: UploadFile = File(...), category: str = "general"):
    """文件上传API
    
    Args:
        file: 上传的文件
        category: 文件分类 (covers/avatars/evidence/scenes/general)
    
    Returns:
        上传结果和文件访问URL
    """
    try:
        # 检查存储服务是否可用
        if not storage_manager.is_available:
            raise HTTPException(status_code=503, detail="存储服务不可用")
        
        # 验证文件类型
        allowed_types = {
            "image/jpeg", "image/png", "image/gif", "image/webp",
            "audio/mpeg", "audio/wav", "audio/ogg",
            "video/mp4", "video/webm",
            "application/pdf", "text/plain"
        }
        
        if file.content_type not in allowed_types:
            raise HTTPException(status_code=400, detail=f"不支持的文件类型: {file.content_type}")
        
        # 验证文件大小 (最大50MB)
        max_size = 50 * 1024 * 1024  # 50MB
        file_content = await file.read()
        if len(file_content) > max_size:
            raise HTTPException(status_code=400, detail="文件大小超过限制 (50MB)")
        
        # 创建文件流
        file_stream = io.BytesIO(file_content)
        
        # 上传文件
        minio_url = await storage_manager.upload_file(
            file_data=file_stream,
            filename=file.filename,
            category=category
        )
        
        if minio_url:
            # 从MinIO URL中提取object_name，构造API下载URL
            object_name = minio_url.split(f"/{storage_manager.config.bucket_name}/")[-1]
            # 对object_name进行URL编码
            from urllib.parse import quote
            encoded_object_name = quote(object_name, safe='')
            api_download_url = f"/api/files/download/{encoded_object_name}"
            
            return create_response(
                True,
                "文件上传成功",
                {
                    "file_url": api_download_url,
                    "file_name": file.filename,
                    "category": category,
                    "content_type": file.content_type,
                    "size": len(file_content)
                }
            )
        else:
            raise HTTPException(status_code=500, detail="文件上传失败")
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"上传失败: {str(e)}")

@app.get("/api/files/list")
async def list_files(category: str = None):
    """获取文件列表API
    
    Args:
        category: 文件分类过滤 (可选)
    
    Returns:
        文件列表
    """
    try:
        # 检查存储服务是否可用
        if not storage_manager.is_available:
            raise HTTPException(status_code=503, detail="存储服务不可用")
        
        files = storage_manager.list_files(category)
        
        return create_response(
            True,
            "获取文件列表成功",
            {
                "files": files,
                "category": category,
                "total": len(files)
            }
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取文件列表失败: {str(e)}")

@app.delete("/api/files/delete")
async def delete_file(file_url: str):
    """删除文件API
    
    Args:
        file_url: 要删除的文件URL
    
    Returns:
        删除结果
    """
    try:
        # 检查存储服务是否可用
        if not storage_manager.is_available:
            raise HTTPException(status_code=503, detail="存储服务不可用")
        
        # 删除文件
        success = await storage_manager.delete_file(file_url)
        
        if success:
            return create_response(True, "文件删除成功")
        else:
            raise HTTPException(status_code=500, detail="文件删除失败")
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"删除失败: {str(e)}")

@app.get("/api/files/stats")
async def get_storage_stats():
    """获取存储统计信息API
    
    Returns:
        存储统计数据
    """
    try:
        # 检查存储服务是否可用
        if not storage_manager.is_available:
            return create_response(
                False,
                "存储服务不可用",
                {"available": False}
            )
        
        stats = storage_manager.get_storage_stats()
        
        return create_response(
            True,
            "获取存储统计成功",
            {
                "available": True,
                "stats": stats
            }
        )
        
    except Exception as e:
        return create_response(False, f"获取存储统计失败: {str(e)}")

@app.get("/api/files/download/{file_path:path}")
async def download_file(file_path: str):
    """文件下载API
    
    Args:
        file_path: 文件在MinIO中的路径
    
    Returns:
        文件流响应
    """
    try:
        # 检查存储服务是否可用
        if not storage_manager.is_available:
            raise HTTPException(status_code=503, detail="存储服务不可用")
        
        # 获取文件的预签名URL用于下载
        try:
            # 生成临时下载URL (有效期1小时)
            download_url = storage_manager.client.presigned_get_object(
                storage_manager.config.bucket_name,
                file_path,
                expires=timedelta(hours=1)  # 1小时
            )
            
            # 重定向到预签名URL
            from fastapi.responses import RedirectResponse
            return RedirectResponse(url=download_url)
            
        except Exception as e:
            raise HTTPException(status_code=404, detail=f"文件不存在或无法访问: {str(e)}")
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"下载失败: {str(e)}")

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