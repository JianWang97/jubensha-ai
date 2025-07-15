from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv
from src.core.websocket_server import game_server

# 导入剧本基础管理API路由
from src.api.script_routes import router as script_router
# 导入剧本管理相关路由
from src.api.routes.script_management_routes import router as script_management_router
from src.api.routes.script_image_generation_routes import router as script_image_generation_router
from src.api.routes.evidence_routes import router as evidence_router
from src.api.routes.character_routes import router as character_router
from src.api.routes.location_routes import router as location_router
# 导入图像生成API路由
from src.api.routes.image_routes import router as image_router
# 导入游戏管理API路由
from src.api.routes.game_routes import router as game_router
# 导入文件管理API路由
from src.api.routes.file_routes import router as file_router
# 导入TTS API路由
from src.api.routes.tts_routes import router as tts_router
# 导入基础数据API路由
from src.api.routes.data_routes import router as data_router
# 导入静态资源API路由
from src.api.routes.asset_routes import router as asset_router
# 导入数据库相关
from src.core.database import db_manager

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

# 数据模型已迁移到各自的路由文件中


# 挂载静态文件目录
app.mount("/static", StaticFiles(directory="static"), name="static")

# 注册剧本基础管理API路由
app.include_router(script_router)
# 注册剧本管理相关路由
app.include_router(script_management_router)
app.include_router(script_image_generation_router)
app.include_router(evidence_router)
app.include_router(character_router)
app.include_router(location_router)
# 注册图像生成API路由
app.include_router(image_router)
# 注册游戏管理API路由
app.include_router(game_router)
# 注册文件管理API路由
app.include_router(file_router)
# 注册TTS API路由
app.include_router(tts_router)
# 注册基础数据API路由
app.include_router(data_router)
# 注册静态资源API路由
app.include_router(asset_router)

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

# create_response函数已迁移到各自的路由文件中

if __name__ == "__main__":
    import uvicorn
    
    host = os.getenv("HOST", "localhost")
    port = int(os.getenv("PORT", 8000))
    
    print(f"Starting server on http://{host}:{port}")
    uvicorn.run(app, host=host, port=port)