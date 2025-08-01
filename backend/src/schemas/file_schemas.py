"""文件相关的Pydantic模型"""
from pydantic import BaseModel
from typing import Optional

class FileUploadResponse(BaseModel):
    success: bool
    message: str
    file_url: Optional[str] = None
    file_name: Optional[str] = None