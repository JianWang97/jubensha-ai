"""TTS事件处理服务

负责处理游戏中的语音合成事件，包括角色发言和系统消息的TTS生成
"""
import asyncio
import logging
import base64
import uuid
import os
from typing import Optional, Dict, Any, List
from datetime import datetime

from .tts_service import TTSService
from .base_tts import TTSRequest
from ..core.config import config
from ..db.session import db_manager
from ..db.models.game_event import GameEventDBModel, TTSGeneratedStatus
from ..db.repositories.game_session_repository import GameSessionRepository

logger = logging.getLogger(__name__)

class TTSEventService:
    """TTS事件处理服务"""
    
    def __init__(self):
        self.tts_service = None
        self._audio_storage_path = "static/audio"  # 音频文件存储路径
        
        # 确保音频存储目录存在
        os.makedirs(self._audio_storage_path, exist_ok=True)
    
    def _get_tts_service(self):
        """获取TTS服务实例"""
        if self.tts_service is None:
            try:
                self.tts_service = TTSService.from_config(config.tts_config)
                logger.info(f"TTS服务初始化成功，提供商: {config.tts_config.provider}")
            except Exception as e:
                logger.error(f"TTS服务初始化失败: {e}")
                self.tts_service = None
        return self.tts_service
    
    async def process_speech_event(
        self, 
        session_id: str, 
        character_name: str, 
        content: str, 
        event_type: str = "chat",
        voice_id: Optional[str] = None
    ) -> Optional[GameEventDBModel]:
        """处理语音事件，生成TTS并保存到数据库
        
        Args:
            session_id: 游戏会话ID
            character_name: 角色名称（系统消息时为"系统"）
            content: 发言内容
            event_type: 事件类型（chat, system, action等）
            voice_id: 指定的声音ID
            
        Returns:
            创建的游戏事件对象，如果创建失败则返回None
        """
        try:
            # 创建游戏事件记录
            with db_manager.session_scope() as db:
                game_event = GameEventDBModel(
                    session_id=session_id,
                    event_type=event_type,
                    character_name=character_name,
                    content=content,
                    tts_status=TTSGeneratedStatus.PENDING,
                    timestamp=datetime.utcnow()
                )
                
                db.add(game_event)
                db.commit()
                db.refresh(game_event)
                
                event_id = game_event.id
                logger.info(f"创建游戏事件 {event_id}: {character_name} - {content[:50]}...")
                
                # 异步生成TTS
                asyncio.create_task(self._generate_tts_async(event_id, content, voice_id))
            
            return game_event
            
        except Exception as e:
            logger.error(f"处理语音事件失败: {e}", exc_info=True)
            return None
    
    async def _generate_tts_async(self, event_id: int, content: str, voice_id: Optional[str] = None):
        """异步生成TTS音频"""
        try:
            # 获取TTS服务
            tts_service = self._get_tts_service()
            if not tts_service:
                await self._mark_tts_failed(event_id, "TTS服务不可用")
                return
            
            # 清理文本内容
            clean_content = self._clean_text_for_tts(content)
            if not clean_content.strip():
                await self._skip_tts(event_id, "内容为空或无需TTS")
                return
            
            # 创建TTS请求
            tts_request = TTSRequest(
                text=clean_content,
                voice=voice_id or config.tts_config.voice
            )
            
            # 收集音频数据
            audio_chunks = []
            
            tts_stream = tts_service.synthesize_stream(tts_request)  # type: ignore
            async for chunk in tts_stream:  # type: ignore
                if "error" in chunk:
                    logger.error(f"TTS生成错误 (事件 {event_id}): {chunk['error']}")
                    await self._mark_tts_failed(event_id, chunk['error'])
                    return
                elif "end" in chunk:
                    logger.debug(f"TTS生成完成 (事件 {event_id})")
                    break
                elif "audio" in chunk:
                    audio_chunks.append(chunk["audio"])
            
            if not audio_chunks:
                await self._mark_tts_failed(event_id, "未生成音频数据")
                return
            
            # 合并音频数据并保存文件
            audio_file_url = await self._save_audio_file(event_id, audio_chunks, voice_id)
            
            # 更新数据库记录
            await self._update_tts_success(event_id, audio_file_url, voice_id)
            
            logger.info(f"TTS生成成功 (事件 {event_id}): {audio_file_url}")
            
        except Exception as e:
            logger.error(f"TTS异步生成失败 (事件 {event_id}): {e}", exc_info=True)
            await self._mark_tts_failed(event_id, str(e))
    
    def _clean_text_for_tts(self, text: str) -> str:
        """清理文本用于TTS生成"""
        if not text:
            return ""
        
        # 移除特殊标记和不需要朗读的内容
        text = text.strip()
        
        # 移除思考标记
        if text.startswith("[思考中...]") or text == "[思考中...]":
            return ""
        
        # 移除其他系统标记
        system_markers = ["[系统]", "[错误]", "[调试]", "[SYSTEM]", "[ERROR]", "[DEBUG]"]
        for marker in system_markers:
            if text.startswith(marker):
                text = text[len(marker):].strip()
        
        # 限制长度避免过长的TTS生成
        if len(text) > 500:
            text = text[:500] + "..."
        
        return text
    
    async def _save_audio_file(self, event_id: int, audio_chunks: List[str], voice_id: Optional[str]) -> str:
        """保存音频文件并返回URL"""
        try:
            # 合并base64音频数据
            full_audio_b64 = "".join(audio_chunks)
            audio_bytes = base64.b64decode(full_audio_b64)
            
            # 生成文件名
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"tts_{event_id}_{timestamp}_{uuid.uuid4().hex[:8]}.mp3"
            file_path = os.path.join(self._audio_storage_path, filename)
            
            # 保存文件
            with open(file_path, "wb") as f:
                f.write(audio_bytes)
            
            # 返回相对URL路径
            return f"/static/audio/{filename}"
            
        except Exception as e:
            logger.error(f"保存音频文件失败 (事件 {event_id}): {e}")
            raise
    
    async def _update_tts_success(self, event_id: int, file_url: str, voice_id: Optional[str]):
        """更新TTS成功状态"""
        try:
            with db_manager.session_scope() as db:
                event = db.query(GameEventDBModel).filter(GameEventDBModel.id == event_id).first()
                if event:
                    event.update_tts_info(file_url, voice_id or "default")
                    db.commit()
        except Exception as e:
            logger.error(f"更新TTS成功状态失败 (事件 {event_id}): {e}")
    
    async def _mark_tts_failed(self, event_id: int, error_msg: str):
        """标记TTS失败"""
        try:
            with db_manager.session_scope() as db:
                event = db.query(GameEventDBModel).filter(GameEventDBModel.id == event_id).first()
                if event:
                    event.mark_tts_failed()
                    db.commit()
            logger.warning(f"TTS生成失败 (事件 {event_id}): {error_msg}")
        except Exception as e:
            logger.error(f"标记TTS失败状态失败 (事件 {event_id}): {e}")
    
    async def _skip_tts(self, event_id: int, reason: str):
        """跳过TTS生成"""
        try:
            with db_manager.session_scope() as db:
                event = db.query(GameEventDBModel).filter(GameEventDBModel.id == event_id).first()
                if event:
                    event.skip_tts()
                    db.commit()
            logger.info(f"跳过TTS生成 (事件 {event_id}): {reason}")
        except Exception as e:
            logger.error(f"标记TTS跳过状态失败 (事件 {event_id}): {e}")
    
    async def get_event_audio_url(self, event_id: int) -> Optional[str]:
        """获取事件的音频URL"""
        try:
            with db_manager.session_scope() as db:
                event = db.query(GameEventDBModel).filter(GameEventDBModel.id == event_id).first()
                if event and event.tts_status == TTSGeneratedStatus.COMPLETED:
                    return event.tts_file_url
                return None
        except Exception as e:
            logger.error(f"获取事件音频URL失败 (事件 {event_id}): {e}")
            return None
    
    async def get_session_events_with_audio(self, session_id: str) -> List[Dict[str, Any]]:
        """获取会话的所有事件及其音频信息"""
        try:
            with db_manager.session_scope() as db:
                events = db.query(GameEventDBModel).filter(
                    GameEventDBModel.session_id == session_id
                ).order_by(GameEventDBModel.timestamp).all()
                
                result = []
                for event in events:
                    event_data = {
                        "id": event.id,
                        "character_name": event.character_name,
                        "content": event.content,
                        "event_type": event.event_type,
                        "timestamp": event.timestamp.isoformat(),
                        "tts_status": event.tts_status.value,
                        "tts_file_url": event.tts_file_url,
                        "tts_voice": event.tts_voice,
                        "tts_duration": event.tts_duration
                    }
                    result.append(event_data)
                
                return result
                
        except Exception as e:
            logger.error(f"获取会话事件失败 (会话 {session_id}): {e}")
            return []


# 全局TTS事件服务实例
tts_event_service = TTSEventService()


def get_tts_event_service() -> TTSEventService:
    """获取TTS事件服务实例"""
    return tts_event_service
