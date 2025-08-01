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
from .character_schemas import *
from .evidence_schemas import *
from .location_schemas import *
from .file_schemas import *
from .game_schemas import *
from .image_generation_schemas import *
from .tts_schemas import *

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
    
    # character_schemas
    'CharacterCreateRequest',
    'CharacterUpdateRequest',
    'CharacterPromptRequest',
    
    # evidence_schemas
    'EvidenceCreateRequest',
    'EvidenceUpdateRequest',
    'EvidencePromptRequest',
    
    # location_schemas
    'LocationCreateRequest',
    'LocationUpdateRequest',
    
    # file_schemas
    'FileUploadResponse',
    
    # game_schemas
    'GameResponse',
    
    # image_generation_schemas
    'ImageGenerationRequestModel',
    'ScriptCoverPromptRequest',
    
    # tts_schemas
    'TTSRequest',
]