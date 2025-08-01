"""剧本编辑相关Schema定义

包含剧本对话式编辑功能所需的各种请求和响应模型
"""

from typing import List, Optional
from pydantic import BaseModel

from .script import Script
from ..services.script_editor_service import EditInstruction, EditResult


class ParseInstructionRequest(BaseModel):
    """解析指令请求"""
    instruction: str
    script_id: int


class ExecuteInstructionRequest(BaseModel):
    """执行指令请求"""
    instruction: EditInstruction
    script_id: int


class GenerateSuggestionRequest(BaseModel):
    """生成建议请求"""
    script_id: int
    context: str = ""


class BatchEditRequest(BaseModel):
    """批量编辑请求"""
    instructions: List[str]
    script_id: int


class ParsedInstructionsResponse(BaseModel):
    """解析指令响应"""
    instructions: List[EditInstruction]
    original_instruction: str


class EditResultResponse(BaseModel):
    """编辑结果响应"""
    result: EditResult
    updated_script: Optional[Script] = None


class BatchEditResponse(BaseModel):
    """批量编辑响应"""
    results: List[EditResult]
    success_count: int
    total_count: int
    updated_script: Optional[Script] = None