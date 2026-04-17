"""剧本相关的API请求模型"""
from typing import List, Optional
from pydantic import BaseModel


class GenerateScriptContentRequest(BaseModel):
    """根据剧本背景生成角色和证据的请求模型"""
    script_id: int
    theme: str
    background_story: str
    player_count: int
    script_type: Optional[str] = None


class GenerateScriptInfoRequest(BaseModel):
    """生成剧本信息请求模型"""
    theme: str
    script_type: Optional[str] = None
    player_count: Optional[str] = None


class CreateScriptRequest(BaseModel):
    """创建剧本请求模型"""
    title: str
    description: str
    player_count: int
    estimated_duration: Optional[int] = 180
    difficulty: Optional[str] = "medium"
    category: Optional[str] = "推理"
    tags: Optional[List[str]] = []
    author: Optional[str] = None
    # 灵感相关字段
    inspiration_type: Optional[str] = None
    inspiration_content: Optional[str] = None
    background_story: Optional[str] = None