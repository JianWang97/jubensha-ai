"""数据库ORM基类"""
from typing import Dict, Any
from datetime import datetime
from sqlalchemy import Column, Integer, DateTime, func
from sqlalchemy.ext.declarative import declarative_base

# SQLAlchemy基类
SQLAlchemyBase = declarative_base()

class BaseSQLAlchemyModel(SQLAlchemyBase):
    """SQLAlchemy模型基类"""
    __abstract__ = True
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        result = {}
        for column in self.__table__.columns:
            value = getattr(self, column.name)
            if isinstance(value, datetime):
                result[column.name] = value.isoformat()
            else:
                result[column.name] = value
        return result
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]):
        """从字典创建实例"""
        # 过滤掉不存在的字段
        valid_data = {}
        for column in cls.__table__.columns:
            if column.name in data:
                valid_data[column.name] = data[column.name]
        
        return cls(**valid_data)
    
    def __repr__(self):
        """字符串表示"""
        return f"<{self.__class__.__name__}(id={self.id})>"