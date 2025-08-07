"""图片生成相关的Pydantic模型"""
from pydantic import BaseModel
from typing import Optional, List
from enum import Enum

class ImageType(str, Enum):
    """图片类型枚举"""
    COVER = "COVER"       # 封面
    CHARACTER = "CHARACTER"  # 角色  
    EVIDENCE = "EVIDENCE"    # 证据
    SCENE = "SCENE"         # 场景

class ImageGenerationRequest(BaseModel):
    """图片生成请求模型"""
    image_type: ImageType
    script_id: int
    positive_prompt: Optional[str] = None  # 可选，如果不填使用默认提示词
    negative_prompt: Optional[str] = None

class ImageGenerationRequestModel(BaseModel):
    positive_prompt: str
    negative_prompt: str = ""
    script_id: int
    target_id: int  # 证据/头像/场景的ID
    width: int = 512
    height: int = 720
    steps: int = 20
    cfg: float = 8.0
    seed: Optional[int] = None

class ImageListRequest(BaseModel):
    """获取图片列表请求模型"""
    script_id: Optional[int] = None  # 可选，如果提供则返回该剧本的图片

class ImageResponse(BaseModel):
    """图片响应模型"""
    id: str
    image_type: str
    url: str
    script_id: int
    author_id: int
    positive_prompt: Optional[str]
    negative_prompt: Optional[str]
    width: Optional[str]
    height: Optional[str]
    created_at: Optional[str]

class ScriptCoverPromptRequest(BaseModel):
    """剧本封面提示词生成请求模型"""
    script_title: str
    script_description: str
    script_tags: Optional[List[str]] = None
    difficulty: Optional[str] = None
    style_preference: Optional[str] = None

class ScriptResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None