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