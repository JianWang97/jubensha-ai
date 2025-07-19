"""配置管理模块"""
import os
from typing import Dict, Any, Optional
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()

@dataclass
class LLMConfig:
    """LLM配置"""
    provider: str  # openai, azure, anthropic, etc.
    api_key: str
    base_url: Optional[str] = None
    model: str = "gpt-3.5-turbo"
    max_tokens: int = 1000
    temperature: float = 0.7
    extra_params: Dict[str, Any] = None

@dataclass
class TTSConfig:
    """TTS配置"""
    provider: str  # dashscope, openai, azure, minimax, etc.
    api_key: str
    model: str = "qwen-tts-latest"
    voice: str = "Ethan"
    extra_params: Optional[Dict[str, Any]] = None
    
    def __post_init__(self):
        if self.extra_params is None:
            self.extra_params = {}

@dataclass
class DatabaseConfig:
    """数据库配置"""
    host: str
    port: int
    database: str
    username: str
    password: str
    pool_size: int = 10

@dataclass
class StorageConfig:
    """存储配置"""
    endpoint: str
    access_key: str
    secret_key: str
    bucket_name: str
    secure: bool = False

class ConfigManager:
    """配置管理器"""
    
    def __init__(self):
        self._llm_config = None
        self._tts_config = None
        self._db_config = None
        self._storage_config = None
    
    @property
    def llm_config(self) -> LLMConfig:
        """获取LLM配置"""
        if self._llm_config is None:
            self._llm_config = LLMConfig(
                provider=os.getenv("LLM_PROVIDER", "openai"),
                api_key=os.getenv("OPENAI_API_KEY", ""),
                base_url=os.getenv("OPENAI_BASE_URL"),
                model=os.getenv("OPENAI_MODEL", "gpt-3.5-turbo"),
                max_tokens=int(os.getenv("LLM_MAX_TOKENS", "1000")),
                temperature=float(os.getenv("LLM_TEMPERATURE", "0.7"))
            )
        return self._llm_config
    
    @property
    def tts_config(self) -> TTSConfig:
        """获取TTS配置"""
        if self._tts_config is None:
            # 根据不同的TTS提供商设置不同的extra_params
            provider = os.getenv("TTS_PROVIDER", "dashscope")
            extra_params = {}
            
            if provider.lower() == "minimax":
                # MiniMax需要group_id参数
                group_id = os.getenv("MINIMAX_GROUP_ID", "")
                if group_id:
                    extra_params["group_id"] = group_id
            
            self._tts_config = TTSConfig(
                provider=provider,
                api_key=os.getenv("TTS_API_KEY", ""),
                model=os.getenv("TTS_MODEL", ""),
                voice=os.getenv("TTS_DEFAULT_VOICE"),
                extra_params=extra_params
            )
        return self._tts_config
    
    @property
    def database_config(self) -> DatabaseConfig:
        """获取数据库配置"""
        if self._db_config is None:
            self._db_config = DatabaseConfig(
                host=os.getenv("DB_HOST", "localhost"),
                port=int(os.getenv("DB_PORT", "5432")),
                database=os.getenv("DB_NAME", "jubensha_db"),
                username=os.getenv("DB_USER", "postgres"),
                password=os.getenv("DB_PASSWORD", "password"),
                pool_size=int(os.getenv("DB_POOL_SIZE", "10"))
            )
        return self._db_config
    
    @property
    def storage_config(self) -> StorageConfig:
        """获取存储配置"""
        if self._storage_config is None:
            self._storage_config = StorageConfig(
                endpoint=os.getenv("MINIO_ENDPOINT", "localhost:9000"),
                access_key=os.getenv("MINIO_ACCESS_KEY", "minioadmin"),
                secret_key=os.getenv("MINIO_SECRET_KEY", "minioadmin"),
                bucket_name=os.getenv("MINIO_BUCKET_NAME", "jubensha-storage"),
                secure=os.getenv("MINIO_SECURE", "false").lower() == "true"
            )
        return self._storage_config
    
    def get_server_config(self) -> Dict[str, Any]:
        """获取服务器配置"""
        return {
            "host": os.getenv("HOST", "localhost"),
            "port": int(os.getenv("PORT", "8000")),
            "debug": os.getenv("DEBUG", "false").lower() == "true"
        }

# 全局配置实例
config = ConfigManager()

def get_database_config() -> DatabaseConfig:
    """获取数据库配置"""
    return config.database_config