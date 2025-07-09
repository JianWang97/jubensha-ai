"""声音分配管理器"""
from typing import Dict, List, Set
from ..models.character import Character

class VoiceManager:
    """智能声音分配管理器"""
    
    def __init__(self):
        # 可用音色及其性别和语言偏好
        self.available_voices = {
            "Chelsie": {"gender": "女", "language": "普通话", "description": "女性声音"},
            "Cherry": {"gender": "女", "language": "普通话", "description": "女性声音"},
            "Ethan": {"gender": "男", "language": "普通话", "description": "男性声音"},
            "Serena": {"gender": "女", "language": "普通话", "description": "女性声音"},
            "Dylan": {"gender": "男", "language": "北京话", "description": "北京话男性声音"},
            "Jada": {"gender": "女", "language": "吴语", "description": "吴语女性声音"},
            "Sunny": {"gender": "女", "language": "四川话", "description": "四川话女性声音"}
        }
        
        # 已分配的声音
        self.assigned_voices: Dict[str, str] = {}
        # 已使用的声音集合
        self.used_voices: Set[str] = set()
    
    def assign_voice_to_character(self, character: Character) -> str:
        """为角色智能分配声音"""
        # 如果已经分配过，直接返回
        if character.name in self.assigned_voices:
            return self.assigned_voices[character.name]
        
        # 根据性别筛选合适的声音
        suitable_voices = []
        for voice_name, voice_info in self.available_voices.items():
            if voice_name not in self.used_voices:
                # 性别匹配优先
                if voice_info["gender"] == character.gender:
                    suitable_voices.append((voice_name, voice_info, 2))  # 高优先级
                elif character.gender == "中性":
                    suitable_voices.append((voice_name, voice_info, 1))  # 中等优先级
        
        # 如果没有合适的未使用声音，则从所有合适性别的声音中选择
        if not suitable_voices:
            for voice_name, voice_info in self.available_voices.items():
                if voice_info["gender"] == character.gender or character.gender == "中性":
                    suitable_voices.append((voice_name, voice_info, 0))  # 低优先级（可能重复）
        
        # 如果还是没有，使用默认声音
        if not suitable_voices:
            selected_voice = "Ethan"  # 默认声音
        else:
            # 按优先级排序，选择最高优先级的声音
            suitable_voices.sort(key=lambda x: x[2], reverse=True)
            selected_voice = suitable_voices[0][0]
        
        # 记录分配
        self.assigned_voices[character.name] = selected_voice
        self.used_voices.add(selected_voice)
        
        return selected_voice
    
    def get_voice_mapping(self, characters: List[Character]) -> Dict[str, str]:
        """获取所有角色的声音映射"""
        voice_mapping = {}
        
        # 为每个角色分配声音
        for character in characters:
            voice_mapping[character.name] = self.assign_voice_to_character(character)
        
        # 添加系统默认声音
        voice_mapping["系统"] = "Chelsie"
        voice_mapping["default"] = "Ethan"
        
        return voice_mapping
    
    def get_assignment_info(self) -> Dict[str, Dict]:
        """获取声音分配信息"""
        assignment_info = {}
        for char_name, voice_name in self.assigned_voices.items():
            voice_info = self.available_voices.get(voice_name, {})
            assignment_info[char_name] = {
                "voice": voice_name,
                "gender": voice_info.get("gender", "未知"),
                "language": voice_info.get("language", "普通话"),
                "description": voice_info.get("description", "")
            }
        return assignment_info
    
    def reset_assignments(self):
        """重置所有声音分配"""
        self.assigned_voices.clear()
        self.used_voices.clear()