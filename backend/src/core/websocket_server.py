import asyncio
import json
import logging
from typing import Set, Union, Any, Dict, Optional
from datetime import datetime
from abc import ABC, abstractmethod
import os

from sqlalchemy.orm import Session
from src.core import GameEngine
from src.schemas.game_phase import GamePhaseEnum as GamePhase
from src.services.script_editor_service import ScriptEditorService, EditInstruction, EditResult
from src.db.repositories import ScriptRepository
from src.db.repositories.game_session_repository import GameSessionRepository
from src.db.session import get_db_session, db_manager
from src.db.models.game_session import GameSession as DBGameSession, GameSessionStatus
from src.core.game_tts_manager import GameTTSManager
from dotenv import load_dotenv
import uuid

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

try:
    import websockets
except ImportError:
    websockets = None

load_dotenv()

def serialize_object(obj):
    """序列化对象，处理datetime等不可序列化的对象"""
    try:
        if hasattr(obj, 'dict'):
            obj_dict = obj.dict()
        elif isinstance(obj, dict):
            obj_dict = obj
        else:
            return str(obj)
        
        # 递归处理字典中的datetime对象
        def convert_datetime(data):
            if isinstance(data, dict):
                return {k: convert_datetime(v) for k, v in data.items()}
            elif isinstance(data, list):
                return [convert_datetime(item) for item in data]
            elif isinstance(data, datetime):
                return data.isoformat()
            else:
                return data
        
        return convert_datetime(obj_dict)
    except Exception as e:
        logger.error(f"[SERIALIZE] 序列化对象失败: {e}")
        return {"error": "序列化失败", "message": str(e)}

def serialize_script_data(script):
    """序列化剧本数据的便捷函数"""
    return serialize_object(script)

class GameSession:
    """游戏会话类，管理单个房间的游戏状态"""
    def __init__(self, session_id: str, script_id: int = 1):
        self.session_id:str = session_id
        self.clients: set[Any] = set()
        self.script_id = script_id
        self.game_engine = GameEngine(session_id=session_id)
        self.is_game_running = False
        self.game_initialized = False  # 修改：将保护属性改为公共属性
        # 剧本编辑相关
        self.is_editing_mode:bool = False
        self.editor_service: ScriptEditorService|None = None
        self.editing_context: dict[str, Any] = {}  # 存储编辑上下文
        self.db_session:Session|None = None  # 数据库会话引用，类型为Session或None
        
        # TTS管理器
        self.tts_manager: GameTTSManager|None = None
        self._initialize_tts_manager()
    
    def _initialize_tts_manager(self):
        """初始化TTS管理器"""
        try:
            # 从环境变量获取MiniMax配置
            api_key = os.getenv("TTS_API_KEY")
            group_id = os.getenv("MINIMAX_GROUP_ID")
            
            if api_key and group_id:
                self.tts_manager = GameTTSManager(
                    api_key=api_key,
                    group_id=group_id,
                    model="speech-02-turbo"
                )
                logger.info(f"[TTS] TTS管理器初始化成功: 会话={self.session_id}")
            else:
                logger.warning(f"[TTS] 缺少MiniMax配置，TTS功能不可用: 会话={self.session_id}")
        except Exception as e:
            logger.error(f"[TTS] TTS管理器初始化失败: {e}, 会话={self.session_id}")
            self.tts_manager = None
    
    def cleanup(self):
        """清理会话资源，包括数据库连接"""
        try:
            # 清理TTS管理器
            if self.tts_manager:
                try:
                    # 创建异步任务来关闭TTS管理器
                    import asyncio
                    loop = asyncio.get_event_loop()
                    if loop.is_running():
                        loop.create_task(self.tts_manager.close())
                    logger.info(f"[CLEANUP] TTS管理器已清理: 会话={self.session_id}")
                except Exception as e:
                    logger.error(f"[ERROR] 清理TTS管理器失败: 会话={self.session_id}, 错误={e}")
                finally:
                    self.tts_manager = None
            
            # 关闭数据库会话
            if self.db_session:
                try:
                    # 如果有未提交的事务，先回滚
                    if self.db_session.in_transaction():
                        self.db_session.rollback()
                    self.db_session.close()
                    logger.info(f"[CLEANUP] 数据库会话已关闭: 会话={self.session_id}")
                except Exception as e:
                    logger.error(f"[ERROR] 关闭数据库会话失败: 会话={self.session_id}, 错误={e}")
                finally:
                    self.db_session = None
            
            # 清理编辑相关资源
            self.is_editing_mode = False
            self.editor_service = None
            self.editing_context = {}
            
            # 停止游戏循环
            self.is_game_running = False
            
            logger.info(f"[CLEANUP] 会话资源清理完成: 会话={self.session_id}")
            
        except Exception as e:
            logger.error(f"[ERROR] 清理会话资源失败: 会话={self.session_id}, 错误={e}")

# 定义消息处理器接口
class MessageHandler(ABC):
    """消息处理器抽象基类"""
    
    @abstractmethod
    async def handle(self, server: 'GameWebSocketServer', websocket: Any, data: dict):
        """处理消息"""
        pass

# 具体的消息处理器
class StartGameHandler(MessageHandler):
    """处理开始游戏消息"""
    
    async def handle(self, server: 'GameWebSocketServer', websocket: Any, data: dict):
        session_id = data.get("session_id") or server.client_sessions.get(websocket)
        script_id = data.get("script_id")
        logger.info(f"[GAME] 开始游戏请求: 会话={session_id}, 剧本ID={script_id}")
        await GameModeHandler.start_game(server, session_id, script_id)

class NextPhaseHandler(MessageHandler):
    """处理进入下一阶段消息"""
    
    async def handle(self, server: 'GameWebSocketServer', websocket: Any, data: dict):
        session_id = data.get("session_id") or server.client_sessions.get(websocket)
        logger.info(f"[GAME] 下一阶段请求: 会话={session_id}")
        await GameModeHandler.next_phase(server, session_id)

class GetGameStateHandler(MessageHandler):
    """处理获取游戏状态消息"""
    
    async def handle(self, server: 'GameWebSocketServer', websocket: Any, data: dict):
        session_id = data.get("session_id") or server.client_sessions.get(websocket)
        session = server.sessions.get(session_id)
        if session:
            logger.debug(f"[GAME] 获取游戏状态请求: 会话={session_id}")
            await server.send_to_client(websocket, {
                "type": "game_state",
                "data": session.game_engine.game_state,
                "session_id": session_id
            })

