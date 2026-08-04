"""剧本对话式编辑服务

提供剧本编辑操作的校验与增量落库（execute_instruction 及五类 handler），
供 ScriptEditingAgent 的工具与 HTTP 编辑路由复用。
自然语言理解由 agents.script_editing_agent（ReAct 工具调用）负责。
"""

import json
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional, Union, TYPE_CHECKING
from pydantic import BaseModel

from ..services.llm_service import llm_service, LLMMessage
from ..schemas.script import Script, ScriptCharacter, ScriptEvidence, ScriptLocation
from ..schemas.script_evidence import EvidenceType

if TYPE_CHECKING:
    from ..db.repositories.script_repository import ScriptRepository
else:
    # 在运行时导入，避免循环导入
    try:
        from ..db.repositories.script_repository import ScriptRepository
    except ImportError:
        # 如果导入失败，定义一个占位符类
        class ScriptRepository:
            pass

logger = logging.getLogger(__name__)

# 编辑过程事件的步骤中文名（与前端 script_edit_event 契约一致）
# 步骤取值对应 ScriptEditingAgent 的工具域
EDIT_STEP_NAME = {
    "plan": "规划",
    "characters": "角色管理",
    "evidence": "证据管理",
    "locations": "场景管理",
    "script_info": "剧本信息",
    "background_story": "背景故事",
    "game_phases": "游戏阶段",
    "voice": "音色绑定",
}


