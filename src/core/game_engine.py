"""游戏引擎核心模块"""
import asyncio
from typing import Dict, List

from ..models import Character, GameEvent, GamePhase
from ..agents import AIAgent
from ..utils import ScriptLoader
from .evidence_manager import EvidenceManager
from .voting_manager import VotingManager

class GameEngine:
    """剧本杀游戏引擎"""
    
    def __init__(self, script_file: str = "script_data.json"):
        # 加载剧本数据
        self.script_data = ScriptLoader.load_script_data(script_file)
        ScriptLoader.validate_script_data(self.script_data)
        
        # 初始化游戏组件
        self.characters = self._init_characters()
        self.agents = {}
        self.current_phase = GamePhase.INTRODUCTION
        self.events = []
        
        # 初始化管理器
        self.evidence_manager = EvidenceManager(self.script_data["evidence"])
        self.voting_manager = VotingManager(self.characters)
        
        # 游戏状态
        self.public_chat = []  # 公开聊天记录，所有agent共享
        self.game_state = {
            "phase": self.current_phase.value,
            "events": self.events,
            "characters": [char.name for char in self.characters],
            "votes": {},
            "evidence": self.script_data["evidence"],
            "discovered_evidence": [],
            "public_chat": self.public_chat
        }
    
    def _init_characters(self) -> List[Character]:
        """初始化角色"""
        characters = []
        
        for char_data in self.script_data["characters"]:
            # 跳过受害者，受害者不参与游戏
            if char_data.get("is_victim", False):
                continue
                
            character = Character(
                name=char_data["name"],
                background=char_data["background"],
                secret=char_data["secret"],
                objective=char_data["objective"],
                is_murderer=char_data.get("is_murderer", False),
                is_victim=char_data.get("is_victim", False)
            )
            characters.append(character)
            
        return characters
    
    def get_script_info(self) -> Dict:
        """获取剧本基本信息"""
        return self.script_data["script_info"]
    
    def get_game_phases_info(self) -> List[Dict]:
        """获取游戏阶段信息"""
        return self.script_data["game_phases"]
    
    async def initialize_agents(self, api_key: str):
        """初始化AI代理"""
        for character in self.characters:
            if not character.is_victim:
                self.agents[character.name] = AIAgent(character, api_key)
    
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