#type ignore
from typing import List, Dict, Any, Optional
import asyncio
import random
import logging
from datetime import datetime

from src.schemas.game_phase import GamePhaseEnum as GamePhase
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
            
        # 分析对话内容，识别问答链和关键信息
        conversation_analysis = self._analyze_investigation_context(recent_chat, available_characters, game_state)
        
        # 使用增强的LLM分析谁最适合接话
        try:
            context = self._build_enhanced_conversation_context(recent_chat, available_characters, game_state, conversation_analysis)
            
            system_prompt = """
你是一个剧本杀游戏的智能对话流控制器。你的任务是分析当前调查阶段的对话情况，选择最合适的角色来接话。

智能选择原则（按优先级排序）：
1. **避免重复问题**：如果检测到重复问题，优先选择能够提供新信息或转换话题的角色
2. **问答链式反应**：如果有人被直接提问且未回答，优先让被提问者回答
3. **证据关联反应**：如果提到了新证据或线索，让最相关的角色（知情者/当事人）发言
4. **质疑与澄清**：如果有人被质疑或指控，让当事人有机会澄清或反驳
5. **信息补充**：如果有角色可能知道更多相关信息，让其主动提供线索
6. **推理深入**：选择最有动机继续追问或分析的角色
7. **发言平衡**：避免同一角色连续发言，确保每个角色都有参与机会

重复问题处理策略：
- 如果检测到重复问题，不要选择会继续重复相同问题的角色
- 优先选择能够提供答案、澄清疑问或转换话题的角色
- 如果被重复提问的角色还未回答，优先让其发言
- 如果问题已被多次重复但无人回答，选择知情的第三方角色来推进对话

分析要点：
- 识别未解答的问题和悬疑点
- 关注角色间的关系和利益冲突
- 考虑角色的背景知识和秘密信息
- 评估对话的紧张程度和情绪变化
- 特别注意避免重复问题的循环

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
                logger.info(f"智能选择下一个发言者: {selected_character} (基于: {conversation_analysis.get('selection_reason', '综合分析')})")
                return selected_character
            else:
                logger.warning(f"LLM选择的角色无效: {selected_character}，使用备选方案")
                
        except Exception as e:
            logger.error(f"LLM选择发言者失败: {e}")
            
        # 备选方案：基于增强规则选择
        return self._select_based_on_enhanced_rules(available_characters, recent_chat, conversation_analysis)
        
    async def _select_for_discussion(self, 
                                    available_characters: List[str], 
                                    recent_chat: List[Dict[str, Any]], 
                                    game_state: Dict[str, Any]) -> str:
        """讨论阶段：确保每个角色都有机会参与圆桌讨论"""
        # 优先选择还没有在讨论阶段发言的角色
        unspoken = [char for char in available_characters if self.speaking_frequency.get(char, 0) == 0]
        if unspoken:
            logger.info(f"讨论阶段：选择未发言角色 {unspoken[0]}")
            return unspoken[0]
        
        # 如果所有角色都发言过，使用调查阶段的智能选择逻辑
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
        
    def _select_based_on_enhanced_rules(self, available_characters: List[str], 
                                       recent_chat: List[Dict[str, Any]], 
                                       analysis: Dict[str, Any]) -> str:
        """基于增强规则选择发言者"""
        if not recent_chat:
            return self._select_randomly_with_balance(available_characters)
        
        # 规则1：优先处理未解答的问题
        if analysis['unanswered_questions']:
            latest_question = analysis['unanswered_questions'][-1]
            target = latest_question['target']
            if target and target in available_characters:
                analysis['selection_reason'] = f"回答{latest_question['asker']}的问题"
                return target
        
        # 规则2：被指控者优先澄清
        if analysis['accusations']:
            latest_accusation = analysis['accusations'][-1]
            target = latest_accusation['target']
            if target and target in available_characters:
                analysis['selection_reason'] = f"回应{latest_accusation['accuser']}的质疑"
                return target
        
        # 规则3：被频繁提及的角色优先发言
        if analysis['character_mentions']:
            most_mentioned = max(analysis['character_mentions'].items(), 
                               key=lambda x: len(x[1]))
            char, mentions = most_mentioned
            if char in available_characters and len(mentions) >= 2:
                analysis['selection_reason'] = f"回应关于自己的讨论"
                return char
        
        # 规则4：证据相关者优先发言
        if analysis['mentioned_evidence']:
            # 简单策略：让还没有对最新证据发表意见的角色发言
            recent_speakers = {chat.get('character') for chat in recent_chat[-3:]}
            non_recent_speakers = [char for char in available_characters 
                                 if char not in recent_speakers]
            if non_recent_speakers:
                analysis['selection_reason'] = "对新证据发表看法"
                return self._select_randomly_with_balance(non_recent_speakers)
        
        # 规则5：避免同一个人连续发言
        if recent_chat:
            last_speaker = recent_chat[-1].get("character", "")
            if last_speaker in available_characters:
                other_characters = [char for char in available_characters if char != last_speaker]
                if other_characters:
                    analysis['selection_reason'] = "避免连续发言"
                    return self._select_randomly_with_balance(other_characters)
        
        # 规则6：默认平衡选择
        analysis['selection_reason'] = "平衡发言机会"
        return self._select_randomly_with_balance(available_characters)
    
    def _select_based_on_conversation_rules(self, available_characters: List[str], recent_chat: List[Dict[str, Any]]) -> str:
        """基于对话规则选择发言者（保留原方法以兼容其他阶段）"""
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
        
    def _analyze_investigation_context(self, recent_chat: List[Dict[str, Any]], 
                                      available_characters: List[str], 
                                      game_state: Dict[str, Any]) -> Dict[str, Any]:
        """分析调查阶段的对话上下文，识别关键信息"""
        analysis = {
            'unanswered_questions': [],
            'mentioned_evidence': [],
            'character_mentions': {},
            'accusations': [],
            'emotional_tension': 'low',
            'selection_reason': '',
            'repeated_questions': [],  # 新增：重复问题检测
            'question_frequency': {}   # 新增：问题频率统计
        }
        
        if not recent_chat:
            return analysis
            
        # 收集所有问题用于重复检测
        all_questions = []
        
        # 分析最近的对话
        for i, chat in enumerate(recent_chat[-15:]):  # 增加分析范围到15条对话
            character = chat.get("character", "")
            message = chat.get("message", "")
            
            # 识别问题
            if any(marker in message for marker in ["?", "吗", "呢", "什么", "为什么", "怎么", "哪里", "谁"]):
                # 提取问题的核心内容用于重复检测
                question_core = self._extract_question_core(message)
                all_questions.append({
                    'question': message,
                    'core': question_core,
                    'asker': character,
                    'target': self._extract_question_target(message, available_characters),
                    'index': i
                })
                
                # 统计问题频率
                if question_core not in analysis['question_frequency']:
                    analysis['question_frequency'][question_core] = 0
                analysis['question_frequency'][question_core] += 1
                
                # 检查是否有后续回答
                is_answered = False
                for j in range(i + 1, len(recent_chat[-15:])):
                    next_chat = recent_chat[-15:][j]
                    next_speaker = next_chat.get("character", "")
                    # 如果问题中提到了某个角色，检查该角色是否回答了
                    for char in available_characters:
                        if char in message and next_speaker == char:
                            is_answered = True
                            break
                    if is_answered:
                        break
                        
                if not is_answered:
                    analysis['unanswered_questions'].append({
                        'question': message,
                        'asker': character,
                        'target': self._extract_question_target(message, available_characters)
                    })
        
        # 检测重复问题
        for core, frequency in analysis['question_frequency'].items():
            if frequency > 2:  # 如果同一个问题被问了超过2次
                repeated_questions = [q for q in all_questions if q['core'] == core]
                analysis['repeated_questions'].append({
                    'core': core,
                    'frequency': frequency,
                    'questions': repeated_questions
                })
            
            # 识别证据提及
            evidence_keywords = ["证据", "线索", "发现", "看到", "听到", "找到", "血迹", "指纹", "凶器"]
            if any(keyword in message for keyword in evidence_keywords):
                analysis['mentioned_evidence'].append({
                    'speaker': character,
                    'content': message
                })
            
            # 识别角色提及
            for char in available_characters:
                if char in message and char != character:
                    if char not in analysis['character_mentions']:
                        analysis['character_mentions'][char] = []
                    analysis['character_mentions'][char].append({
                        'mentioned_by': character,
                        'context': message
                    })
            
            # 识别指控或质疑
            accusation_keywords = ["觉得", "怀疑", "认为", "肯定是", "一定是", "可疑", "撒谎", "隐瞒"]
            if any(keyword in message for keyword in accusation_keywords):
                analysis['accusations'].append({
                    'accuser': character,
                    'content': message,
                    'target': self._extract_accusation_target(message, available_characters)
                })
        
        # 评估情绪紧张度（考虑重复问题的影响）
        tension_keywords = ["撒谎", "隐瞒", "可疑", "怀疑", "指控", "凶手", "杀人", "血", "死"]
        tension_count = sum(1 for chat in recent_chat[-5:] 
                          for keyword in tension_keywords 
                          if keyword in chat.get("message", ""))
        
        # 重复问题也会增加紧张度
        if analysis['repeated_questions']:
            tension_count += len(analysis['repeated_questions'])
        
        if tension_count >= 4:
            analysis['emotional_tension'] = 'high'
        elif tension_count >= 2:
            analysis['emotional_tension'] = 'medium'
            
        return analysis
    
    def _extract_question_target(self, message: str, available_characters: List[str]) -> str:
        """从问题中提取被提问的目标角色"""
        for char in available_characters:
            if char in message:
                return char
        return ""
    
    def _extract_question_core(self, message: str) -> str:
        """提取问题的核心内容，用于重复检测"""
        import re
        
        # 移除标点符号和语气词
        core = re.sub(r'[？?！!。，,、；;：:""''()（）\s]+', '', message)
        
        # 提取关键词组合
        key_patterns = [
            r'毒药瓶.*指纹',
            r'指纹.*毒药瓶', 
            r'邮件.*竞争对手',
            r'竞争对手.*邮件',
            r'遗嘱.*财产',
            r'财产.*遗嘱',
            r'合作.*项目',
            r'项目.*合作'
        ]
        
        for pattern in key_patterns:
            if re.search(pattern, core):
                return re.search(pattern, core).group()
        
        # 如果没有匹配到特定模式，返回简化的核心内容
        # 保留主要名词和动词
        keywords = ['毒药', '指纹', '邮件', '遗嘱', '财产', '合作', '项目', '竞争对手', 
                   '为什么', '怎么', '什么', '哪里', '谁', '有没有', '是不是']
        
        found_keywords = [kw for kw in keywords if kw in core]
        if found_keywords:
            return ''.join(found_keywords)
        
        # 最后返回前20个字符作为核心
        return core[:20] if len(core) > 20 else core
    
    def _extract_accusation_target(self, message: str, available_characters: List[str]) -> str:
        """从指控中提取被指控的目标角色"""
        for char in available_characters:
            if char in message:
                return char
        return ""
    
    def _build_enhanced_conversation_context(self, recent_chat: List[Dict[str, Any]], 
                                           available_characters: List[str], 
                                           game_state: Dict[str, Any],
                                           analysis: Dict[str, Any]) -> str:
        """构建增强的对话上下文供LLM分析"""
        context = f"可选择的角色：{', '.join(available_characters)}\n\n"
        
        # 添加对话分析结果
        context += "=== 对话分析结果 ===\n"
        
        # 重复问题警告（最高优先级）
        if analysis['repeated_questions']:
            context += "⚠️ 检测到重复问题（需要避免）：\n"
            for rq in analysis['repeated_questions']:
                context += f"- 问题核心：{rq['core']} (重复{rq['frequency']}次)\n"
                recent_askers = [q['asker'] for q in rq['questions'][-3:]]  # 最近3次提问者
                context += f"  最近提问者：{', '.join(recent_askers)}\n"
            context += "\n"
        
        if analysis['unanswered_questions']:
            context += "未解答的问题：\n"
            for q in analysis['unanswered_questions']:
                context += f"- {q['asker']}问{q['target'] or '大家'}：{q['question']}\n"
            context += "\n"
        
        if analysis['accusations']:
            context += "指控或质疑：\n"
            for acc in analysis['accusations']:
                context += f"- {acc['accuser']}质疑{acc['target'] or '某人'}：{acc['content']}\n"
            context += "\n"
        
        if analysis['mentioned_evidence']:
            context += "提及的证据线索：\n"
            for ev in analysis['mentioned_evidence']:
                context += f"- {ev['speaker']}：{ev['content']}\n"
            context += "\n"
        
        if analysis['character_mentions']:
            context += "被提及的角色：\n"
            for char, mentions in analysis['character_mentions'].items():
                context += f"- {char}被提及{len(mentions)}次\n"
            context += "\n"
        
        context += f"当前情绪紧张度：{analysis['emotional_tension']}\n\n"
        
        # 添加最近对话
        context += "=== 最近的对话 ===\n"
        for chat in recent_chat[-8:]:  # 增加到8条对话
            character = chat.get("character", "未知")
            message = chat.get("message", "")
            message_type = chat.get("type", "chat")
            context += f"[{message_type}] {character}: {message}\n"
            
        # 添加发言频率统计
        context += "\n=== 发言频率统计 ===\n"
        for char in available_characters:
            frequency = self.speaking_frequency.get(char, 0)
            context += f"{char}: {frequency}次\n"
            
        context += "\n请选择最合适的下一个发言者："
        return context
    
    def _build_conversation_context(self, recent_chat: List[Dict[str, Any]], 
                                   available_characters: List[str], 
                                   game_state: Dict[str, Any]) -> str:
        """构建对话上下文供LLM分析（保留原方法以兼容其他阶段）"""
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
        """获取本轮的发言顺序 - 已废弃，建议使用select_next_speaker进行动态选择"""
        logger.warning("get_speaking_order方法已废弃，建议使用select_next_speaker进行动态选择")
        
        # 获取可用角色（排除受害者）
        available_characters = []
        for char in self.characters:
            char_name = char.name if hasattr(char, 'name') else str(char)
            is_victim = getattr(char, 'is_victim', False) if hasattr(char, 'is_victim') else False
            if not is_victim:
                available_characters.append(char_name)
                
        if not available_characters:
            return []
            
        # 为了向后兼容，返回简单的角色列表
        return available_characters
            
    def _get_introduction_order(self, available_characters: List[str]) -> List[str]:
        """角色介绍阶段的发言顺序 - 标准剧本杀轮流发言"""
        # 采用顺时针或逆时针的轮流发言方式
        # 随机决定起始角色，然后按固定顺序轮流
        order = available_characters.copy()
        random.shuffle(order)  # 随机起始位置
        logger.info(f"角色介绍阶段发言顺序: {' -> '.join(order)}")
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
        """调查阶段的发言顺序 - 智能动态调整"""
        # 分析当前对话状态
        analysis = self._analyze_investigation_context(recent_chat, available_characters, {})
        
        # 根据对话状态动态调整发言人数
        base_speakers = 2
        
        # 如果有未解答的问题，增加发言人数
        if analysis['unanswered_questions']:
            base_speakers += len(analysis['unanswered_questions'])
        
        # 如果有指控，增加发言人数（让更多人参与讨论）
        if analysis['accusations']:
            base_speakers += 1
        
        # 如果情绪紧张度高，增加发言人数
        if analysis['emotional_tension'] == 'high':
            base_speakers += 1
        elif analysis['emotional_tension'] == 'medium':
            base_speakers += 1  # 改为整数，避免浮点数问题
        
        # 限制发言人数在合理范围内
        num_speakers = min(int(base_speakers), len(available_characters), 4)
        num_speakers = max(num_speakers, 1)  # 至少1个人发言
        
        speakers = []
        used_analysis = analysis.copy()  # 复制分析结果，避免修改原始数据
        
        for i in range(num_speakers):
            remaining = [char for char in available_characters if char not in speakers]
            if not remaining:
                break
            
            # 第一个发言者使用智能选择
            if i == 0:
                next_speaker = await self._select_for_investigation(
                    remaining, recent_chat, {}
                )
            else:
                # 后续发言者基于增强规则选择
                next_speaker = self._select_based_on_enhanced_rules(
                    remaining, recent_chat, used_analysis
                )
            
            if next_speaker:
                speakers.append(next_speaker)
                # 更新发言频率（模拟）
                self.speaking_frequency[next_speaker] = self.speaking_frequency.get(next_speaker, 0) + 1
        
        logger.info(f"调查阶段发言顺序: {speakers} (共{len(speakers)}人，基于分析: 问题{len(analysis['unanswered_questions'])}个, 指控{len(analysis['accusations'])}个, 紧张度{analysis['emotional_tension']})")
        return speakers
        
    async def _get_discussion_order(self, available_characters: List[str], recent_chat: List[Dict[str, Any]]) -> List[str]:
        """圆桌讨论阶段的发言顺序 - 标准剧本杀集中讨论与自由辩论"""
        # 分析当前讨论状态
        total_speeches = sum(self.speaking_frequency.values())
        
        # 第一轮集中讨论：确保每个角色都有机会完整发言
        if total_speeches < len(available_characters):
            # 从死者右边第一位开始（或随机选择起始位置）
            remaining_speakers = [char for char in available_characters 
                                if self.speaking_frequency.get(char, 0) == 0]
            if remaining_speakers:
                # 选择1-2个角色进行首轮发言
                num_speakers = min(2, len(remaining_speakers))
                speakers = remaining_speakers[:num_speakers]
                logger.info(f"圆桌讨论第一轮发言: {speakers}")
                return speakers
        
        # 自由讨论/辩论阶段：智能选择发言者
        num_speakers = min(3, len(available_characters))  # 每轮2-3个角色参与讨论
        speakers = []
        
        for i in range(num_speakers):
            remaining = [char for char in available_characters if char not in speakers]
            if not remaining:
                break
                
            # 使用智能选择机制
            next_speaker = await self._select_for_discussion(
                remaining, recent_chat, {}
            )
            if next_speaker:
                speakers.append(next_speaker)
        
        logger.info(f"圆桌讨论自由辩论轮: {speakers}")
        return speakers
        
    def _get_voting_order(self, available_characters: List[str]) -> List[str]:
        """最终投票与陈述阶段的发言顺序 - 标准剧本杀投票流程"""
        # 投票前最终陈述：所有玩家轮流进行最后陈述
        # 投票：同时或依次亮票
        # 票后陈述：得票者或所有人进行最后辩解
        
        order = available_characters.copy()
        # 随机决定投票陈述的起始顺序
        random.shuffle(order)
        
        logger.info(f"投票陈述阶段发言顺序: {' -> '.join(order)}")
        logger.info("投票流程：投票前陈述 -> 正式投票 -> 票后陈述")
        return order