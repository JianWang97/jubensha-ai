import asyncio
import sys
from pathlib import Path

# Add project root to Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from src.core.database import initialize_database, db_manager

async def main():
    """初始化数据库"""
    try:
        print("开始初始化数据库...")
        await initialize_database()
        print("数据库初始化完成！")
    except Exception as e:
        print(f"数据库初始化失败: {e}")
    finally:
        await db_manager.close()

if __name__ == "__main__":
    asyncio.run(main())