import asyncio
import json
from typing import Set, Union, Any
from src.core import GameEngine
from src.models import GamePhase
import os
from dotenv import load_dotenv

try:
    import websockets
except ImportError:
    websockets = None

load_dotenv()

class GameWebSocketServer:
    def __init__(self, script_id: int = 1):
        self.clients: Set[Any] = set()
        self.script_id = script_id
        self.game_engine = GameEngine()
        self.is_game_running = False
        self._game_initialized = False
        
    async def register_client(self, websocket: Any):
        """注册新的WebSocket客户端"""
        self.clients.add(websocket)
        print(f"Client connected. Total clients: {len(self.clients)}")
        
        # 发送当前游戏状态给新客户端
        await self.send_to_client(websocket, {
            "type": "game_state",
            "data": self.game_engine.game_state
        })
    
    async def _initialize_game(self):
        """初始化游戏数据"""
        try:
            await self.game_engine.load_script_data(self.script_id)
            self._game_initialized = True
            print(f"Game initialized with script ID: {self.script_id}")
        except Exception as e:
            print(f"Failed to initialize game: {e}")
            raise
    
    async def unregister_client(self, websocket: Any):
        """注销WebSocket客户端"""
        self.clients.discard(websocket)
        print(f"Client disconnected. Total clients: {len(self.clients)}")
    
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
    
    async def broadcast(self, message: dict):
        """广播消息给所有客户端"""
        if self.clients:
            disconnected = set()
            for client in self.clients:
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
    
    async def handle_client_message(self, websocket: Any, message: str):
        """处理客户端消息"""
        try:
            data = json.loads(message)
            message_type = data.get("type")
            
            if message_type == "start_game":
                script_id = data.get("script_id")
                await self.start_game(script_id)
            elif message_type == "next_phase":
                await self.next_phase()
            elif message_type == "get_game_state":
                await self.send_to_client(websocket, {
                    "type": "game_state",
                    "data": self.game_engine.game_state
                })
            elif message_type == "get_public_chat":
                await self.send_to_client(websocket, {
                    "type": "public_chat",
                    "data": self.game_engine.get_recent_public_chat()
                })
            elif message_type == "reset_game":
                await self.reset_game()
                
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
    
    async def start_game(self, script_id=None):
        """开始游戏"""
        if self.is_game_running:
            return
        
        # 如果提供了新的script_id，重新初始化游戏引擎
        if script_id and script_id != self.script_id:
            # 确保script_id是整数类型
            if isinstance(script_id, str):
                script_id = int(script_id)
            self.script_id = script_id
            self.game_engine = GameEngine()
            self._game_initialized = False
        
        # 确保游戏已初始化
        if not self._game_initialized:
            await self._initialize_game()
            
        self.is_game_running = True
        
        try:
            # 使用新的配置系统初始化AI代理
            await self.game_engine.initialize_agents()
            
            await self.broadcast({
                "type": "game_started",
                "data": self.game_engine.game_state
            })
            
            # 开始游戏循环
            asyncio.create_task(self.game_loop())
            
        except Exception as e:
            await self.broadcast({
                "type": "error",
                "message": f"游戏启动失败: {str(e)}"
            })
            self.is_game_running = False
    
    async def next_phase(self):
        """手动进入下一阶段"""
        if not self.is_game_running:
            return
            
        await self.game_engine.next_phase()
        await self.broadcast({
            "type": "phase_changed",
            "data": {
                "phase": self.game_engine.current_phase.value,
                "game_state": self.game_engine.game_state
            }
        })
    
    async def reset_game(self):
        """重置游戏"""
        self.is_game_running = False
        self.game_engine = GameEngine()
        self._game_initialized = False
        
        # 重新初始化游戏数据
        await self._initialize_game()
        
        await self.broadcast({
            "type": "game_reset",
            "data": self.game_engine.game_state
        })
    
    async def game_loop(self):
        """游戏主循环"""
        try:
            while self.is_game_running and self.game_engine.current_phase != GamePhase.ENDED:
                # 运行当前阶段
                actions = await self.game_engine.run_phase()
                
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
                        "data": action
                    })
                    await asyncio.sleep(2)  # 每个行动之间的延迟
                
                # 广播更新的游戏状态和公开聊天
                await self.broadcast({
                    "type": "game_state_update",
                    "data": self.game_engine.game_state
                })
                
                # 广播公开聊天更新
                await self.broadcast({
                    "type": "public_chat_update",
                    "data": self.game_engine.get_recent_public_chat()
                })
                
                # 特殊处理投票阶段
                if self.game_engine.current_phase == GamePhase.VOTING:
                    await self.game_engine.process_voting()
                    await self.broadcast({
                        "type": "voting_complete",
                        "data": self.game_engine.voting_manager.votes
                    })
                
                # 自动进入下一阶段（除了最后阶段）
                if self.game_engine.current_phase != GamePhase.REVELATION:
                    await asyncio.sleep(5)  # 阶段间延迟
                    await self.game_engine.next_phase()
                    
                    await self.broadcast({
                        "type": "phase_changed",
                        "data": {
                            "phase": self.game_engine.current_phase.value,
                            "game_state": self.game_engine.game_state
                        }
                    })
                else:
                    # 揭晓阶段后显示游戏结果
                    result = self.game_engine.get_game_result()
                    await self.broadcast({
                        "type": "game_result",
                        "data": result
                    })
                    
                    await self.game_engine.next_phase()  # 进入结束阶段
                    break
                    
        except Exception as e:
            await self.broadcast({
                "type": "error",
                "message": f"游戏循环错误: {str(e)}"
            })
        finally:
            self.is_game_running = False
    
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
game_server = GameWebSocketServer(script_id=5)  # 默认使用商业纠纷谋杀案

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