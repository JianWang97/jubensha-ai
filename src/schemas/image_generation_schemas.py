"""图片生成相关的Pydantic模型"""
from pydantic import BaseModel
from typing import Optional

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

class ScriptCoverPromptRequest(BaseModel):
    """剧本封面提示词生成请求模型"""
    script_title: str
    script_description: str
    script_tags: Optional[list] = None
    difficulty: Optional[str] = None
    style_preference: Optional[str] = None

class ScriptResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None