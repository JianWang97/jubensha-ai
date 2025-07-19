from typing import List, Dict, Any, Optional
import asyncio
import random
import logging
from datetime import datetime

from src.schemas.script import GamePhaseEnum as GamePhase
from src.services.llm_service import LLMService, LLMMessage
from src.core.config import config

logger = logging.getLogger(__name__)

class ConversationFlowController:
    """对话流控制器 - 智能安排下一个说话的角色，模拟现实中的自然接话场景"""
    
    def __init__(self, characters=None):
        self.llm_service = LLMService.from_config(config.llm_config)
        self.last_speaker = None
        self.conversation_history = []
        self.speaking_frequency = {}  # 记录每个角色的发言频率
        self.characters = characters or []
        
    def reset_for_new_phase(self, phase: GamePhase):
        """为新阶段重置状态"""
        self.last_speaker = None
        self.conversation_history = []
        self.speaking_frequency = {}
        
    async def select_next_speaker(self, 
                                 available_characters: List[str], 
                                 game_state: Dict[str, Any], 
                                 phase: GamePhase,
                                 recent_chat: List[Dict[str, Any]]) -> str:
        """智能选择下一个说话的角色"""
        
        if not available_characters:
            return None
            
        # 如果只有一个角色，直接返回
        if len(available_characters) == 1:
            return available_characters[0]
            
        # 更新发言频率统计
        for char in available_characters:
            if char not in self.speaking_frequency:
                self.speaking_frequency[char] = 0
                
        # 根据不同阶段使用不同的选择策略
        if phase == GamePhase.INTRODUCTION:
            return self._select_for_introduction(available_characters)
        elif phase == GamePhase.EVIDENCE_COLLECTION:
            return self._select_for_evidence_collection(available_characters, game_state)
        elif phase == GamePhase.INVESTIGATION:
            return await self._select_for_investigation(available_characters, recent_chat, game_state)
        elif phase == GamePhase.DISCUSSION:
            return await self._select_for_discussion(available_characters, recent_chat, game_state)
        elif phase == GamePhase.VOTING:
            return self._select_for_voting(available_characters)
        else:
            return self._select_randomly_with_balance(available_characters)
            
    def _select_for_introduction(self, available_characters: List[str]) -> str:
        """自我介绍阶段：随机顺序，但确保每个人都有机会"""
        # 优先选择还没说过话的角色
        unspoken = [char for char in available_characters if self.speaking_frequency.get(char, 0) == 0]
        if unspoken:
            return random.choice(unspoken)
        return random.choice(available_characters)
        
    def _select_for_evidence_collection(self, available_characters: List[str], game_state: Dict[str, Any]) -> str:
        """搜证阶段：优先选择还没搜证过的角色"""
        # 检查谁还没有进行过搜证
        discovered_evidence = game_state.get("discovered_evidence", [])
        searchers = {ev.get("discoverer", "") for ev in discovered_evidence}
        
        unsearched = [char for char in available_characters if char not in searchers]
        if unsearched:
            return random.choice(unsearched)
            
        # 如果都搜证过了，选择发言频率最低的
        return min(available_characters, key=lambda x: self.speaking_frequency.get(x, 0))
        
    async def _select_for_investigation(self, 
                                       available_characters: List[str], 
                                       recent_chat: List[Dict[str, Any]], 
                                       game_state: Dict[str, Any]) -> str:
        """调查阶段：基于对话内容智能选择最合适的提问者"""
        
        if not recent_chat:
            return self._select_randomly_with_balance(available_characters)
            
        # 使用LLM分析谁最适合接话
        try:
            context = self._build_conversation_context(recent_chat, available_characters, game_state)
            
            system_prompt = """
你是一个剧本杀游戏的对话流控制器。你的任务是分析当前对话情况，选择最合适的角色来接话。

选择原则：
1. 如果有人被直接提问，优先让被提问者回答
2. 如果有人提到了某个角色，该角色应该有机会回应
3. 如果出现了新的线索或证据，相关角色应该发言
4. 避免同一个角色连续发言太多次
5. 确保每个角色都有发言机会

请只返回一个角色名字，不要有任何其他内容。
"""
            
            messages = [
                LLMMessage(role="system", content=system_prompt),
                LLMMessage(role="user", content=context)
            ]
            
            response = await self.llm_service.chat_completion(messages)
            selected_character = response.content.strip() if response and response.content else None
            
            # 验证选择的角色是否有效
            if selected_character and selected_character in available_characters:
                logger.info(f"LLM选择下一个发言者: {selected_character}")
                return selected_character
            else:
                logger.warning(f"LLM选择的角色无效: {selected_character}，使用备选方案")
                
        except Exception as e:
            logger.error(f"LLM选择发言者失败: {e}")
            
        # 备选方案：基于规则选择
        return self._select_based_on_conversation_rules(available_characters, recent_chat)
        
    async def _select_for_discussion(self, 
                                    available_characters: List[str], 
                                    recent_chat: List[Dict[str, Any]], 
                                    game_state: Dict[str, Any]) -> str:
        """讨论阶段：选择最有话要说的角色"""
        # 与调查阶段类似，但更注重推理和反驳
        return await self._select_for_investigation(available_characters, recent_chat, game_state)
        
    def _select_for_voting(self, available_characters: List[str]) -> str:
        """投票阶段：确保每个人都投票"""
        # 优先选择还没投票的角色
        unvoted = [char for char in available_characters if self.speaking_frequency.get(char, 0) == 0]
        if unvoted:
            return random.choice(unvoted)
        return random.choice(available_characters)
        
    def _select_randomly_with_balance(self, available_characters: List[str]) -> str:
        """随机选择，但平衡发言频率"""
        # 计算权重：发言次数越少，权重越高
        max_frequency = max(self.speaking_frequency.get(char, 0) for char in available_characters)
        weights = []
        
        for char in available_characters:
            frequency = self.speaking_frequency.get(char, 0)
            # 权重 = 最大频率 - 当前频率 + 1
            weight = max_frequency - frequency + 1
            weights.append(weight)
            
        # 加权随机选择
        return random.choices(available_characters, weights=weights)[0]
        
    def _select_based_on_conversation_rules(self, available_characters: List[str], recent_chat: List[Dict[str, Any]]) -> str:
        """基于对话规则选择发言者"""
        if not recent_chat:
            return self._select_randomly_with_balance(available_characters)
            
        last_message = recent_chat[-1]
        last_speaker = last_message.get("character", "")
        last_content = last_message.get("message", "")
        
        # 规则1：如果有人被直接提问，优先让被提问者回答
        for char in available_characters:
            if char in last_content and ("?" in last_content or "吗" in last_content or "呢" in last_content):
                return char
                
        # 规则2：避免同一个人连续发言
        if last_speaker in available_characters:
            other_characters = [char for char in available_characters if char != last_speaker]
            if other_characters:
                return self._select_randomly_with_balance(other_characters)
                
        # 规则3：默认平衡选择
        return self._select_randomly_with_balance(available_characters)
        
    def _build_conversation_context(self, recent_chat: List[Dict[str, Any]], 
                                   available_characters: List[str], 
                                   game_state: Dict[str, Any]) -> str:
        """构建对话上下文供LLM分析"""
        context = f"可选择的角色：{', '.join(available_characters)}\n\n"
        context += "最近的对话：\n"
        
        # 只取最近5条对话
        for chat in recent_chat[-5:]:
            character = chat.get("character", "未知")
            message = chat.get("message", "")
            context += f"{character}: {message}\n"
            
        context += "\n发言频率统计：\n"
        for char in available_characters:
            frequency = self.speaking_frequency.get(char, 0)
            context += f"{char}: {frequency}次\n"
            
        context += "\n请选择最合适的下一个发言者："
        return context
        
    def record_speaker(self, character: str):
        """记录角色发言"""
        if character not in self.speaking_frequency:
            self.speaking_frequency[character] = 0
        self.speaking_frequency[character] += 1
        self.last_speaker = character
        
    def get_speaking_stats(self) -> Dict[str, int]:
        """获取发言统计"""
        return self.speaking_frequency.copy()
        
    async def get_speaking_order(self, phase: GamePhase, recent_chat: List[Dict[str, Any]]) -> List[str]:
        """获取本轮的发言顺序"""
        # 获取可用角色（排除受害者）
        available_characters = []
        for char in self.characters:
            char_name = char.name if hasattr(char, 'name') else str(char)
            is_victim = getattr(char, 'is_victim', False) if hasattr(char, 'is_victim') else False
            if not is_victim:
                available_characters.append(char_name)
                
        if not available_characters:
            return []
            
        # 根据阶段决定发言人数和策略
        if phase == GamePhase.INTRODUCTION:
            # 自我介绍阶段：所有人都要发言
            return self._get_introduction_order(available_characters)
        elif phase == GamePhase.EVIDENCE_COLLECTION:
            # 搜证阶段：每轮1-2个人发言
            return await self._get_evidence_collection_order(available_characters, recent_chat)
        elif phase == GamePhase.INVESTIGATION:
            # 调查阶段：每轮2-3个人发言（问答形式）
            return await self._get_investigation_order(available_characters, recent_chat)
        elif phase == GamePhase.DISCUSSION:
            # 讨论阶段：每轮3-4个人发言（更多互动）
            return await self._get_discussion_order(available_characters, recent_chat)
        elif phase == GamePhase.VOTING:
            # 投票阶段：所有人都要投票
            return self._get_voting_order(available_characters)
        else:
            # 其他阶段：默认顺序
            return available_characters
            
    def _get_introduction_order(self, available_characters: List[str]) -> List[str]:
        """自我介绍阶段的发言顺序"""
        # 随机打乱顺序，让每次游戏都不一样
        order = available_characters.copy()
        random.shuffle(order)
        return order
        
    async def _get_evidence_collection_order(self, available_characters: List[str], recent_chat: List[Dict[str, Any]]) -> List[str]:
        """搜证阶段的发言顺序"""
        # 每轮选择1-2个角色进行搜证
        num_speakers = min(2, len(available_characters))
        speakers = []
        
        for _ in range(num_speakers):
            remaining = [char for char in available_characters if char not in speakers]
            if not remaining:
                break
                
            next_speaker = await self.select_next_speaker(
                remaining, {}, GamePhase.EVIDENCE_COLLECTION, recent_chat
            )
            if next_speaker:
                speakers.append(next_speaker)
                
        return speakers
        
    async def _get_investigation_order(self, available_characters: List[str], recent_chat: List[Dict[str, Any]]) -> List[str]:
        """调查阶段的发言顺序"""
        # 每轮选择2-3个角色进行问答
        num_speakers = min(3, len(available_characters))
        speakers = []
        
        for _ in range(num_speakers):
            remaining = [char for char in available_characters if char not in speakers]
            if not remaining:
                break
                
            next_speaker = await self.select_next_speaker(
                remaining, {}, GamePhase.INVESTIGATION, recent_chat
            )
            if next_speaker:
                speakers.append(next_speaker)
                
        return speakers
        
    async def _get_discussion_order(self, available_characters: List[str], recent_chat: List[Dict[str, Any]]) -> List[str]:
        """讨论阶段的发言顺序"""
        # 每轮选择3-4个角色进行讨论
        num_speakers = min(4, len(available_characters))
        speakers = []
        
        for _ in range(num_speakers):
            remaining = [char for char in available_characters if char not in speakers]
            if not remaining:
                break
                
            next_speaker = await self.select_next_speaker(
                remaining, {}, GamePhase.DISCUSSION, recent_chat
            )
            if next_speaker:
                speakers.append(next_speaker)
                
        return speakers
        
    def _get_voting_order(self, available_characters: List[str]) -> List[str]:
        """投票阶段的发言顺序"""
        # 投票阶段所有人都要发言
        order = available_characters.copy()
        random.shuffle(order)
        return order