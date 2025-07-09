"""角色数据模型"""
from dataclasses import dataclass

@dataclass
class Character:
    """剧本杀角色数据模型"""
    name: str
    background: str
    secret: str
    objective: str
    is_murderer: bool = False
    is_victim: bool = False