class GetPublicChatHandler(MessageHandler):
    """处理获取公开聊天消息"""
    
    async def handle(self, server: 'GameWebSocketServer', websocket: Any, data: dict):
        session_id = data.get("session_id") or server.client_sessions.get(websocket)
        session = server.sessions.get(session_id)
        if session:
            logger.debug(f"[GAME] 获取公开聊天请求: 会话={session_id}")
            await server.send_to_client(websocket, {
                "type": "public_chat",
                "data": session.game_engine.get_recent_public_chat(),
                "session_id": session_id
            })

class ResetGameHandler(MessageHandler):
    """处理重置游戏消息"""
    
    async def handle(self, server: 'GameWebSocketServer', websocket: Any, data: dict):
        session_id = data.get("session_id") or server.client_sessions.get(websocket)
        logger.info(f"[GAME] 重置游戏请求: 会话={session_id}")
        await GameModeHandler.reset_game(server, session_id)

class StartScriptEditingHandler(MessageHandler):
    """处理开始剧本编辑消息"""
    
    async def handle(self, server: 'GameWebSocketServer', websocket: Any, data: dict):
        session_id = data.get("session_id") or server.client_sessions.get(websocket)
        script_id = data.get("script_id")
        logger.info(f"[EDITOR] 开始剧本编辑请求: 会话={session_id}, 剧本ID={script_id}")
        await EditModeHandler.start_script_editing(server, session_id, script_id)

class StopScriptEditingHandler(MessageHandler):
    """处理停止剧本编辑消息"""
    
    async def handle(self, server: 'GameWebSocketServer', websocket: Any, data: dict):
        session_id = data.get("session_id") or server.client_sessions.get(websocket)
        logger.info(f"[EDITOR] 停止剧本编辑请求: 会话={session_id}")
        await EditModeHandler.stop_script_editing(server, session_id)

class EditInstructionHandler(MessageHandler):
    """处理编辑指令消息"""
    
    async def handle(self, server: 'GameWebSocketServer', websocket: Any, data: dict):
        session_id = data.get("session_id") or server.client_sessions.get(websocket)
        instruction = data.get("instruction", "")
        logger.info(f"[EDITOR] 编辑指令请求: 会话={session_id}, 指令长度={len(instruction)}字符")
        await EditModeHandler.handle_edit_instruction(server, session_id, instruction)

class GetScriptDataHandler(MessageHandler):
    """处理获取剧本数据消息"""
    
    async def handle(self, server: 'GameWebSocketServer', websocket: Any, data: dict):
        session_id = data.get("session_id") or server.client_sessions.get(websocket)
        logger.debug(f"[EDITOR] 获取剧本数据请求: 会话={session_id}")
        await EditModeHandler.get_script_data(server, session_id)

class GenerateAISuggestionHandler(MessageHandler):
    """处理生成AI建议消息"""
    
    async def handle(self, server: 'GameWebSocketServer', websocket: Any, data: dict):
        session_id = data.get("session_id") or server.client_sessions.get(websocket)
        context = data.get("context", "")
        logger.info(f"[EDITOR] AI建议生成请求: 会话={session_id}, 上下文长度={len(context)}字符")
        await EditModeHandler.generate_ai_suggestion(server, session_id, context)

class GetTTSHistoryHandler(MessageHandler):
    """处理获取TTS历史记录消息"""
    
    async def handle(self, server: 'GameWebSocketServer', websocket: Any, data: dict):
        session_id = data.get("session_id") or server.client_sessions.get(websocket)
        character_name = data.get("character_name")
        limit = data.get("limit", 20)
        
        session = server.sessions.get(session_id)
        if not session or not session.tts_manager:
            await server.send_to_client(websocket, {
                "type": "error",
                "message": "TTS服务不可用",
                "session_id": session_id
            })
            return
        
        try:
            logger.info(f"[TTS] 获取TTS历史请求: 会话={session_id}, 角色={character_name}")
            
            history = await session.tts_manager.get_character_tts_history(
                session_id=session_id,
                character_name=character_name,
                limit=limit
            )
            
            await server.send_to_client(websocket, {
                "type": "tts_history",
                "data": {
                    "session_id": session_id,
                    "character_name": character_name,
                    "history": history,
                    "total_count": len(history)
                },
                "session_id": session_id
            })
            
        except Exception as e:
            logger.error(f"[ERROR] 获取TTS历史失败: 会话={session_id}, 错误={e}")
            await server.send_to_client(websocket, {
                "type": "error",
                "message": f"获取TTS历史失败: {str(e)}",
                "session_id": session_id
            })

class FetchHistoryHandler(MessageHandler):
    """处理历史回看消息"""

    async def handle(self, server: 'GameWebSocketServer', websocket: Any, data: dict):
        session_id = data.get("session_id") or server.client_sessions.get(websocket)
        from_event_id = int(data.get("from_event_id") or 0)
        limit = data.get("limit")
        try:
            limit_val = int(limit) if limit is not None else None
        except Exception:
            limit_val = None
        session = server.sessions.get(session_id)
        if not session:
            await server.send_to_client(websocket, {"type": "error", "message": "会话不存在", "session_id": session_id})
            return
        history = session.game_engine.get_history(from_event_id=from_event_id, limit=limit_val)
        await server.send_to_client(websocket, {
            "type": "history",
            "data": history,
            "session_id": session_id
        })

