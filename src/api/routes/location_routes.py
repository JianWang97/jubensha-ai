"""场景管理API路由"""
from fastapi import APIRouter, HTTPException
from typing import Optional, List
from pydantic import BaseModel
from ...core.script_repository import script_repository

router = APIRouter(prefix="/api/scripts", tags=["场景管理"])

# Pydantic模型用于API请求/响应
class LocationCreateRequest(BaseModel):
    name: str
    description: str
    background_url: Optional[str] = None
    atmosphere: Optional[str] = None
    available_actions: Optional[List[str]] = None
    connected_locations: Optional[List[int]] = None
    hidden_clues: Optional[List[str]] = None
    access_conditions: Optional[str] = None

class LocationUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    background_url: Optional[str] = None
    atmosphere: Optional[str] = None
    available_actions: Optional[List[str]] = None
    connected_locations: Optional[List[int]] = None
    hidden_clues: Optional[List[str]] = None
    access_conditions: Optional[str] = None

class ScriptResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None

@router.post("/{script_id}/locations", summary="创建场景")
async def create_location(script_id: int, request: LocationCreateRequest):
    """为指定剧本创建新场景"""
    try:
        # 检查剧本是否存在
        script = await script_repository.get_script_by_id(script_id)
        if not script:
            raise HTTPException(status_code=404, detail="剧本不存在")
        
        # 创建场景
        location_id = await script_repository.create_location(
            script_id=script_id,
            name=request.name,
            description=request.description,
            background_url=request.background_url,
            atmosphere=request.atmosphere,
            available_actions=request.available_actions or [],
            connected_locations=request.connected_locations or [],
            hidden_clues=request.hidden_clues or [],
            access_conditions=request.access_conditions
        )
        
        if not location_id:
            raise HTTPException(status_code=500, detail="创建场景失败")
        
        return ScriptResponse(
            success=True,
            message="场景创建成功",
            data={"location_id": location_id}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"创建失败: {str(e)}")

@router.put("/{script_id}/locations/{location_id}", summary="更新场景")
async def update_location(script_id: int, location_id: int, request: LocationUpdateRequest):
    """更新指定场景的信息"""
    try:
        # 检查剧本是否存在
        script = await script_repository.get_script_by_id(script_id)
        if not script:
            raise HTTPException(status_code=404, detail="剧本不存在")
        
        # 检查场景是否存在
        location = None
        for loc in script.locations:
            if loc.id == location_id:
                location = loc
                break
        
        if not location:
            raise HTTPException(status_code=404, detail="场景不存在")
        
        # 准备更新数据
        update_data = {}
        if request.name is not None:
            update_data['name'] = request.name
        if request.description is not None:
            update_data['description'] = request.description
        if request.background_url is not None:
            update_data['background_url'] = request.background_url
        if request.atmosphere is not None:
            update_data['atmosphere'] = request.atmosphere
        if request.available_actions is not None:
            update_data['available_actions'] = request.available_actions
        if request.connected_locations is not None:
            update_data['connected_locations'] = request.connected_locations
        if request.hidden_clues is not None:
            update_data['hidden_clues'] = request.hidden_clues
        if request.access_conditions is not None:
            update_data['access_conditions'] = request.access_conditions
        
        if not update_data:
            raise HTTPException(status_code=400, detail="没有提供更新数据")
        
        # 更新场景
        success = await script_repository.update_location(location_id, update_data)
        if not success:
            raise HTTPException(status_code=500, detail="更新场景失败")
        
        return ScriptResponse(
            success=True,
            message="场景更新成功",
            data={"location_id": location_id}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"更新失败: {str(e)}")

@router.delete("/{script_id}/locations/{location_id}", summary="删除场景")
async def delete_location(script_id: int, location_id: int):
    """删除指定场景"""
    try:
        # 检查剧本是否存在
        script = await script_repository.get_script_by_id(script_id)
        if not script:
            raise HTTPException(status_code=404, detail="剧本不存在")
        
        # 检查场景是否存在
        location = None
        for loc in script.locations:
            if loc.id == location_id:
                location = loc
                break
        
        if not location:
            raise HTTPException(status_code=404, detail="场景不存在")
        
        # 删除场景
        success = await script_repository.delete_location(location_id)
        if not success:
            raise HTTPException(status_code=500, detail="删除场景失败")
        
        return ScriptResponse(
            success=True,
            message="场景删除成功",
            data={"location_id": location_id}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"删除失败: {str(e)}")

@router.get("/{script_id}/locations", summary="获取场景列表")
async def get_locations(script_id: int):
    """获取指定剧本的所有场景"""
    try:
        # 检查剧本是否存在
        script = await script_repository.get_script_by_id(script_id)
        if not script:
            raise HTTPException(status_code=404, detail="剧本不存在")
        
        # 返回场景列表
        locations_data = []
        for location in script.locations:
            locations_data.append({
                "id": location.id,
                "name": location.name,
                "description": location.description,
                "background_url": location.background_url,
                "atmosphere": location.atmosphere,
                "available_actions": location.available_actions,
                "connected_locations": location.connected_locations,
                "hidden_clues": location.hidden_clues,
                "access_conditions": location.access_conditions
            })
        
        return ScriptResponse(
            success=True,
            message="获取场景列表成功",
            data={
                "locations": locations_data,
                "total": len(locations_data)
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取失败: {str(e)}")

@router.get("/{script_id}/locations/{location_id}", summary="获取场景详情")
async def get_location_detail(script_id: int, location_id: int):
    """获取指定场景的详细信息"""
    try:
        # 检查剧本是否存在
        script = await script_repository.get_script_by_id(script_id)
        if not script:
            raise HTTPException(status_code=404, detail="剧本不存在")
        
        # 查找场景
        location = None
        for loc in script.locations:
            if loc.id == location_id:
                location = loc
                break
        
        if not location:
            raise HTTPException(status_code=404, detail="场景不存在")
        
        # 返回场景详情
        location_data = {
            "id": location.id,
            "name": location.name,
            "description": location.description,
            "background_url": location.background_url,
            "atmosphere": location.atmosphere,
            "available_actions": location.available_actions,
            "connected_locations": location.connected_locations,
            "hidden_clues": location.hidden_clues,
            "access_conditions": location.access_conditions
        }
        
        return ScriptResponse(
            success=True,
            message="获取场景详情成功",
            data={"location": location_data}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取失败: {str(e)}")