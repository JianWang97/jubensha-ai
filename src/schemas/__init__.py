"""数据模型模块初始化文件"""
from .base import *
from .user_schemas import *
from .script import *
from .script_info import *
from .script_character import *
from .script_evidence import *
from .script_location import *
from .background_story import *
from .game_phase import *
from .script_requests import *

__all__ = [
    # base
    'BaseDataModel',
    'APIResponse',
    'PaginatedResponse',
    
    # user_schemas
    'UserLogin',
    'UserRegister',
    'UserInfo',
    'Token',
    'TokenData',
    
    # script
    'Script',
    'ScriptInfo',
    'ScriptCharacter',
    'ScriptEvidence',
    'ScriptLocation',
    'BackgroundStory',
    'GamePhase',
    
    # script_info
    'ScriptStatus',
    
    # script_character
    'CharacterType',
    'CharacterGender',
    
    # script_evidence
    'EvidenceType',
    
    # script_requests
    'GenerateScriptInfoRequest',
    'CreateScriptRequest',
]