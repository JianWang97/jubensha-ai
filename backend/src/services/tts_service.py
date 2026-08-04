"""TTS服务抽象层"""
from .base_tts import BaseTTSService


class TTSService:
    """TTS服务工厂"""
    
    @staticmethod
    def create_service(provider: str, **config) -> BaseTTSService:
        """创建TTS服务实例"""
        if not provider:
            raise ValueError("TTS provider cannot be None or empty")
        
        provider_lower = provider.lower()
        if provider_lower == "minimax":
            # 延迟导入避免循环依赖
            from .minimax_service import MiniMaxTTSService
            return MiniMaxTTSService(**config)
        elif provider_lower == "cosyvoice2-ex":
            # 延迟导入避免循环依赖
            from .cosyvoice_service import CosyVoice2ExTTSService
            return CosyVoice2ExTTSService(**config)
        else:
            raise ValueError(f"Unsupported TTS provider: {provider}")
    
    @staticmethod
    def from_config(config) -> BaseTTSService:
        """从配置创建TTS服务"""
        return TTSService.create_service(
            provider=config.provider,
            api_key=config.api_key,
            model=config.model,
            **(config.extra_params or {})
        )


# 模块级缓存，保证容器单例与各处获取到的实例一致
_tts_service_instance: BaseTTSService | None = None


def _get_or_create_tts_service() -> BaseTTSService:
    """创建或返回缓存的TTS服务实例（作为DI容器的注册工厂）"""
    global _tts_service_instance
    if _tts_service_instance is None:
        from ..core.config import config
        _tts_service_instance = TTSService.from_config(config.tts_config)
    return _tts_service_instance


def get_tts_service() -> BaseTTSService:
    """获取全局TTS服务实例

    优先从DI容器解析（需先调用 configure_services()）；
    容器未配置时回退到按配置创建，保持与每次 from_config 等效的行为。
    """
    global _tts_service_instance
    if _tts_service_instance is not None:
        return _tts_service_instance
    try:
        from ..core.dependency_container import container
        service = container.resolve(BaseTTSService)
    except Exception:
        service = _get_or_create_tts_service()
    _tts_service_instance = service
    return service