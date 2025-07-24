"""剧本相关的Pydantic数据模型"""
from typing import List, Optional, Dict, Any, Type
from enum import Enum
from pydantic import Field, field_validator,BaseModel
from .base import BaseDataModel

class ScriptStatus(Enum):
    """剧本状态"""
    DRAFT = "DRAFT"  # 草稿
    PUBLISHED = "PUBLISHED"  # 已发布
    ARCHIVED = "ARCHIVED"  # 已归档

class EvidenceType(Enum):
    """证据类型"""
    PHYSICAL = "PHYSICAL"  # 物理证据
    DOCUMENT = "DOCUMENT"  # 文件证据
    VIDEO = "VIDEO"  # 视频证据
    AUDIO = "AUDIO"  # 音频证据
    IMAGE = "IMAGE"  # 图片证据

class GamePhaseEnum(Enum):
    """游戏阶段枚举"""
    BACKGROUND = "BACKGROUND"  # 背景介绍
    INTRODUCTION = "INTRODUCTION"  # 自我介绍
    EVIDENCE_COLLECTION = "EVIDENCE_COLLECTION"  # 搜证阶段
    INVESTIGATION = "INVESTIGATION"  # 调查取证
    DISCUSSION = "DISCUSSION"  # 自由讨论
    VOTING = "VOTING"  # 投票表决
    REVELATION = "REVELATION"  # 真相揭晓
    ENDED = "ENDED"  # 游戏结束

class ScriptInfo(BaseDataModel):
    """剧本基本信息"""
    title: str = Field("", description="剧本标题")
    description: str = Field("", description="剧本描述")
    author: Optional[str] = Field(None, description="作者")
    player_count: int = Field(4, description="玩家数量")
    estimated_duration: int = Field(180, description="预计游戏时长(分钟)", alias="duration_minutes")
    difficulty_level: str = Field("medium", description="难度等级", alias="difficulty")
    tags: List[str] = Field(default_factory=list, description="标签列表")
    status: ScriptStatus = Field(ScriptStatus.DRAFT, description="剧本状态")
    cover_image_url: Optional[str] = Field(None, description="封面图片URL")
    is_public: bool = Field(False, description="是否公开")
    price: float = Field(0.00, description="价格")
    # 新增字段
    rating: float = Field(0.0, description="剧本评分(0-5分)")
    category: str = Field("推理", description="剧本分类")
    play_count: int = Field(0, description="游玩次数统计")
    
    model_config = {"populate_by_name": True}
    
    @field_validator('status', mode='before')
    @classmethod
    def validate_status(cls, v):
        """验证并转换status字段"""
        if hasattr(v, 'value'):  # 如果是枚举对象，获取其值
            return v.value
        return v
    
    @field_validator('tags', mode='before')
    @classmethod
    def validate_tags(cls, v):
        """验证并转换tags字段"""
        if v is None:
            return []
        return v
    
    @classmethod
    def get_db_model(cls) -> Type:
        from ..db.models.script_model import ScriptDBModel
        return ScriptDBModel

class ScriptCharacter(BaseDataModel):
    """剧本角色"""
    script_id: Optional[int] = Field(None, description="剧本ID")
    name: str = Field("", description="角色姓名")
    age: Optional[int] = Field(None, description="年龄")
    profession: str = Field("", description="职业")
    background: str = Field("", description="背景故事")
    secret: str = Field("", description="秘密")
    objective: str = Field("", description="目标")
    gender: str = Field("中性", description="性别")
    is_murderer: bool = Field(False, description="是否为凶手")
    is_victim: bool = Field(False, description="是否为受害者")
    personality_traits: List[str] = Field(default_factory=list, description="性格特征")
    avatar_url: Optional[str] = Field(None, description="头像URL")
    voice_preference: Optional[str] = Field(None, description="语音偏好")
    voice_id: Optional[str] = Field(None, description="TTS声音ID")
    
    @field_validator('personality_traits', mode='before')
    @classmethod
    def validate_personality_traits(cls, v):
        """验证并转换personality_traits字段"""
        if v is None:
            return []
        return v
    
    @classmethod
    def get_db_model(cls) -> Type:
        from ..db.models.character import CharacterDBModel
        return CharacterDBModel