# 游戏模式处理器
class GameModeHandler:
    """处理游戏模式相关业务逻辑"""
    
    @staticmethod
    async def start_game(server: 'GameWebSocketServer', session_id: str, script_id=None):
        """开始游戏"""
        session = server.sessions.get(session_id)
        if not session:
            logger.error(f"[GAME] 开始游戏失败: 会话不存在 {session_id}")
            return
            
        if session.is_game_running:
            logger.warning(f"[GAME] 游戏已在运行: 会话={session_id}")
            return
        
        logger.info(f"[GAME] 准备开始游戏: 会话={session_id}, 当前剧本ID={session.script_id}, 新剧本ID={script_id}")
        
        # 如果提供了新的script_id，重新初始化游戏引擎
        if script_id and script_id != session.script_id:
            # 确保script_id是整数类型
            if isinstance(script_id, str):
                script_id = int(script_id)
            logger.info(f"[GAME] 切换剧本: 会话={session_id}, 从剧本{session.script_id}切换到{script_id}")
            session.script_id = script_id
            session.game_engine = GameEngine()
            session.game_initialized = False  # 修改：使用公共属性game_initialized
        
        if not session.game_initialized:  # 修改：使用公共属性game_initialized
            await GameModeHandler.initialize_game(session)
        session.is_game_running = True
        logger.info(f"[GAME] 游戏状态设置为运行中: 会话={session_id}")
        
        try:
            # 使用新的配置系统初始化AI代理
            logger.info(f"[GAME] 初始化AI代理: 会话={session_id}")
            await session.game_engine.initialize_agents()
            
            # 发送游戏开始消息
            logger.info(f"[GAME] 广播游戏开始消息: 会话={session_id}")
            await server.broadcast({
                "type": "game_started",
                "data": session.game_engine.game_state,
                "session_id": session_id
            }, session_id)
            
            print(f"Game started for session {session_id}, broadcasting game_started message")
            
            # 发送初始阶段消息
            current_phase = session.game_engine.current_phase.value
            logger.info(f"[GAME] 广播初始阶段: 会话={session_id}, 阶段={current_phase}")
            await server.broadcast({
                "type": "phase_changed",
                "data": {
                    "phase": current_phase,
                    "game_state": session.game_engine.game_state
                },
                "session_id": session_id
            }, session_id)
            
            print(f"Broadcasting initial phase: {current_phase}")
            
            # 开始游戏循环
            logger.info(f"[GAME] 启动游戏循环任务: 会话={session_id}")
            asyncio.create_task(GameModeHandler.game_loop(server, session_id))
            
        except Exception as e:
            logger.error(f"[ERROR] 游戏启动失败: 会话={session_id}, 错误={e}")
            print(f"Error starting game for session {session_id}: {e}")
            await server.broadcast({
                "type": "error",
                "message": f"游戏启动失败: {str(e)}",
                "session_id": session_id
            }, session_id)
            session.is_game_running = False
    
    @staticmethod
    async def initialize_game(session: GameSession):
        """初始化游戏"""
        try:
            logger.info(f"[GAME] 开始初始化游戏: 会话={session.session_id}, 剧本={session.script_id}")
            
            # 使用依赖容器获取服务
            from .dependency_container import get_container
            container = get_container()
            
            with container.create_scope() as scope:
                # 从依赖容器获取剧本编辑服务
                from ..services.script_editor_service import ScriptEditorService
                session.editor_service = scope.resolve(ScriptEditorService)
                
                # 加载剧本
                script = session.editor_service.script_repository.get_script_by_id(session.script_id)
                if not script:
                    raise ValueError(f"无法加载剧本 ID: {session.script_id}")
                
                # 初始化游戏引擎
                await session.game_engine.load_script_data(session.script_id)
                
                # 标记游戏已初始化
                session.game_initialized = True
                logger.info(f"[GAME] 游戏初始化完成: 会话={session.session_id}")
                
        except Exception as e:
            logger.error(f"[GAME] 游戏初始化失败: {e}", exc_info=True)
            raise
    
    @staticmethod
    async def next_phase(server: 'GameWebSocketServer', session_id: str):
        """手动进入下一阶段"""
        session = server.sessions.get(session_id)
        if not session or not session.is_game_running:
            logger.warning(f"[GAME] 进入下一阶段失败: 会话={session_id}, 游戏运行状态={session.is_game_running if session else False}")
            return
            
        try:
            old_phase = session.game_engine.current_phase.value
            logger.info(f"[GAME] 手动进入下一阶段: 会话={session_id}, 当前阶段={old_phase}")
            
            await session.game_engine.next_phase()
            new_phase = session.game_engine.current_phase.value
            
            logger.info(f"[GAME] 阶段切换成功: 会话={session_id}, {old_phase} -> {new_phase}")
            await server.broadcast({
                "type": "phase_changed",
                "data": {
                    "phase": new_phase,
                    "game_state": session.game_engine.game_state
                },
                "session_id": session_id
            }, session_id)
            
        except Exception as e:
            logger.error(f"[ERROR] 进入下一阶段失败: 会话={session_id}, 错误={e}")
            print(f"Error in next_phase for session {session_id}: {e}")
    
    @staticmethod
    async def reset_game(server: 'GameWebSocketServer', session_id: str):
        """重置游戏"""
        session = server.sessions.get(session_id)
        if not session:
            logger.error(f"[GAME] 重置游戏失败: 会话不存在 {session_id}")
            return
            
        try:
            logger.info(f"[GAME] 开始重置游戏: 会话={session_id}, 当前运行状态={session.is_game_running}")
            
            session.is_game_running = False
            session.game_engine = GameEngine()
            session.game_initialized = False
            
            logger.debug(f"[GAME] 游戏引擎已重置: 会话={session_id}")
            
            # 重新初始化游戏数据
            logger.debug(f"[GAME] 重新初始化游戏数据: 会话={session_id}")
            await GameModeHandler.initialize_game(session)
            
            logger.info(f"[GAME] 广播游戏重置消息: 会话={session_id}")
            await server.broadcast({
                "type": "game_reset",
                "data": session.game_engine.game_state,
                "session_id": session_id
            }, session_id)
            
            logger.info(f"[GAME] 游戏重置完成: 会话={session_id}")
            
        except Exception as e:
            logger.error(f"[ERROR] 重置游戏失败: 会话={session_id}, 错误={e}")
            print(f"Error resetting game for session {session_id}: {e}")
    
    @staticmethod
    async def game_loop(server: 'GameWebSocketServer', session_id: str):
        """游戏主循环"""
        session = server.sessions.get(session_id)
        if not session:
            logger.error(f"[GAME_LOOP] 游戏循环启动失败: 会话不存在 {session_id}")
            return
            
        logger.info(f"[GAME_LOOP] 开始游戏循环: 会话={session_id}")
        print(f"Starting game loop for session {session_id}")
        
        try:
            loop_count = 0
            while session.is_game_running and session.game_engine.current_phase != GamePhase.ENDED:
                loop_count += 1
                current_phase = session.game_engine.current_phase.value
                logger.info(f"[GAME_LOOP] 循环#{loop_count} 运行阶段: {current_phase}, 会话={session_id}")
                print(f"Running phase: {current_phase}")
                
                # 定义流式回调函数
                async def action_callback(action):
                    """每个角色发言完成后立即广播，并生成TTS"""
                    try:
                        # 确保action中的数据是可序列化的字符串
                        if isinstance(action, dict):
                            # 确保action字段是字符串
                            if 'action' in action and not isinstance(action['action'], str):
                                # 如果action不是字符串，尝试转换或使用默认值
                                if isinstance(action['action'], dict):
                                    action['action'] = "[系统信息格式错误]"
                                else:
                                    action['action'] = str(action['action'])
                        
                        character = action.get('character', 'Unknown')
                        action_text = action.get('action', '')
                        action_preview = action_text[:50] if action_text else ''
                        logger.debug(f"[AI_ACTION] 角色行动: {character}: {action_preview}..., 会话={session_id}")
                        print(f"Streaming action: {character}: {action_preview}...")
                        
                        # 合并AI动作与TTS：如果有TTS管理器则先生成TTS再一次性广播
                        ai_action_payload = dict(action)  # 复制，避免外部引用被改
                        if session.tts_manager and action_text and len(action_text.strip()) > 0:
                            voice_id_candidate = None
                            try:
                                voice_id_candidate = session.tts_manager._get_character_voice(character, action.get('character_info'))
                                tts_url = await session.tts_manager.generate_character_tts(
                                    session_id=session_id,
                                    character_name=character,
                                    content=action_text,
                                    character_info=action.get('character_info'),
                                    event_metadata={
                                        "game_phase": session.game_engine.current_phase.value,
                                        "action_type": "ai_dialogue",
                                        "timestamp": datetime.utcnow().isoformat()
                                    }
                                )
                                if tts_url:
                                    ai_action_payload["tts_url"] = tts_url
                                    ai_action_payload["tts_voice"] = voice_id_candidate
                                    ai_action_payload["tts_status"] = "completed"
                                else:
                                    ai_action_payload["tts_status"] = "failed"
                            except Exception as e:
                                logger.error(f"[TTS] 合并生成TTS失败: {e}, 角色={character}, 会话={session_id}")
                                ai_action_payload["tts_status"] = "error"
                        else:
                            # 无TTS或空文本
                            ai_action_payload["tts_status"] = "skipped"

                        await server.broadcast({
                            "type": "ai_action",
                            "data": ai_action_payload,
                            "session_id": session_id
                        }, session_id)
                        
                        await asyncio.sleep(1)  # 减少延迟，提高响应速度
                        
                    except Exception as e:
                        logger.error(f"[ERROR] AI行动回调错误: {e}, 会话={session_id}")
                        print(f"Error in action callback: {e}")
                
                # 运行当前阶段（使用流式回调）
                try:
                    logger.info(f"[GAME_LOOP] 开始运行阶段: {current_phase}, 会话={session_id}")
                    actions = await session.game_engine.run_phase(action_callback=action_callback)
                    logger.info(f"[GAME_LOOP] 阶段完成: {current_phase}, 行动数量={len(actions)}, 会话={session_id}")
                    print(f"Phase {session.game_engine.current_phase.value} completed with {len(actions)} total actions")
                except Exception as e:
                    logger.error(f"[ERROR] 运行阶段失败: {current_phase}, 错误={e}, 会话={session_id}")
                    print(f"Error in run_phase: {e}")
                    # 即使run_phase出错，也继续游戏循环
                    actions = []
                
                # 广播更新的游戏状态和公开聊天
                try:
                    print("Broadcasting game_state_update")
                    await server.broadcast({
                        "type": "game_state_update",
                        "data": session.game_engine.game_state,
                        "session_id": session_id
                    }, session_id)
                except Exception as e:
                    print(f"Error broadcasting game_state_update: {e}")
                
                # 广播公开聊天更新
                try:
                    print("Broadcasting public_chat_update")
                    await server.broadcast({
                        "type": "public_chat_update",
                        "data": session.game_engine.get_recent_public_chat(),
                        "session_id": session_id
                    }, session_id)
                except Exception as e:
                    print(f"Error broadcasting public_chat_update: {e}")
                
                # 特殊处理投票阶段
                if session.game_engine.current_phase == GamePhase.VOTING:
                    try:
                        print("Processing voting phase")
                        await session.game_engine.process_voting()
                        await server.broadcast({
                            "type": "voting_complete",
                            "data": session.game_engine.voting_manager.votes if session.game_engine.voting_manager and hasattr(session.game_engine.voting_manager, 'votes') else {},
                            "session_id": session_id
                        }, session_id)
                    except Exception as e:
                        print(f"Error in voting phase: {e}")
                
                # 根据阶段设置不同的等待时间
                phase_durations = {
                    GamePhase.BACKGROUND: 10,  # 背景介绍10秒
                    GamePhase.INTRODUCTION: 5,  # 自我介绍30秒
                    GamePhase.EVIDENCE_COLLECTION: 5,  # 搜证60秒
                    GamePhase.INVESTIGATION: 5,  # 调查120秒
                    GamePhase.DISCUSSION: 5,  # 讨论180秒
                    GamePhase.VOTING: 5,  # 投票60秒
                }
                
                # 自动进入下一阶段（除了最后阶段）
                if session.game_engine.current_phase != GamePhase.REVELATION:
                    wait_time = phase_durations.get(session.game_engine.current_phase, 30)
                    print(f"Waiting {wait_time} seconds before next phase...")
                    await asyncio.sleep(wait_time)  # 根据阶段设置不同的等待时间
                    
                    try:
                        await session.game_engine.next_phase()
                        print(f"Advanced to next phase: {session.game_engine.current_phase.value}")
                        
                        await server.broadcast({
                            "type": "phase_changed",
                            "data": {
                                "phase": session.game_engine.current_phase.value,
                                "game_state": session.game_engine.game_state
                            },
                            "session_id": session_id
                        }, session_id)
                    except Exception as e:
                        print(f"Error advancing to next phase: {e}")
                else:
                    # 揭晓阶段后显示游戏结果
                    try:
                        print("Processing revelation phase")
                        result = session.game_engine.get_game_result()
                        await server.broadcast({
                            "type": "game_result",
                            "data": result,
                            "session_id": session_id
                        }, session_id)
                        
                        await session.game_engine.next_phase()  # 进入结束阶段
                        
                        # 发送游戏结束播报
                        await server.broadcast({
                            "type": "game_ended",
                            "data": {
                                "message": "游戏已结束，感谢各位玩家的参与！",
                                "final_result": result
                            },
                            "session_id": session_id
                        }, session_id)
                        
                        print("Game ended successfully")
                        break
                    except Exception as e:
                        print(f"Error in revelation phase: {e}")
                        break
                    
        except Exception as e:
            print(f"Critical error in game loop for session {session_id}: {e}")
            try:
                await server.broadcast({
                    "type": "error",
                    "message": f"游戏循环错误: {str(e)}",
                    "session_id": session_id
                }, session_id)
            except Exception as broadcast_error:
                print(f"Failed to broadcast error message: {broadcast_error}")
        finally:
            print(f"Game loop ended for session {session_id}")
            session.is_game_running = False

