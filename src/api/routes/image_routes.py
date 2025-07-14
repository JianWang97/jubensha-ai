"""图像生成相关的API路由"""
from fastapi import APIRouter, HTTPException, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional
from io import BytesIO
import logging

from ...services.comfyui_service import comfyui_service, ImageGenerationRequest

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/image", tags=["图像生成"])

class ImageGenerationRequestModel(BaseModel):
    """图像生成请求模型"""
    positive_prompt: str = Field(..., description="正向提示词", min_length=1)
    negative_prompt: str = Field("", description="反向提示词")
    width: int = Field(512, description="图像宽度", ge=64, le=2048)
    height: int = Field(720, description="图像高度", ge=64, le=2048)
    steps: int = Field(20, description="采样步数", ge=1, le=100)
    cfg: float = Field(8.0, description="CFG引导强度", ge=1.0, le=30.0)
    seed: Optional[int] = Field(None, description="随机种子")
    model: str = Field("AWPainting_v1.5.safetensors", description="使用的模型")
    sampler_name: str = Field("euler", description="采样器名称")
    scheduler: str = Field("normal", description="调度器")

class ImageGenerationResponseModel(BaseModel):
    """图像生成响应模型"""
    success: bool = Field(..., description="是否成功")
    filename: Optional[str] = Field(None, description="生成的文件名")
    prompt_id: Optional[str] = Field(None, description="提示词ID")
    error_message: Optional[str] = Field(None, description="错误信息")
    generation_time: Optional[float] = Field(None, description="生成耗时（秒）")

@router.post("/generate/download")
async def generate_and_download_image(
    request: ImageGenerationRequestModel
) -> StreamingResponse:
    """生成图像并直接返回图像文件"""
    
    # 转换请求模型
    generation_request = ImageGenerationRequest(
        positive_prompt=request.positive_prompt,
        negative_prompt=request.negative_prompt,
        width=request.width,
        height=request.height,
        steps=request.steps,
        cfg=request.cfg,
        seed=request.seed,
        model=request.model,
        sampler_name=request.sampler_name,
        scheduler=request.scheduler
    )
    
    # 调用服务生成图像
    result = await comfyui_service.generate_image(generation_request)
    
    if not result.success:
        raise HTTPException(status_code=500, detail=result.error_message)
    
    if not result.image_data:
        raise HTTPException(status_code=500, detail="图像数据为空")
    
    # 创建字节流
    image_stream = BytesIO(result.image_data)
    
    # 返回图像文件
    return StreamingResponse(
        image_stream,
        media_type="image/png",
        headers={
            "Content-Disposition": f"attachment; filename={result.filename}",
            "X-Generation-Time": str(result.generation_time),
            "X-Prompt-ID": result.prompt_id or ""
        }
    )


@router.get("/health")
async def health_check():
    """健康检查接口"""
    try:
        # 检查ComfyUI服务是否可用
        is_available = comfyui_service._check_server_connection()
        
        return {
            "status": "healthy" if is_available else "unhealthy",
            "comfyui_available": is_available,
            "service": "image_generation"
        }
    except Exception as e:
        logger.error(f"健康检查失败: {str(e)}")
        return {
            "status": "unhealthy",
            "comfyui_available": False,
            "service": "image_generation",
            "error": str(e)
        }