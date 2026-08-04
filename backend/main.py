import asyncio
import uvicorn
from src.core.server import app
from dotenv import load_dotenv
import os
import logging

def main():
    """启动AI剧本杀游戏服务器"""

    
    # 配置日志
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler('ai_agent.log', encoding='utf-8')  # 输出到根目录文件
        ],
        force=True  # 强制重新配置，覆盖已有配置
    )
    
    # 测试日志输出
    logger = logging.getLogger(__name__)
    logger.info("日志系统已启动，AI代理日志将记录在此")
    print("✅ 日志配置完成，日志文件：ai_agent.log")
    
    print("🎭 AI剧本杀游戏服务器启动中...")
    print("="*50)
    print("请确保已在.env文件中设置OPENAI_API_KEY")
    print("游戏特色:")
    print("- 多个AI角色自动扮演")
    print("- 完整的剧本杀流程")
    print("- 实时WebSocket同步")
    print("- 精美的Web界面")
    print("="*50)
    
    host = "0.0.0.0"  # 改为0.0.0.0允许外部访问
    port = int(os.getenv("PORT", 8010))
    reload = os.getenv("RELOAD", "false").lower() == "true"

    if reload:
        print("🔁 热重载已开启，代码变更后自动重启")
    print(f"🌐 服务器地址: http://{host}:{port}")
    print(f"🎮 游戏页面: http://{host}:{port}")
    print("\n按 Ctrl+C 停止服务器")
    
    try:
        uvicorn.run(
            "main:app",
            host=host,
            port=port,
            log_level="info",
            reload=reload,
            reload_dirs=["src", "main.py"],
        )
    except KeyboardInterrupt:
        print("\n👋 服务器已停止")

def run_next():
    os.system("cd frontend && npm run dev")


if __name__ == "__main__":
    load_dotenv()
    # run_next()
    main()
 
