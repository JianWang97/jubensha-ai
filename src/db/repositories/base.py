"""基础数据访问层"""
from typing import TypeVar, Generic, Type, Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from ..base import BaseSQLAlchemyModel

ModelType = TypeVar("ModelType", bound=BaseSQLAlchemyModel)

class BaseRepository(Generic[ModelType]):
    """基础仓储类，提供通用的CRUD操作"""
    
    def __init__(self, model: Type[ModelType], session: Session):
        self.model = model
        self.session = session

    
    def create(self, **kwargs) -> ModelType:
        """创建新记录"""
        instance = self.model(**kwargs)
        self.session.add(instance)
  
        self.session.flush()
        return instance
    
    def get_by_id(self, id: int) -> Optional[ModelType]:
        """根据ID获取记录"""
        return self.session.query(self.model).filter(self.model.id == id).first()
    
    def get_all(self, skip: int = 0, limit: int = 100) -> List[ModelType]:
        """获取所有记录（分页）"""
        return self.session.query(self.model).offset(skip).limit(limit).all()
    
    def update(self, id: int, **kwargs) -> Optional[ModelType]:
        """更新记录"""
        instance = self.get_by_id(id)
        if instance:
            for key, value in kwargs.items():
                if hasattr(instance, key):
                    setattr(instance, key, value)
      
            self.session.flush()
        return instance
    
    def delete(self, id: int) -> bool:
        """删除记录"""
        instance = self.get_by_id(id)
        if instance:
            self.session.delete(instance)
      
            return True
        return False
    
    def count(self, **filters) -> int:
        """统计记录数量"""
        query = self.session.query(self.model)
        if filters:
            conditions = [getattr(self.model, key) == value for key, value in filters.items() if hasattr(self.model, key)]
            if conditions:
                query = query.filter(and_(*conditions))
        return query.count()
    
    def exists(self, **filters) -> bool:
        """检查记录是否存在"""
        return self.count(**filters) > 0
    
    def filter_by(self, skip: int = 0, limit: int = 100, **filters) -> List[ModelType]:
        """根据条件过滤记录"""
        query = self.session.query(self.model)
        if filters:
            conditions = [getattr(self.model, key) == value for key, value in filters.items() if hasattr(self.model, key)]
            if conditions:
                query = query.filter(and_(*conditions))
        return query.offset(skip).limit(limit).all()
    
    def search(self, search_term: str, search_fields: List[str], skip: int = 0, limit: int = 100) -> List[ModelType]:
        """搜索记录"""
        query = self.session.query(self.model)
        if search_term and search_fields:
            conditions = []
            for field in search_fields:
                if hasattr(self.model, field):
                    field_attr = getattr(self.model, field)
                    if hasattr(field_attr.type, 'python_type') and field_attr.type.python_type == str:
                        conditions.append(field_attr.ilike(f"%{search_term}%"))
            if conditions:
                query = query.filter(or_(*conditions))
        return query.offset(skip).limit(limit).all()