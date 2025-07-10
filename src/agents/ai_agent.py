"""AI代理模块"""
from typing import Dict
import os
import logging

from ..models import Character, GamePhase
from ..services import LLMService
from ..services.llm_service import LLMMessage
from ..core.config import config

# 配置日志
logger = logging.getLogger(__name__)

class AIAgent:
    """AI角色代理"""
    
    def __init__(self, character: Character, api_key: str = None):
        self.character = character
        
        # 使用新的LLM服务抽象层
        if api_key:
            # 兼容旧的API，临时更新配置
            os.environ["OPENAI_API_KEY"] = api_key
        
        self.llm_service = LLMService.from_config(config.llm_config)
        self.memory = []
        
    async def think_and_act(self, game_state: Dict, phase: GamePhase) -> str:
        """根据当前游戏状态和阶段，AI角色进行思考和行动"""
        system_prompt = self._get_system_prompt(phase)
        context = self._build_context(game_state, phase)
        
        # 记录AI输入日志
        logger.info(f"[{self.character.name}] AI输入 - 阶段: {phase.value}")
        logger.info(f"[{self.character.name}] 系统提示词: {system_prompt}")
        logger.info(f"[{self.character.name}] 上下文: {context}")
        
        messages = [
            LLMMessage(role="system", content=system_prompt),
            LLMMessage(role="user", content=context)
        ]
        
        try:
            response = await self.llm_service.chat_completion(messages)
            action = response.content if response and response.content else "我需要仔细想想..."
        except Exception as e:
            logger.error(f"[{self.character.name}] LLM调用失败: {e}")
            action = "我现在有点困惑，让我整理一下思路..."
        
        # 记录AI输出日志
        logger.info(f"[{self.character.name}] AI输出: {action}")
        
        # 记录到记忆中
        self.memory.append({
            "phase": phase.value,
            "context": context,
            "action": action
        })
        
        return action
    
    def _get_system_prompt(self, phase: GamePhase) -> str:
        """获取系统提示词，现在只包含角色和通用表达要求"""
        character_info = f"角色背景：{self.character.background}"
        if self.character.secret:
            character_info += f"\n角色秘密：{self.character.secret}"
        if self.character.objective:
            character_info += f"\n角色目标：{self.character.objective}"

        if self.character.personality_traits:
            traits = '、'.join(self.character.personality_traits)
            character_info += f"\n你的性格是：{traits}。请在对话中体现出这些性格特征。"

        base_prompt = f"""
你是剧本杀游戏中的角色：{self.character.name}

{character_info}

重要表达要求：
1. **角色扮演**: 深度沉浸在你的角色中，完全以角色的身份和性格来说话，不要有任何旁观者或AI的视角。
2. **自然口语**: 使用自然、口语化的表达，就像真人在现场对话一样。
3. **避免内心独白**: 绝对不要说出角色的内心想法、计划或策略。只说角色会公开说出的话。
4. **简洁有力**: 避免长篇大论，让语言简练、有重点。
5. **情绪表达**: 根据当前情况和角色性格，自然地流露出情绪。
6. **互动与回应**: 仔细听其他人的发言，并作出符合角色逻辑和动机的回应。

{'你是凶手，需要隐藏真相并误导其他人，但要表现得自然。' if self.character.is_murderer else ''}
{'你是受害者，已经死亡，无法参与游戏。' if self.character.is_victim else ''}
"""
        return base_prompt
    
    def _build_context(self, game_state: Dict, phase: GamePhase) -> str:
        """构建游戏上下文，并将阶段任务指令放在最前面"""
        phase_prompts = {
            GamePhase.BACKGROUND: "现在是背景介绍阶段。你需要保持沉默，等待系统介绍完毕。",
            GamePhase.INTRODUCTION: "现在是【自我介绍】阶段。请用自然的口吻介绍你的身份背景，不要透露秘密。",
            GamePhase.EVIDENCE_COLLECTION: "现在是【搜证】阶段。请说出你想搜查的一个地点或物品。绝对不要说内心想法或策略。",
            GamePhase.INVESTIGATION: "现在是【调查】阶段。请根据已有信息，向某位玩家提出一个具体问题，以推进调查。",
            GamePhase.DISCUSSION: "现在是【讨论】阶段。请分享你的一个推理或反驳某人的观点，并给出证据支持。",
            GamePhase.VOTING: "现在是【投票】阶段。请指认你认为是凶手的玩家，并说明你的核心理由。",
            GamePhase.REVELATION: "现在是【真相揭晓】阶段。请根据你的结局，分享你的最终想法或秘密。"
        }

        task_instruction = phase_prompts.get(phase, "请根据当前情况做出回应。")
        
        # 将核心任务指令放在最前面，并用醒目的格式突出
        context = f"""【当前阶段：{phase.value}】

**=== 你的核心任务 ===**
{task_instruction}
**====================**

"""

        # 根据阶段提供不同的上下文信息
        if phase == GamePhase.EVIDENCE_COLLECTION:
            context += "**你可以搜查的地点：**\n"
            discovered_ids = {e['id'] for e in game_state.get("discovered_evidence", [])}
            searchable_locations = {ev['location'] for ev in game_state.get("evidence", []) if ev['id'] not in discovered_ids}

            if searchable_locations:
                for location in sorted(list(searchable_locations)):
                    context += f"- {location}\n"
            else:
                context += "所有地点都已搜查完毕。\n"
            context += "\n"
        else:
            # 在非搜证阶段，明确告知不能搜证
            context += "**注意：当前不是搜证阶段，绝对禁止提出任何搜证要求。**\n\n"

        # 显示已发现的证据
        if game_state.get("discovered_evidence"):
            context += "**已发现的全部证据：**\n"
            for evidence in game_state["discovered_evidence"]:
                context += f"- {evidence['name']}：{evidence['description']}\n"
            context += "\n"
        
        # 显示公开聊天记录
        if "public_chat" in game_state and game_state["public_chat"]:
            context += "**最近的公开对话：**\n"
            recent_chats = game_state["public_chat"][-12:]
            for chat in recent_chats:
                context += f"{chat.get('character', '未知')}: {chat.get('message', '')}\n"
            context += "\n"

        context += "请严格按照你的核心任务进行回应，只说角色会说的话。"
        return context