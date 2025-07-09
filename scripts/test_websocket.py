#!/usr/bin/env python3
"""
简单的WebSocket测试脚本
用于验证WebSocket连接和消息传递是否正常工作
"""

import asyncio
import json
import websockets
from websockets.exceptions import ConnectionClosed

async def test_websocket_connection():
    """测试WebSocket连接"""
    uri = "ws://localhost:8000/ws"
    
    try:
        print(f"正在连接到 {uri}...")
        async with websockets.connect(uri) as websocket:
            print("✅ WebSocket连接成功！")
            
            # 发送获取游戏状态的消息
            test_message = {
                "type": "get_game_state"
            }
            
            print(f"发送消息: {test_message}")
            await websocket.send(json.dumps(test_message))
            
            # 接收响应
            response = await websocket.recv()
            print(f"收到响应: {response}")
            
            # 解析响应
            try:
                data = json.loads(response)
                print(f"✅ 消息解析成功: {data['type']}")
            except json.JSONDecodeError:
                print("❌ 响应不是有效的JSON格式")
                
    except ConnectionClosed:
        print("❌ WebSocket连接被关闭")
    except ConnectionRefusedError:
        print("❌ 无法连接到服务器，请确保服务器正在运行")
        print("   运行命令: python main.py")
    except Exception as e:
        print(f"❌ 连接错误: {e}")

if __name__ == "__main__":
    print("🧪 WebSocket连接测试")
    print("=" * 30)
    asyncio.run(test_websocket_connection())