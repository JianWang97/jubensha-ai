"""图像生成服务抽象层"""
import os
from typing import Optional, Dict, Any, List
from abc import ABC, abstractmethod
from dataclasses import dataclass
from io import BytesIO
import base64
import requests
import asyncio

from .comfyui_service import ComfyUIService, ImageGenerationRequest as ComfyUIImageRequest
from .minimax_service import MiniMaxImageGenerationService

@dataclass
class ImageGenerationResult:
    """图像生成结果"""
    success: bool
    image_data: Optional[bytes] = None
    image_urls: Optional[List[str]] = None
    filename: Optional[str] = None
    error_message: Optional[str] = None
    generation_time: Optional[float] = None
    metadata: Optional[Dict[str, Any]] = None

@dataclass
class ImageGenerationRequest:
    """图像生成请求"""
    prompt: str
    negative_prompt: str = ""
    width: int = 512
    height: int = 720
    aspect_ratio: str = "1:1"
    steps: int = 20
    cfg: float = 8.0
    seed: Optional[int] = None
    model: str = "default"
    n: int = 1  # 生成图片数量

class ImageGenerationService(ABC):
    """图像生成服务抽象基类"""
    
    @abstractmethod
    async def generate_image(self, request: ImageGenerationRequest) -> ImageGenerationResult:
        """生成图像"""
        pass

class ComfyUIImageGenerationService(ImageGenerationService):
    """ComfyUI图像生成服务实现"""
    
    def __init__(self):
        self.comfyui_service = ComfyUIService()
    
    async def generate_image(self, request: ImageGenerationRequest) -> ImageGenerationResult:
        """生成图像"""
        comfyui_request = ComfyUIImageRequest(
            positive_prompt=request.prompt,
            negative_prompt=request.negative_prompt,
            width=request.width,
            height=request.height,
            steps=request.steps,
            cfg=request.cfg,
            seed=request.seed,
            model=request.model
        )
        
        response = await self.comfyui_service.generate_image(comfyui_request)
        
        return ImageGenerationResult(
            success=response.success,
            image_data=response.image_data,
            filename=response.filename,
            error_message=response.error_message,
            generation_time=response.generation_time
        )

class MiniMaxImageGenerationServiceAdapter(ImageGenerationService):
    """MiniMax图像生成服务适配器"""
    
    def __init__(self):
        self.minimax_service = None
        # 检查是否配置了MiniMax API密钥
        if os.getenv("MINIMAX_API_KEY"):
            from .minimax_service import MiniMaxImageGenerationService
            self.minimax_service = MiniMaxImageGenerationService()
    
    async def generate_image(self, request: ImageGenerationRequest) -> ImageGenerationResult:
        """生成图像"""
        if not self.minimax_service:
            return ImageGenerationResult(
                success=False,
                error_message="MiniMax API key not configured"
            )
        
        # 调用MiniMax服务生成图像
        response = await self.minimax_service.generate_image(
            prompt=request.prompt,
            aspect_ratio=request.aspect_ratio,
            n=request.n
        )
        
        if response["success"]:
            return ImageGenerationResult(
                success=True,
                image_urls=response["images"],
                metadata=response.get("metadata", {})
            )
        else:
            return ImageGenerationResult(
                success=False,
                error_message=response.get("error", "Unknown error")
            )

class ImageGenerationServiceFactory:
    """图像生成服务工厂"""
    
    @staticmethod
    def create_service(provider: Optional[str] = None) -> ImageGenerationService:
        """创建图像生成服务实例"""
        if not provider:
            # 从环境变量获取默认提供者
            provider = os.getenv("IMAGE_GENERATION_PROVIDER", "comfyui")
        
        provider = provider.lower()
        
        if provider == "minimax":
            return MiniMaxImageGenerationServiceAdapter()
        else:
            # 默认使用ComfyUI
            return ComfyUIImageGenerationService()

# 全局服务实例
image_generation_service = ImageGenerationServiceFactory.create_service()