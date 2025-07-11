import asyncio
import json
from typing import Set, Union, Any, Dict
from src.core import GameEngine
from src.models import GamePhase
import os
from dotenv import load_dotenv
import uuid

try:
    import websockets
except ImportError:
    websockets = None

load_dotenv()

class GameSession:
    """游戏会话类，管理单个房间的游戏状态"""
    def __init__(self, session_id: str, script_id: int = 1):
        self.session_id = session_id
        self.clients: Set[Any] = set()
        self.script_id = script_id
        self.game_engine = GameEngine()
        self.is_game_running = False
        self._game_initialized = False

class GameWebSocketServer:
    def __init__(self):
        self.sessions: Dict[str, GameSession] = {}
        self.client_sessions: Dict[Any, str] = {}  # 客户端到会话的映射
        
    def get_or_create_session(self, session_id: str = None, script_id: int = 1) -> GameSession:
        """获取或创建游戏会话"""
        if session_id is None:
            session_id = str(uuid.uuid4())
        
        if session_id not in self.sessions:
            self.sessions[session_id] = GameSession(session_id, script_id)
            print(f"Created new game session: {session_id}")
        
        return self.sessions[session_id]
    
    async def register_client(self, websocket: Any, session_id: str = None, script_id: int = 1):
        """注册新的WebSocket客户端到指定会话"""
        session = self.get_or_create_session(session_id, script_id)
        session.clients.add(websocket)
        self.client_sessions[websocket] = session.session_id
        
        print(f"Client connected to session {session.session_id}. Session clients: {len(session.clients)}")
        
        # 发送当前游戏状态给新客户端
        await self.send_to_client(websocket, {
            "type": "game_state",
            "data": session.game_engine.game_state,
            "session_id": session.session_id
        })
    
    async def unregister_client(self, websocket: Any):
        """注销WebSocket客户端"""
        if websocket in self.client_sessions:
            session_id = self.client_sessions[websocket]
            session = self.sessions.get(session_id)
            if session:
                session.clients.discard(websocket)
                print(f"Client disconnected from session {session_id}. Session clients: {len(session.clients)}")
                
                # 如果会话中没有客户端了，可以考虑清理会话（可选）
                if len(session.clients) == 0:
                    print(f"Session {session_id} is now empty")
            
            del self.client_sessions[websocket]
    
    async def send_to_client(self, websocket, message: dict):
        """发送消息给特定客户端"""
        try:
            # 检查是否是FastAPI WebSocket还是websockets库的WebSocket
            if hasattr(websocket, 'send_text'):
                # FastAPI WebSocket
                await websocket.send_text(json.dumps(message, ensure_ascii=False))
            else:
                # websockets库的WebSocket
                await websocket.send(json.dumps(message, ensure_ascii=False))
        except Exception as e:
            # 处理连接关闭异常
            await self.unregister_client(websocket)
    
    async def broadcast_to_session(self, session_id: str, message: dict):
        """向指定会话广播消息"""
        session = self.sessions.get(session_id)
        if not session or not session.clients:
            return
            
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
                disconnected.add(client)
        
        # 清理断开的连接
        for client in disconnected:
            await self.unregister_client(client)
    
    async def broadcast(self, message: dict, session_id: str = None):
        """广播消息给所有客户端或指定会话的客户端"""
        if session_id:
            await self.broadcast_to_session(session_id, message)
        else:
            # 向所有会话广播（保持向后兼容）
            for session_id in self.sessions:
                await self.broadcast_to_session(session_id, message)
    
    async def handle_client_message(self, websocket: Any, message: str):
        """处理客户端消息"""
        try:
            data = json.loads(message)
            message_type = data.get("type")
            session_id = data.get("session_id") or self.client_sessions.get(websocket)
            
            if not session_id:
                await self.send_to_client(websocket, {
                    "type": "error",
                    "message": "No session_id provided"
                })
                return
            
            session = self.sessions.get(session_id)
            if not session:
                await self.send_to_client(websocket, {
                    "type": "error",
                    "message": f"Session {session_id} not found"
                })
                return
            
            if message_type == "start_game":
                script_id = data.get("script_id")
                await self.start_game(session_id, script_id)
            elif message_type == "next_phase":
                await self.next_phase(session_id)
            elif message_type == "get_game_state":
                await self.send_to_client(websocket, {
                    "type": "game_state",
                    "data": session.game_engine.game_state,
                    "session_id": session_id
                })
            elif message_type == "get_public_chat":
                await self.send_to_client(websocket, {
                    "type": "public_chat",
                    "data": session.game_engine.get_recent_public_chat(),
                    "session_id": session_id
                })
            elif message_type == "reset_game":
                await self.reset_game(session_id)
                
        except json.JSONDecodeError:
            await self.send_to_client(websocket, {
                "type": "error",
                "message": "Invalid JSON format"
            })
        except Exception as e:
            await self.send_to_client(websocket, {
                "type": "error",
                "message": str(e)
            })
    
    async def _initialize_game(self, session: GameSession):
        """初始化游戏数据"""
        try:
            await session.game_engine.load_script_data(session.script_id)
            session._game_initialized = True
            print(f"Game initialized for session {session.session_id} with script ID: {session.script_id}")
        except Exception as e:
            print(f"Failed to initialize game for session {session.session_id}: {e}")
            raise
    
    async def start_game(self, session_id: str, script_id=None):
        """开始游戏"""
        session = self.sessions.get(session_id)
        if not session:
            return
            
        if session.is_game_running:
            return
        
        # 如果提供了新的script_id，重新初始化游戏引擎
        if script_id and script_id != session.script_id:
            # 确保script_id是整数类型
            if isinstance(script_id, str):
                script_id = int(script_id)
            session.script_id = script_id
            session.game_engine = GameEngine()
            session._game_initialized = False
        
        # 确保游戏已初始化
        if not session._game_initialized:
            await self._initialize_game(session)
            
        session.is_game_running = True
        
        try:
            # 使用新的配置系统初始化AI代理
            await session.game_engine.initialize_agents()
            
            await self.broadcast({
                "type": "game_started",
                "data": session.game_engine.game_state,
                "session_id": session_id
            }, session_id)
            
            # 开始游戏循环
            asyncio.create_task(self.game_loop(session_id))
            
        except Exception as e:
            await self.broadcast({
                "type": "error",
                "message": f"游戏启动失败: {str(e)}",
                "session_id": session_id
            }, session_id)
            session.is_game_running = False
    
    async def next_phase(self, session_id: str):
        """手动进入下一阶段"""
        session = self.sessions.get(session_id)
        if not session or not session.is_game_running:
            return
            
        await session.game_engine.next_phase()
        await self.broadcast({
            "type": "phase_changed",
            "data": {
                "phase": session.game_engine.current_phase.value,
                "game_state": session.game_engine.game_state
            },
            "session_id": session_id
        }, session_id)
    
    async def reset_game(self, session_id: str):
        """重置游戏"""
        session = self.sessions.get(session_id)
        if not session:
            return
            
        session.is_game_running = False
        session.game_engine = GameEngine()
        session._game_initialized = False
        
        # 重新初始化游戏数据
        await self._initialize_game(session)
        
        await self.broadcast({
            "type": "game_reset",
            "data": session.game_engine.game_state,
            "session_id": session_id
        }, session_id)
    
    async def game_loop(self, session_id: str):
        """游戏主循环"""
        session = self.sessions.get(session_id)
        if not session:
            return
            
        try:
            while session.is_game_running and session.game_engine.current_phase != GamePhase.ENDED:
                # 运行当前阶段
                actions = await session.game_engine.run_phase()
                
                # 广播AI行动
                for action in actions:
                    # 确保action中的数据是可序列化的字符串
                    if isinstance(action, dict):
                        # 确保action字段是字符串
                        if 'action' in action and not isinstance(action['action'], str):
                            # 如果action不是字符串，尝试转换或使用默认值
                            if isinstance(action['action'], dict):
                                action['action'] = "[系统信息格式错误]"
                            else:
                                action['action'] = str(action['action'])
                    
                    await self.broadcast({
                        "type": "ai_action",
                        "data": action,
                        "session_id": session_id
                    }, session_id)
                    await asyncio.sleep(2)  # 每个行动之间的延迟
                
                # 广播更新的游戏状态和公开聊天
                await self.broadcast({
                    "type": "game_state_update",
                    "data": session.game_engine.game_state,
                    "session_id": session_id
                }, session_id)
                
                # 广播公开聊天更新
                await self.broadcast({
                    "type": "public_chat_update",
                    "data": session.game_engine.get_recent_public_chat(),
                    "session_id": session_id
                }, session_id)
                
                # 特殊处理投票阶段
                if session.game_engine.current_phase == GamePhase.VOTING:
                    await session.game_engine.process_voting()
                    await self.broadcast({
                        "type": "voting_complete",
                        "data": session.game_engine.voting_manager.votes,
                        "session_id": session_id
                    }, session_id)
                
                # 自动进入下一阶段（除了最后阶段）
                if session.game_engine.current_phase != GamePhase.REVELATION:
                    await asyncio.sleep(5)  # 阶段间延迟
                    await session.game_engine.next_phase()
                    
                    await self.broadcast({
                        "type": "phase_changed",
                        "data": {
                            "phase": session.game_engine.current_phase.value,
                            "game_state": session.game_engine.game_state
                        },
                        "session_id": session_id
                    }, session_id)
                else:
                    # 揭晓阶段后显示游戏结果
                    result = session.game_engine.get_game_result()
                    await self.broadcast({
                        "type": "game_result",
                        "data": result,
                        "session_id": session_id
                    }, session_id)
                    
                    await session.game_engine.next_phase()  # 进入结束阶段
                    
                    # 发送游戏结束播报
                    await self.broadcast({
                        "type": "game_ended",
                        "data": {
                            "message": "游戏已结束，感谢各位玩家的参与！",
                            "final_result": result
                        },
                        "session_id": session_id
                    }, session_id)
                    
                    break
                    
        except Exception as e:
            await self.broadcast({
                "type": "error",
                "message": f"游戏循环错误: {str(e)}",
                "session_id": session_id
            }, session_id)
        finally:
            session.is_game_running = False
    
    async def handle_connection(self, websocket: Any, path: str):
        """处理WebSocket连接（仅用于websockets库）"""
        await self.register_client(websocket)
        try:
            async for message in websocket:
                await self.handle_client_message(websocket, message)
        except Exception:
            pass
        finally:
            await self.unregister_client(websocket)

# 全局服务器实例
game_server = GameWebSocketServer()

async def start_websocket_server(host="localhost", port=8765):
    """启动WebSocket服务器（仅在websockets库可用时）"""
    if websockets is None:
        raise ImportError("websockets library is not installed. Use 'pip install websockets' to install it.")
    
    print(f"WebSocket server starting on ws://{host}:{port}")
    return await websockets.serve(game_server.handle_connection, host, port)

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