#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
清空数据库脚本
用于开发和测试环境中重置数据库状态

警告：此脚本将删除所有数据，请谨慎使用！
"""

import asyncio
import sys
import os
from pathlib import Path

# Add project root to Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from src.core.database import db_manager


async def clear_all_tables():
    """清空所有数据表"""
    try:
        # 初始化数据库连接
        await db_manager.initialize()
        
        async with db_manager.get_connection() as conn:
            # 按照外键依赖顺序删除数据
            tables_to_clear = [
                'game_phases',
                'background_stories', 
                'locations',
                'evidence',
                'characters',
                'scripts'
            ]
            
            print("开始清空数据库...")
            
            for table in tables_to_clear:
                try:
                    result = await conn.execute(f"DELETE FROM {table}")
                    print(f"✅ 已清空表 {table}: {result}")
                except Exception as e:
                    print(f"❌ 清空表 {table} 失败: {e}")
            
            # 重置序列
            sequences_to_reset = [
                'scripts_id_seq',
                'characters_id_seq',
                'evidence_id_seq',
                'locations_id_seq',
                'background_stories_id_seq',
                'game_phases_id_seq'
            ]
            
            print("\n重置自增序列...")
            for seq in sequences_to_reset:
                try:
                    await conn.execute(f"ALTER SEQUENCE {seq} RESTART WITH 1")
                    print(f"✅ 已重置序列 {seq}")
                except Exception as e:
                    print(f"❌ 重置序列 {seq} 失败: {e}")
            
            print("\n✅ 数据库清空完成！")
            
    except Exception as e:
        print(f"❌ 清空数据库失败: {e}")
        raise
    finally:
        await db_manager.close()


async def confirm_and_clear():
    """确认后清空数据库"""
    print("⚠️  警告：此操作将删除数据库中的所有数据！")
    print("⚠️  请确保这是在开发或测试环境中执行！")
    print()
    
    # 检查环境变量
    env = os.getenv('ENVIRONMENT', 'development')
    if env == 'production':
        print("❌ 检测到生产环境，拒绝执行清空操作！")
        return
    
    # 用户确认
    confirm = input("请输入 'YES' 确认清空数据库: ")
    if confirm != 'YES':
        print("操作已取消")
        return
    
    await clear_all_tables()


if __name__ == "__main__":
    # 检查命令行参数
    if len(sys.argv) > 1 and sys.argv[1] == '--force':
        # 强制清空，跳过确认
        print("强制清空模式")
        asyncio.run(clear_all_tables())
    else:
        # 需要用户确认
        asyncio.run(confirm_and_clear())