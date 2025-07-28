"""剧本对话式编辑API路由

提供剧本编辑相关的HTTP接口，配合WebSocket实现完整的编辑功能
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel

from ...db.repositories import ScriptRepository
from ...services.script_editor_service import ScriptEditorService, EditInstruction, EditResult
from ...schemas.script import Script, ScriptInfo
from ...schemas.base import APIResponse
from ...schemas.script_editor import (
    ParseInstructionRequest,
    ExecuteInstructionRequest,
    GenerateSuggestionRequest,
    BatchEditRequest,
    ParsedInstructionsResponse,
    EditResultResponse,
    BatchEditResponse
)
from ...db.session import get_db_session
from src.core.auth_dependencies import get_current_active_user
from src.db.models.user import User

router = APIRouter(prefix="/api/script-editor", tags=["剧本编辑"])



def get_script_repository(db: Session = Depends(get_db_session)) -> ScriptRepository:
    """获取剧本仓库实例"""
    return ScriptRepository(db)


def get_script_editor_service(repo: ScriptRepository = Depends(get_script_repository)) -> ScriptEditorService:
    """获取剧本编辑服务实例"""
    return ScriptEditorService(repo)


@router.post("/parse-instruction", response_model=APIResponse[ParsedInstructionsResponse])
async def parse_instruction(
    request: ParseInstructionRequest,
    current_user: User = Depends(get_current_active_user),
    editor_service: ScriptEditorService = Depends(get_script_editor_service)
) -> APIResponse[ParsedInstructionsResponse]:
    """解析用户的自然语言指令"""
    try:
        # 检查剧本权限
        script = editor_service.script_repository.get_script_by_id(request.script_id)
        if not script:
            raise HTTPException(status_code=404, detail="剧本不存在")
        
        if script.info.author != current_user.username:
            raise HTTPException(status_code=403, detail="无权限编辑此剧本")
        
        # 解析指令
        instructions = await editor_service.parse_user_instruction(
            request.instruction, request.script_id
        )
        
        response_data = ParsedInstructionsResponse(
            instructions=instructions,
            original_instruction=request.instruction
        )
        
        return APIResponse(
            success=True,
            data=response_data,
            message="指令解析成功"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"解析指令失败: {str(e)}")


@router.post("/execute-instruction", response_model=APIResponse[EditResultResponse])
async def execute_instruction(
    request: ExecuteInstructionRequest,
    current_user: User = Depends(get_current_active_user),
    editor_service: ScriptEditorService = Depends(get_script_editor_service)
) -> APIResponse[EditResultResponse]:
    """执行单个编辑指令"""
    try:
        # 检查剧本权限
        script = editor_service.script_repository.get_script_by_id(request.script_id)
        if not script:
            raise HTTPException(status_code=404, detail="剧本不存在")
        
        if script.info.author != current_user.username:
            raise HTTPException(status_code=403, detail="无权限编辑此剧本")
        
        # 执行指令
        result = await editor_service.execute_instruction(
            request.instruction, request.script_id
        )
        
        # 获取更新后的剧本
        updated_script = None
        if result.success:
            updated_script = editor_service.script_repository.get_script_by_id(request.script_id)
        
        response_data = EditResultResponse(
            result=result,
            updated_script=updated_script
        )
        
        return APIResponse(
            success=True,
            data=response_data,
            message="指令执行完成"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"执行指令失败: {str(e)}")


@router.post("/batch-edit", response_model=APIResponse[BatchEditResponse])
async def batch_edit(
    request: BatchEditRequest,
    current_user: User = Depends(get_current_active_user),
    editor_service: ScriptEditorService = Depends(get_script_editor_service)
) -> APIResponse[BatchEditResponse]:
    """批量执行编辑指令"""
    try:
        # 检查剧本权限
        script = editor_service.script_repository.get_script_by_id(request.script_id)
        if not script:
            raise HTTPException(status_code=404, detail="剧本不存在")
        
        if script.info.author != current_user.username:
            raise HTTPException(status_code=403, detail="无权限编辑此剧本")
        
        all_results = []
        
        # 逐个处理指令
        for instruction_text in request.instructions:
            try:
                # 解析指令
                instructions = await editor_service.parse_user_instruction(
                    instruction_text, request.script_id
                )
                
                # 执行每个解析出的指令
                for instruction in instructions:
                    result = await editor_service.execute_instruction(
                        instruction, request.script_id
                    )
                    all_results.append(result)
                    
            except Exception as e:
                # 如果某个指令失败，记录错误但继续处理其他指令
                error_result = EditResult(
                    success=False,
                    message=f"处理指令 '{instruction_text}' 失败: {str(e)}"
                )
                all_results.append(error_result)
        
        # 统计成功数量
        success_count = sum(1 for result in all_results if result.success)
        
        # 获取最终的剧本状态
        updated_script = None
        if success_count > 0:
            updated_script = editor_service.script_repository.get_script_by_id(request.script_id)
        
        response_data = BatchEditResponse(
            results=all_results,
            success_count=success_count,
            total_count=len(all_results),
            updated_script=updated_script
        )
        
        return APIResponse(
            success=True,
            data=response_data,
            message=f"批量编辑完成，成功 {success_count}/{len(all_results)} 个操作"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"批量编辑失败: {str(e)}")


@router.post("/generate-suggestion", response_model=APIResponse[str])
async def generate_suggestion(
    request: GenerateSuggestionRequest,
    current_user: User = Depends(get_current_active_user),
    editor_service: ScriptEditorService = Depends(get_script_editor_service)
) -> APIResponse[str]:
    """生成AI编辑建议"""
    try:
        # 检查剧本权限
        script = editor_service.script_repository.get_script_by_id(request.script_id)
        if not script:
            raise HTTPException(status_code=404, detail="剧本不存在")
        
        if script.info.author != current_user.username:
            raise HTTPException(status_code=403, detail="无权限访问此剧本")
        
        # 生成建议
        suggestion = await editor_service.generate_ai_suggestion(
            request.script_id, request.context
        )
        
        return APIResponse(
            success=True,
            data=suggestion,
            message="AI建议生成成功"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"生成建议失败: {str(e)}")


@router.get("/script/{script_id}/editing-context", response_model=APIResponse[Dict[str, Any]])
async def get_editing_context(
    script_id: int,
    current_user: User = Depends(get_current_active_user),
    editor_service: ScriptEditorService = Depends(get_script_editor_service)
) -> APIResponse[Dict[str, Any]]:
    """获取剧本编辑上下文信息"""
    try:
        # 检查剧本权限
        script = editor_service.script_repository.get_script_by_id(script_id)
        if not script:
            raise HTTPException(status_code=404, detail="剧本不存在")
        
        if script.info.author != current_user.username:
            raise HTTPException(status_code=403, detail="无权限访问此剧本")
        
        # 构建编辑上下文
        context = {
            "script_info": script.info.model_dump() if hasattr(script.info, 'model_dump') else script.info.__dict__,
            "characters_count": len(script.characters),
            "evidence_count": len(script.evidence),
            "locations_count": len(script.locations),
            "characters": [char.model_dump() if hasattr(char, 'model_dump') else char.__dict__ for char in script.characters],
            "evidence": [ev.model_dump() if hasattr(ev, 'model_dump') else ev.__dict__ for ev in script.evidence],
            "locations": [loc.model_dump() if hasattr(loc, 'model_dump') else loc.__dict__ for loc in script.locations],
            "editing_tips": [
                "可以说'添加一个角色'来创建新角色",
                "可以说'修改角色张三的描述'来更新角色信息",
                "可以说'删除证据X'来移除证据",
                "可以说'添加一个新场景'来创建场景",
                "可以说'更新剧本标题为X'来修改基本信息"
            ]
        }
        
        return APIResponse(
            success=True,
            data=context,
            message="编辑上下文获取成功"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取编辑上下文失败: {str(e)}")


@router.get("/script/{script_id}/validation", response_model=APIResponse[Dict[str, Any]])
async def validate_script(
    script_id: int,
    current_user: User = Depends(get_current_active_user),
    editor_service: ScriptEditorService = Depends(get_script_editor_service)
) -> APIResponse[Dict[str, Any]]:
    """验证剧本完整性"""
    try:
        # 检查剧本权限
        script = editor_service.script_repository.get_script_by_id(script_id)
        if not script:
            raise HTTPException(status_code=404, detail="剧本不存在")
        
        if script.info.author != current_user.username:
            raise HTTPException(status_code=403, detail="无权限访问此剧本")
        
        # 验证剧本
        validation_result = {
            "is_valid": True,
            "errors": [],
            "warnings": [],
            "suggestions": []
        }
        
        # 检查基本信息
        if not script.info.title or script.info.title.strip() == "":
            validation_result["errors"].append("剧本标题不能为空")
            validation_result["is_valid"] = False
        
        if not script.info.description or script.info.description.strip() == "":
            validation_result["warnings"].append("建议添加剧本描述")
        
        # 检查角色
        if len(script.characters) == 0:
            validation_result["errors"].append("剧本至少需要一个角色")
            validation_result["is_valid"] = False
        elif len(script.characters) < script.info.player_count:
            validation_result["warnings"].append(f"角色数量({len(script.characters)})少于玩家人数({script.info.player_count})")
        
        # 检查角色完整性
        for char in script.characters:
            if not char.name or char.name.strip() == "":
                validation_result["errors"].append("存在未命名的角色")
                validation_result["is_valid"] = False
            if hasattr(char, 'description') and (not char.description or char.description.strip() == ""):
                validation_result["warnings"].append(f"角色'{char.name}'缺少描述")
            elif hasattr(char, 'background') and (not char.background or char.background.strip() == ""):
                validation_result["warnings"].append(f"角色'{char.name}'缺少背景故事")
        
        # 检查证据
        if len(script.evidence) == 0:
            validation_result["warnings"].append("建议添加一些证据线索")
        
        # 检查场景
        if len(script.locations) == 0:
            validation_result["warnings"].append("建议添加一些场景")
        
        # 生成建议
        if len(script.characters) > 0 and len(script.evidence) == 0:
            validation_result["suggestions"].append("可以为每个角色添加相关的证据线索")
        
        if len(script.locations) == 0:
            validation_result["suggestions"].append("可以添加一些关键场景，如案发现场、角色住所等")
        
        return APIResponse(
            success=True,
            data=validation_result,
            message="剧本验证完成"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"验证剧本失败: {str(e)}")