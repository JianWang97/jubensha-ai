"""TTS 音色列表共用逻辑

/api/tts/voices 路由与剧本编辑 Agent（bind_character_voice 工具）共用：
- fetch_voices_payload(): 按当前 provider 获取原始音色响应（保持路由既有返回结构）
- list_available_voices(): 归一化为扁平音色列表 [{voice_id, name, gender?}] 供模糊匹配
"""
import logging
from typing import Any, Dict, List, Optional, Tuple

from ..core.config import config

logger = logging.getLogger(__name__)

# DashScope 固定音色列表
_DASHSCOPE_VOICES = [
    {"voice_id": "Ethan", "name": "Ethan", "gender": "male", "language": "en"},
    {"voice_id": "Emma", "name": "Emma", "gender": "female", "language": "en"},
    {"voice_id": "Liam", "name": "Liam", "gender": "male", "language": "en"},
    {"voice_id": "Olivia", "name": "Olivia", "gender": "female", "language": "en"},
    {"voice_id": "Noah", "name": "Noah", "gender": "male", "language": "en"},
    {"voice_id": "Ava", "name": "Ava", "gender": "female", "language": "en"},
    {"voice_id": "William", "name": "William", "gender": "male", "language": "en"},
    {"voice_id": "Sophia", "name": "Sophia", "gender": "female", "language": "en"},
]


async def fetch_voices_payload() -> Dict[str, Any]:
    """按当前 TTS provider 获取音色列表（返回结构与 /api/tts/voices 一致）"""
    try:
        # 延迟导入避免循环依赖
        from .tts_service import get_tts_service

        # 从DI容器解析TTS服务（单例，容器未配置时回退到按配置创建）
        tts_service = get_tts_service()

        # 根据不同的TTS提供商返回不同的声音列表
        provider = config.tts_config.provider.lower()

        if provider == "dashscope":
            return {
                "success": True,
                "provider": "dashscope",
                "voices": list(_DASHSCOPE_VOICES),
            }

        elif provider == "minimax":
            # MiniMax需要调用API获取声音列表
            if hasattr(tts_service, 'get_voice_list'):
                voice_response = await tts_service.get_voice_list()
                if voice_response and voice_response.get('success'):
                    data = voice_response.get('data', {})
                    return {
                        "success": True,
                        "provider": "minimax",
                        "data": data,
                    }
                else:
                    error_msg = voice_response.get('error') if voice_response else "Unknown error"
                    logger.error(f"Failed to get voice list from MiniMax: {error_msg}")
                    return {
                        "success": False,
                        "error": f"获取Minimax声音列表失败: {error_msg}",
                        "provider": "minimax"
                    }
            return {
                "success": False,
                "error": "获取Minimax声音列表失败: 服务不支持get_voice_list方法"
            }

        elif provider == "cosyvoice2-ex":
            # CosyVoice2-Ex需要调用API获取声音列表
            if hasattr(tts_service, 'get_voice_list'):
                try:
                    voice_response = await tts_service.get_voice_list()
                    if voice_response and voice_response.get('success'):
                        data = voice_response.get('data', {})
                        return {
                            "success": True,
                            "provider": "cosyvoice2-ex",
                            "data": data,
                        }
                    else:
                        error_msg = voice_response.get('error') if voice_response else "Unknown error"
                        logger.error(f"Failed to get voice list from CosyVoice2-Ex: {error_msg}")
                        return {
                            "success": False,
                            "error": f"获取CosyVoice2-Ex声音列表失败: {error_msg}",
                            "provider": "cosyvoice2-ex"
                        }
                except Exception as e:
                    logger.error(f"Failed to get voice list from CosyVoice2-Ex: {str(e)}")
                    return {
                        "success": False,
                        "error": f"获取CosyVoice2-Ex声音列表失败: {str(e)}",
                        "provider": "cosyvoice2-ex"
                    }
            return {
                "success": False,
                "error": "获取CosyVoice2-Ex声音列表失败: 服务不支持get_voice_list方法"
            }

        else:
            return {
                "success": False,
                "error": f"不支持的TTS提供商: {provider}"
            }

    except Exception as e:
        logger.error(f"Failed to get available voices: {str(e)}", exc_info=True)
        return {
            "success": False,
            "error": f"获取声音列表失败: {str(e)}"
        }


def _normalize_voice_item(item: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """把各 provider 的音色条目归一化为 {voice_id, name, gender?}"""
    voice_id = item.get("voice_id") or item.get("id")
    if not voice_id:
        return None
    name = item.get("voice_name") or item.get("name") or str(voice_id)
    normalized: Dict[str, Any] = {"voice_id": str(voice_id), "name": str(name)}
    if item.get("gender"):
        normalized["gender"] = str(item["gender"])
    return normalized


async def list_available_voices() -> Tuple[bool, List[Dict[str, Any]], str]:
    """获取归一化音色列表，供按 voice_id/名称/性别模糊匹配

    返回 (是否成功, 音色列表, 失败原因)
    """
    payload = await fetch_voices_payload()
    if not payload.get("success"):
        return False, [], payload.get("error") or "获取音色列表失败"

    voices: List[Dict[str, Any]] = []
    # dashscope：扁平 voices 列表
    for item in payload.get("voices") or []:
        if isinstance(item, dict):
            normalized = _normalize_voice_item(item)
            if normalized:
                voices.append(normalized)
    # minimax / cosyvoice2-ex：data 下按类别分组的列表
    data = payload.get("data") or {}
    if isinstance(data, dict):
        for group in data.values():
            if not isinstance(group, list):
                continue
            for item in group:
                if isinstance(item, dict):
                    normalized = _normalize_voice_item(item)
                    if normalized:
                        voices.append(normalized)

    if not voices:
        return False, [], "音色列表为空"
    return True, voices, ""
