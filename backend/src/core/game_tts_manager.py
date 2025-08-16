"""游戏TTS管理器"""
import asyncio
import base64
import logging
from typing import Dict, Optional, Any
from datetime import datetime

from src.services.tts_service import TTSService
from src.services.base_tts import TTSRequest, BaseTTSService
from src.core.storage import StorageManager
from src.db.models.game_event import GameEventDBModel, TTSGeneratedStatus
from src.db.repositories.game_session_repository import GameEventRepository
from src.db.session import db_manager
from src.core.config import config
logger = logging.getLogger(__name__)

class GameTTSManager:
    """游戏TTS管理器 - 处理角色发言的TTS生成"""
    
    # 角色声音映射配置
    CHARACTER_VOICE_MAPPING = {
        # 默认声音映射
        'male': 'male-qn-qingse',           # 青涩男声
        'female': 'female-shaonv',          # 少女音
        'elder_male': 'audiobook_male_2',   # 男性有声书
        'elder_female': 'female-yujie',     # 御姐音
        
        # 可以根据具体角色名称映射特定声音
        '侦探': 'male-qn-qingse',
        '管家': 'audiobook_male_2',
        '女主人': 'female-yujie',
        '秘书': 'female-shaonv',
        
        # 默认声音
        'default': '新闻播报女'
    }
    
    def __init__(self, api_key: str, group_id: str, model: str = "speech-02-turbo", provider: str = "minimax"):
        self.api_key = api_key
        self.group_id = group_id
        self.model = model
        self.provider = provider
        self.storage_manager = StorageManager()
        self._tts_service: Optional[BaseTTSService] = None
        
    def _get_tts_service(self) -> BaseTTSService:
        """获取TTS服务实例"""
        if self._tts_service is None:
            self._tts_service = TTSService.create_service(
                provider=self.provider,
                api_key=self.api_key,
                group_id=self.group_id,
                model=self.model
            )
        return self._tts_service
    
    def _get_character_voice(self, character_name: str, character_info: Optional[Dict[str, Any]] = None) -> str:
        """根据角色名称和信息获取对应的声音ID"""
        # 1. 优先使用角色配置的voice_id
        if character_info and character_info.get('voice_id'):
            configured_voice_id = character_info.get('voice_id')
            logger.debug(f"[TTS] 使用角色配置的声音ID: {character_name} -> {configured_voice_id}")
            return configured_voice_id
        
        # 2. 检查角色名称的直接映射
        if character_name in self.CHARACTER_VOICE_MAPPING:
            return self.CHARACTER_VOICE_MAPPING[character_name]
        
        # 3. 检查角色信息中的性别
        if character_info:
            gender = character_info.get('gender', '').lower()
            age_group = character_info.get('age_group', '').lower()
            
            # 根据性别和年龄组合选择声音
            if gender == 'male':
                if 'elder' in age_group or 'old' in age_group:
                    return self.CHARACTER_VOICE_MAPPING['elder_male']
                else:
                    return self.CHARACTER_VOICE_MAPPING['male']
            elif gender == 'female':
                if 'elder' in age_group or 'old' in age_group:
                    return self.CHARACTER_VOICE_MAPPING['elder_female']
                else:
                    return self.CHARACTER_VOICE_MAPPING['female']
        
        # 4. 根据角色名称启发式判断
        male_keywords = ['先生', '生', '男', '君', '哥', '叔', '爷', '伯', '父']
        female_keywords = ['女士', '小姐', '姐', '妹', '婆', '娘', '母', '阿姨']
        
        name_lower = character_name.lower()
        if any(keyword in name_lower for keyword in male_keywords):
            return self.CHARACTER_VOICE_MAPPING['male']
        elif any(keyword in name_lower for keyword in female_keywords):
            return self.CHARACTER_VOICE_MAPPING['female']
        
        # 5. 返回默认声音
        return self.CHARACTER_VOICE_MAPPING['default']
    
    async def generate_character_tts(
        self, 
        session_id: str, 
        character_name: str, 
        content: str,
        character_info: Optional[Dict[str, Any]] = None,
        event_metadata: Optional[Dict[str, Any]] = None
    ) -> Optional[str]:
        """
        为角色发言生成TTS音频并存储
        
        Args:
            session_id: 游戏会话ID
            character_name: 角色名称
            content: 发言内容
            character_info: 角色信息（包含性别、年龄等）
            event_metadata: 事件元数据
            
        Returns:
            音频文件的公网访问URL，失败时返回None
        """
        try:
            logger.info(f"[TTS] 开始生成TTS: 会话={session_id}, 角色={character_name}, 内容长度={len(content)}字符")
            
            # 检查存储服务
            if not self.storage_manager.is_available:
                logger.warning(f"[TTS] MinIO存储服务不可用，跳过TTS生成: 会话={session_id}")
                return None
            
            # 选择角色声音
            voice_id = self._get_character_voice(character_name, character_info)
            logger.debug(f"[TTS] 角色声音映射: {character_name} -> {voice_id}")
            
            # 创建TTS请求
            tts_request = TTSRequest(
                text=content,
                voice=voice_id,
                speed=1.0,
                pitch=0
            )
            
            # 生成TTS音频
            tts_service = self._get_tts_service()
            
            logger.debug(f"[TTS] 开始生成音频: 会话={session_id}, 角色={character_name}")
            try:
                tts_response = await tts_service.text_to_speech(tts_request)
                
                # 检查是否有有效的音频数据
                if not tts_response.audio_data:
                    logger.error(f"[TTS] 生成失败: 未返回音频数据, 会话={session_id}, 角色={character_name}")
                    return None
            except Exception as tts_error:
                logger.error(f"[TTS] 生成失败: {tts_error}, 会话={session_id}, 角色={character_name}")
                return None
            
            # 获取音频数据
            if isinstance(tts_response.audio_data, str):
                # 处理不同TTS服务的返回格式
                if tts_response.audio_data.startswith('http'):
                    # CosyVoice返回URL，需要下载音频文件
                    import httpx
                    async with httpx.AsyncClient() as client:
                        audio_response = await client.get(tts_response.audio_data)
                        audio_response.raise_for_status()
                        audio_bytes = audio_response.content
                else:
                    # MiniMax返回base64编码的音频数据
                    import base64
                    audio_bytes = base64.b64decode(tts_response.audio_data)
            else:
                # 如果已经是bytes类型，直接使用
                audio_bytes = tts_response.audio_data
            logger.info(f"[TTS] 音频生成成功: 会话={session_id}, 角色={character_name}, 大小={len(audio_bytes)}字节")
            
            # 上传到MinIO
            logger.debug(f"[TTS] 开始上传到MinIO: 会话={session_id}, 角色={character_name}")
            minio_url = await self.storage_manager.upload_tts_audio(
                audio_data=audio_bytes,
                session_id=session_id,
                character_name=character_name,
                filename_suffix=f"_{voice_id}"
            )
            
            if not minio_url:
                logger.error(f"[TTS] MinIO上传失败: 会话={session_id}, 角色={character_name}")
                return None
            
            logger.info(f"[TTS] MinIO上传成功: 会话={session_id}, URL={minio_url}")
            
            # 计算音频时长（估算，基于音频大小和采样率）
            estimated_duration = self._estimate_audio_duration(len(audio_bytes))
            
            # 保存到数据库
            try:
                await self._save_tts_event_to_db(
                    session_id=session_id,
                    character_name=character_name,
                    content=content,
                    tts_file_url=minio_url,
                    voice_id=voice_id,
                    duration=estimated_duration,
                    event_metadata=event_metadata
                )
                logger.debug(f"[TTS] 数据库保存成功: 会话={session_id}, 角色={character_name}")
            except Exception as e:
                logger.error(f"[TTS] 数据库保存失败: {e}, 会话={session_id}, 角色={character_name}")
                # 即使数据库保存失败，也返回URL
            
            return minio_url
            
        except Exception as e:
            logger.error(f"[TTS] 生成TTS失败: {e}, 会话={session_id}, 角色={character_name}", exc_info=True)
            return None
    
    def _estimate_audio_duration(self, audio_size_bytes: int) -> float:
        """估算音频时长（秒）"""
        # 基于MP3格式的估算：128kbps的MP3，1秒约16KB
        # 这是一个粗略估算，实际时长可能有差异
        estimated_seconds = audio_size_bytes / 16000  # 16KB per second for 128kbps MP3
        return round(estimated_seconds, 2)
    
    async def _save_tts_event_to_db(
        self,
        session_id: str,
        character_name: str,
        content: str,
        tts_file_url: str,
        voice_id: str,
        duration: float,
        event_metadata: Optional[Dict[str, Any]] = None
    ):
        """保存TTS事件到数据库"""
        try:
            with db_manager.session_scope() as db_session:
                event_repo = GameEventRepository(db_session)
                
                # 合并元数据
                metadata = {
                    "tts_generated": True,
                    "voice_id": voice_id,
                    "estimated_duration": duration,
                    **(event_metadata or {})
                }
                
                # 创建游戏事件记录
                event = GameEventDBModel(
                    session_id=session_id,
                    event_type="tts",
                    character_name=character_name,
                    content=content,
                    tts_file_url=tts_file_url,
                    tts_voice=voice_id,
                    tts_duration=duration,
                    tts_status=TTSGeneratedStatus.COMPLETED,
                    event_metadata=metadata,
                    timestamp=datetime.utcnow(),
                    is_public=True
                )
                
                db_session.add(event)
                logger.debug(f"[TTS] 事件已保存到数据库: ID={event.id}")
                
        except Exception as e:
            logger.error(f"[TTS] 保存事件到数据库失败: {e}", exc_info=True)
            raise
    
    async def get_character_tts_history(
        self, 
        session_id: str, 
        character_name: Optional[str] = None,
        limit: int = 50
    ) -> list[Dict[str, Any]]:
        """获取角色TTS历史记录"""
        try:
            with db_manager.session_scope() as db_session:
                event_repo = GameEventRepository(db_session)
                
                query = db_session.query(GameEventDBModel).filter(
                    GameEventDBModel.session_id == session_id,
                    GameEventDBModel.event_type == "tts",
                    GameEventDBModel.tts_status == TTSGeneratedStatus.COMPLETED
                )
                
                if character_name:
                    query = query.filter(GameEventDBModel.character_name == character_name)
                
                events = query.order_by(GameEventDBModel.timestamp.desc()).limit(limit).all()
                
                return [
                    {
                        "id": event.id,
                        "character_name": event.character_name,
                        "content": event.content,
                        "tts_file_url": event.tts_file_url,
                        "tts_voice": event.tts_voice,
                        "tts_duration": event.tts_duration,
                        "timestamp": event.timestamp.isoformat(),
                        "metadata": event.event_metadata
                    }
                    for event in events
                ]
                
        except Exception as e:
            logger.error(f"[TTS] 获取TTS历史失败: {e}", exc_info=True)
            return []
    
    async def close(self):
        """关闭TTS服务"""
        if self._tts_service:
            await self._tts_service.close()
            self._tts_service = None