class EditModeHandler:
    """处理编辑模式相关业务逻辑"""
    
    @staticmethod
    async def start_script_editing(server: 'GameWebSocketServer', session_id: str, script_id: int | None = None):
        """开始剧本编辑模式"""
        session = server.sessions.get(session_id)
        if not session:
            logger.error(f"[EDITOR] 开始剧本编辑失败: 会话不存在 {session_id}")
            return
        
        try:
            # 如果提供了script_id，使用它；否则使用会话的script_id
            target_script_id = script_id or session.script_id
            logger.info(f"[EDITOR] 开始剧本编辑: 会话={session_id}, 目标剧本ID={target_script_id}")
            
            # 创建数据库会话（手动管理事务）
            logger.debug(f"[EDITOR] 创建数据库会话: 会话={session_id}")
            db_session = db_manager.get_session()
            script_repository = ScriptRepository(db_session)
            
            # 初始化编辑服务
            logger.debug(f"[EDITOR] 初始化编辑服务: 会话={session_id}")
            session.editor_service = ScriptEditorService(script_repository)
            session.db_session = db_session  # 保存数据库会话引用
            session.is_editing_mode = True
            session.script_id = target_script_id
            
            # 获取剧本数据
            logger.debug(f"[EDITOR] 获取剧本数据: 剧本ID={target_script_id}")
            script = script_repository.get_script_by_id(target_script_id)
            if not script:
                logger.error(f"[EDITOR] 剧本不存在: 剧本ID={target_script_id}, 会话={session_id}")
                await server.broadcast({
                    "type": "error",
                    "message": f"剧本 {target_script_id} 不存在",
                    "session_id": session_id
                }, session_id)
                return
            
            # 发送编辑模式开始消息
            logger.info(f"[EDITOR] 广播编辑模式开始消息: 会话={session_id}, 剧本ID={target_script_id}")
            await server.broadcast({
                "type": "script_editing_started",
                "data": {
                    "script_id": target_script_id,
                    "script": serialize_script_data(script)
                },
                "session_id": session_id
            }, session_id)
            
            logger.info(f"[EDITOR] 剧本编辑模式启动成功: 会话={session_id}, 剧本ID={target_script_id}")
            print(f"Script editing started for session {session_id}, script {target_script_id}")
            
        except Exception as e:
            logger.error(f"[ERROR] 启动剧本编辑失败: 会话={session_id}, 错误={e}")
            print(f"Error starting script editing for session {session_id}: {e}")
            await server.broadcast({
                "type": "error",
                "message": f"启动剧本编辑失败: {str(e)}",
                "session_id": session_id
            }, session_id)
    
    @staticmethod
    async def stop_script_editing(server: 'GameWebSocketServer', session_id: str):
        """停止剧本编辑模式"""
        session = server.sessions.get(session_id)
        if not session:
            logger.error(f"[EDITOR] 停止剧本编辑失败: 会话不存在 {session_id}")
            return
        
        logger.info(f"[EDITOR] 停止剧本编辑: 会话={session_id}")
        
        # 关闭数据库会话
        if session.db_session:
            try:
                session.db_session.close()
                logger.debug(f"[EDITOR] 数据库会话已关闭: 会话={session_id}")
            except Exception as e:
                logger.error(f"[ERROR] 关闭数据库会话失败: 会话={session_id}, 错误={e}")
        
        session.is_editing_mode = False
        session.editor_service = None
        session.editing_context = {}
        session.db_session = None
        
        logger.debug(f"[EDITOR] 广播编辑模式停止消息: 会话={session_id}")
        await server.broadcast({
            "type": "script_editing_stopped",
            "session_id": session_id
        }, session_id)
        
        logger.info(f"[EDITOR] 剧本编辑模式已停止: 会话={session_id}")
        print(f"Script editing stopped for session {session_id}")
    
    @staticmethod
    async def handle_edit_instruction(server: 'GameWebSocketServer', session_id: str, instruction: str):
        """处理编辑指令"""
        session = server.sessions.get(session_id)
        if not session or not session.is_editing_mode or not session.editor_service:
            logger.warning(f"[EDITOR] 编辑指令被拒绝: 会话={session_id}, 编辑模式={session.is_editing_mode if session else False}")
            await server.broadcast({
                "type": "error",
                "message": "当前不在编辑模式",
                "session_id": session_id
            }, session_id)
            return
        
        try:
            logger.info(f"[EDITOR] 开始处理编辑指令: 会话={session_id}, 指令='{instruction[:100]}...'")
            
            # 发送处理中消息
            logger.debug(f"[EDITOR] 发送处理中消息: 会话={session_id}")
            await server.broadcast({
                "type": "instruction_processing",
                "data": {"instruction": instruction},
                "session_id": session_id
            }, session_id)
            
            # 解析用户指令
            logger.debug(f"[EDITOR] 解析用户指令: 会话={session_id}")
            edit_instructions = await session.editor_service.parse_user_instruction(
                instruction, session.script_id
            )
            logger.info(f"[EDITOR] 指令解析完成: 会话={session_id}, 生成{len(edit_instructions)}个编辑操作")
            
            # 执行编辑指令
            results = []
            for i, edit_instruction in enumerate(edit_instructions, 1):
                logger.debug(f"[EDITOR] 执行编辑操作 {i}/{len(edit_instructions)}: 会话={session_id}")
                result = await session.editor_service.execute_instruction(
                    edit_instruction, session.script_id
                )
                results.append(result)
                
                # 实时发送每个操作的结果
                logger.debug(f"[EDITOR] 广播编辑结果 {i}: 成功={result.success}, 会话={session_id}")
                await server.broadcast({
                    "type": "edit_result",
                    "data": {
                        "instruction": serialize_object(edit_instruction),
                        "result": serialize_object(result)
                    },
                    "session_id": session_id
                }, session_id)
            
            success_count = sum(1 for r in results if r.success)
            logger.info(f"[EDITOR] 编辑指令执行完成: 会话={session_id}, 成功={success_count}/{len(results)}")
            
            # 发送完成消息
            await server.broadcast({
                "type": "instruction_completed",
                "data": {
                    "instruction": instruction,
                    "results": [serialize_object(r) for r in results],
                    "success_count": success_count
                },
                "session_id": session_id
            }, session_id)
            
            # 如果有成功的操作，提交事务并发送更新后的剧本数据
            if success_count > 0:
                try:
                    session.db_session.commit()
                    logger.debug(f"[EDITOR] 数据库事务已提交: 会话={session_id}")
                except Exception as e:
                    session.db_session.rollback()
                    logger.error(f"[ERROR] 数据库事务提交失败: 会话={session_id}, 错误={e}")
                    raise e
                
                logger.debug(f"[EDITOR] 发送更新后的剧本数据: 会话={session_id}")
                await EditModeHandler.get_script_data(server, session_id)
            
        except Exception as e:
            logger.error(f"[ERROR] 处理编辑指令失败: 会话={session_id}, 错误={e}")
            print(f"Error handling edit instruction for session {session_id}: {e}")
            await server.broadcast({
                "type": "error",
                "message": f"处理编辑指令失败: {str(e)}",
                "session_id": session_id
            }, session_id)
    
    @staticmethod
    async def get_script_data(server: 'GameWebSocketServer', session_id: str):
        """获取当前剧本数据"""
        session = server.sessions.get(session_id)
        if not session or not session.editor_service:
            logger.warning(f"[EDITOR] 获取剧本数据失败: 会话={session_id}, 编辑服务未初始化")
            await server.broadcast({
                "type": "error",
                "message": "编辑服务未初始化",
                "session_id": session_id
            }, session_id)
            return
        
        try:
            logger.debug(f"[EDITOR] 开始获取剧本数据: 会话={session_id}, 剧本ID={session.script_id}")
            # 获取最新的剧本数据
            script = session.editor_service.script_repository.get_script_by_id(session.script_id)
            if not script:
                logger.error(f"[EDITOR] 剧本不存在: 剧本ID={session.script_id}, 会话={session_id}")
                await server.broadcast({
                    "type": "error",
                    "message": "剧本不存在",
                    "session_id": session_id
                }, session_id)
                return
            
            logger.info(f"[EDITOR] 剧本数据获取成功: 会话={session_id}, 数据大小={len(str(script))}字符")
            await server.broadcast({
                "type": "script_data_update",
                "data": {
                    "script": serialize_script_data(script)
                },
                "session_id": session_id
            }, session_id)
            
        except Exception as e:
            logger.error(f"[ERROR] 获取剧本数据失败: 会话={session_id}, 错误={e}")
            print(f"Error getting script data for session {session_id}: {e}")
            await server.broadcast({
                "type": "error",
                "message": f"获取剧本数据失败: {str(e)}",
                "session_id": session_id
            }, session_id)
    
    @staticmethod
    async def generate_ai_suggestion(server: 'GameWebSocketServer', session_id: str, context: str = ""):
        """生成AI编辑建议"""
        session = server.sessions.get(session_id)
        if not session or not session.is_editing_mode or not session.editor_service:
            logger.warning(f"[AI] 生成AI建议失败: 会话={session_id}, 编辑模式={session.is_editing_mode if session else False}")
            await server.broadcast({
                "type": "error",
                "message": "当前不在编辑模式",
                "session_id": session_id
            }, session_id)
            return
        
        try:
            logger.info(f"[AI] 开始生成AI建议: 会话={session_id}, 上下文长度={len(context)}字符")
            
            # 发送生成中消息
            logger.debug(f"[AI] 发送处理中消息: 会话={session_id}")
            await server.broadcast({
                "type": "ai_suggestion_generating",
                "session_id": session_id
            }, session_id)
            
            # 生成AI建议
            logger.debug(f"[AI] 调用AI建议生成服务: 会话={session_id}")
            suggestion = await session.editor_service.generate_ai_suggestion(
                session.script_id, context
            )
            
            logger.info(f"[AI] AI建议生成成功: 会话={session_id}, 建议长度={len(str(suggestion))}字符")
            await server.broadcast({
                "type": "ai_suggestion",
                "data": {
                    "suggestion": suggestion,
                    "context": context
                },
                "session_id": session_id
            }, session_id)
            
        except Exception as e:
            logger.error(f"[ERROR] 生成AI建议失败: 会话={session_id}, 错误={e}")
            print(f"Error generating AI suggestion for session {session_id}: {e}")
            await server.broadcast({
                "type": "error",
                "message": f"生成AI建议失败: {str(e)}",
                "session_id": session_id
            }, session_id)

