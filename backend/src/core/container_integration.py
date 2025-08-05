"""依赖注入容器与FastAPI集成

提供FastAPI依赖注入的集成支持
"""

from typing import Type, TypeVar, Callable, Any
from fastapi import Depends
from .dependency_container import container, service_scope

T = TypeVar('T')


def get_service(service_type: Type[T]) -> Callable[[], T]:
    """获取服务的FastAPI依赖函数
    
    对于瞬态/单例服务无需持久化 Session，但为了保持一致，
    这里同样使用生成器依赖，使 ServiceScope 在请求结束时再释放。
    """
    async def dependency():
        # 使用 with 确保在 yield 之后自动调用 __exit__ 以释放资源
        with service_scope() as scope:
            service_instance = scope.resolve(service_type)
            yield service_instance
    return dependency


def inject(service_type: Type[T]) -> T:
    """依赖注入装饰器，用于FastAPI路由函数
    
    Args:
        service_type: 要注入的服务类型
        
    Returns:
        FastAPI Depends对象
    """
    return Depends(get_service(service_type))


def get_scoped_service(service_type: Type[T]) -> Callable[[], T]:
    """获取作用域服务的FastAPI依赖函数
    
    该版本使用生成器(
    yield)依赖，保证 ServiceScope 生命周期贯穿整个请求，
    在请求完成后再统一提交/回滚事务并释放资源。
    """
    async def dependency():
        # 使用 with 确保 __exit__ 在 yield 之后调用，避免作用域过早释放
        with service_scope() as scope:  # 使用 with 语句自动管理生命周期
            service_instance = scope.resolve(service_type)
            yield service_instance  # 路由处理完成后，with 块退出，scope.dispose 自动调用
    return dependency


def inject_scoped(service_type: Type[T]) -> T:
    """作用域依赖注入装饰器
    
    Args:
        service_type: 要注入的服务类型
        
    Returns:
        FastAPI Depends对象
    """
    return Depends(get_scoped_service(service_type))


# 便捷的依赖注入函数
def get_repository_dependency(repository_type: Type[T]) -> Callable[[], T]:
    """获取Repository依赖
    
    Repository通常需要数据库会话，应该在请求作用域内使用
    """
    return get_scoped_service(repository_type)


def get_service_dependency(service_type: Type[T]) -> Callable[[], T]:
    """获取Service依赖
    
    Service通常依赖Repository，应该在请求作用域内使用
    """
    return get_scoped_service(service_type)


# 常用的依赖注入快捷方式
from ..db.repositories.script_repository import ScriptRepository
from ..db.repositories.character_repository import CharacterRepository
from ..db.repositories.evidence_repository import EvidenceRepository
from ..db.repositories.location_repository import LocationRepository
from ..services.script_editor_service import ScriptEditorService
from sqlalchemy.orm import Session


# FastAPI Depends对象 - 使用工厂函数而不是预定义对象
# 这些函数在需要时创建Depends对象，避免在模块导入时创建
def get_db_session_depends():
    """获取数据库会话的Depends对象"""
    return inject_scoped(Session)

def get_script_repo_depends():
    """获取脚本仓储的Depends对象"""
    return inject_scoped(ScriptRepository)

def get_character_repo_depends():
    """获取角色仓储的Depends对象"""
    return inject_scoped(CharacterRepository)

def get_evidence_repo_depends():
    """获取证据仓储的Depends对象"""
    return inject_scoped(EvidenceRepository)

def get_location_repo_depends():
    """获取地点仓储的Depends对象"""
    return inject_scoped(LocationRepository)

def get_script_editor_svc_depends():
    """获取脚本编辑服务的Depends对象"""
    return inject_scoped(ScriptEditorService)

# 注意：不要在模块级别创建Depends对象，这会导致在容器配置之前就尝试解析依赖
# 使用上面的工厂函数在需要时创建Depends对象