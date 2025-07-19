"""Pydantic基础数据模型"""
from typing import Any, Dict, List, Optional, Type, TypeVar, Generic
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict
from abc import ABC, abstractmethod

T = TypeVar('T')

class BaseDataModel(BaseModel, ABC):
    """基础数据模型
    
    所有Pydantic模型的基类，提供统一的配置和方法
    """
    model_config = ConfigDict(
        # 允许从ORM对象创建模型
        from_attributes=True,
        # 验证赋值
        validate_assignment=True,
        # 使用枚举值而不是名称
        use_enum_values=True,
        # 允许额外字段但忽略它们
        extra='ignore'
    )
    
    # 基础字段
    id: Optional[int] = Field(None, description="记录ID")
    created_at: Optional[datetime] = Field(None, description="创建时间")
    updated_at: Optional[datetime] = Field(None, description="更新时间")
    
    @classmethod
    @abstractmethod
    def get_db_model(cls) -> Type:
        """获取对应的数据库模型类"""
        pass
    
    def to_db_dict(self) -> Dict[str, Any]:
        """转换为数据库字典格式
        
        排除None值和不需要的字段
        """
        data = self.model_dump(exclude_none=True)
        # 移除自动管理的字段
        data.pop('id', None)
        data.pop('created_at', None)
        data.pop('updated_at', None)
        return data
    
    def to_api_dict(self) -> Dict[str, Any]:
        """转换为API响应字典格式"""
        return self.model_dump()
    
    @classmethod
    def from_api_dict(cls, data: Dict[str, Any]) -> 'BaseDataModel':
        """从API字典创建模型实例"""
        return cls(**data)
    
    def update_from_dict(self, data: Dict[str, Any]) -> 'BaseDataModel':
        """从字典更新模型字段"""
        for key, value in data.items():
            if hasattr(self, key):
                setattr(self, key, value)
        return self
    
    def validate_for_create(self) -> bool:
        """验证创建时的数据完整性"""
        try:
            self.model_validate(self.model_dump())
            return True
        except Exception:
            return False
    
    def validate_for_update(self) -> bool:
        """验证更新时的数据完整性"""
        try:
            # 更新时允许部分字段为空
            data = self.model_dump(exclude_none=True)
            self.model_validate(data)
            return True
        except Exception:
            return False

class APIResponse(BaseModel, Generic[T]):
    def __init__(self, **data: Any):
        super().__init__(**data)
    """统一API响应格式"""
    success: bool = Field(True, description="请求是否成功")
    message: str = Field("", description="响应消息")
    data: Optional[T] = Field(None, description="响应数据")
    error_code: Optional[str] = Field(None, description="错误代码")
    timestamp: datetime = Field(default_factory=datetime.now, description="响应时间")
    
    model_config = ConfigDict(from_attributes=True)
    
    @classmethod
    def success_response(cls, data: T = None, message: str = "操作成功") -> 'APIResponse[T]':
        """创建成功响应"""
        return cls(success=True, message=message, data=data)
    
    @classmethod
    def error_response(cls, message: str, error_code: str = None) -> 'APIResponse[T]':
        """创建错误响应"""
        return cls(success=False, message=message, error_code=error_code, data=None)

class PaginatedResponse(BaseModel, Generic[T]):
    """分页响应格式"""
    items: List[T] = Field(default_factory=list, description="数据列表")
    total: int = Field(0, description="总记录数")
    page: int = Field(1, description="当前页码")
    size: int = Field(10, description="每页大小")
    pages: int = Field(0, description="总页数")
    has_next: bool = Field(False, description="是否有下一页")
    has_prev: bool = Field(False, description="是否有上一页")
    
    model_config = ConfigDict(from_attributes=True)
    
    @classmethod
    def create(cls, items: List[T], total: int, page: int, size: int) -> 'PaginatedResponse[T]':
        """创建分页响应"""
        pages = (total + size - 1) // size if size > 0 else 0
        return cls(
            items=items,
            total=total,
            page=page,
            size=size,
            pages=pages,
            has_next=page < pages,
            has_prev=page > 1
        )