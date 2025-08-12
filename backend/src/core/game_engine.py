"""游戏引擎核心模块"""
import asyncio
import json
import logging
import time
from typing import Dict, List, Optional, Any, Union

from ..schemas.script import (
    ScriptCharacter
)
from ..schemas.game_phase import GamePhaseEnum
from ..schemas.base import BaseDataModel
from ..agents import AIAgent
from .evidence_manager import EvidenceManager
from .voting_manager import VotingManager
from .conversation_flow_controller import ConversationFlowController
from src.db.repositories.script_repository import ScriptRepository
# 不能在模块顶层直接导入 TTS 服务，Alembic 迁移时会导致循环引用：
# tts_event_service -> db.session -> core.config -> (可能) 引擎/服务
# 在使用处进行延迟导入。

logger = logging.getLogger(__name__)

class GameEngine:
    """剧本杀游戏引擎"""

    def __init__(self, script_id: Optional[int] = None, session_id: Optional[str] = None):
        # 基础标识
        self.script_id: Optional[int] = script_id
        self.session_id: Optional[str] = session_id  # 用于TTS会话

        # 核心数据结构
        self.script_data: Optional[Dict[str, Any]] = None
        self.characters: List[ScriptCharacter] = []
        self.agents: Dict[str, AIAgent] = {}
        self.current_phase: GamePhaseEnum = GamePhaseEnum.BACKGROUND

        # 历史事件 & 聊天
        self.events: List[Dict[str, Any]] = []
        self.event_sequence: int = 0  # 自增事件ID
        self.max_events: int = 5000
        self.max_public_chat: int = 5000
        self.public_chat: List[Dict[str, Any]] = []

        # 管理器（延后初始化）
        self.evidence_manager: Optional[EvidenceManager] = None
        self.voting_manager: Optional[VotingManager] = None
        self.conversation_flow_controller: Optional[ConversationFlowController] = None

        # 游戏状态快照（供AI与前端使用）
        self.game_state: Dict[str, Any] = {
            "phase": self.current_phase.value,
            "events": self.events,
            "characters": [],
            "votes": {},
            "evidence": [],
            "discovered_evidence": [],
            "public_chat": self.public_chat,
        }

    def get_history(self, from_event_id: int = 0, limit: Optional[int] = None) -> Dict[str, Any]:
        """获取历史事件与聊天（用于前端回看，不涉及断线状态恢复）

        参数:
            from_event_id: 起始事件ID（排除该ID，返回其后的事件；0 表示返回全部保留事件）
            limit: 事件数量上限（None 表示不限制）
        返回:
            dict: {
                events: [...],           # 满足条件的事件（已按时间顺序）
                public_chat: [...],      # 当前保留的全部公开聊天（可在前端自行去重）
                truncated: bool,         # 是否因为 limit 被截断
                newest_event_id: int,    # 当前最新事件ID（供前端记录）
                earliest_event_id: int   # 当前仍保留的最早事件ID（用于判断是否发生裁剪）
            }
        """
        if from_event_id <= 0:
            events_slice = self.events
        else:
            events_slice = [e for e in self.events if e.get("id", 0) > from_event_id]
        truncated = False
        if limit is not None and limit > 0 and len(events_slice) > limit:
            truncated = True
            events_slice = events_slice[-limit:]
        earliest_id = self.events[0]["id"] if self.events else 0
        return {
            "events": events_slice,
            "public_chat": self.public_chat,
            "truncated": truncated,
            "newest_event_id": self.event_sequence,
            "earliest_event_id": earliest_id
        }
    
    async def load_script_data(self, script_id: int):
        """从数据库加载剧本数据"""
        self.script_id = script_id
        
        # 手动创建数据库会话和仓库实例
        from src.db.session import get_db_session
        db_session = next(get_db_session())
        script_repository = ScriptRepository(db_session)
        
        try:
            # 获取完整的剧本数据
            full_script = script_repository.get_script_by_id(script_id)
            logger.info(f"加载剧本数据: {full_script}")
            if not full_script:
                raise ValueError(f"未找到剧本ID: {script_id}")
        finally:
            # 确保数据库会话被正确关闭
            db_session.close()
        
        # 从完整剧本对象中提取数据，确保类型安全
        characters = []
        for char in full_script.characters:
            try:
                char_dict = {
                    'id': char.id,
                    'script_id': char.script_id,
                    'name': char.name or "",
                    'background': char.background or "",
                    'gender': char.gender or "中性",
                    'age': char.age,
                    'profession': char.profession or "",
                    'secret': char.secret or "",
                    'objective': char.objective or "",
                    'is_victim': bool(char.is_victim),
                    'is_murderer': bool(char.is_murderer),
                    'personality_traits': char.personality_traits or [],
                    'avatar_url': char.avatar_url,
                    'voice_preference': char.voice_preference,
                    'voice_id': char.voice_id
                }
                characters.append(char_dict)
            except Exception as e:
                logger.error(f"处理角色数据失败 {getattr(char, 'name', 'Unknown')}: {e}")
                continue
        
        evidence = []
        for ev in full_script.evidence:
            try:
                ev_dict = {
                    'id': ev.id,
                    'script_id': ev.script_id,
                    'name': ev.name or "",
                    'description': ev.description or "",
                    'location': ev.location or "",
                    'related_to': ev.related_to or "",
                    'significance': ev.significance or "",
                    'evidence_type': ev.evidence_type.value if hasattr(ev.evidence_type, 'value') else str(ev.evidence_type),
                    'importance': ev.importance or "重要证据",
                    'image_url': ev.image_url,
                    'is_hidden': bool(ev.is_hidden)
                }
                evidence.append(ev_dict)
            except Exception as e:
                logger.error(f"处理证据数据失败 {getattr(ev, 'name', 'Unknown')}: {e}")
                continue
        
        locations = []
        for loc in full_script.locations:
            try:
                loc_dict = {
                    'id': loc.id,
                    'script_id': loc.script_id,
                    'name': loc.name or "",
                    'description': loc.description or "",
                    'searchable_items': loc.searchable_items or [],
                    'background_image_url': loc.background_image_url,
                    'is_crime_scene': bool(loc.is_crime_scene)
                }
                locations.append(loc_dict)
            except Exception as e:
                logger.error(f"处理场景数据失败 {getattr(loc, 'name', 'Unknown')}: {e}")
                continue
        
        # 转换背景故事对象为字典，确保类型安全
        background_story: Dict[str, Union[str, Dict[str, Any]]] = {}
        if full_script.background_story:
            try:
                bg = full_script.background_story
                background_story = {
                    "title": bg.title or "",
                    "setting_description": bg.setting_description or "",
                    "incident_description": bg.incident_description or "",
                    "victim_background": bg.victim_background or "",
                    "investigation_scope": bg.investigation_scope or "",
                    "rules_reminder": bg.rules_reminder or "",
                    "murder_method": bg.murder_method or "",
                    "murder_location": bg.murder_location or "",
                    "discovery_time": bg.discovery_time or "",
                    "victory_conditions": bg.victory_conditions or {}
                }
            except Exception as e:
                logger.error(f"处理背景故事数据失败: {e}")
                background_story = {
                    "title": "案件背景",
                    "setting_description": "暂无相关信息",
                    "incident_description": "暂无相关信息",
                    "victim_background": "暂无相关信息",
                    "investigation_scope": "暂无相关信息",
                    "rules_reminder": "暂无相关信息",
                    "murder_method": "暂无相关信息",
                    "murder_location": "暂无相关信息",
                    "discovery_time": "暂无相关信息",
                    "victory_conditions": {}
                }
        
        # 转换游戏阶段数据
        game_phases = []
        for phase in full_script.game_phases:
            try:
                phase_dict = {
                    "id": phase.id,
                    "script_id": phase.script_id,
                    "phase": phase.phase.value if hasattr(phase.phase, 'value') else str(phase.phase),
                    "name": phase.name or "",
                    "description": phase.description or "",
                    "order_index": phase.order_index or 0
                }
                game_phases.append(phase_dict)
            except Exception as e:
                logger.error(f"处理游戏阶段数据失败: {e}")
                continue
        
        # 组装剧本数据，确保类型安全
        try:
            script_info = {
                "title": full_script.info.title or "",
                "description": full_script.info.description or "",
                "player_count": full_script.info.player_count or 4,
                "difficulty": full_script.info.difficulty_level or "medium",
                "estimated_time": full_script.info.estimated_duration or 180,
                "tags": full_script.info.tags or [],
                "author": getattr(full_script.info, 'author', None),
                "status": full_script.info.status.value if hasattr(full_script.info.status, 'value') else str(full_script.info.status),
                "cover_image_url": getattr(full_script.info, 'cover_image_url', None),
                "is_public": getattr(full_script.info, 'is_public', False),
                "price": getattr(full_script.info, 'price', 0.0)
            }
        except Exception as e:
            logger.error(f"处理剧本信息失败: {e}")
            script_info = {
                "title": "未知剧本",
                "description": "暂无描述",
                "player_count": 4,
                "difficulty": "medium",
                "estimated_time": 180,
                "tags": []
            }
        
        # 使用类型注解确保数据结构的正确性
        script_data_dict: Dict[str, Any] = {
            "script_info": script_info,
            "characters": characters,
            "evidence": evidence,
            "locations": locations,
            "background_story": background_story if background_story is not None else {},
            "game_phases": game_phases
        }

        self.script_data = script_data_dict

        # 验证剧本数据完整性
        if not self.validate_script_data():
            raise ValueError(f"剧本数据验证失败，剧本ID: {script_id}")
        
        # 初始化游戏组件
        try:
            self.characters = self._init_characters()
            # 初始化证据管理器、投票管理器和对话流控制器
            self.evidence_manager = EvidenceManager(self.script_data["evidence"])
            self.voting_manager = VotingManager(self.characters)
            self.conversation_flow_controller = ConversationFlowController(self.characters)
            
            # 更新游戏状态
            self.game_state.update({
                "characters": [char.name for char in self.characters],
                "evidence": self.script_data["evidence"]
            })
            
            logger.info(f"游戏引擎初始化完成，剧本: {self.script_data.get('script_info', {}).get('title', '未知剧本')}")
            
        except Exception as e:
            logger.error(f"初始化游戏组件失败: {e}")
            raise ValueError(f"游戏引擎初始化失败: {e}")
    
    def _init_characters(self) -> List[ScriptCharacter]:
        """初始化角色"""
        characters: List[ScriptCharacter] = []
        
        if not self.script_data or "characters" not in self.script_data:
            logger.warning("剧本数据中没有角色信息")
            return characters
            
        for char_data in self.script_data["characters"]:
            # 跳过受害者，受害者不参与游戏
            if char_data.get("is_victim", False):
                continue
                
            try:
                character = ScriptCharacter(
                    id=char_data.get("id"),
                    script_id=char_data.get("script_id"),
                    name=char_data["name"],
                    age=char_data.get("age"),
                    profession=char_data.get("profession", ""),
                    background=char_data["background"],
                    secret=char_data["secret"] or "",
                    objective=char_data["objective"] or "",
                    gender=char_data.get("gender", "中性"),
                    is_murderer=char_data.get("is_murderer", False),
                    is_victim=char_data.get("is_victim", False),
                    personality_traits=char_data.get("personality_traits", []),
                    avatar_url=char_data.get("avatar_url"),
                    voice_preference=char_data.get("voice_preference"),
                    voice_id=char_data.get("voice_id"),
                    created_at=char_data.get("created_at"),
                    updated_at=char_data.get("updated_at")
                )
                characters.append(character)
            except Exception as e:
                logger.error(f"初始化角色 {char_data.get('name', 'Unknown')} 失败: {e}")
                continue
            
        return characters
    
    def get_script_info(self) -> Dict[str, Any]:
        """获取剧本基本信息"""
        if not self.script_data:
            raise ValueError("剧本数据未加载")
        return self.script_data["script_info"]
    
    def get_game_phases_info(self) -> List[Dict[str, Any]]:
        """获取游戏阶段信息"""
        if not self.script_data:
            raise ValueError("剧本数据未加载")
        return self.script_data["game_phases"]
    
    def get_background_story(self) -> Dict[str, Any]:
        """获取背景故事信息"""
        if not self.script_data:
            return {}
        return self.script_data.get("background_story", {})
    
    def get_characters_data(self) -> List[Dict[str, Any]]:
        """获取角色数据"""
        if not self.script_data:
            return []
        return self.script_data.get("characters", [])
    
    def get_evidence_data(self) -> List[Dict[str, Any]]:
        """获取证据数据"""
        if not self.script_data:
            return []
        return self.script_data.get("evidence", [])
    
    def get_locations_data(self) -> List[Dict[str, Any]]:
        """获取场景数据"""
        if not self.script_data:
            return []
        return self.script_data.get("locations", [])
    
    def validate_script_data(self) -> bool:
        """验证剧本数据的完整性"""
        if not self.script_data:
            logger.error("剧本数据未加载")
            return False
        
        required_keys = ["script_info", "characters", "evidence", "locations", "background_story", "game_phases"]
        for key in required_keys:
            if key not in self.script_data:
                logger.error(f"剧本数据缺少必要字段: {key}")
                return False
        
        # 检查角色数据
        characters = self.get_characters_data()
        if not characters:
            logger.warning("剧本中没有角色数据")
        
        # 检查是否有非受害者角色
        active_characters = [char for char in characters if not char.get("is_victim", False)]
        if not active_characters:
            logger.error("剧本中没有可参与游戏的角色")
            return False
        
        logger.info(f"剧本数据验证通过，包含 {len(active_characters)} 个可参与角色")
        return True

    async def initialize_agents(self):
        """初始化AI代理"""
        if not self.characters:
            logger.warning("没有可用的角色来初始化AI代理")
            return
            
        for character in self.characters:
            if not character.is_victim:
                try:
                    self.agents[character.name] = AIAgent(character)
                    logger.info(f"成功初始化AI代理: {character.name}")
                except Exception as e:
                    logger.error(f"初始化AI代理 {character.name} 失败: {e}", exc_info=True)
    
    async def next_phase(self):
        """进入下一个游戏阶段"""
        phases = list(GamePhaseEnum)
        current_index = phases.index(self.current_phase)
        if current_index < len(phases) - 1:
            self.current_phase = phases[current_index + 1]
            self.game_state["phase"] = self.current_phase.value  # 使用枚举的值
            
            # 重置对话流控制器状态（重要：确保每个阶段的发言频率重新计算）
            if self.conversation_flow_controller:
                self.conversation_flow_controller.reset_for_new_phase(self.current_phase)
                logger.info(f"已重置对话流控制器状态，进入{self.current_phase.value}阶段")
            
            # 阶段中文名称映射
            phase_names = {
                "background": "背景介绍",
                "introduction": "自我介绍",
                "evidence_collection": "搜证阶段",
                "investigation": "调查取证",
                "discussion": "自由讨论",
                "voting": "投票表决",
                "revelation": "真相揭晓",
                "ended": "游戏结束"
            }
            
            # 添加阶段转换事件
            phase_display_name = phase_names.get(self.current_phase.value, self.current_phase.value)
            self.add_event("系统", f"游戏进入{phase_display_name}阶段")
    
    def add_event(self, character: str, content: str):
        """添加游戏事件"""
        # 递增事件序号（保持单线程上下文内安全；如需并发扩展需加锁）
        self.event_sequence += 1
        event = {
            "id": self.event_sequence,
            "type": "action",
            "character": character,
            "content": content,
            "timestamp": time.time()
        }
        self.events.append(event)
        # 超出容量时裁剪（保留最新）
        if len(self.events) > self.max_events:
            overflow = len(self.events) - self.max_events
            if overflow > 0:
                self.events = self.events[overflow:]
        # 注意：裁剪后事件ID不会重置，前端若请求不存在的旧ID，需提示已被裁剪
        self.game_state["events"] = self.events

    def get_events_since(self, last_event_id: int) -> List[Dict[str, Any]]:
        """获取指定事件ID之后的增量事件列表

        Args:
            last_event_id: 客户端已接收的最后一个事件ID（若为0表示需要全部）
        Returns:
            List[事件字典]
        """
        if last_event_id <= 0:
            return self.events
        # events按追加顺序存储，可直接过滤
        return [e for e in self.events if e.get("id", 0) > last_event_id]
    
    def add_public_chat(self, character: str, message: str, message_type: str = "chat", 
                       session_id: Optional[str] = None, voice_id: Optional[str] = None):
        """添加公开聊天信息"""
        chat_entry = {
            "character": character,
            "message": message,
            "type": message_type,  # chat, question, answer, accusation, defense
            "timestamp": time.time()
        }
        self.public_chat.append(chat_entry)
        if len(self.public_chat) > self.max_public_chat:
            overflow = len(self.public_chat) - self.max_public_chat
            if overflow > 0:
                self.public_chat = self.public_chat[overflow:]
        self.game_state["public_chat"] = self.public_chat
        
        # 同时添加到events中保持兼容性
        self.add_event(character, message)
        
        # 处理TTS事件（异步，不阻塞游戏流程）
        if session_id and message.strip():
            try:
                # 延迟导入以避免 Alembic / 初始化阶段的循环依赖
                from src.services.tts_event_service import get_tts_event_service  # type: ignore
                tts_service = get_tts_event_service()
                if tts_service:
                    asyncio.create_task(
                        tts_service.process_speech_event(
                            session_id=session_id,
                            character_name=character,
                            content=message,
                            event_type=message_type,
                            voice_id=voice_id
                        )
                    )
                    logger.debug(f"已启动TTS处理任务: {character} - {message[:50]}...")
            except Exception as e:
                logger.error(f"启动TTS处理任务失败: {e}")
                # TTS失败不应该影响游戏进程，继续执行
    
    def get_recent_public_chat(self, limit: int = 15) -> List[Dict[str, Any]]:
        """获取最近的公开聊天记录"""
        return self.public_chat[-limit:] if self.public_chat else []

    def get_public_chat_since(self, since_ts: float) -> List[Dict[str, Any]]:
        """获取某时间戳后的公开聊天（用于断线重连增量同步）
        Args:
            since_ts: 客户端本地最后一条消息的timestamp（秒）
        Returns:
            List[聊天记录]
        """
        if since_ts <= 0:
            return self.public_chat
        return [c for c in self.public_chat if c.get("timestamp", 0) > since_ts]
    
    async def run_phase(self, max_turns: Optional[int] = None, action_callback=None) -> List[Dict[str, Any]]:
        """运行当前阶段，返回所有AI的行动
        
        Args:
            max_turns: 最大发言轮数，如果为None则使用默认值
            action_callback: 可选的回调函数，每个角色发言完成后立即调用
        """
        actions: List[Dict[str, Any]] = []
        
        if self.current_phase == GamePhaseEnum.ENDED:
            return actions
        
        # 背景介绍阶段由系统叙述，不需要AI发言
        if self.current_phase == GamePhaseEnum.BACKGROUND:
            background = self.get_background_story()
            
            # 确保background是字典类型
            if not isinstance(background, dict):
                logger.warning(f"背景故事数据类型错误: {type(background)}")
                background = {}
            
            # 定义背景故事的各个部分
            story_sections = [
                ("title", "案件背景", "【{}】"),
                ("setting_description", "现场情况", "现场情况：{}"),
                ("incident_description", "案件经过", "案件经过：{}"),
                ("victim_background", "死者背景", "死者背景：{}"),
                ("investigation_scope", "调查范围", "调查范围：{}"),
                ("rules_reminder", "游戏规则", "游戏规则：{}")
            ]
            
            for key, default_name, template in story_sections:
                try:
                    content = background.get(key, "")
                    
                    # 处理内容为空或无效的情况
                    if not content or content.strip() == "" or content == "None":
                        content = "暂无相关信息"
                    
                    # 格式化消息
                    if key == "title":
                        message = template.format(content if content != "暂无相关信息" else default_name)
                    else:
                        message = template.format(content)
                    
                    # 添加到聊天记录和动作列表
                    self.add_public_chat(
                        character="系统", 
                        message=message, 
                        message_type="background",
                        session_id=self.session_id
                    )
                    action_data = {
                        "character": "系统",
                        "action": message,
                        "type": "background"
                    }
                    actions.append(action_data)
                    
                    # 如果提供了回调函数，立即调用以实现流式返回
                    if action_callback:
                        try:
                            await action_callback(action_data)
                        except Exception as e:
                            logger.error(f"背景介绍回调函数执行失败: {e}")
                    
                    await asyncio.sleep(2)  # 每部分之间的延迟
                    
                except Exception as e:
                    logger.error(f"处理背景故事部分 {key} 失败: {e}")
                    error_msg = f"{default_name}：数据处理失败"
                    self.add_public_chat(
                        character="系统", 
                        message=error_msg, 
                        message_type="background",
                        session_id=self.session_id
                    )
                    error_action_data = {
                        "character": "系统",
                        "action": error_msg,
                        "type": "background"
                    }
                    actions.append(error_action_data)
                    
                    # 如果提供了回调函数，立即调用以实现流式返回
                    if action_callback:
                        try:
                            await action_callback(error_action_data)
                        except Exception as callback_error:
                            logger.error(f"错误消息回调函数执行失败: {callback_error}")
                    
                    await asyncio.sleep(2)
            
            return actions
        
        # 动态对话流：每次发言后重新评估下一个发言者
        available_characters = list(self.agents.keys())
        
        # 根据标准剧本杀流程设置各阶段最大轮数
        if max_turns is None:
            phase_max_turns = {
                GamePhaseEnum.INTRODUCTION: len(available_characters),  # 角色介绍：每人一次轮流发言
                GamePhaseEnum.EVIDENCE_COLLECTION: len(available_characters) * 2,  # 搜证调查：每人最多搜证2次
                GamePhaseEnum.INVESTIGATION: len(available_characters) * 4,  # 线索公开与调查：充分的信息交换
                GamePhaseEnum.DISCUSSION: len(available_characters) * 5,  # 圆桌讨论：核心推理环节，需要更多轮次
                GamePhaseEnum.VOTING: len(available_characters) + 3,  # 投票陈述：每人投票+可能的票后陈述
            }
            max_turns = phase_max_turns.get(self.current_phase, len(available_characters) * 2)
        
        logger.info(f"开始{self.current_phase.value}阶段，最大轮数: {max_turns}")
        
        # 动态发言循环
        turn_count = 0
        consecutive_same_speaker = 0
        last_speaker = None
        
        # 对于DISCUSSION和VOTING阶段，确保每个角色都有机会发言
        if self.current_phase in [GamePhaseEnum.DISCUSSION, GamePhaseEnum.VOTING]:
            # 获取还没有发言的角色
            unspoken_characters = []
            if self.conversation_flow_controller:
                unspoken_characters = [char for char in available_characters 
                                     if self.conversation_flow_controller.speaking_frequency.get(char, 0) == 0]
            
            # 如果还有角色没发言，优先让他们发言
            if unspoken_characters:
                logger.info(f"{self.current_phase.value}阶段：优先安排未发言角色: {unspoken_characters}")
        
        while turn_count < max_turns and available_characters:
            # 获取最近的聊天记录用于智能选择
            recent_chat = self.get_recent_public_chat(limit=10)
            
            # 选择下一个发言者的逻辑
            next_speaker = None
            
            # 对于DISCUSSION和VOTING阶段，确保公平发言
            if self.current_phase in [GamePhaseEnum.DISCUSSION, GamePhaseEnum.VOTING] and self.conversation_flow_controller:
                # 优先选择还没有发言的角色
                unspoken = [char for char in available_characters 
                           if self.conversation_flow_controller.speaking_frequency.get(char, 0) == 0]
                
                if unspoken:
                    # 从未发言的角色中选择
                    next_speaker = unspoken[0]
                    logger.info(f"{self.current_phase.value}阶段：选择未发言角色 {next_speaker}")
                else:
                    # 所有角色都发言过，使用智能选择
                    try:
                        next_speaker = await self.conversation_flow_controller.select_next_speaker(
                            available_characters, 
                            self.game_state, 
                            self.current_phase,
                            recent_chat
                        )
                    except Exception as e:
                        logger.error(f"智能选择发言者失败: {e}，使用轮流选择")
                        next_speaker = available_characters[turn_count % len(available_characters)]
            else:
                # 其他阶段使用原有的智能选择逻辑
                if self.conversation_flow_controller:
                    try:
                        next_speaker = await self.conversation_flow_controller.select_next_speaker(
                            available_characters, 
                            self.game_state, 
                            self.current_phase,
                            recent_chat
                        )
                        
                        # 避免同一角色连续发言超过2次（紧急情况除外）
                        if next_speaker == last_speaker:
                            consecutive_same_speaker += 1
                            if consecutive_same_speaker >= 2 and len(available_characters) > 1:
                                # 强制选择其他角色
                                other_characters = [char for char in available_characters if char != last_speaker]
                                if other_characters:
                                    next_speaker = other_characters[0]  # 选择第一个其他角色
                                    logger.info(f"避免连续发言，强制切换到: {next_speaker}")
                        else:
                            consecutive_same_speaker = 0
                            
                    except Exception as e:
                        logger.error(f"智能选择发言者失败: {e}，使用随机选择")
                        next_speaker = available_characters[0] if available_characters else None
                else:
                    # 回退到简单的轮流发言
                    next_speaker = available_characters[turn_count % len(available_characters)]
            
            if not next_speaker or next_speaker not in self.agents:
                logger.warning(f"无效的发言者: {next_speaker}，跳过此轮")
                turn_count += 1
                continue
            
            agent = self.agents[next_speaker]
            try:
                # AI思考并行动
                action = await agent.think_and_act(self.game_state, self.current_phase)
                
                # 根据阶段确定消息类型
                message_type = "chat"
                if self.current_phase == GamePhaseEnum.INVESTIGATION:
                    message_type = "question" if "?" in action or "吗" in action or "呢" in action else "answer"
                elif self.current_phase == GamePhaseEnum.DISCUSSION:
                    message_type = "accusation" if "觉得" in action and "是" in action else "discussion"
                elif self.current_phase == GamePhaseEnum.VOTING:
                    message_type = "vote"
                
                # 获取角色的完整信息
                character_voice_id = None
                character_info = None
                for character in self.characters:
                    if character.name == next_speaker:
                        character_voice_id = character.voice_id
                        # 构造角色信息字典，用于TTS声音映射
                        character_info = {
                            "gender": character.gender,
                            "age": character.age,
                            "age_group": "elder" if character.age and character.age >= 50 else "young",
                            "profession": character.profession,
                            "voice_preference": character.voice_preference,
                            "voice_id": character.voice_id
                        }
                        break
                
                # 使用公开聊天系统记录，传递session_id和voice_id用于TTS
                self.add_public_chat(
                    character=next_speaker, 
                    message=action, 
                    message_type=message_type,
                    session_id=self.session_id,
                    voice_id=character_voice_id
                )
                
                # 更新对话流控制器的发言频率
                if self.conversation_flow_controller:
                    if next_speaker not in self.conversation_flow_controller.speaking_frequency:
                        self.conversation_flow_controller.speaking_frequency[next_speaker] = 0
                    self.conversation_flow_controller.speaking_frequency[next_speaker] += 1
                
                # 搜证阶段处理证据发现
                if self.current_phase == GamePhaseEnum.EVIDENCE_COLLECTION and self.evidence_manager:
                    discovered = self.evidence_manager.process_evidence_search(action, next_speaker)
                    if discovered:
                        self.add_public_chat(
                            character="系统", 
                            message=f"{next_speaker}发现了证据：{discovered['name']}", 
                            message_type="system",
                            session_id=self.session_id
                        )
                        self.game_state["discovered_evidence"] = self.evidence_manager.get_discovered_evidence()
                
                action_data = {
                    "character": next_speaker,
                    "action": action,
                    "type": message_type,
                    "voice_id": character_voice_id,
                    "character_info": character_info,
                    "turn": str(turn_count + 1)
                }
                
                actions.append(action_data)
                
                # 如果提供了回调函数，立即调用以实现流式返回
                if action_callback:
                    try:
                        await action_callback(action_data)
                    except Exception as e:
                        logger.error(f"回调函数执行失败: {e}")
                
                logger.info(f"轮次 {turn_count + 1}/{max_turns}: {next_speaker} 发言完成")
                
                # 检查是否满足阶段结束条件
                if self._should_end_phase(turn_count + 1, max_turns):
                    logger.info(f"{self.current_phase.value}阶段提前结束，满足结束条件")
                    break
                
                # 在行动之间添加短暂延迟，模拟真实对话
                await asyncio.sleep(1)
                
                last_speaker = next_speaker
                turn_count += 1
                
            except Exception as e:
                logger.error(f"Agent {next_speaker} 执行错误: {e}", exc_info=True)
                self.add_public_chat(
                    character=next_speaker, 
                    message="[思考中...]", 
                    message_type="system",
                    session_id=self.session_id
                )
                turn_count += 1
        
        logger.info(f"{self.current_phase.value}阶段结束，共进行了 {turn_count} 轮发言")
        return actions
    
    def _should_end_phase(self, current_turn: int, max_turns: int) -> bool:
        """根据标准剧本杀流程判断当前阶段是否应该提前结束"""
        
        # 基本条件：达到最大轮数
        if current_turn >= max_turns:
            return True
        
        # 角色介绍阶段：每个角色都完成轮流发言后结束
        if self.current_phase == GamePhaseEnum.INTRODUCTION:
            if self.conversation_flow_controller:
                introduced_count = sum(1 for freq in self.conversation_flow_controller.speaking_frequency.values() if freq > 0)
                return introduced_count >= len(self.agents)
        
        # 搜证调查阶段：发现大部分重要证据后可以结束
        elif self.current_phase == GamePhaseEnum.EVIDENCE_COLLECTION:
            if self.evidence_manager:
                discovered_evidence = self.evidence_manager.get_discovered_evidence()
                total_evidence = len(self.script_data.get("evidence", []))
                # 如果发现了75%以上的证据，可以考虑结束搜证
                if total_evidence > 0 and len(discovered_evidence) / total_evidence >= 0.75:
                    return True
        
        # 线索公开与调查阶段：确保充分的信息交换
        elif self.current_phase == GamePhaseEnum.INVESTIGATION:
            if self.conversation_flow_controller:
                # 检查是否每个角色都有机会发言
                spoken_count = sum(1 for freq in self.conversation_flow_controller.speaking_frequency.values() if freq > 0)
                if spoken_count >= len(self.agents) and current_turn >= len(self.agents) * 2:
                    # 每个角色都发言过，且进行了至少2轮交流
                    return True
        
        # 圆桌讨论阶段：核心推理环节，需要充分讨论
        elif self.current_phase == GamePhaseEnum.DISCUSSION:
            if self.conversation_flow_controller:
                # 检查讨论是否充分
                spoken_count = sum(1 for freq in self.conversation_flow_controller.speaking_frequency.values() if freq > 0)
                total_speeches = sum(self.conversation_flow_controller.speaking_frequency.values())
                
                # 每个角色都参与讨论，且总发言数达到一定数量
                if spoken_count >= len(self.agents) and total_speeches >= len(self.agents) * 3:
                    return True
        
        # 最终投票与陈述阶段：每个角色都完成投票后结束
        elif self.current_phase == GamePhaseEnum.VOTING:
            if self.conversation_flow_controller:
                voted_count = sum(1 for freq in self.conversation_flow_controller.speaking_frequency.values() if freq > 0)
                return voted_count >= len(self.agents)
        
        return False
    
    async def process_voting(self):
        """处理投票阶段"""
        if self.current_phase != GamePhaseEnum.VOTING:
            return
            
        if self.voting_manager is None:
            logger.error("投票管理器未初始化")
            return
            
        # 简单的投票逻辑，实际应该解析AI的投票内容
        import random
        for agent_name in self.agents.keys():
            # 这里应该解析AI的投票，暂时随机
            suspects = [name for name in self.agents.keys() if name != agent_name]
            if suspects:  # 确保有可投票的对象
                vote = random.choice(suspects)
                self.voting_manager.add_vote(agent_name, vote)
        
        self.game_state["votes"] = self.voting_manager.votes
    
    def get_game_result(self) -> Dict[str, Any]:
        """获取游戏结果"""
        if self.voting_manager is None:
            return {"error": "投票管理器未初始化"}
        return self.voting_manager.get_game_result()