#!/usr/bin/env python3
"""测试数据库连接池配置"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from src.db.session import db_manager
from src.core.config import get_database_config

def test_connection_pool():
    """测试连接池配置"""
    print("=== 数据库连接池配置测试 ===")
    
    # 获取配置
    config = get_database_config()
    print(f"配置的连接池大小: {config.pool_size}")
    
    # 初始化数据库
    db_manager.initialize()
    
    # 获取引擎信息
    engine = db_manager.engine
    pool = engine.pool
    
    print(f"实际连接池大小: {pool.size()}")
    print(f"最大溢出连接数: {pool._max_overflow}")
    print(f"连接池超时时间: {pool._timeout}")
    print(f"当前连接池状态: {pool.status()}")
    
    # 测试连接
    try:
        with db_manager.session_scope() as session:
            result = session.execute("SELECT 1")
            print(f"数据库连接测试成功: {result.scalar()}")
    except Exception as e:
        print(f"数据库连接测试失败: {e}")
    
    print("=== 测试完成 ===")

if __name__ == "__main__":
    test_connection_pool()