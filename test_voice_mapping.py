#!/usr/bin/env python3
"""测试声音映射功能"""

import asyncio
import sys
import os
from pathlib import Path

# 添加项目根目录到Python路径
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

# 设置环境变量
os.environ.setdefault('PYTHONPATH', str(project_root))

# 导入模块
try:
    from src.core.db_manager import db_manager
    from src.core.game_engine import GameEngine
    from src.core.websocket_server import GameWebSocketServer
except ImportError:
    # 如果直接导入失败，尝试添加src到路径
    sys.path.insert(0, str(project_root / 'src'))
    from core.db_manager import db_manager
    from core.game_engine import GameEngine
    from core.websocket_server import GameWebSocketServer

async def test_voice_mapping():
    """测试声音映射功能"""
    try:
        # 初始化数据库
        await db_manager.initialize()
        print("✅ 数据库连接成功")
        
        # 创建游戏服务器和会话
        game_server = GameWebSocketServer()
        session = game_server.get_or_create_session("test_session", 1)
        
        # 初始化游戏
        await game_server._initialize_game(session)
        print("✅ 游戏初始化成功")
        
        # 获取声音映射
        voice_mapping = session.game_engine.get_voice_mapping()
        print("\n🎵 声音映射结果:")
        for character, voice in voice_mapping.items():
            print(f"  {character}: {voice}")
        
        # 获取声音分配详细信息
        assignment_info = session.game_engine.get_voice_assignment_info()
        print("\n📋 声音分配详细信息:")
        for character, info in assignment_info.items():
            print(f"  {character}: {info}")
        
        # 验证是否所有角色都有声音分配
        characters = [char.name for char in session.game_engine.characters]
        print(f"\n👥 角色列表: {characters}")
        
        missing_voices = [char for char in characters if char not in voice_mapping]
        if missing_voices:
            print(f"❌ 缺少声音映射的角色: {missing_voices}")
        else:
            print("✅ 所有角色都有声音映射")
        
        # 检查是否有重复的声音分配
        voice_counts = {}
        for character, voice in voice_mapping.items():
            if character not in ["系统", "default"]:
                voice_counts[voice] = voice_counts.get(voice, 0) + 1
        
        duplicates = {voice: count for voice, count in voice_counts.items() if count > 1}
        if duplicates:
            print(f"⚠️ 重复使用的声音: {duplicates}")
        else:
            print("✅ 没有重复的声音分配")
            
    except Exception as e:
        print(f"❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # 关闭数据库连接
        await db_manager.close()
        print("\n🔒 数据库连接已关闭")

if __name__ == "__main__":
    asyncio.run(test_voice_mapping())