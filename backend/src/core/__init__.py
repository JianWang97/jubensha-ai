"""核心游戏引擎模块

注意: 避免在包导入阶段就加载重量级或有循环依赖的模块 (如 game_engine / tts_event_service)。
Alembic 在 env.py 中导入模型时会 import src.db -> src.core，过早加载 GameEngine 会触发
对 tts_event_service 的依赖，进而引用 db.session，造成循环导入。

因此这里不再在包层级直接导出 GameEngine 等类；需要时显式 from src.core.game_engine import GameEngine。
"""

__all__ = []