def _make_edit_event(event_type: str, step: str, content: str = "",
                     kind: Optional[str] = None, data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """构建编辑过程事件（经 script_edit_event 消息广播给前端）"""
    return {
        "type": event_type,
        "step": step,
        "step_name": EDIT_STEP_NAME.get(step),
        "content": content,
        "kind": kind,
        "data": data,
        "timestamp": datetime.now().isoformat(),
    }


async def _emit_edit_event(event_callback, event_type: str, step: str, content: str = "",
                           kind: Optional[str] = None, data: Optional[Dict[str, Any]] = None):
    """发送编辑事件给回调（前端展示用），回调异常不影响主流程"""
    if event_callback is None:
        return
    try:
        await event_callback(_make_edit_event(event_type, step, content, kind, data))
    except Exception as e:
        logger.error(f"[SCRIPT_EDIT] 事件回调失败: {e}")


class EditInstruction(BaseModel):
    """编辑指令"""
    action: str
    target: str
    content: Dict[str, Any]
    description: str


class EditResult(BaseModel):
    """编辑结果"""
    success: bool
    message: str
    data: Optional[Dict[str, Any]] = None
    updated_script: Optional[Script] = None


class ScriptEditorService:
    """剧本编辑服务"""
    
    def __init__(self, script_repository: ScriptRepository):
        self.script_repository = script_repository

    def _format_characters(self, characters: List[ScriptCharacter]) -> str:
        """格式化角色列表"""
        if not characters:
            return "无"
        return "\n".join([f"- {char.name}: {char.background}" for char in characters])
    
    def _format_evidence(self, evidence: List[ScriptEvidence]) -> str:
        """格式化证据列表"""
        if not evidence:
            return "无"
        return "\n".join([f"- {ev.name}: {ev.description}" for ev in evidence])
    
    def _format_locations(self, locations: List[ScriptLocation]) -> str:
        """格式化场景列表"""
        if not locations:
            return "无"
        return "\n".join([f"- {loc.name}: {loc.description}" for loc in locations])
    
    async def execute_instruction(self, instruction: EditInstruction, script_id: int) -> EditResult:
        """执行编辑指令"""
        logger.info(f"[SCRIPT_EDIT] 开始执行编辑指令 - 剧本ID: {script_id}, 操作: {instruction.action}, 目标: {instruction.target}")
        logger.debug(f"[SCRIPT_EDIT] 指令详情: {instruction.model_dump()}")
        
        try:
            # 使会话中已加载的ORM对象失效，确保同一会话内能读到之前指令 flush 的最新状态
            self.script_repository.db.expire_all()
            
            # 获取当前剧本
            current_script = self.script_repository.get_script_by_id(script_id)
            if not current_script:
                logger.error(f"[SCRIPT_EDIT] 剧本不存在 - ID: {script_id}")
                return EditResult(
                    success=False,
                    message=f"剧本 {script_id} 不存在"
                )
            
            # 记录操作前的状态
            before_state = self._get_script_state_summary(current_script)
            logger.info(f"[SCRIPT_EDIT] 操作前状态: {before_state}")
            
            # 根据指令类型执行相应操作
            if instruction.target == "character":
                result = await self._handle_character_instruction(instruction, current_script)
            elif instruction.target == "evidence":
                result = await self._handle_evidence_instruction(instruction, current_script)
            elif instruction.target == "location":
                result = await self._handle_location_instruction(instruction, current_script)
            elif instruction.target == "info":
                result = await self._handle_info_instruction(instruction, current_script)
            elif instruction.target == "story":
                result = await self._handle_story_instruction(instruction, current_script)
            else:
                logger.warning(f"[SCRIPT_EDIT] 不支持的目标类型: {instruction.target}")
                return EditResult(
                    success=False,
                    message=f"不支持的目标类型: {instruction.target}"
                )
            
            # 记录操作结果
            if result.success:
                logger.info(f"[SCRIPT_EDIT] 操作成功: {result.message}")
                if result.updated_script:
                    after_state = self._get_script_state_summary(result.updated_script)
                    logger.info(f"[SCRIPT_EDIT] 操作后状态: {after_state}")
                    
                    # 记录具体变更内容
                    changes = self._get_changes_detail(before_state, after_state, instruction)
                    logger.info(f"[SCRIPT_EDIT] 具体变更: {changes}")
                
                # 各处理器已通过增量方法完成 flush，此处不再整体重建剧本；
                # 事务由调用方（websocket_server）在全部指令执行成功后统一 commit
                # 使会话缓存失效，保证调用方后续读取（如HTTP路由重读剧本）拿到最新状态
                self.script_repository.db.expire_all()
                logger.info(f"[SCRIPT_EDIT] 数据库增量更新完成（待统一提交）")
            else:
                logger.warning(f"[SCRIPT_EDIT] 操作失败: {result.message}")
            
            return result
            
        except Exception as e:
            logger.error(f"[SCRIPT_EDIT] 执行指令异常: {str(e)}", exc_info=True)
            return EditResult(
                success=False,
                message=f"执行指令失败: {str(e)}"
            )
    
    async def _handle_character_instruction(self, instruction: EditInstruction, script: Script) -> EditResult:
        """处理角色相关指令"""
        logger.info(f"[CHARACTER_EDIT] 处理角色指令 - 操作: {instruction.action}")
        
        if instruction.action == "add":
            # 验证必填字段
            required_fields = ["name", "profession", "background", "secret", "objective", "gender"]
            missing_fields = []
            for field in required_fields:
                if not instruction.content.get(field):
                    missing_fields.append(field)
            
            # 检查特殊必填字段
            if not instruction.content.get("personality_traits"):
                missing_fields.append("personality_traits")
            
            if len(missing_fields) > 0:
                logger.warning(f"[CHARACTER_EDIT] 添加角色失败: 缺少必填字段 {missing_fields}")
                return EditResult(
                    success=False, 
                    message=f"添加角色失败: 缺少必填字段 {missing_fields}，请提供完整信息"
                )
            
            # 验证字段内容质量
            content_issues = []
            if len(instruction.content.get("background", "")) < 50:
                content_issues.append("背景描述至少需要50个字符")
            
            if len(instruction.content.get("secret", "")) < 20:
                content_issues.append("角色秘密至少需要20个字符")
            
            if len(instruction.content.get("objective", "")) < 15:
                content_issues.append("角色目标至少需要15个字符")
            
            if not isinstance(instruction.content.get("personality_traits"), list) or \
               len(instruction.content.get("personality_traits", [])) < 2:
                content_issues.append("性格特征至少需要2个")
            
            gender = instruction.content.get("gender", "").lower()
            if gender not in ["男", "女", "中性"]:
                content_issues.append("性别必须是：男、女、中性之一")
            
            if content_issues:
                logger.warning(f"[CHARACTER_EDIT] 添加角色失败: 内容质量问题 {content_issues}")
                return EditResult(
                    success=False,
                    message=f"添加角色失败: {', '.join(content_issues)}"
                )
            
            # 添加新角色
            character_data = {
                "script_id": script.info.id,
                "name": str(instruction.content["name"]),
                "profession": str(instruction.content["profession"]),
                "background": str(instruction.content["background"]),
                "secret": str(instruction.content["secret"]),
                "objective": str(instruction.content["objective"]),
                "gender": str(instruction.content["gender"]),
                "is_murderer": bool(instruction.content.get("is_murderer", False)),
                "is_victim": bool(instruction.content.get("is_victim", False))
            }
            
            # 添加可选字段
            if "age" in instruction.content:
                try:
                    character_data["age"] = int(instruction.content["age"])
                except (ValueError, TypeError):
                    pass  # 如果年龄不是有效数字，则忽略
            
            if "personality_traits" in instruction.content and \
               isinstance(instruction.content["personality_traits"], list):
                character_data["personality_traits"] = instruction.content["personality_traits"]

            # 其他可选字段
            
            logger.info(f"[CHARACTER_EDIT] 准备添加角色数据: {character_data}")
            
            new_character = ScriptCharacter(**character_data)
            # 增量落库（仅 flush，事务由调用方统一提交）
            persisted_character = self.script_repository.add_character(new_character)
            script.characters.append(persisted_character)
            
            logger.info(f"[CHARACTER_EDIT] 成功添加角色: {persisted_character.name}, 当前角色总数: {len(script.characters)}")
            
            return EditResult(
                success=True,
                message=f"成功添加角色: {persisted_character.name}",
                data={"character": persisted_character.model_dump()},
                updated_script=script
            )
        
        elif instruction.action == "update" or instruction.action == "modify":
            # 更新现有角色
            character_name = instruction.content.get("name")
            if not character_name:
                logger.warning(f"[CHARACTER_EDIT] 更新角色失败: 缺少角色名称")
                return EditResult(success=False, message="缺少角色名称")
            
            # 查找角色
            character = None
            for char in script.characters:
                if char.name == character_name:
                    character = char
                    break
            
            if not character:
                logger.warning(f"[CHARACTER_EDIT] 更新角色失败: 未找到角色 {character_name}")
                return EditResult(success=False, message=f"未找到角色: {character_name}")
            
            # 记录更新前的状态
            before_update = character.model_dump()
            logger.info(f"[CHARACTER_EDIT] 更新前角色状态: {before_update}")
            
            # 构建增量更新数据（类型转换逻辑与原内存修改保持一致）
            update_data = {}
            updated_fields = []
            for key, value in instruction.content.items():
                if hasattr(character, key) and key != "id" and key != "script_id":
                    old_value = getattr(character, key)
                    
                    # 根据字段类型进行适当的类型转换
                    if key == "age" and value is not None:
                        try:
                            value = int(value) if isinstance(value, (int, str)) and str(value).isdigit() else None
                        except (ValueError, TypeError):
                            logger.warning(f"[CHARACTER_EDIT] 年龄字段类型转换失败: {value}")
                            value = old_value
                    elif key in ["name", "profession", "background", "secret", "objective", "gender", "avatar_url", "voice_preference", "voice_id"] and value is not None:
                        value = str(value)
                    elif key == "personality_traits" and value is not None:
                        if isinstance(value, list):
                            value = [str(trait) for trait in value]
                        elif isinstance(value, str):
                            # 如果是字符串，尝试解析为列表
                            try:
                                import json
                                value = json.loads(value)
                                if isinstance(value, list):
                                    value = [str(trait) for trait in value]
                                else:
                                    value = [str(value)]
                            except:
                                value = [str(value)]
                        else:
                            value = old_value
                    elif key in ["is_murderer", "is_victim"] and value is not None:
                        value = bool(value)
                    
                    update_data[key] = value
                    updated_fields.append(f"{key}: {old_value} -> {value}")
            
            logger.info(f"[CHARACTER_EDIT] 角色 '{character_name}' 字段更新: {'; '.join(updated_fields)}")
            
            # 增量落库（仅 flush，事务由调用方统一提交）
            updated_character = self.script_repository.update_character_by_name(script.info.id, character_name, update_data)
            if not updated_character:
                logger.warning(f"[CHARACTER_EDIT] 更新角色失败: 数据库中未找到角色 {character_name}")
                return EditResult(success=False, message=f"未找到角色: {character_name}")
            
            # 同步内存中的剧本快照
            for i, char in enumerate(script.characters):
                if char.name == character_name:
                    script.characters[i] = updated_character
                    break
            
            return EditResult(
                success=True,
                message=f"成功更新角色: {updated_character.name}",
                data={"character": updated_character.model_dump()},
                updated_script=script
            )
        
        elif instruction.action == "delete":
            # 删除角色
            character_name = instruction.content.get("name")
            if not character_name:
                logger.warning(f"[CHARACTER_EDIT] 删除角色失败: 缺少角色名称")
                return EditResult(success=False, message="缺少角色名称")
            
            # 查找并删除角色
            for i, char in enumerate(script.characters):
                if char.name == character_name:
                    deleted_character = char.model_dump()
                    logger.info(f"[CHARACTER_EDIT] 准备删除角色: {deleted_character}")
                    
                    # 增量落库（仅 flush，事务由调用方统一提交）
                    if not self.script_repository.delete_character_by_name(script.info.id, character_name):
                        logger.warning(f"[CHARACTER_EDIT] 删除角色失败: 数据库中未找到角色 {character_name}")
                        return EditResult(success=False, message=f"未找到角色: {character_name}")
                    
                    del script.characters[i]
                    
                    logger.info(f"[CHARACTER_EDIT] 成功删除角色: {character_name}, 剩余角色数: {len(script.characters)}")
                    
                    return EditResult(
                        success=True,
                        message=f"成功删除角色: {character_name}",
                        updated_script=script
                    )
            
            logger.warning(f"[CHARACTER_EDIT] 删除角色失败: 未找到角色 {character_name}")
            return EditResult(success=False, message=f"未找到角色: {character_name}")
        
        return EditResult(success=False, message=f"不支持的角色操作: {instruction.action}")
    
    async def _handle_evidence_instruction(self, instruction: EditInstruction, script: Script) -> EditResult:
        """处理证据相关指令"""
        logger.info(f"[EVIDENCE_EDIT] 处理证据指令 - 操作: {instruction.action}")
        
        if instruction.action == "add":
            # 添加新证据
            evidence_type_value = instruction.content.get("evidence_type", "PHYSICAL")
            if isinstance(evidence_type_value, str):
                try:
                    evidence_type = EvidenceType(evidence_type_value)
                except ValueError:
                    evidence_type = EvidenceType.PHYSICAL
            else:
                evidence_type = EvidenceType.PHYSICAL
                
            evidence_data = {
                "script_id": script.info.id,
                "name": str(instruction.content.get("name", "新证据")),
                "description": str(instruction.content.get("description", "")),
                "location": str(instruction.content.get("location", "")),
                "related_to": str(instruction.content.get("related_to", "")),
                "significance": str(instruction.content.get("significance", "")),
                "evidence_type": evidence_type,
                "importance": str(instruction.content.get("importance", "重要证据")),
                "is_hidden": bool(instruction.content.get("is_hidden", False))
            }
            
            # 添加可选字段
            
            logger.info(f"[EVIDENCE_EDIT] 准备添加证据数据: {evidence_data}")
            
            new_evidence = ScriptEvidence(**evidence_data)
            # 增量落库（仅 flush，事务由调用方统一提交）
            persisted_evidence = self.script_repository.add_evidence(new_evidence)
            script.evidence.append(persisted_evidence)
            
            logger.info(f"[EVIDENCE_EDIT] 成功添加证据: {persisted_evidence.name}, 当前证据总数: {len(script.evidence)}")
            
            return EditResult(
                success=True,
                message=f"成功添加证据: {persisted_evidence.name}",
                data={"evidence": persisted_evidence.model_dump()},
                updated_script=script
            )
        
        elif instruction.action == "update" or instruction.action == "modify":
            # 更新现有证据
            evidence_name = instruction.content.get("name")
            if not evidence_name:
                logger.warning(f"[EVIDENCE_EDIT] 更新证据失败: 缺少证据名称")
                return EditResult(success=False, message="缺少证据名称")
            
            # 查找证据
            evidence = None
            for ev in script.evidence:
                if ev.name == evidence_name:
                    evidence = ev
                    break
            
            if not evidence:
                logger.warning(f"[EVIDENCE_EDIT] 更新证据失败: 未找到证据 {evidence_name}")
                return EditResult(success=False, message=f"未找到证据: {evidence_name}")
            
            # 记录更新前的状态
            before_update = evidence.model_dump()
            logger.info(f"[EVIDENCE_EDIT] 更新前证据状态: {before_update}")
            
            # 构建增量更新数据（类型转换逻辑与原内存修改保持一致）
            update_data = {}
            updated_fields = []
            for key, value in instruction.content.items():
                if hasattr(evidence, key) and key != "id" and key != "script_id":
                    old_value = getattr(evidence, key)
                    if key == "evidence_type" and isinstance(value, str):
                        # 校验证据类型合法性，非法值会抛出 ValueError（与原行为一致）
                        update_data[key] = EvidenceType(value).value
                    else:
                        update_data[key] = value
                    updated_fields.append(f"{key}: {old_value} -> {value}")
            
            logger.info(f"[EVIDENCE_EDIT] 证据 '{evidence_name}' 字段更新: {'; '.join(updated_fields)}")
            
            # 增量落库（仅 flush，事务由调用方统一提交）
            updated_evidence = self.script_repository.update_evidence_by_name(script.info.id, evidence_name, update_data)
            if not updated_evidence:
                logger.warning(f"[EVIDENCE_EDIT] 更新证据失败: 数据库中未找到证据 {evidence_name}")
                return EditResult(success=False, message=f"未找到证据: {evidence_name}")
            
            # 同步内存中的剧本快照
            for i, ev in enumerate(script.evidence):
                if ev.name == evidence_name:
                    script.evidence[i] = updated_evidence
                    break
            
            return EditResult(
                success=True,
                message=f"成功更新证据: {updated_evidence.name}",
                data={"evidence": updated_evidence.model_dump()},
                updated_script=script
            )
        
        elif instruction.action == "delete":
            # 删除证据
            evidence_name = instruction.content.get("name")
            if not evidence_name:
                logger.warning(f"[EVIDENCE_EDIT] 删除证据失败: 缺少证据名称")
                return EditResult(success=False, message="缺少证据名称")
            
            # 查找并删除证据
            for i, ev in enumerate(script.evidence):
                if ev.name == evidence_name:
                    deleted_evidence = ev.model_dump()
                    logger.info(f"[EVIDENCE_EDIT] 准备删除证据: {deleted_evidence}")
                    
                    # 增量落库（仅 flush，事务由调用方统一提交）
                    if not self.script_repository.delete_evidence_by_name(script.info.id, evidence_name):
                        logger.warning(f"[EVIDENCE_EDIT] 删除证据失败: 数据库中未找到证据 {evidence_name}")
                        return EditResult(success=False, message=f"未找到证据: {evidence_name}")
                    
                    del script.evidence[i]
                    
                    logger.info(f"[EVIDENCE_EDIT] 成功删除证据: {evidence_name}, 剩余证据数: {len(script.evidence)}")
                    
                    return EditResult(
                        success=True,
                        message=f"成功删除证据: {evidence_name}",
                        updated_script=script
                    )
            
            logger.warning(f"[EVIDENCE_EDIT] 删除证据失败: 未找到证据 {evidence_name}")
            return EditResult(success=False, message=f"未找到证据: {evidence_name}")
        
        return EditResult(success=False, message=f"不支持的证据操作: {instruction.action}")
    
    async def _handle_location_instruction(self, instruction: EditInstruction, script: Script) -> EditResult:
        """处理场景相关指令"""
        logger.info(f"[LOCATION_EDIT] 处理场景指令 - 操作: {instruction.action}")
        
        if instruction.action == "add":
            # 添加新场景
            location_data = {
                "script_id": script.info.id,
                "name": str(instruction.content.get("name", "新场景")),
                "description": str(instruction.content.get("description", "")),
                "searchable_items": list(instruction.content.get("searchable_items", [])),
                "is_crime_scene": bool(instruction.content.get("is_crime_scene", False))
            }
            
            logger.info(f"[LOCATION_EDIT] 准备添加场景数据: {location_data}")
            
            new_location = ScriptLocation(**location_data)
            # 增量落库（仅 flush，事务由调用方统一提交）
            persisted_location = self.script_repository.add_location(new_location)
            script.locations.append(persisted_location)
            
            logger.info(f"[LOCATION_EDIT] 成功添加场景: {persisted_location.name}, 当前场景总数: {len(script.locations)}")
            
            return EditResult(
                success=True,
                message=f"成功添加场景: {persisted_location.name}",
                data={"location": persisted_location.model_dump()},
                updated_script=script
            )
        
        elif instruction.action == "update" or instruction.action == "modify":
            # 更新现有场景
            location_name = instruction.content.get("name")
            if not location_name:
                logger.warning(f"[LOCATION_EDIT] 更新场景失败: 缺少场景名称")
                return EditResult(success=False, message="缺少场景名称")
            
            # 查找场景
            location = None
            for loc in script.locations:
                if loc.name == location_name:
                    location = loc
                    break
            
            if not location:
                logger.warning(f"[LOCATION_EDIT] 更新场景失败: 未找到场景 {location_name}")
                return EditResult(success=False, message=f"未找到场景: {location_name}")
            
            # 记录更新前的状态
            before_update = location.model_dump()
            logger.info(f"[LOCATION_EDIT] 更新前场景状态: {before_update}")
            
            # 构建增量更新数据
            update_data = {}
            updated_fields = []
            for key, value in instruction.content.items():
                if hasattr(location, key) and key != "id" and key != "script_id":
                    old_value = getattr(location, key)
                    update_data[key] = value
                    updated_fields.append(f"{key}: {old_value} -> {value}")
            
            logger.info(f"[LOCATION_EDIT] 场景 '{location_name}' 字段更新: {'; '.join(updated_fields)}")
            
            # 增量落库（仅 flush，事务由调用方统一提交）
            updated_location = self.script_repository.update_location_by_name(script.info.id, location_name, update_data)
            if not updated_location:
                logger.warning(f"[LOCATION_EDIT] 更新场景失败: 数据库中未找到场景 {location_name}")
                return EditResult(success=False, message=f"未找到场景: {location_name}")
            
            # 同步内存中的剧本快照
            for i, loc in enumerate(script.locations):
                if loc.name == location_name:
                    script.locations[i] = updated_location
                    break
            
            return EditResult(
                success=True,
                message=f"成功更新场景: {updated_location.name}",
                data={"location": updated_location.model_dump()},
                updated_script=script
            )
        
        elif instruction.action == "delete":
            # 删除场景
            location_name = instruction.content.get("name")
            if not location_name:
                logger.warning(f"[LOCATION_EDIT] 删除场景失败: 缺少场景名称")
                return EditResult(success=False, message="缺少场景名称")
            
            # 查找并删除场景
            for i, loc in enumerate(script.locations):
                if loc.name == location_name:
                    deleted_location = loc.model_dump()
                    logger.info(f"[LOCATION_EDIT] 准备删除场景: {deleted_location}")
                    
                    # 增量落库（仅 flush，事务由调用方统一提交）
                    if not self.script_repository.delete_location_by_name(script.info.id, location_name):
                        logger.warning(f"[LOCATION_EDIT] 删除场景失败: 数据库中未找到场景 {location_name}")
                        return EditResult(success=False, message=f"未找到场景: {location_name}")
                    
                    del script.locations[i]
                    
                    logger.info(f"[LOCATION_EDIT] 成功删除场景: {location_name}, 剩余场景数: {len(script.locations)}")
                    
                    return EditResult(
                        success=True,
                        message=f"成功删除场景: {location_name}",
                        updated_script=script
                    )
            
            logger.warning(f"[LOCATION_EDIT] 删除场景失败: 未找到场景 {location_name}")
            return EditResult(success=False, message=f"未找到场景: {location_name}")
        
        return EditResult(success=False, message=f"不支持的场景操作: {instruction.action}")
    
    async def _handle_info_instruction(self, instruction: EditInstruction, script: Script) -> EditResult:
        """处理剧本信息相关指令"""
        logger.info(f"[INFO_EDIT] 处理剧本信息指令 - 操作: {instruction.action}")
        
        if instruction.action == "update" or instruction.action == "modify":
            # 记录更新前的状态
            before_update = script.info.model_dump()
            logger.info(f"[INFO_EDIT] 更新前剧本信息: {before_update}")
            
            # 更新剧本基本信息
            update_data = {}
            updated_fields = []
            for key, value in instruction.content.items():
                if hasattr(script.info, key) and key not in ["id", "author", "created_at", "updated_at"]:
                    old_value = getattr(script.info, key)
                    # 根据字段类型进行适当的类型转换
                    if key == "player_count" and value is not None:
                        value = int(value) if isinstance(value, (int, str)) and str(value).isdigit() else old_value
                    elif key in ["title", "description", "difficulty", "theme", "tags"] and value is not None:
                        # 标签等列表字段保持列表形式，避免字符串化后无法通过校验
                        value = [str(item) for item in value] if isinstance(value, list) else str(value)
                    elif key == "estimated_duration" and value is not None:
                        value = int(value) if isinstance(value, (int, str)) and str(value).isdigit() else old_value
                    elif key in ["is_published", "is_featured"] and value is not None:
                        value = bool(value)
                    
                    setattr(script.info, key, value)
                    update_data[key] = value
                    updated_fields.append(f"{key}: {old_value} -> {value}")
            
            logger.info(f"[INFO_EDIT] 剧本信息字段更新: {'; '.join(updated_fields)}")
            
            # Pydantic字段名与数据库列名不一致的字段做映射
            db_field_mapping = {
                "estimated_duration": "duration_minutes",
                "difficulty_level": "difficulty",
            }
            db_update_data = {db_field_mapping.get(key, key): value for key, value in update_data.items()}
            
            # 增量落库（仅 flush，事务由调用方统一提交）
            self.script_repository.update_script_info_fields(script.info.id, db_update_data)
            
            return EditResult(
                success=True,
                message="成功更新剧本信息",
                data={"info": script.info.model_dump()},
                updated_script=script
            )
        
        logger.warning(f"[INFO_EDIT] 不支持的剧本信息操作: {instruction.action}")
        return EditResult(success=False, message=f"不支持的剧本信息操作: {instruction.action}")
    
    async def _handle_story_instruction(self, instruction: EditInstruction, script: Script) -> EditResult:
        """处理背景故事相关指令"""
        logger.info(f"[STORY_EDIT] 处理背景故事指令 - 操作: {instruction.action}")
        
        if instruction.action == "update" or instruction.action == "modify":
            try:
                # 准备更新数据
                story_data = {}
                
                # 处理所有支持的背景故事字段
                supported_fields = [
                    "title", "setting_description", "incident_description", 
                    "victim_background", "investigation_scope", "rules_reminder",
                    "murder_method", "murder_location", "discovery_time", "victory_conditions"
                ]
                
                # 处理具体字段内容
                for field in supported_fields:
                    if field in instruction.content:
                        story_data[field] = instruction.content[field]
                
                # 智能字段映射 - 处理用户可能使用的别名
                field_mapping = {
                    "story": "setting_description",
                    "description": "setting_description", 
                    "content": "setting_description",
                    "background": "setting_description",
                    "event": "incident_description",
                    "incident": "incident_description",
                    "victim": "victim_background",
                    "scope": "investigation_scope",
                    "rules": "rules_reminder",
                    "method": "murder_method",
                    "location": "murder_location",
                    "time": "discovery_time",
                    "victory": "victory_conditions"
                }
                
                # 应用字段映射
                for alias, actual_field in field_mapping.items():
                    if alias in instruction.content and actual_field not in story_data:
                        story_data[actual_field] = instruction.content[alias]
                
                # AI智能生成缺失字段（仅在明确要求时）
                if "generate_missing" in instruction.content:
                    story_data = await self._generate_missing_story_fields(dict(story_data), script)
                
                # 如果没有指定具体字段，尝试从通用字段中提取
                if not story_data:
                    if "story" in instruction.content:
                        story_data["setting_description"] = instruction.content["story"]
                    elif "description" in instruction.content:
                        story_data["setting_description"] = instruction.content["description"]
                    elif "content" in instruction.content:
                        story_data["setting_description"] = instruction.content["content"]
                    else:
                        # 如果用户直接输入了新的故事内容
                        story_content = str(instruction.content)
                        if story_content and story_content != "{}":
                            story_data["setting_description"] = story_content
                
                if not story_data:
                    return EditResult(success=False, message="未提供有效的背景故事内容")
                
                # 增量落库：按剧本维度 upsert（仅 flush，事务由调用方统一提交）
                had_story = bool(script.background_story)
                persisted_story = self.script_repository.upsert_background_story(script.info.id, story_data)
                script.background_story = persisted_story
                if had_story:
                    logger.info(f"[STORY_EDIT] 更新现有背景故事: {list(story_data.keys())}")
                else:
                    logger.info(f"[STORY_EDIT] 创建新背景故事: {list(story_data.keys())}")
                
                logger.info(f"[STORY_EDIT] 成功更新背景故事")
                return EditResult(
                    success=True,
                    message=f"成功更新背景故事 ({len(story_data)}个字段)",
                    data={"background_story": persisted_story.model_dump()},
                    updated_script=script
                )
                    
            except Exception as e:
                logger.error(f"[STORY_EDIT] 背景故事更新异常: {str(e)}")
                return EditResult(success=False, message=f"背景故事更新失败: {str(e)}")
        
        logger.warning(f"[STORY_EDIT] 不支持的背景故事操作: {instruction.action}")
        return EditResult(success=False, message=f"不支持的背景故事操作: {instruction.action}")
    
    async def _generate_missing_story_fields(self, existing_data: Dict[str, Any], script: Script) -> Dict[str, Any]:
        """基于现有数据智能生成缺失的背景故事字段"""
        # 重试机制
        max_retries = 3
        last_error = None
        base_temperature = 0.7
        context_info = ""
        
        for attempt in range(max_retries):
            try:
                from ..services.llm_service import llm_service, LLMMessage
                
                # 构建AI提示
                system_prompt = """你是一个专业的剧本杀背景故事创作助手。基于已有的剧本信息和背景故事片段，
                请生成完整的背景故事各个字段。确保内容逻辑一致、情节合理、适合剧本杀游戏。
                
                请按照以下JSON格式返回结果：
                {
                    "setting_description": "背景设定描述",
                    "incident_description": "事件描述", 
                    "victim_background": "受害者背景",
                    "investigation_scope": "调查范围",
                    "rules_reminder": "规则提醒",
                    "murder_method": "作案手法",
                    "murder_location": "作案地点",
                    "discovery_time": "发现时间"
                }"""
                
                # 构建上下文信息
                context_info = f"""剧本信息：
                标题：{script.info.title}
                描述：{script.info.description}
                玩家人数：{script.info.player_count}
                
                已有背景故事内容：
                {existing_data}
                
                角色信息：
                {[char.name + ': ' + char.background for char in script.characters[:3]]}
                """
                
                messages = [
                    LLMMessage(role="system", content=system_prompt),
                    LLMMessage(role="user", content=context_info)
                ]
                
                # 每次重试时增加temperature值
                current_temperature = base_temperature + (attempt * 0.1)
                
                response = await llm_service.chat_completion(
                    messages, 
                    max_tokens=1000, 
                    temperature=current_temperature  # 每次重试时temperature增加0.1
                )
                
                if response.content:
                    try:
                        import json
                        generated_data = json.loads(response.content)
                        
                        # 合并现有数据和生成数据，现有数据优先
                        result_data = {**generated_data, **existing_data}
                        
                        logger.info(f"[STORY_EDIT] AI生成背景故事字段: {list(generated_data.keys())}")
                        return result_data
                        
                    except json.JSONDecodeError:
                        logger.warning(f"[STORY_EDIT] AI返回内容不是有效JSON，使用原始数据")
                        return existing_data
                
                return existing_data
                
            except Exception as e:
                last_error = e
                logger.warning(f"[STORY_EDIT] 第{attempt + 1}次尝试生成背景故事字段失败: {str(e)}")
                
                if attempt < max_retries - 1:
                    # 在重试前调整提示词，强调之前失败的原因
                    if "JSON" in str(e) or "格式" in str(e):
                        context_info += "\n\n注意：请确保返回的是标准JSON格式，不要包含任何代码标记或额外文字。"
        
        # 所有重试都失败了
        logger.error(f"[STORY_EDIT] AI生成背景故事字段失败，已重试{max_retries}次。最后错误: {str(last_error)}")
        return existing_data
    
    async def generate_ai_suggestion(self, script_id: int, context: str = "") -> str:
        """生成AI编辑建议"""
        # 重试机制
        max_retries = 3
        last_error = None
        base_temperature = 0.7
        script_context = ""
        
        for attempt in range(max_retries):
            try:
                # 获取当前剧本
                current_script = self.script_repository.get_script_by_id(script_id)
                if not current_script:
                    return "剧本不存在，无法生成建议"
                
                # 构建AI提示
                system_prompt = """你是一个专业的剧本杀游戏设计师，能够分析剧本内容并提供改进建议。

请分析当前剧本的结构和内容，提供具体的改进建议，包括：
1. 角色设计的完善
2. 证据线索的优化
3. 场景设置的改进
4. 剧情逻辑的完善
5. 游戏平衡性的调整

请提供具体、可操作的建议。"""
                
                script_context = f"""剧本信息：
标题：{current_script.info.title}
描述：{current_script.info.description}
玩家人数：{current_script.info.player_count}

角色列表：
{self._format_characters(current_script.characters)}

证据列表：
{self._format_evidence(current_script.evidence)}

场景列表：
{self._format_locations(current_script.locations)}

{context}"""
                
                messages = [
                    LLMMessage(role="system", content=system_prompt),
                    LLMMessage(role="user", content=script_context)
                ]
                
                # 每次重试时增加temperature值
                current_temperature = base_temperature + (attempt * 0.1)
                
                response = await llm_service.chat_completion(
                    messages, 
                    max_tokens=800, 
                    temperature=current_temperature  # 每次重试时temperature增加0.1
                )
                
                return response.content or "无法生成建议，请稍后重试"
                
            except Exception as e:
                last_error = e
                logger.warning(f"[AI_SUGGESTION] 第{attempt + 1}次尝试生成AI建议失败: {str(e)}")
                
                if attempt < max_retries - 1:
                    # 在重试前调整提示词，强调之前失败的原因
                    if "JSON" in str(e) or "格式" in str(e):
                        script_context += "\n\n注意：请确保返回的是标准JSON格式，不要包含任何代码标记或额外文字。"
        
        # 所有重试都失败了
        logger.error(f"[AI_SUGGESTION] AI生成建议失败，已重试{max_retries}次。最后错误: {str(last_error)}")
        return f"生成建议失败，请稍后重试。最后错误: {str(last_error)}"
    
    def _get_script_state_summary(self, script: Script) -> Dict[str, Any]:
        """获取剧本状态摘要"""
        return {
            "title": script.info.title,
            "description": script.info.description[:100] + "..." if len(script.info.description) > 100 else script.info.description,
            "character_count": len(script.characters),
            "character_names": [char.name for char in script.characters],
            "evidence_count": len(script.evidence),
            "evidence_names": [ev.name for ev in script.evidence],
            "location_count": len(script.locations),
            "location_names": [loc.name for loc in script.locations]
        }
    
    def _get_changes_detail(self, before_state: Dict[str, Any], after_state: Dict[str, Any], instruction: EditInstruction) -> str:
        """获取具体变更详情"""
        changes = []
        
        # 检查角色变更
        if before_state["character_count"] != after_state["character_count"]:
            if instruction.action == "add":
                new_characters = set(after_state["character_names"]) - set(before_state["character_names"])
                changes.append(f"新增角色: {', '.join(new_characters)}")
            elif instruction.action == "delete":
                deleted_characters = set(before_state["character_names"]) - set(after_state["character_names"])
                changes.append(f"删除角色: {', '.join(deleted_characters)}")
        elif instruction.target == "character" and instruction.action in ["update", "modify"]:
            character_name = instruction.content.get("name", "未知角色")
            modified_fields = list(instruction.content.keys())
            changes.append(f"修改角色 '{character_name}' 的字段: {', '.join(modified_fields)}")
        
        # 检查证据变更
        if before_state["evidence_count"] != after_state["evidence_count"]:
            if instruction.action == "add":
                new_evidence = set(after_state["evidence_names"]) - set(before_state["evidence_names"])
                changes.append(f"新增证据: {', '.join(new_evidence)}")
            elif instruction.action == "delete":
                deleted_evidence = set(before_state["evidence_names"]) - set(after_state["evidence_names"])
                changes.append(f"删除证据: {', '.join(deleted_evidence)}")
        elif instruction.target == "evidence" and instruction.action in ["update", "modify"]:
            evidence_name = instruction.content.get("name", "未知证据")
            modified_fields = list(instruction.content.keys())
            changes.append(f"修改证据 '{evidence_name}' 的字段: {', '.join(modified_fields)}")
        
        # 检查场景变更
        if before_state["location_count"] != after_state["location_count"]:
            if instruction.action == "add":
                new_locations = set(after_state["location_names"]) - set(before_state["location_names"])
                changes.append(f"新增场景: {', '.join(new_locations)}")
            elif instruction.action == "delete":
                deleted_locations = set(before_state["location_names"]) - set(after_state["location_names"])
                changes.append(f"删除场景: {', '.join(deleted_locations)}")
        elif instruction.target == "location" and instruction.action in ["update", "modify"]:
            location_name = instruction.content.get("name", "未知场景")
            modified_fields = list(instruction.content.keys())
            changes.append(f"修改场景 '{location_name}' 的字段: {', '.join(modified_fields)}")
        
        # 检查剧本信息变更
        if instruction.target == "info":
            modified_fields = list(instruction.content.keys())
            changes.append(f"修改剧本信息字段: {', '.join(modified_fields)}")
        
        # 检查背景故事变更
        if instruction.target == "story":
            changes.append("修改背景故事")
        
        return "; ".join(changes) if changes else "无明显变更"