"""剧本数据模型"""
from dataclasses import dataclass, field
from typing import List, Optional, Dict
from datetime import datetime
from enum import Enum

class ScriptStatus(Enum):
    """剧本状态"""
    DRAFT = "draft"  # 草稿
    PUBLISHED = "published"  # 已发布
    ARCHIVED = "archived"  # 已归档

class EvidenceType(Enum):
    """证据类型"""
    PHYSICAL = "physical"  # 物理证据
    DOCUMENT = "document"  # 文件证据
    VIDEO = "video"  # 视频证据
    AUDIO = "audio"  # 音频证据
    IMAGE = "image"  # 图片证据

@dataclass
class ScriptInfo:
    """剧本基本信息"""
    id: Optional[int] = None
    title: str = ""
    description: str = ""
    author: str = ""
    player_count: int = 4
    duration_minutes: int = 120
    difficulty: str = "中等"  # 简单/中等/困难
    tags: List[str] = field(default_factory=list)
    status: ScriptStatus = ScriptStatus.DRAFT
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    cover_image_url: Optional[str] = None  # MinIO存储的封面图片URL

@dataclass
class ScriptCharacter:
    """剧本角色"""
    id: Optional[int] = None
    script_id: Optional[int] = None
    name: str = ""
    age: Optional[int] = None
    profession: str = ""
    background: str = ""
    secret: str = ""
    objective: str = ""
    gender: str = "中性"  # 男/女/中性
    is_murderer: bool = False
    is_victim: bool = False
    personality_traits: List[str] = field(default_factory=list)
    avatar_url: Optional[str] = None  # MinIO存储的角色头像URL
    voice_preference: Optional[str] = None  # 语音偏好
    voice_id: Optional[str] = None  # TTS声音ID，用于语音合成

@dataclass
class ScriptEvidence:
    """剧本证据"""
    id: Optional[int] = None
    script_id: Optional[int] = None
    name: str = ""
    location: str = ""
    description: str = ""
    related_to: str = ""  # 关联角色
    significance: str = ""  # 重要性说明
    evidence_type: EvidenceType = EvidenceType.PHYSICAL
    importance: str = "重要证据"  # 关键证据/重要证据/一般证据
    image_url: Optional[str] = None  # MinIO存储的证据图片URL
    is_hidden: bool = False  # 是否隐藏证据

@dataclass
class ScriptLocation:
    """剧本场景"""
    id: Optional[int] = None
    script_id: Optional[int] = None
    name: str = ""
    description: str = ""
    searchable_items: List[str] = field(default_factory=list)
    background_image_url: Optional[str] = None  # MinIO存储的场景背景图
    is_crime_scene: bool = False  # 是否为案发现场

@dataclass
class Script:
    """完整剧本数据"""
    info: ScriptInfo
    background_story: Dict[str, str] = field(default_factory=dict)
    characters: List[ScriptCharacter] = field(default_factory=list)
    evidence: List[ScriptEvidence] = field(default_factory=list)
    locations: List[ScriptLocation] = field(default_factory=list)
    game_phases: List[Dict[str, str]] = field(default_factory=list)