class ScriptEvidence(BaseDataModel):
    """剧本证据"""
    script_id: Optional[int] = Field(None, description="剧本ID")
    name: str = Field("", description="证据名称")
    location: str = Field("", description="发现地点")
    description: str = Field("", description="证据描述")
    related_to: Optional[str] = Field("", description="关联角色")
    significance: Optional[str] = Field("", description="重要性说明")
    evidence_type: EvidenceType = Field(EvidenceType.PHYSICAL, description="证据类型")
    importance: str = Field("重要证据", description="重要程度")
    image_url: Optional[str] = Field(None, description="证据图片URL")
    is_hidden: bool = Field(False, description="是否隐藏证据")
    
    @classmethod
    def get_db_model(cls) -> Type:
        from ..db.models.evidence import EvidenceDBModel
        return EvidenceDBModel

class ScriptLocation(BaseDataModel):
    """剧本场景"""
    script_id: Optional[int] = Field(None, description="剧本ID")
    name: str = Field("", description="场景名称")
    description: str = Field("", description="场景描述")
    searchable_items: List[str] = Field(default_factory=list, description="可搜索物品")
    background_image_url: Optional[str] = Field(None, description="背景图片URL")
    is_crime_scene: bool = Field(False, description="是否为案发现场")
    
    @field_validator('searchable_items', mode='before')
    @classmethod
    def validate_searchable_items(cls, v):
        """验证并转换searchable_items字段"""
        if v is None:
            return []
        return v
    
    @classmethod
    def get_db_model(cls) -> Type:
        from ..db.models.location import LocationDBModel
        return LocationDBModel

class BackgroundStory(BaseDataModel):
    """背景故事"""
    script_id: Optional[int] = Field(None, description="剧本ID")
    title: str = Field("", description="标题")
    setting_description:Optional[str] = Field("", description="背景设定")
    incident_description:Optional[str] = Field("", description="事件描述")
    victim_background:Optional[str] = Field("", description="受害者背景")
    investigation_scope:Optional[str] = Field("", description="调查范围")
    rules_reminder:Optional[str] = Field("", description="规则提醒")
    murder_method:Optional[str] = Field("", description="作案手法")
    murder_location:Optional[str] = Field("", description="作案地点")
    discovery_time:Optional[str] = Field("", description="发现时间")
    victory_conditions: Optional[Dict[str, Any]] = Field(default=dict(), description="胜利条件")
    
    @field_validator('victory_conditions', mode='before')
    @classmethod
    def validate_victory_conditions(cls, v):
        """验证并转换victory_conditions字段"""
        if v is None:
            return {}
        if isinstance(v, str):
            try:
                import json
                return json.loads(v)
            except (json.JSONDecodeError, TypeError):
                return {}
        if isinstance(v, dict):
            return v
        return {}
    
    @classmethod
    def get_db_model(cls) -> Type:
        from ..db.models.background_story import BackgroundStoryDBModel
        return BackgroundStoryDBModel

class GamePhase(BaseDataModel):
    """游戏阶段"""
    script_id: Optional[int] = Field(None, description="剧本ID")
    phase: GamePhaseEnum = Field(GamePhaseEnum.BACKGROUND, description="阶段标识")
    name: str = Field("", description="阶段名称")
    description: str = Field("", description="阶段描述")
    order_index: int = Field(0, description="排序索引")
    
    @classmethod
    def get_db_model(cls) -> Type:
        from ..db.models.game_phase import GamePhaseDBModel
        return GamePhaseDBModel

class Script(BaseModel):
    """完整剧本数据"""
    info: ScriptInfo = Field(description="剧本基本信息")
    background_story: Optional[BackgroundStory] = Field(None, description="背景故事")
    characters: List[ScriptCharacter] = Field(default_factory=list, description="角色列表")
    evidence: List[ScriptEvidence] = Field(default_factory=list, description="证据列表")
    locations: List[ScriptLocation] = Field(default_factory=list, description="场景列表")
    game_phases: List[GamePhase] = Field(default_factory=list, description="游戏阶段列表")
    
    @classmethod
    def get_db_model(cls) -> Type:
        from ..db.models.script_model import ScriptDBModel
        return ScriptDBModel