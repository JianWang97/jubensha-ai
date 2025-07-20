"""AI代理模块"""
from typing import Dict
import os
import logging

from ..schemas.script import ScriptCharacter as Character, GamePhaseEnum as GamePhase
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
        self.memory: list[dict[str, str]] = []
        
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

        # 根据阶段调整凶手的行为指令
        murderer_instruction = ""
        if self.character.is_murderer:
            if phase == GamePhase.REVELATION:
                murderer_instruction = "你是凶手，在真相复盘阶段应该诚实坦白，详细说明作案过程和动机。"
            else:
                murderer_instruction = "你是凶手，需要隐藏真相并误导其他人，但要表现得自然。"
        
        victim_instruction = "你是受害者，已经死亡，无法参与游戏。" if self.character.is_victim else ""
        
        base_prompt = f"""
你是剧本杀游戏中的角色：{self.character.name}

{character_info}

重要表达要求：
1. **角色扮演**: 深度沉浸在你的角色中，完全以角色的身份和性格来说话，不要有任何旁观者或AI的视角。
2. **自然口语**: 使用自然、口语化的表达，就像真人在现场对话一样。
3. **避免内心独白**: 绝对不要说出角色的内心想法、计划或策略。只说角色会公开说出的话。
4. **简洁有力**: 避免长篇大论，让语言简练、有重点。
5. **情绪表达**: 根据当前情况和角色性格，自然地流露出情绪。
6. **个性化表达**: 绝对不要直接重复或模仿其他人的话。要结合自己的性格和立场来表达观点。如果确实同意某人观点，可以说"我同意XXX的观点"，但要加上自己的理由或补充。
7. **独立思考**: 每次发言都要体现你角色的独特视角和思考方式，避免千篇一律的表达。

{murderer_instruction}
{victim_instruction}
"""
        return base_prompt
    
    def _build_context(self, game_state: Dict, phase: GamePhase) -> str:
        """构建游戏上下文，并将阶段任务指令放在最前面"""
        phase_prompts = {
            GamePhase.BACKGROUND: "现在是背景介绍阶段。你需要保持沉默，等待系统介绍完毕。",
            GamePhase.INTRODUCTION: """
现在是【角色介绍】阶段 - 第一轮发言
你的任务：按照轮流发言的顺序，简洁介绍你的角色形象。

发言要点：
- 我是谁：介绍角色姓名、身份、与其他玩家的关系
- 我的时间线：简述案发前后的个人行动轨迹
- 我的视角：描述你了解的案件信息或发现的异常情况

注意事项：
- 此阶段不允许打断，按顺序完成发言
- 只说公开的身份信息，绝对不要透露秘密
- 如果你是凶手，需要进行伪装性发言隐藏身份
- 体现你的性格特点，为后续留下悬念
""",
            GamePhase.EVIDENCE_COLLECTION: """
现在是【搜证调查】阶段
你的任务：选择一个具体的地点或物品进行搜查，为后续线索公开做准备。

指令要求：
- 必须明确说出要搜查的地点名称（如"我要搜查书房"、"我检查一下花瓶"）
- 可以简要说明搜查理由，但不要透露过多策略
- 一次只能搜查一个地方
- 搜到的线索将在下一阶段公开展示
""",
            GamePhase.INVESTIGATION: """
现在是【线索公开与调查】阶段
你的任务：基于已公开的线索，进行信息交换和初步推理。

发言策略：
- 如果你刚搜到线索：清晰念出线索内容，进行初步解读
- 如果你要提问：向具体角色提出针对性问题（如"张三，你昨晚在哪里？"）
- 如果你要回答：诚实回答他人问题（凶手可适当隐瞒）
- 如果你要分析：结合线索进行逻辑推理，但避免过早下定论

注意事项：
- 问题要有针对性，能推进案件调查
- 根据已发现的证据来提问和分析
- 避免重复提问相同问题
""",
            GamePhase.DISCUSSION: """
现在是【圆桌讨论】阶段 - 核心推理环节
你的任务：进行深入的推理分析和自由讨论。

发言模式：
- 集中讨论：基于所有已知线索，阐述你的观点和怀疑对象
- 自由辩论：针对疑点和矛盾进行深入讨论和对质
- 逻辑推理：结合证据进行有理有据的推理
- 立场表达：适时"跳车"与"站队"，灵活调整怀疑对象

发言要求：
- 可以提出自己的推理和怀疑
- 可以反驳或支持他人的观点，但要加上自己的理由
- 要结合已发现的证据来论证
- 避免直接重复他人的话，要有自己的独特观点
- 保持逻辑清晰，做到有理有据
""",
            GamePhase.VOTING: """
现在是【最终投票与陈述】阶段
你的任务：做出最终判断，找出真凶。

发言流程：
- 投票前陈述：总结你的最终逻辑，明确指出将要投给谁及理由
- 正式投票：明确说出你投票的对象（如"我投票给张三"）
- 票后陈述：如果被质疑，为自己进行最后的辩解

指令要求：
- 必须明确说出你投票的对象
- 说明你的核心理由（1-2个最重要的证据或逻辑）
- 要坚定表达你的判断
- 不要犹豫不决或说"不知道"
""",
            GamePhase.REVELATION: """
现在是【真相复盘】阶段
你的任务：根据游戏结果分享你的最终想法和心路历程。

**重要：此阶段游戏已结束，应该诚实分享真相，不再需要隐瞒。**

发言内容：
- 如果你是凶手：应该坦白承认罪行，详细解释作案动机、手法和心路历程
- 如果你是无辜者：分享你的感受和对真相的看法
- 可以透露之前隐藏的秘密（如果不是犯罪相关）
- 分享你在游戏中的心路历程和未能解开的疑惑
- 解释你在各个阶段的策略和想法

注意事项：
- 此阶段可以自由提问和讨论
- 诚实分享你的游戏体验和真实想法
- 帮助其他玩家理解完整的故事情节
- 如果你是凶手，请详细说明你的作案过程，让大家了解完整真相
"""
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
                context += "\n请从上述地点中选择一个进行搜查。直接说出你的选择，例如：'我要搜查书房'。\n"
            else:
                context += "所有地点都已搜查完毕。请等待其他玩家行动。\n"
            context += "\n"
        
        # 调查阶段：提供其他角色信息
        elif phase == GamePhase.INVESTIGATION:
            characters_data = game_state.get("characters", [])
            other_characters = []
            for char_data in characters_data:
                char_name = char_data.get('name') if isinstance(char_data, dict) else getattr(char_data, 'name', str(char_data))
                is_victim = char_data.get('is_victim', False) if isinstance(char_data, dict) else getattr(char_data, 'is_victim', False)
                if char_name != self.character.name and not is_victim:
                    other_characters.append(char_name)
            
            if other_characters:
                context += f"**【可询问角色】：**{', '.join(other_characters)}\n"
                context += "请选择一个角色并提出具体问题，例如：'张三，你昨晚几点睡的？'\n\n"
        
        # 投票阶段：提供投票对象
        elif phase == GamePhase.VOTING:
            characters_data = game_state.get("characters", [])
            voting_candidates = []
            for char_data in characters_data:
                char_name = char_data.get('name') if isinstance(char_data, dict) else getattr(char_data, 'name', str(char_data))
                is_victim = char_data.get('is_victim', False) if isinstance(char_data, dict) else getattr(char_data, 'is_victim', False)
                if char_name != self.character.name and not is_victim:
                    voting_candidates.append(char_name)
            
            if voting_candidates:
                context += f"**【投票对象】：**{', '.join(voting_candidates)}\n"
                context += "请明确说出你的投票选择，例如：'我投票给张三，因为...'。\n\n"
        
        else:
            # 在非搜证阶段，明确告知不能搜证
            if phase not in [GamePhase.BACKGROUND, GamePhase.REVELATION]:
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