class GameWebSocketServer:
    def __init__(self):
        self.sessions: Dict[str, GameSession] = {}
        self.client_sessions: Dict[Any, str] = {}  # 客户端到会话的映射
        # 注册消息处理器
        # 普通指令处理器（断线重连/增量同步单独处理）
        self.message_handlers: Dict[str, MessageHandler] = {
            "start_game": StartGameHandler(),
            "next_phase": NextPhaseHandler(),
            "get_game_state": GetGameStateHandler(),
            "get_public_chat": GetPublicChatHandler(),
            "reset_game": ResetGameHandler(),
            "start_script_editing": StartScriptEditingHandler(),
            "stop_script_editing": StopScriptEditingHandler(),
            "edit_instruction": EditInstructionHandler(),
            "get_script_data": GetScriptDataHandler(),
            "generate_ai_suggestion": GenerateAISuggestionHandler(),
            "get_tts_history": GetTTSHistoryHandler(),
            "fetch_history": FetchHistoryHandler(),
        }
        # 会话保留超时（秒）：断开后在该时间内保留以支持重连
        self.session_retention_seconds: int = 600
        # 记录会话最后活动时间，用于清理
        self.session_last_active: Dict[str, float] = {}
        # 后台任务引用
        self._cleanup_task: Optional[asyncio.Task] = None

    def start_background_tasks(self):
        """启动服务器级后台任务（清理超时会话等）"""
        if self._cleanup_task is None:
            try:
                loop = asyncio.get_running_loop()
                self._cleanup_task = loop.create_task(self._cleanup_loop())
                logger.info("[SERVER] 启动会话清理后台任务")
            except RuntimeError:
                # 事件循环尚未就绪，可在外部稍后调用
                logger.warning("[SERVER] 事件循环未就绪，稍后再启动后台任务")

    async def _cleanup_loop(self):
        """定期执行空会话清理"""
        while True:
            try:
                await self.cleanup_inactive_sessions()
            except Exception as e:
                logger.error(f"[SERVER] 清理任务出错: {e}")
            await asyncio.sleep(60)
        
    def get_or_create_session(self, session_id: Optional[str] = None, script_id: int = 1) -> GameSession:
        """获取或创建游戏会话"""
        if session_id is None:
            session_id = str(uuid.uuid4())
        
        if session_id not in self.sessions:
            self.sessions[session_id] = GameSession(session_id, script_id)
            logger.info(f"[SESSION] 创建新游戏会话: {session_id}, 剧本ID: {script_id}")
            print(f"Created new game session: {session_id}")
        else:
            logger.debug(f"[SESSION] 获取已存在会话: {session_id}")
        
        return self.sessions[session_id]
    
    async def register_client(self, websocket: Any, script_id: int = 1, user_id: Optional[int] = None):
        """注册新的WebSocket客户端到指定会话"""
        # 基于用户ID和剧本ID自动管理会话，不需要前端传递session_id
        actual_session_id = None
        
        # 如果提供了用户ID，使用GameSessionRepository处理会话
        if user_id is not None:
            with db_manager.session_scope() as db:
                repo = GameSessionRepository(db)
                
                # 创建或恢复会话（完全基于用户ID和剧本ID）
                db_session = repo.create_or_resume_session(user_id, script_id, None)
                actual_session_id = str(db_session.session_id)
                
                logger.info(f"[SESSION] 用户 {user_id} 的会话处理完成: {actual_session_id}, 状态: {db_session.status}")
        else:
            # 如果没有用户ID，创建临时会话
            actual_session_id = str(uuid.uuid4())
            logger.info(f"[SESSION] 创建临时会话: {actual_session_id}")
        
        # 获取或创建内存中的游戏会话
        session = self.get_or_create_session(actual_session_id, script_id)
        session.clients.add(websocket)
        self.client_sessions[websocket] = session.session_id
        
        client_info = f"客户端地址: {getattr(websocket, 'remote_address', 'unknown')}"
        logger.info(f"[CONNECTION] 客户端连接到会话 {session.session_id}, {client_info}, 当前会话客户端数: {len(session.clients)}")
        print(f"Client connected to session {session.session_id}. Session clients: {len(session.clients)}")
        
        # 发送当前游戏状态给新客户端
        logger.debug(f"[MESSAGE] 向新客户端发送游戏状态, 会话: {session.session_id}")
        
        # 只发送一次 session_connected 消息，并在其中告知是否有正在进行的游戏及其必要信息
        active_game_info: dict[str, Any] | None = None
        if session.is_game_running:
            # 如果游戏正在运行，附加当前阶段与游戏状态（可按需裁剪）
            try:
                active_game_info = {
                    "current_phase": getattr(session.game_engine.current_phase, "value", None),
                    "game_state": session.game_engine.game_state,
                }
            except Exception as e:
                logger.error(f"[SESSION] 收集进行中游戏信息失败: 会话={session.session_id}, 错误={e}")
                active_game_info = {"error": "获取进行中游戏信息失败"}

        payload = {
            "type": "session_connected",
            "data": {
                "session_id": session.session_id,
                "script_id": script_id,
                "user_id": user_id,
                "message": "已连接到游戏会话",
                "is_game_running": session.is_game_running,
                "game_initialized": session.game_initialized,
            },
            "session_id": session.session_id
        }
        if active_game_info:
            payload["data"]["active_game"] = active_game_info

        await self.send_to_client(websocket, payload)
    
    async def unregister_client(self, websocket: Any):
        """注销WebSocket客户端"""
        if websocket in self.client_sessions:
            session_id = self.client_sessions[websocket]
            session = self.sessions.get(session_id)
            if session:
                session.clients.discard(websocket)
                client_info = f"客户端地址: {getattr(websocket, 'remote_address', 'unknown')}"
                logger.info(f"[CONNECTION] 客户端断开连接, 会话: {session_id}, {client_info}, 剩余客户端数: {len(session.clients)}")
                print(f"Client disconnected from session {session_id}. Session clients: {len(session.clients)}")
                # 更新最后活动时间
                self.session_last_active[session_id] = asyncio.get_event_loop().time()
                # 不再立即删除空会话，允许一定时间内重连
                if len(session.clients) == 0:
                    logger.warning(f"[SESSION] 会话 {session_id} 暂时无客户端，保留 {self.session_retention_seconds}s 以支持重连")
                    print(f"Session {session_id} empty, retained for reconnection window")
            
            del self.client_sessions[websocket]
        else:
            logger.warning(f"[CONNECTION] 尝试注销未注册的客户端: {getattr(websocket, 'remote_address', 'unknown')}")
    
    async def send_to_client(self, websocket, message: Dict[str, Any]):
        """发送消息给特定客户端"""
        try:
            # 尝试序列化消息以检查是否有序列化问题
            json_message = json.dumps(message, ensure_ascii=False, default=str)
            message_type = message.get('type', 'unknown')
            session_id = message.get('session_id', 'unknown')
            
            logger.debug(f"[MESSAGE] 发送消息到客户端: 类型={message_type}, 会话={session_id}, 大小={len(json_message)}字节")
            
            # 检查是否是FastAPI WebSocket还是websockets库的WebSocket
            if hasattr(websocket, 'send_text'):
                # FastAPI WebSocket
                await websocket.send_text(json_message)
            else:
                # websockets库的WebSocket
                await websocket.send(json_message)
                
            logger.debug(f"[MESSAGE] 消息发送成功: 类型={message_type}")
            
        except json.JSONDecodeError as e:
            logger.error(f"[ERROR] JSON序列化错误: {e}, 消息内容: {message}")
            print(f"JSON序列化错误: {e}, 消息内容: {message}")
            # 发送错误消息给客户端
            try:
                error_message = json.dumps({
                    "type": "error",
                    "message": "服务器消息序列化失败"
                }, ensure_ascii=False)
                if hasattr(websocket, 'send_text'):
                    await websocket.send_text(error_message)
                else:
                    await websocket.send(error_message)
            except:
                pass
        except Exception as e:
            logger.error(f"[ERROR] WebSocket发送消息失败: {e}, 消息类型: {message.get('type', 'unknown')}")
            print(f"WebSocket发送消息失败: {e}")
            # 处理连接关闭异常
            await self.unregister_client(websocket)
    
    async def broadcast_to_session(self, session_id: str, message: Dict[str, Any]):
        """向指定会话广播消息"""
        session = self.sessions.get(session_id)
        if not session or not session.clients:
            logger.debug(f"[BROADCAST] 会话无客户端或不存在: 会话={session_id}")
            return
            
        logger.debug(f"[BROADCAST] 向会话广播消息: 会话={session_id}, 客户端数量={len(session.clients)}, 消息类型={message.get('type', 'unknown')}")
        disconnected = set()
        for client in session.clients:
            try:
                # 检查是否是FastAPI WebSocket还是websockets库的WebSocket
                if hasattr(client, 'send_text'):
                    # FastAPI WebSocket
                    await client.send_text(json.dumps(message, ensure_ascii=False))
                else:
                    # websockets库的WebSocket
                    await client.send(json.dumps(message, ensure_ascii=False))
            except Exception as e:
                logger.warning(f"[BROADCAST] 发送消息失败: 会话={session_id}, 错误={e}")
                disconnected.add(client)
        
        # 清理断开的连接
        if disconnected:
            logger.info(f"[BROADCAST] 移除断开连接的客户端: 会话={session_id}, 数量={len(disconnected)}")
            for client in disconnected:
                await self.unregister_client(client)
    
    async def broadcast(self, message: Dict[str, Any], session_id: Optional[str] = None):
        """广播消息给所有客户端或指定会话的客户端"""
        if session_id:
            logger.debug(f"[BROADCAST] 广播消息到指定会话: 会话={session_id}, 消息类型={message.get('type', 'unknown')}")
            await self.broadcast_to_session(session_id, message)
        else:
            # 向所有会话广播（保持向后兼容）
            logger.debug(f"[BROADCAST] 广播消息到所有会话: 会话数量={len(self.sessions)}, 消息类型={message.get('type', 'unknown')}")
            for session_id in self.sessions:
                await self.broadcast_to_session(session_id, message)
    
    async def handle_client_message(self, websocket: Any, message: str):
        """处理客户端消息"""
        try:
            data = json.loads(message)
            message_type = data.get("type")
            session_id = data.get("session_id") or self.client_sessions.get(websocket)
            
            logger.info(f"[MESSAGE] 收到客户端消息: 类型={message_type}, 会话={session_id}, 消息长度={len(message)}字节")
            
            if not session_id:
                logger.warning(f"[ERROR] 客户端消息缺少session_id: 消息类型={message_type}")
                await self.send_to_client(websocket, {
                    "type": "error",
                    "message": "No session_id provided"
                })
                return
            
            session = self.sessions.get(session_id)
            if not session:
                logger.error(f"[ERROR] 会话不存在: {session_id}, 消息类型={message_type}")
                await self.send_to_client(websocket, {
                    "type": "error",
                    "message": f"Session {session_id} not found"
                })
                return
            
            logger.debug(f"[HANDLER] 处理消息类型: {message_type}, 会话: {session_id}")
            
            # 断线重连/增量同步特殊消息类型
            # 使用消息处理器处理消息
            handler = self.message_handlers.get(message_type)
            if handler:
                await handler.handle(self, websocket, data)
            else:
                logger.warning(f"[ERROR] 未知消息类型: {message_type}, 会话={session_id}")
                
        except json.JSONDecodeError as e:
            logger.error(f"[ERROR] JSON解析错误: {e}, 原始消息: {message[:200]}...")
            await self.send_to_client(websocket, {
                "type": "error",
                "message": "Invalid JSON format"
            })
        except Exception as e:
            logger.error(f"[ERROR] 处理客户端消息时发生异常: {e}, 消息: {message[:200]}...")
            await self.send_to_client(websocket, {
                "type": "error",
                "message": str(e)
            })
    
    async def handle_connection(self, websocket, path: str):
        """处理WebSocket连接（仅用于websockets库）"""
        await self.register_client(websocket)
        try:
            async for message in websocket:
                await self.handle_client_message(websocket, message)
        except Exception:
            pass
        finally:
            await self.unregister_client(websocket)


    async def cleanup_inactive_sessions(self):
        """周期性清理超时未重连的空会话"""
        now = asyncio.get_event_loop().time()
        to_remove = []
        for sid, session in self.sessions.items():
            if len(session.clients) == 0:
                last_active = self.session_last_active.get(sid, now)
                if now - last_active > self.session_retention_seconds:
                    to_remove.append(sid)
        for sid in to_remove:
            try:
                sess = self.sessions.get(sid)
                if sess:
                    sess.cleanup()
                del self.sessions[sid]
                self.session_last_active.pop(sid, None)
                logger.info(f"[SESSION] 清理过期会话: {sid}")
            except Exception as e:
                logger.error(f"[SESSION] 清理会话失败 {sid}: {e}")

# 全局服务器实例
game_server = GameWebSocketServer()

async def start_websocket_server(host="localhost", port=8765):
    """启动WebSocket服务器（仅在websockets库可用时）"""
    if websockets is None:
        raise ImportError("websockets library is not installed. Use 'pip install websockets' to install it.")
    
    print(f"WebSocket server starting on ws://{host}:{port}")
    server = await websockets.serve(game_server.handle_connection, host, port)
    # 启动后台任务
    game_server.start_background_tasks()
    return server

if __name__ == "__main__":
    # 直接运行WebSocket服务器
    async def main():
        try:
            server = await start_websocket_server()
            print("WebSocket server is running...")
            await server.wait_closed()
        except ImportError as e:
            print(f"Error: {e}")
            print("Please use the FastAPI server instead: python main.py")
    
    asyncio.run(main())
