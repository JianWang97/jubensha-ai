from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, HTTPException, status
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
import os
import logging
from dotenv import load_dotenv
from src.core.websocket_server import game_server
from src.services.auth_service import AuthService
from src.db.session import init_database, db_manager
from typing import Optional

# 导入剧本管理相关路由
from src.api.routes.script_routes import router as script_management_router
from src.api.routes.script_editor_routes import router as script_editor_router
from src.api.routes.image_generation_routes import router as image_generation_router
from src.api.routes.evidence_routes import router as evidence_router
from src.api.routes.character_routes import router as character_router
from src.api.routes.location_routes import router as location_router
from src.api.routes.asset_routes import router as asset_router
# 导入游戏管理API路由
from src.api.routes.game_routes import router as game_router
# 导入文件管理API路由
from src.api.routes.file_routes import router as file_router
# 导入TTS API路由
from src.api.routes.tts_routes import router as tts_router
# 导入用户认证路由
from src.api.routes.auth_routes import router as auth_router

from src.db.session import init_database, get_db_session

load_dotenv()

app = FastAPI(title="AI剧本杀游戏",docs_url="/docs",redoc_url="/redoc")

# 添加全局验证错误处理器
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """处理请求验证错误，提供详细的错误信息"""
    logger = logging.getLogger(__name__)
    
    # 记录详细的错误信息
    error_details = []
    for error in exc.errors():
        error_details.append({
            "field": ".".join(str(x) for x in error["loc"]),
            "message": error["msg"],
            "type": error["type"],
            "input": error.get("input")
        })
    
    logger.error(f"请求验证失败 - URL: {request.url}, 错误详情: {error_details}")
    
    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "message": "请求数据验证失败",
            "errors": error_details,
            "detail": "请检查请求数据格式和字段类型"
        }
    )

# 添加认证中间件（必须在CORS之后添加）
from src.core.auth_middleware import UnifiedAuthMiddleware
app.add_middleware(UnifiedAuthMiddleware)

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

# 注册剧本管理相关路由
app.include_router(script_management_router)
app.include_router(script_editor_router)
app.include_router(image_generation_router)
app.include_router(evidence_router)
app.include_router(character_router)
app.include_router(location_router)
# 注册游戏管理API路由
app.include_router(game_router)
# 注册文件管理API路由
app.include_router(file_router)
# 注册TTS API路由
app.include_router(tts_router)
app.include_router(asset_router)
# 注册用户认证路由
app.include_router(auth_router)
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, script_id: int = 1, token: str = None):
    """WebSocket端点 - 支持token认证，基于用户身份自动管理会话"""
    from src.services.auth_service import AuthService
    import logging
    
    logger = logging.getLogger(__name__)
    await websocket.accept()
    
    # 通过token获取当前用户
    current_user = None
    if token:
        try:
            # 验证令牌
            token_data = AuthService.verify_token(token)
            
            # 获取数据库会话
            db_gen = get_db_session()
            db = next(db_gen)
            
            try:
                # 获取用户
                if token_data.username:
                    current_user = AuthService.get_user_by_username(db, token_data.username)
                    
                if current_user and not getattr(current_user, 'is_active', False):
                    current_user = None
            finally:
                db.close()
                
        except Exception as e:
            logger.error(f"WebSocket token验证失败: {e}")
            await websocket.close(code=1008, reason="Invalid token")
            return
    
    if not current_user:
        logger.warning("WebSocket连接缺少有效的用户认证")
        await websocket.close(code=1008, reason="Authentication required")
        return
    
    # 使用验证后的用户ID注册客户端
    user_id = getattr(current_user, 'id', None)
    await game_server.register_client(websocket, script_id, user_id)
    
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
        # 初始化SQLAlchemy数据库
        init_database()
        print("SQLAlchemy数据库初始化完成")
        
        # 配置依赖注入容器
        from .dependency_container import configure_services
        configure_services()
        print("依赖注入容器配置完成")
    except Exception as e:
        print(f"应用初始化失败: {e}")

@app.on_event("shutdown")
async def shutdown_event():
    """应用关闭时的清理"""
    try:
        # 关闭数据库连接池
        from src.db.session import db_manager
        db_manager.close()
        print("数据库连接池已关闭")
    except Exception as e:
        print(f"数据库关闭失败: {e}")

# create_response函数已迁移到各自的路由文件中

if __name__ == "__main__":
    import uvicorn
    
    host = os.getenv("HOST", "localhost")
    port = int(os.getenv("PORT", 8000))
    
    print(f"Starting server on http://{host}:{port}")
    uvicorn.run(app, host=host, port=port)