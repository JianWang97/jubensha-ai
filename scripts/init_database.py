#!/usr/bin/env python3
"""
数据库初始化脚本
用于创建PostgreSQL数据库和表结构
"""

import asyncio
import os
import sys
from pathlib import Path

# Add project root to Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from src.core.database import DatabaseManager, DatabaseConfig
from dotenv import load_dotenv

async def init_database():
    """初始化数据库"""
    load_dotenv()
    
    print("🗄️ 初始化剧本杀数据库...")
    print("="*50)
    
    # 创建数据库配置
    config = DatabaseConfig(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", 5432)),
        database=os.getenv("DB_NAME", "jubensha_db"),
        username=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", ""),
        pool_size=int(os.getenv("DB_POOL_SIZE", 10)),
        max_overflow=int(os.getenv("DB_MAX_OVERFLOW", 20))
    )
    
    print(f"📍 连接数据库: {config.host}:{config.port}/{config.database}")
    
    try:
        # 创建数据库管理器
        db_manager = DatabaseManager(config)
        
        # 初始化数据库连接
        await db_manager.initialize()
        print("✅ 数据库连接成功")
        
        # 初始化表结构
        await db_manager.initialize_tables()
        print("✅ 数据库表结构初始化完成")
        
        # 验证表是否创建成功
        tables = await db_manager.execute_query(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
        )
        
        print("\n📋 已创建的表:")
        for table in tables:
            print(f"  - {table['table_name']}")
        
        print("\n🎉 数据库初始化完成!")
        print("\n可以开始使用剧本管理系统了:")
        print(f"  - 剧本管理页面: http://localhost:8000/script-manager")
        print(f"  - 游戏页面: http://localhost:8000")
        
    except Exception as e:
        print(f"❌ 数据库初始化失败: {e}")
        print("\n请检查:")
        print("1. PostgreSQL服务是否运行")
        print("2. .env文件中的数据库配置是否正确")
        print("3. 数据库用户是否有足够的权限")
        sys.exit(1)
    
    finally:
        # 关闭数据库连接
        await db_manager.close()

if __name__ == "__main__":
    asyncio.run(init_database())