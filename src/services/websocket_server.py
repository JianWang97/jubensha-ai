"""WebSocket服务器

集成LangGraph工作流的WebSocket服务器，支持实时脚本编辑协作。
"""

import json
import asyncio
import logging
from typing import Dict, Any, Set, Optional, List
from datetime import datetime
from fastapi import WebSocket, WebSocketDisconnect
from fastapi.websockets import WebSocketState

from .langgraph_workflows import ScriptEditWorkflow, StateManager, CollaborationManager, ErrorHandler
from ..db.session import get_db_session
from ..schemas.script_schemas import ScriptEditRequest, ScriptEditResponse


class ConnectionManager:
    """WebSocket连接管理器"""
    
    def __init__(self):
        # 活动连接：session_id -> {user_id -> websocket}
        self.active_connections: Dict[str, Dict[str, WebSocket]] = {}
        # 用户会话映射：user_id -> session_id
        self.user_sessions: Dict[str, str] = {}
        # 连接元数据
        self.connection_metadata: Dict[str, Dict[str, Any]] = {}
        
        self.logger = logging.getLogger(__name__)
    
    async def connect(self, websocket: WebSocket, session_id: str, user_id: str, metadata: Optional[Dict[str, Any]] = None):
        """建立WebSocket连接"""
        await websocket.accept()
        
        # 初始化会话连接字典
        if session_id not in self.active_connections:
            self.active_connections[session_id] = {}
        
        # 如果用户已在其他会话中，先断开
        if user_id in self.user_sessions:
            old_session_id = self.user_sessions[user_id]
            await self.disconnect(old_session_id, user_id)
        
        # 添加新连接
        self.active_connections[session_id][user_id] = websocket
        self.user_sessions[user_id] = session_id
        
        # 保存连接元数据
        connection_key = f"{session_id}:{user_id}"
        self.connection_metadata[connection_key] = {
            "connected_at": datetime.now().isoformat(),
            "user_id": user_id,
            "session_id": session_id,
            "metadata": metadata or {}
        }
        
        self.logger.info(f"用户 {user_id} 连接到会话 {session_id}")
        
        # 通知其他用户有新用户加入
        await self.broadcast_to_session(
            session_id,
            {
                "type": "user_joined",
                "user_id": user_id,
                "timestamp": datetime.now().isoformat(),
                "active_users": list(self.active_connections[session_id].keys())
            },
            exclude_user=user_id
        )
    
    async def disconnect(self, session_id: str, user_id: str):
        """断开WebSocket连接"""
        try:
            if session_id in self.active_connections and user_id in self.active_connections[session_id]:
                websocket = self.active_connections[session_id][user_id]
                
                # 安全关闭WebSocket连接
                if websocket.client_state == WebSocketState.CONNECTED:
                    await websocket.close()
                
                # 移除连接
                del self.active_connections[session_id][user_id]
                
                # 如果会话中没有其他用户，清理会话
                if not self.active_connections[session_id]:
                    del self.active_connections[session_id]
                
                # 移除用户会话映射
                if user_id in self.user_sessions:
                    del self.user_sessions[user_id]
                
                # 清理连接元数据
                connection_key = f"{session_id}:{user_id}"
                if connection_key in self.connection_metadata:
                    del self.connection_metadata[connection_key]
                
                self.logger.info(f"用户 {user_id} 从会话 {session_id} 断开连接")
                
                # 通知其他用户有用户离开
                if session_id in self.active_connections:
                    await self.broadcast_to_session(
                        session_id,
                        {
                            "type": "user_left",
                            "user_id": user_id,
                            "timestamp": datetime.now().isoformat(),
                            "active_users": list(self.active_connections[session_id].keys())
                        }
                    )
        
        except Exception as e:
            self.logger.error(f"断开连接时发生错误: {str(e)}")
    
    async def send_personal_message(self, session_id: str, user_id: str, message: Dict[str, Any]):
        """发送个人消息"""
        try:
            if session_id in self.active_connections and user_id in self.active_connections[session_id]:
                websocket = self.active_connections[session_id][user_id]
                if websocket.client_state == WebSocketState.CONNECTED:
                    await websocket.send_text(json.dumps(message, ensure_ascii=False))
        except Exception as e:
            self.logger.error(f"发送个人消息失败: {str(e)}")
            # 连接可能已断开，清理连接
            await self.disconnect(session_id, user_id)
    
    async def broadcast_to_session(self, session_id: str, message: Dict[str, Any], exclude_user: Optional[str] = None):
        """向会话中的所有用户广播消息"""
        if session_id not in self.active_connections:
            return
        
        disconnected_users = []
        
        for user_id, websocket in self.active_connections[session_id].items():
            if exclude_user and user_id == exclude_user:
                continue
            
            try:
                if websocket.client_state == WebSocketState.CONNECTED:
                    await websocket.send_text(json.dumps(message, ensure_ascii=False))
                else:
                    disconnected_users.append(user_id)
            except Exception as e:
                self.logger.error(f"广播消息给用户 {user_id} 失败: {str(e)}")
                disconnected_users.append(user_id)
        
        # 清理断开的连接
        for user_id in disconnected_users:
            await self.disconnect(session_id, user_id)
    
    def get_session_users(self, session_id: str) -> List[str]:
        """获取会话中的用户列表"""
        return list(self.active_connections.get(session_id, {}).keys())
    
    def get_connection_info(self, session_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        """获取连接信息"""
        connection_key = f"{session_id}:{user_id}"
        return self.connection_metadata.get(connection_key)
    
    def get_all_sessions(self) -> List[str]:
        """获取所有活动会话"""
        return list(self.active_connections.keys())


class WebSocketServer:
    """WebSocket服务器
    
    集成LangGraph工作流的WebSocket服务器，处理实时脚本编辑请求。
    """
    
    def __init__(self):
        self.connection_manager = ConnectionManager()
        self.workflow = ScriptEditWorkflow()
        self.logger = logging.getLogger(__name__)
        
        # 消息处理器映射
        self.message_handlers = {
            "chat_edit": self.handle_chat_edit,
            "get_status": self.handle_get_status,
            "cancel_workflow": self.handle_cancel_workflow,
            "ping": self.handle_ping,
            "join_collaboration": self.handle_join_collaboration,
            "leave_collaboration": self.handle_leave_collaboration,
            "cursor_update": self.handle_cursor_update,
            "selection_update": self.handle_selection_update
        }
    
    async def handle_websocket(self, websocket: WebSocket, session_id: str, user_id: str):
        """处理WebSocket连接"""
        try:
            # 建立连接
            await self.connection_manager.connect(websocket, session_id, user_id)
            
            # 发送连接成功消息
            await self.connection_manager.send_personal_message(
                session_id, user_id,
                {
                    "type": "connection_established",
                    "session_id": session_id,
                    "user_id": user_id,
                    "timestamp": datetime.now().isoformat(),
                    "message": "WebSocket连接已建立"
                }
            )
            
            # 监听消息
            while True:
                try:
                    # 接收消息
                    data = await websocket.receive_text()
                    message = json.loads(data)
                    
                    # 处理消息
                    await self.process_message(session_id, user_id, message)
                    
                except WebSocketDisconnect:
                    self.logger.info(f"用户 {user_id} 主动断开连接")
                    break
                except json.JSONDecodeError as e:
                    self.logger.error(f"JSON解析错误: {str(e)}")
                    await self.send_error_message(
                        session_id, user_id, "invalid_json", "消息格式错误"
                    )
                except Exception as e:
                    self.logger.error(f"处理消息时发生错误: {str(e)}")
                    await self.send_error_message(
                        session_id, user_id, "processing_error", str(e)
                    )
        
        except Exception as e:
            self.logger.error(f"WebSocket处理错误: {str(e)}")
        
        finally:
            # 断开连接
            await self.connection_manager.disconnect(session_id, user_id)
    
    async def process_message(self, session_id: str, user_id: str, message: Dict[str, Any]):
        """处理接收到的消息"""
        message_type = message.get("type")
        
        if not message_type:
            await self.send_error_message(
                session_id, user_id, "missing_type", "消息缺少type字段"
            )
            return
        
        # 获取消息处理器
        handler = self.message_handlers.get(message_type)
        
        if not handler:
            await self.send_error_message(
                session_id, user_id, "unknown_type", f"未知的消息类型: {message_type}"
            )
            return
        
        try:
            # 执行处理器
            await handler(session_id, user_id, message)
        except Exception as e:
            self.logger.error(f"处理消息类型 {message_type} 时发生错误: {str(e)}")
            await self.send_error_message(
                session_id, user_id, "handler_error", str(e)
            )
    
    async def handle_chat_edit(self, session_id: str, user_id: str, message: Dict[str, Any]):
        """处理聊天编辑请求"""
        try:
            # 提取请求数据
            user_instruction = message.get("instruction", "")
            script_data = message.get("script_data", {})
            context = message.get("context", {})
            
            if not user_instruction:
                await self.send_error_message(
                    session_id, user_id, "missing_instruction", "缺少用户指令"
                )
                return
            
            # 发送处理开始通知
            await self.connection_manager.send_personal_message(
                session_id, user_id,
                {
                    "type": "edit_started",
                    "session_id": session_id,
                    "instruction": user_instruction,
                    "timestamp": datetime.now().isoformat()
                }
            )
            
            # 通知其他用户有编辑操作开始
            await self.connection_manager.broadcast_to_session(
                session_id,
                {
                    "type": "user_editing",
                    "user_id": user_id,
                    "instruction": user_instruction,
                    "timestamp": datetime.now().isoformat()
                },
                exclude_user=user_id
            )
            
            # 执行LangGraph工作流
            workflow_result = await self.workflow.execute_workflow(
                session_id=session_id,
                user_instruction=user_instruction,
                script_data=script_data,
                user_id=user_id,
                context=context
            )
            
            # 发送结果
            if workflow_result["success"]:
                # 成功结果
                response_message = {
                    "type": "edit_completed",
                    "session_id": session_id,
                    "execution_id": workflow_result["execution_id"],
                    "result": workflow_result["result"],
                    "execution_time": workflow_result["execution_time"],
                    "timestamp": workflow_result["timestamp"]
                }
                
                # 发送给请求用户
                await self.connection_manager.send_personal_message(
                    session_id, user_id, response_message
                )
                
                # 广播脚本更新给其他用户
                final_state = workflow_result["result"]["state"]
                script_update = {
                    "type": "script_updated",
                    "session_id": session_id,
                    "updated_by": user_id,
                    "script_data": final_state.get("script_data", {}),
                    "execution_result": final_state.get("execution_result", {}),
                    "timestamp": datetime.now().isoformat()
                }
                
                await self.connection_manager.broadcast_to_session(
                    session_id, script_update, exclude_user=user_id
                )
            
            else:
                # 错误结果
                error_message = {
                    "type": "edit_failed",
                    "session_id": session_id,
                    "execution_id": workflow_result["execution_id"],
                    "error": workflow_result["error"],
                    "execution_time": workflow_result["execution_time"],
                    "timestamp": workflow_result["timestamp"]
                }
                
                await self.connection_manager.send_personal_message(
                    session_id, user_id, error_message
                )
        
        except Exception as e:
            self.logger.error(f"处理聊天编辑请求时发生错误: {str(e)}")
            await self.send_error_message(
                session_id, user_id, "edit_error", str(e)
            )
    
    async def handle_get_status(self, session_id: str, user_id: str, message: Dict[str, Any]):
        """处理获取状态请求"""
        try:
            status = await self.workflow.get_workflow_status(session_id)
            
            await self.connection_manager.send_personal_message(
                session_id, user_id,
                {
                    "type": "status_response",
                    "session_id": session_id,
                    "status": status,
                    "timestamp": datetime.now().isoformat()
                }
            )
        
        except Exception as e:
            await self.send_error_message(
                session_id, user_id, "status_error", str(e)
            )
    
    async def handle_cancel_workflow(self, session_id: str, user_id: str, message: Dict[str, Any]):
        """处理取消工作流请求"""
        try:
            result = await self.workflow.cancel_workflow(session_id, user_id)
            
            await self.connection_manager.send_personal_message(
                session_id, user_id,
                {
                    "type": "cancel_response",
                    "session_id": session_id,
                    "result": result,
                    "timestamp": datetime.now().isoformat()
                }
            )
            
            # 如果取消成功，通知其他用户
            if result["success"]:
                await self.connection_manager.broadcast_to_session(
                    session_id,
                    {
                        "type": "workflow_cancelled",
                        "session_id": session_id,
                        "cancelled_by": user_id,
                        "timestamp": datetime.now().isoformat()
                    },
                    exclude_user=user_id
                )
        
        except Exception as e:
            await self.send_error_message(
                session_id, user_id, "cancel_error", str(e)
            )
    
    async def handle_ping(self, session_id: str, user_id: str, message: Dict[str, Any]):
        """处理ping请求"""
        await self.connection_manager.send_personal_message(
            session_id, user_id,
            {
                "type": "pong",
                "timestamp": datetime.now().isoformat()
            }
        )
    
    async def handle_join_collaboration(self, session_id: str, user_id: str, message: Dict[str, Any]):
        """处理加入协作请求"""
        try:
            script_id = message.get("script_id")
            if not script_id:
                await self.send_error_message(
                    session_id, user_id, "missing_script_id", "缺少script_id"
                )
                return
            
            # 注册协作会话
            await self.workflow.collaboration_manager.register_session(
                session_id, user_id, script_id
            )
            
            # 获取当前协作状态
            collaboration_status = self.workflow.collaboration_manager.get_collaboration_status(session_id)
            
            await self.connection_manager.send_personal_message(
                session_id, user_id,
                {
                    "type": "collaboration_joined",
                    "session_id": session_id,
                    "script_id": script_id,
                    "collaboration_status": collaboration_status,
                    "timestamp": datetime.now().isoformat()
                }
            )
        
        except Exception as e:
            await self.send_error_message(
                session_id, user_id, "collaboration_error", str(e)
            )
    
    async def handle_leave_collaboration(self, session_id: str, user_id: str, message: Dict[str, Any]):
        """处理离开协作请求"""
        try:
            await self.workflow.collaboration_manager.unregister_session(session_id, user_id)
            
            await self.connection_manager.send_personal_message(
                session_id, user_id,
                {
                    "type": "collaboration_left",
                    "session_id": session_id,
                    "timestamp": datetime.now().isoformat()
                }
            )
        
        except Exception as e:
            await self.send_error_message(
                session_id, user_id, "collaboration_error", str(e)
            )
    
    async def handle_cursor_update(self, session_id: str, user_id: str, message: Dict[str, Any]):
        """处理光标更新"""
        try:
            # 获取光标位置数据
            cursor_data = message.get("cursor_data", {})
            
            # 广播光标更新给其他用户
            await self.connection_manager.broadcast_to_session(
                session_id,
                {
                    "type": "cursor_update",
                    "user_id": user_id,
                    "cursor_data": cursor_data,
                    "timestamp": datetime.now().isoformat()
                },
                exclude_user=user_id
            )
            
        except Exception as e:
            self.logger.error(f"处理光标更新时发生错误: {str(e)}")
            await self.send_error_message(
                session_id, user_id, "cursor_update_error", str(e)
            )
    
    async def handle_selection_update(self, session_id: str, user_id: str, message: Dict[str, Any]):
        """处理选中内容更新"""
        try:
            # 获取选中内容数据
            selection_data = message.get("selection_data", {})
            
            # 广播选中内容更新给其他用户
            await self.connection_manager.broadcast_to_session(
                session_id,
                {
                    "type": "selection_update",
                    "user_id": user_id,
                    "selection_data": selection_data,
                    "timestamp": datetime.now().isoformat()
                },
                exclude_user=user_id
            )
            
        except Exception as e:
            self.logger.error(f"处理选中内容更新时发生错误: {str(e)}")
            await self.send_error_message(
                session_id, user_id, "selection_update_error", str(e)
            )
    
    async def send_error_message(self, session_id: str, user_id: str, error_type: str, message: str):
        """发送错误消息"""
        error_message = {
            "type": "error",
            "error_type": error_type,
            "message": message,
            "timestamp": datetime.now().isoformat()
        }
        
        await self.connection_manager.send_personal_message(session_id, user_id, error_message)
