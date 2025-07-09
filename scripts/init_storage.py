#!/usr/bin/env python3
"""
MinIO存储初始化脚本
用于创建存储桶和设置权限
"""

import asyncio
import os
import sys
from pathlib import Path

# Add project root to Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from src.core.storage import StorageManager, StorageConfig
from dotenv import load_dotenv

async def init_storage():
    """初始化MinIO存储"""
    load_dotenv()
    
    print("📦 初始化MinIO存储系统...")
    print("="*50)
    
    # 创建存储配置
    config = StorageConfig(
        endpoint=os.getenv("MINIO_ENDPOINT", "localhost:9000"),
        access_key=os.getenv("MINIO_ACCESS_KEY", "minioadmin"),
        secret_key=os.getenv("MINIO_SECRET_KEY", "minioadmin"),
        bucket_name=os.getenv("MINIO_BUCKET_NAME", "jubensha-storage"),
        secure=os.getenv("MINIO_SECURE", "false").lower() == "true"
    )
    
    print(f"📍 连接MinIO: {config.endpoint}")
    print(f"🪣 存储桶: {config.bucket_name}")
    
    try:
        # 创建存储管理器
        storage_manager = StorageManager(config)
        
        # 确保存储桶存在
        await storage_manager.ensure_bucket_exists()
        print("✅ 存储桶创建/验证成功")
        
        # 测试上传功能
        test_content = b"Test file for MinIO initialization"
        test_path = "test/init_test.txt"
        
        success = await storage_manager.upload_file(
            file_content=test_content,
            object_path=test_path,
            content_type="text/plain"
        )
        
        if success:
            print("✅ 文件上传测试成功")
            
            # 获取文件URL
            file_url = await storage_manager.get_file_url(test_path)
            print(f"📎 测试文件URL: {file_url}")
            
            # 删除测试文件
            await storage_manager.delete_file(test_path)
            print("✅ 测试文件清理完成")
        else:
            print("❌ 文件上传测试失败")
        
        # 获取存储统计信息
        stats = await storage_manager.get_storage_stats()
        print("\n📊 存储统计信息:")
        print(f"  - 总文件数: {stats['total']}")
        print(f"  - 剧本封面: {stats['covers']}")
        print(f"  - 角色头像: {stats['avatars']}")
        print(f"  - 证据图片: {stats['evidence']}")
        print(f"  - 场景背景: {stats['scenes']}")
        
        print("\n🎉 MinIO存储初始化完成!")
        print("\n存储目录结构:")
        print("  📁 covers/     - 剧本封面图片")
        print("  📁 avatars/    - 角色头像图片")
        print("  📁 evidence/   - 证据相关图片")
        print("  📁 scenes/     - 场景背景图片")
        
    except Exception as e:
        print(f"❌ MinIO存储初始化失败: {e}")
        print("\n请检查:")
        print("1. MinIO服务是否运行")
        print("2. .env文件中的MinIO配置是否正确")
        print("3. MinIO访问密钥是否有效")
        print("4. 网络连接是否正常")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(init_storage())