"""场景数据访问层"""
from typing import List, Optional
from sqlalchemy.orm import Session
from ...schemas.script import ScriptLocation
from ..models.location import LocationDBModel
from .base import BaseRepository


class LocationRepository(BaseRepository[LocationDBModel]):
    """场景数据访问层"""
    
    def __init__(self, db_session: Session):
        super().__init__(LocationDBModel, db_session)
        self.db = db_session
    def add_location(self, location: ScriptLocation) -> ScriptLocation:
        """添加场景"""
        db_data = location.to_db_dict()
        db_location = LocationDBModel(**db_data)
        self.db.add(db_location)
 
        self.db.flush()
        return ScriptLocation.model_validate(db_location, from_attributes=True)
    
    def update_location(self, location_id: int, location: ScriptLocation) -> Optional[ScriptLocation]:
        """更新场景"""
        db_location = self.db.query(LocationDBModel).filter(LocationDBModel.id == location_id).first()
        if not db_location:
            return None
        
        update_data = location.model_dump(exclude={'id', 'created_at', 'updated_at'}, exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_location, field, value)
        
        self.db.flush()
        return ScriptLocation.model_validate(db_location, from_attributes=True)
    
    def delete_location(self, location_id: int) -> bool:
        """删除场景"""
        db_location = self.db.query(LocationDBModel).filter(LocationDBModel.id == location_id).first()
        if not db_location:
            return False
        
        self.db.delete(db_location)
 
        return True
    
    def update_location_background_url(self, location_id: int, background_url: str) -> bool:
        """更新场景背景图片URL"""
        db_location = self.db.query(LocationDBModel).filter(LocationDBModel.id == location_id).first()
        if not db_location:
            return False
        
        db_location.background_url = background_url
        self.db.flush()
        return True
    

    def get_location_by_id(self, location_id: int) -> Optional[ScriptLocation]:
        """根据ID获取场景"""
        db_location = self.db.query(LocationDBModel).filter(LocationDBModel.id == location_id).first()
        if not db_location:
            return None
        return ScriptLocation.model_validate(db_location, from_attributes=True)
    
    def get_locations_by_script(self, script_id: int) -> List[ScriptLocation]:
        """获取剧本的所有场景"""
        db_locations = self.db.query(LocationDBModel).filter(LocationDBModel.script_id == script_id).all()
        return [ScriptLocation.model_validate(loc, from_attributes=True) for loc in db_locations]
    
    def get_crime_scenes(self, script_id: int) -> List[ScriptLocation]:
        """获取案发现场"""
        db_locations = self.db.query(LocationDBModel).filter(
            LocationDBModel.script_id == script_id,
            LocationDBModel.is_crime_scene == True
        ).all()
        return [ScriptLocation.model_validate(loc, from_attributes=True) for loc in db_locations]
    
    def get_regular_locations(self, script_id: int) -> List[ScriptLocation]:
        """获取普通场景（非案发现场）"""
        db_locations = self.db.query(LocationDBModel).filter(
            LocationDBModel.script_id == script_id,
            LocationDBModel.is_crime_scene == False
        ).all()
        return [ScriptLocation.model_validate(loc, from_attributes=True) for loc in db_locations]
    
    def get_location_by_name(self, script_id: int, name: str) -> Optional[ScriptLocation]:
        """根据名称获取场景"""
        db_location = self.db.query(LocationDBModel).filter(
            LocationDBModel.script_id == script_id,
            LocationDBModel.name == name
        ).first()
        if not db_location:
            return None
        return ScriptLocation.model_validate(db_location, from_attributes=True)
    
    def search_locations_with_item(self, script_id: int, item: str) -> List[ScriptLocation]:
        """搜索包含特定物品的场景"""
        # 这里需要根据具体的JSON查询语法来实现
        # 假设使用PostgreSQL的JSON操作符
        db_locations = self.db.query(LocationDBModel).filter(
            LocationDBModel.script_id == script_id,
            LocationDBModel.searchable_items.contains([item])
        ).all()
        return [ScriptLocation.model_validate(loc, from_attributes=True) for loc in db_locations]
    
    def delete_locations_by_script(self, script_id: int) -> bool:
        """删除剧本的所有场景"""
        deleted_count = self.db.query(LocationDBModel).filter(LocationDBModel.script_id == script_id).delete()
 
        return deleted_count > 0