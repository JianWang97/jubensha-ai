#!/usr/bin/env python3
"""
剧本管理系统一键设置脚本
自动安装依赖、初始化数据库和存储系统
"""

import asyncio
import os
import sys
import subprocess
from pathlib import Path

# 添加项目根目录到Python路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

def print_banner():
    """打印欢迎横幅"""
    print("\n" + "="*60)
    print("🎭 AI剧本杀游戏 - 剧本管理系统设置")
    print("="*60)
    print("这个脚本将帮助您设置完整的剧本管理系统")
    print("包括数据库、存储系统和所有必要的依赖")
    print("="*60 + "\n")

def check_python_version():
    """检查Python版本"""
    print("🐍 检查Python版本...")
    if sys.version_info < (3, 8):
        print("❌ 需要Python 3.8或更高版本")
        sys.exit(1)
    print(f"✅ Python版本: {sys.version.split()[0]}")

def install_dependencies():
    """安装项目依赖"""
    print("\n📦 安装项目依赖...")
    try:
        # 检查是否存在requirements.txt
        requirements_file = project_root / "requirements.txt"
        if not requirements_file.exists():
            print("⚠️ requirements.txt不存在，创建基础依赖文件...")
            create_requirements_file()
        
        # 安装依赖
        subprocess.run([
            sys.executable, "-m", "pip", "install", "-r", str(requirements_file)
        ], check=True)
        print("✅ 依赖安装完成")
    except subprocess.CalledProcessError as e:
        print(f"❌ 依赖安装失败: {e}")
        sys.exit(1)

def create_requirements_file():
    """创建requirements.txt文件"""
    requirements_content = """# AI剧本杀游戏依赖
fastapi>=0.104.0
uvicorn[standard]>=0.24.0
websockets>=12.0
python-dotenv>=1.0.0
langchain>=0.1.0
langchain-openai>=0.0.5
pydantic>=2.5.0

# 数据库相关
asyncpg>=0.29.0
sqlalchemy[asyncio]>=2.0.0
alembic>=1.13.0

# 存储相关
minio>=7.2.0
aiofiles>=23.2.0
python-multipart>=0.0.6

# TTS相关
dashscope>=1.17.0

# 开发工具
pytest>=7.4.0
pytest-asyncio>=0.21.0
black>=23.0.0
flake8>=6.0.0
"""
    
    requirements_file = project_root / "requirements.txt"
    with open(requirements_file, 'w', encoding='utf-8') as f:
        f.write(requirements_content)
    print(f"✅ 创建requirements.txt: {requirements_file}")

def check_env_file():
    """检查环境配置文件"""
    print("\n⚙️ 检查环境配置...")
    env_file = project_root / ".env"
    env_example = project_root / ".env.example"
    
    if not env_file.exists():
        if env_example.exists():
            print("📋 复制.env.example到.env...")
            with open(env_example, 'r', encoding='utf-8') as src:
                content = src.read()
            with open(env_file, 'w', encoding='utf-8') as dst:
                dst.write(content)
            print("✅ .env文件已创建")
            print("⚠️ 请编辑.env文件，填入正确的配置信息")
        else:
            print("❌ .env.example文件不存在")
            return False
    else:
        print("✅ .env文件已存在")
    
    return True

def check_services():
    """检查必要的服务"""
    print("\n🔍 检查必要服务...")
    
    services_status = {
        "PostgreSQL": False,
        "MinIO": False
    }
    
    # 这里可以添加实际的服务检查逻辑
    # 目前只是提示用户
    print("请确保以下服务正在运行:")
    print("  📊 PostgreSQL数据库服务")
    print("  📦 MinIO对象存储服务")
    print("\n如果您还没有安装这些服务，请参考文档进行安装")
    
    return True

async def initialize_database():
    """初始化数据库"""
    print("\n🗄️ 初始化数据库...")
    try:
        from scripts.init_database import init_database
        await init_database()
        return True
    except Exception as e:
        print(f"❌ 数据库初始化失败: {e}")
        return False

async def initialize_storage():
    """初始化存储系统"""
    print("\n📦 初始化存储系统...")
    try:
        from scripts.init_storage import init_storage
        await init_storage()
        return True
    except Exception as e:
        print(f"❌ 存储系统初始化失败: {e}")
        return False

def print_success_message():
    """打印成功消息"""
    print("\n" + "="*60)
    print("🎉 剧本管理系统设置完成!")
    print("="*60)
    print("\n🚀 启动服务器:")
    print("   python main.py")
    print("\n🌐 访问地址:")
    print("   游戏页面: http://localhost:8000")
    print("   剧本管理: http://localhost:8000/script-manager")
    print("\n📚 功能特性:")
    print("   ✅ 剧本创建和编辑")
    print("   ✅ 角色、证据、场景管理")
    print("   ✅ 图片上传和存储")
    print("   ✅ 剧本搜索和筛选")
    print("   ✅ 数据统计和分析")
    print("\n📖 使用说明:")
    print("   1. 访问剧本管理页面创建您的第一个剧本")
    print("   2. 上传角色头像、证据图片、场景背景")
    print("   3. 设置剧本状态为'已发布'")
    print("   4. 在游戏页面开始剧本杀游戏")
    print("\n" + "="*60)

async def main():
    """主函数"""
    print_banner()
    
    # 检查Python版本
    check_python_version()
    
    # 安装依赖
    install_dependencies()
    
    # 检查环境配置
    if not check_env_file():
        print("❌ 环境配置检查失败")
        sys.exit(1)
    
    # 检查服务
    if not check_services():
        print("❌ 服务检查失败")
        sys.exit(1)
    
    # 询问用户是否继续
    print("\n⚠️ 请确保PostgreSQL和MinIO服务正在运行")
    response = input("是否继续初始化数据库和存储系统? (y/N): ")
    if response.lower() not in ['y', 'yes']:
        print("设置已取消")
        sys.exit(0)
    
    # 初始化数据库
    db_success = await initialize_database()
    
    # 初始化存储系统
    storage_success = await initialize_storage()
    
    # 检查结果
    if db_success and storage_success:
        print_success_message()
    else:
        print("\n❌ 设置过程中出现错误")
        print("请检查错误信息并重新运行设置脚本")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())