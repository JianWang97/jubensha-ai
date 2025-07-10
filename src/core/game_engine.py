"""游戏引擎核心模块"""
import asyncio
import json
from typing import Dict, List, Optional

from ..models import Character, GameEvent, GamePhase
from ..agents import AIAgent
from .script_repository import script_repository
from .evidence_manager import EvidenceManager
from .voting_manager import VotingManager
from .voice_manager import VoiceManager
import logging

logger = logging.getLogger(__name__)

class GameEngine:
    """剧本杀游戏引擎"""
    
    def __init__(self, script_id: Optional[int] = None):
        self.script_id = script_id
        self.script_data = None
        self.characters = []
        self.agents = {}
        self.current_phase = GamePhase.BACKGROUND
        self.events = []
        
        # 初始化管理器（稍后在load_script_data中设置）
        self.evidence_manager = None
        self.voting_manager = None
        self.voice_manager = VoiceManager()
        
        # 游戏状态
        self.public_chat = []
        self.game_state = {
            "phase": self.current_phase.value,
            "events": self.events,
            "characters": [],
            "votes": {},
            "evidence": [],
            "discovered_evidence": [],
            "public_chat": self.public_chat
        }
    
    async def load_script_data(self, script_id: int):
        """从数据库加载剧本数据"""
        self.script_id = script_id
        
        # 获取剧本基本信息
        script = await script_repository.get_script_by_id(script_id)
        logger.info(f"加载剧本数据: {script}")
        if not script:
            raise ValueError(f"未找到剧本ID: {script_id}")
        
        # 获取完整的剧本数据
        full_script = await script_repository.get_script_by_id(script_id)
        if not full_script:
            raise ValueError(f"未找到剧本ID: {script_id}")
        
        # 从完整剧本对象中提取数据
        characters = [{
            'id': char.id,
            'name': char.name,
            'background': char.background,
            'gender': char.gender,
            'age': char.age,
            'profession': char.profession,
            'secret': char.secret,
            'objective': char.objective,
            'is_victim': char.is_victim,
            'is_murderer': char.is_murderer,
            'personality_traits': char.personality_traits
        } for char in full_script.characters]
        
        evidence = [{
            'id': ev.id,
            'name': ev.name,
            'description': ev.description,
            'location': ev.location,
            'related_to': ev.related_to,
            'significance': ev.significance,
            'type': ev.evidence_type.value,
            'importance': ev.importance
        } for ev in full_script.evidence]
        
        locations = [{
            'id': loc.id,
            'name': loc.name,
            'description': loc.description,
            'searchable_items': loc.searchable_items,
            'is_crime_scene': loc.is_crime_scene
        } for loc in full_script.locations]
        
        background_story = full_script.background_story
        game_phases = full_script.game_phases
        
        # 组装剧本数据
        self.script_data = {
            "script_info": {
                "title": full_script.info.title,
                "description": full_script.info.description,
                "player_count": full_script.info.player_count,
                "difficulty": full_script.info.difficulty,
                "estimated_time": full_script.info.duration_minutes,
                "tags": full_script.info.tags
            },
            "characters": characters,
            "evidence": evidence,
            "locations": locations,
            "background_story": background_story,
            "game_phases": game_phases
        }
        
        # 初始化游戏组件
        self.characters = self._init_characters()
        self.evidence_manager = EvidenceManager(self.script_data["evidence"])
        self.voting_manager = VotingManager(self.characters)
        
        # 更新游戏状态
        self.game_state.update({
            "characters": [char.name for char in self.characters],
            "evidence": self.script_data["evidence"]
        })
    
    def _init_characters(self) -> List[Character]:
        """初始化角色"""
        characters = []
        
        for char_data in self.script_data["characters"]:
            # 跳过受害者，受害者不参与游戏
            if char_data.get("is_victim", False):
                continue
                
            character = Character(
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
                voice_preference=char_data.get("voice_preference")
            )
            characters.append(character)
            
        return characters
    
    def get_script_info(self) -> Dict:
        """获取剧本基本信息"""
        return self.script_data["script_info"]
    
    def get_game_phases_info(self) -> List[Dict]:
        """获取游戏阶段信息"""
        return self.script_data["game_phases"]
    
    def get_background_story(self) -> Dict:
        """获取背景故事信息"""
        return self.script_data.get("background_story", {})
    
    def get_voice_mapping(self) -> Dict[str, str]:
        """获取角色声音映射"""
        return self.voice_manager.get_voice_mapping(self.characters)
    
    def get_voice_assignment_info(self) -> Dict[str, Dict]:
        """获取声音分配详细信息"""
        return self.voice_manager.get_assignment_info()
    
    async def initialize_agents(self):
        """初始化AI代理"""
        for character in self.characters:
            if not character.is_victim:
                self.agents[character.name] = AIAgent(character)
    
    async def next_phase(self):
        """进入下一个游戏阶段"""
        phases = list(GamePhase)
        current_index = phases.index(self.current_phase)
        if current_index < len(phases) - 1:
            self.current_phase = phases[current_index + 1]
            self.game_state["phase"] = self.current_phase.value
            
            # 添加阶段转换事件
            self.add_event("系统", f"游戏进入{self.current_phase.value}阶段")
    
    def add_event(self, character: str, content: str):
        """添加游戏事件"""
        event = GameEvent(
            type="action",
            character=character,
            content=content,
            timestamp=asyncio.get_event_loop().time()
        )
        self.events.append(event.__dict__)
        self.game_state["events"] = self.events
    
    def add_public_chat(self, character: str, message: str, message_type: str = "chat"):
        """添加公开聊天信息"""
        chat_entry = {
            "character": character,
            "message": message,
            "type": message_type,  # chat, question, answer, accusation, defense
            "timestamp": asyncio.get_event_loop().time()
        }
        self.public_chat.append(chat_entry)
        self.game_state["public_chat"] = self.public_chat
        
        # 同时添加到events中保持兼容性
        self.add_event(character, message)
    
    def get_recent_public_chat(self, limit: int = 15) -> List[Dict]:
        """获取最近的公开聊天记录"""
        return self.public_chat[-limit:] if self.public_chat else []
    
    async def run_phase(self) -> List[Dict]:
        """运行当前阶段，返回所有AI的行动"""
        actions = []
        
        if self.current_phase == GamePhase.ENDED:
            return actions
        
        # 背景介绍阶段由系统叙述，不需要AI发言
        if self.current_phase == GamePhase.BACKGROUND:
            background = self.get_background_story()
            if background and isinstance(background, dict):
                # 添加背景故事的各个部分
                story_parts = [
                    f"【{background.get('title', '案件背景')}】",
                    f"现场情况：{background.get('setting_description', '暂无相关信息')}",
                    f"案件经过：{background.get('incident_description', '暂无相关信息')}",
                    f"死者背景：{background.get('victim_background', '暂无相关信息')}",
                    f"调查范围：{background.get('investigation_scope', '暂无相关信息')}",
                    f"游戏规则：{background.get('rules_reminder', '暂无相关信息')}"
                ]
                
                for part in story_parts:
                    # 确保part是字符串类型
                    if not isinstance(part, str):
                        continue
                        
                    # 检查内容是否为空或None
                    content = part.split('：', 1)[-1] if '：' in part else part
                    if content and content.strip() and content != '暂无相关信息' and content != 'None':
                        self.add_public_chat("系统", part, "background")
                        actions.append({
                            "character": "系统",
                            "action": part,  # 确保这里传递的是字符串
                            "type": "background"
                        })
                        await asyncio.sleep(2)  # 每部分之间的延迟
                    else:
                        # 如果内容为空或是默认值，显示提示信息
                        part_name = part.split('：')[0] if '：' in part else part
                        placeholder_text = f"{part_name}：暂无相关信息"
                        self.add_public_chat("系统", placeholder_text, "background")
                        actions.append({
                            "character": "系统",
                            "action": placeholder_text,  # 确保这里传递的是字符串
                            "type": "background"
                        })
                        await asyncio.sleep(2)
            elif background:
                # 如果background不是字典，可能是字符串或其他类型，需要处理
                import json
                if isinstance(background, str):
                    try:
                        # 尝试解析JSON字符串
                        background_dict = json.loads(background)
                        if isinstance(background_dict, dict):
                            background = background_dict
                        else:
                            # 如果不是字典，直接显示错误信息
                            error_msg = "背景信息格式错误，请联系管理员"
                            self.add_public_chat("系统", error_msg, "background")
                            actions.append({
                                "character": "系统",
                                "action": error_msg,
                                "type": "background"
                            })
                    except json.JSONDecodeError:
                        # JSON解析失败，直接显示原始字符串（但这不应该发生）
                        error_msg = "背景信息解析失败，请联系管理员"
                        self.add_public_chat("系统", error_msg, "background")
                        actions.append({
                            "character": "系统",
                            "action": error_msg,
                            "type": "background"
                        })
                else:
                    # 其他类型，显示错误信息
                    error_msg = "背景信息类型错误，请联系管理员"
                    self.add_public_chat("系统", error_msg, "background")
                    actions.append({
                        "character": "系统",
                        "action": error_msg,
                        "type": "background"
                    })
            
            return actions
            
        # 让每个AI代理依次行动
        for agent_name, agent in self.agents.items():
            try:
                action = await agent.think_and_act(self.game_state, self.current_phase)
                
                # 根据阶段确定消息类型
                message_type = "chat"
                if self.current_phase == GamePhase.INVESTIGATION:
                    message_type = "question" if "?" in action or "吗" in action or "呢" in action else "answer"
                elif self.current_phase == GamePhase.DISCUSSION:
                    message_type = "accusation" if "觉得" in action and "是" in action else "discussion"
                elif self.current_phase == GamePhase.VOTING:
                    message_type = "vote"
                
                # 使用公开聊天系统记录
                self.add_public_chat(agent_name, action, message_type)
                
                # 搜证阶段处理证据发现
                if self.current_phase == GamePhase.EVIDENCE_COLLECTION:
                    discovered = self.evidence_manager.process_evidence_search(action, agent_name)
                    if discovered:
                        self.add_public_chat("系统", f"{agent_name}发现了证据：{discovered['name']}", "system")
                        self.game_state["discovered_evidence"] = self.evidence_manager.get_discovered_evidence()
                
                actions.append({
                    "character": agent_name,
                    "action": action,
                    "type": message_type
                })
                
                # 在行动之间添加短暂延迟，模拟真实对话
                await asyncio.sleep(1)
                
            except Exception as e:
                print(f"Agent {agent_name} error: {e}")
                self.add_public_chat(agent_name, "[思考中...]", "system")
        
        return actions
    
    async def process_voting(self):
        """处理投票阶段"""
        if self.current_phase != GamePhase.VOTING:
            return
            
        # 简单的投票逻辑，实际应该解析AI的投票内容
        for agent_name in self.agents.keys():
            # 这里应该解析AI的投票，暂时随机
            import random
            suspects = [name for name in self.agents.keys() if name != agent_name]
            vote = random.choice(suspects)
            self.voting_manager.add_vote(agent_name, vote)
        
        self.game_state["votes"] = self.voting_manager.votes
    
    def get_game_result(self) -> Dict:
        """获取游戏结果"""
        return self.voting_manager.get_game_result()