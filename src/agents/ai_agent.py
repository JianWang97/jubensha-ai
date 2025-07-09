"""AI代理模块"""
from typing import Dict
import os

from ..models import Character, GamePhase
from ..services import LLMService
from ..services.llm_service import LLMMessage
from ..core.config import config

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
        
        messages = [
            LLMMessage(role="system", content=system_prompt),
            LLMMessage(role="user", content=context)
        ]
        
        response = await self.llm_service.chat_completion(messages)
        action = response.content
        
        # 记录到记忆中
        self.memory.append({
            "phase": phase.value,
            "context": context,
            "action": action
        })
        
        return action
    
    def _get_system_prompt(self, phase: GamePhase) -> str:
        """获取系统提示词"""
        base_prompt = f"""
你是剧本杀游戏中的角色：{self.character.name}

角色背景：{self.character.background}
角色秘密：{self.character.secret}
角色目标：{self.character.objective}

重要表达要求：
1. 只说出角色会说的话，绝对不要表达内心想法或独白
2. 用自然口语化的表达，就像真人在说话
3. 可以使用"..."表示停顿或犹豫
4. 适当使用语气词如"嗯"、"啊"、"呃"等表达情感
5. 用"!"表示强调或惊讶
6. 保持简洁，避免长篇大论
7. 根据情况表现紧张、疑惑、愤怒等情绪

{'你是凶手，需要隐藏真相并误导其他人，但要表现得自然。' if self.character.is_murderer else ''}
{'你是受害者，已经死亡，无法参与游戏。' if self.character.is_victim else ''}
"""
        
        phase_prompts = {
            GamePhase.BACKGROUND: "现在是背景介绍阶段。你需要保持沉默，不要发言。这个阶段由系统介绍案件背景。",
            GamePhase.INTRODUCTION: "现在是自我介绍阶段。用自然的口吻简单介绍自己，就像第一次见面打招呼一样。可以稍微紧张或客套，但不要透露秘密。",
            GamePhase.EVIDENCE_COLLECTION: "现在是搜证阶段。说出你想搜查的地方，就像真的在现场一样。可以表现出好奇、紧张或发现线索时的惊讶，但别说出内心的计算。",
            GamePhase.INVESTIGATION: "现在是调查阶段。仔细阅读公开对话记录，看看其他人说了什么。你可以针对别人的话提问、质疑或补充信息。像普通人一样对话，表现疑惑、担心或恍然大悟。",
            GamePhase.DISCUSSION: "现在是讨论阶段。根据公开对话记录中其他人的发言，分享你的看法。可以回应别人的观点、提出反驳或表示赞同。像平时聊天一样争论、质疑或附和。",
            GamePhase.VOTING: "现在是投票阶段。综合考虑公开对话中所有人的发言和表现，说出你的选择和简单理由。可以犹豫、坚定或无奈，就像真的要做重要决定一样。",
            GamePhase.REVELATION: "现在是揭晓阶段。如果你有秘密要说，就自然地说出来，可以表现解脱、紧张或其他真实情感。"
        }
        
        return base_prompt + "\n\n" + phase_prompts.get(phase, "")
    
    def _build_context(self, game_state: Dict, phase: GamePhase) -> str:
        """构建游戏上下文"""
        context = f"当前游戏阶段：{phase.value}\n\n"
        
        # 搜证阶段显示可搜查的地点
        if phase == GamePhase.EVIDENCE_COLLECTION:
            context += "可搜查的地点和物品：\n"
            for evidence in game_state.get("evidence", []):
                if evidence["id"] not in [e["id"] for e in game_state.get("discovered_evidence", [])]:
                    context += f"- {evidence['location']}\n"
            context += "\n"
        
        # 其他阶段显示已发现的证据
        elif game_state.get("discovered_evidence"):
            context += "已发现的证据：\n"
            for evidence in game_state["discovered_evidence"]:
                context += f"- {evidence['name']}：{evidence['description']}\n"
            context += "\n"
        
        # 显示公开聊天记录，让AI能看到其他角色的发言
        if "public_chat" in game_state and game_state["public_chat"]:
            context += "公开对话记录：\n"
            recent_chats = game_state["public_chat"][-12:]  # 显示最近12条对话
            for chat in recent_chats:
                chat_type = chat.get('type', 'chat')
                character = chat['character']
                message = chat['message']
                
                # 根据消息类型添加标识
                if chat_type == 'question':
                    context += f"{character}（提问）: {message}\n"
                elif chat_type == 'accusation':
                    context += f"{character}（指控）: {message}\n"
                elif chat_type == 'vote':
                    context += f"{character}（投票）: {message}\n"
                elif chat_type == 'system':
                    context += f"[系统]: {message}\n"
                else:
                    context += f"{character}: {message}\n"
            context += "\n"
        elif "events" in game_state:
            context += "游戏历史：\n"
            for event in game_state["events"][-10:]:  # 只显示最近10个事件
                context += f"{event['character']}: {event['content']}\n"
        
        context += "\n请用自然的口语回应，就像真人在现场说话一样。记住：只说角色会说的话，不要表达内心想法！"
        return context