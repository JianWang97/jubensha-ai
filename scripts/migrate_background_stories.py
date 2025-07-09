#!/usr/bin/env python3
"""
数据库迁移脚本：为background_stories表添加新字段
"""

import asyncio
import sys
import os

# 添加项目根目录到Python路径
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.core.database import db_manager

async def migrate_background_stories():
    """迁移background_stories表，添加新字段"""
    try:
        await db_manager.initialize()
        
        async with db_manager.get_connection() as conn:
            # 检查字段是否已存在
            existing_columns = await conn.fetch("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'background_stories'
            """)
            
            existing_column_names = [row['column_name'] for row in existing_columns]
            
            # 需要添加的字段
            new_columns = [
                ("murder_method", "VARCHAR(100)"),
                ("murder_location", "VARCHAR(255)"),
                ("discovery_time", "VARCHAR(100)"),
                ("victory_conditions", "JSONB")
            ]
            
            # 添加缺失的字段
            for column_name, column_type in new_columns:
                if column_name not in existing_column_names:
                    alter_sql = f"ALTER TABLE background_stories ADD COLUMN {column_name} {column_type}"
                    await conn.execute(alter_sql)
                    print(f"✅ 添加字段: {column_name} ({column_type})")
                else:
                    print(f"⚠️  字段已存在: {column_name}")
            
            print("✅ 数据库迁移完成")
            
    except Exception as e:
        print(f"❌ 数据库迁移失败: {e}")
        raise
    finally:
        await db_manager.close()

if __name__ == "__main__":
    asyncio.run(migrate_background_stories())