"""场景管理API路由"""
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional, List
from pydantic import BaseModel
from sqlalchemy.orm import Session
from ...db.repositories import LocationRepository
from ...db.repositories import ScriptRepository
from ...services.llm_service import llm_service
from ...schemas.script import ScriptLocation
from ...db.session import get_db_session
from datetime import datetime

router = APIRouter(prefix="/api/locations", tags=["场景管理"])

def get_location_repository(db: Session = Depends(get_db_session)) -> LocationRepository:
    return LocationRepository(db)

def get_script_repository(db: Session = Depends(get_db_session)) -> ScriptRepository:
    return ScriptRepository(db)

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
async def create_location(script_id: int, request: ScriptLocation, location_repository: LocationRepository = Depends(get_location_repository)):
    """为指定剧本创建新场景"""
    try:
        
        # 准备场景数据
        location_data = {
            "script_id": script_id,
            "name": request.name,
            "description": request.description,
            "searchable_items": [],  # 默认为空列表
            "background_image_url": request.background_image_url,
            "is_crime_scene": False  # 默认为非案发现场
        }
        
        # 添加场景
        location = location_repository.add_location(location_data)
        location_id = location.id
        
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
async def update_location(script_id: int, location_id: int, request: ScriptLocation, location_repository: LocationRepository = Depends(get_location_repository)):
    """更新指定场景的信息"""
    try:
        # 检查场景是否存在
        location = location_repository.get_location_by_id(location_id)
        if not location:
            raise HTTPException(status_code=404, detail="场景不存在")

        # 更新场景
        if not location_repository.update_location(location_id, request):
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
async def delete_location(script_id: int, location_id: int, location_repository: LocationRepository = Depends(get_location_repository)):
    """删除指定场景"""
    try:

        # 检查场景是否存在
        location = location_repository.get_location_by_id(location_id)
        
        if not location:
            raise HTTPException(status_code=404, detail="场景不存在")
        
        # 删除场景
        success = location_repository.delete_location(location_id)
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
async def get_locations(script_id: int, 
    location_repository: LocationRepository = Depends(get_location_repository),
    script_repository: ScriptRepository = Depends(get_script_repository)):
    """获取指定剧本的所有场景"""
    try:
        # 检查剧本是否存在
        script = script_repository.get_script_by_id(script_id)
        if not script:
            raise HTTPException(status_code=404, detail="剧本不存在")
        
        locations = location_repository.get_locations_by_script(script_id)
        # 返回场景列表
        locations_data = []
        for location in locations:
            locations_data.append({
                "id": location.id,
                "script_id": location.script_id,
                "name": location.name,
                "description": location.description,
                "searchable_items": location.searchable_items,
                "background_image_url": location.background_image_url,
                "is_crime_scene": location.is_crime_scene
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
async def get_location_detail(script_id: int, location_id: int,
    location_repository: LocationRepository = Depends(get_location_repository),
    script_repository: ScriptRepository = Depends(get_script_repository)):
    """获取指定场景的详细信息"""
    try:
        # 检查场景是否存在
        location = location_repository.get_location_by_id(location_id)
        if not location:
            raise HTTPException(status_code=404, detail="场景不存在")
        
        # 返回场景详情
        location_data = {
            "id": location.id,
            "script_id": location.script_id,
            "name": location.name,
            "description": location.description,
            "searchable_items": location.searchable_items,
            "background_image_url": location.background_image_url,
            "is_crime_scene": location.is_crime_scene
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