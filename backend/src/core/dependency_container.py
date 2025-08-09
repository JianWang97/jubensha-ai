"""依赖注入容器

提供统一的依赖管理和注入机制
"""

import inspect
from abc import ABC, abstractmethod
from typing import Any, Dict, Type, TypeVar, Callable, Optional, Union, get_type_hints
from enum import Enum
from contextlib import contextmanager
from sqlalchemy.orm import Session

T = TypeVar('T')


class ServiceLifetime(Enum):
    """服务生命周期枚举"""
    SINGLETON = "singleton"  # 单例模式
    TRANSIENT = "transient"  # 每次请求创建新实例
    SCOPED = "scoped"       # 作用域内单例


class ServiceDescriptor:
    """服务描述符"""
    
    def __init__(
        self,
        service_type: Type[T],
        implementation_type: Optional[Type[T]] = None,
        factory: Optional[Callable[..., T]] = None,
        instance: Optional[T] = None,
        lifetime: ServiceLifetime = ServiceLifetime.TRANSIENT
    ):
        self.service_type = service_type
        self.implementation_type = implementation_type or service_type
        self.factory = factory
        self.instance = instance
        self.lifetime = lifetime
        
        # 验证配置：如果没有提供implementation_type、factory或instance，使用service_type作为implementation_type
        if not any([implementation_type, factory, instance]) and not service_type:
            raise ValueError("必须提供 service_type、implementation_type、factory 或 instance 中的一个")


class IDependencyContainer(ABC):
    """依赖容器接口"""
    
    @abstractmethod
    def register_singleton(self, service_type: Type[T], implementation_type: Type[T] = None, factory: Callable[..., T] = None) -> 'IDependencyContainer':
        """注册单例服务"""
        pass
    
    @abstractmethod
    def register_transient(self, service_type: Type[T], implementation_type: Type[T] = None, factory: Callable[..., T] = None) -> 'IDependencyContainer':
        """注册瞬态服务"""
        pass
    
    @abstractmethod
    def register_scoped(self, service_type: Type[T], implementation_type: Type[T] = None, factory: Callable[..., T] = None) -> 'IDependencyContainer':
        """注册作用域服务"""
        pass
    
    @abstractmethod
    def register_instance(self, service_type: Type[T], instance: T) -> 'IDependencyContainer':
        """注册实例"""
        pass
    
    @abstractmethod
    def resolve(self, service_type: Type[T]) -> T:
        """解析服务"""
        pass
    
    @abstractmethod
    def create_scope(self) -> 'IServiceScope':
        """创建服务作用域"""
        pass


class IServiceScope(ABC):
    """服务作用域接口"""
    
    @abstractmethod
    def resolve(self, service_type: Type[T]) -> T:
        """在作用域内解析服务"""
        pass
    
    @abstractmethod
    def dispose(self):
        """释放作用域资源"""
        pass


class ServiceScope(IServiceScope):
    """服务作用域实现"""
    
    def __init__(self, container: 'DependencyContainer'):
        self.container = container
        self.scoped_instances: Dict[Type, Any] = {}
        self._disposed = False
    
    def resolve(self, service_type: Type[T]) -> T:
        """在作用域内解析服务"""
        if self._disposed:
            raise RuntimeError("服务作用域已被释放")
        
        descriptor = self.container._get_service_descriptor(service_type)
        
        if descriptor.lifetime == ServiceLifetime.SCOPED:
            # 作用域内单例
            if service_type not in self.scoped_instances:
                self.scoped_instances[service_type] = self.container._create_instance(descriptor, self)
            return self.scoped_instances[service_type]
        else:
            # 其他生命周期委托给容器处理
            return self.container._resolve_with_scope(service_type, self)
    
    def dispose(self):
        """释放作用域资源"""
        if self._disposed:
            return
        
        # 处理数据库会话的自动提交
        for service_type, instance in self.scoped_instances.items():
            if service_type == Session and hasattr(instance, '_auto_commit'):
                try:
                    # 自动提交事务
                    instance.commit()
                except Exception as e:
                    # 如果提交失败，回滚事务
                    try:
                        instance.rollback()
                    except:
                        pass
                    print(f"数据库事务提交失败，已回滚: {e}")
                finally:
                    # 关闭会话
                    try:
                        instance.close()
                    except:
                        pass
        
        # 释放实现了 dispose 方法的服务
        for instance in self.scoped_instances.values():
            if hasattr(instance, 'dispose') and callable(getattr(instance, 'dispose')):
                try:
                    instance.dispose()
                except Exception as e:
                    # 记录错误但不抛出异常
                    print(f"释放服务实例时发生错误: {e}")
        
        self.scoped_instances.clear()
        self._disposed = True
    
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.dispose()


class DependencyContainer(IDependencyContainer):
    """依赖注入容器实现"""
    
    def __init__(self):
        self._services: Dict[Type, ServiceDescriptor] = {}
        self._singletons: Dict[Type, Any] = {}
    
    def register_singleton(self, service_type: Type[T], implementation_type: Type[T] = None, factory: Callable[..., T] = None) -> 'DependencyContainer':
        """注册单例服务"""
        descriptor = ServiceDescriptor(
            service_type=service_type,
            implementation_type=implementation_type,
            factory=factory,
            lifetime=ServiceLifetime.SINGLETON
        )
        self._services[service_type] = descriptor
        return self
    
    def register_transient(self, service_type: Type[T], implementation_type: Type[T] = None, factory: Callable[..., T] = None) -> 'DependencyContainer':
        """注册瞬态服务"""
        descriptor = ServiceDescriptor(
            service_type=service_type,
            implementation_type=implementation_type,
            factory=factory,
            lifetime=ServiceLifetime.TRANSIENT
        )
        self._services[service_type] = descriptor
        return self
    
    def register_scoped(self, service_type: Type[T], implementation_type: Type[T] = None, factory: Callable[..., T] = None) -> 'DependencyContainer':
        """注册作用域服务"""
        descriptor = ServiceDescriptor(
            service_type=service_type,
            implementation_type=implementation_type,
            factory=factory,
            lifetime=ServiceLifetime.SCOPED
        )
        self._services[service_type] = descriptor
        return self
    
    def register_instance(self, service_type: Type[T], instance: T) -> 'DependencyContainer':
        """注册实例"""
        descriptor = ServiceDescriptor(
            service_type=service_type,
            instance=instance,
            lifetime=ServiceLifetime.SINGLETON
        )
        self._services[service_type] = descriptor
        self._singletons[service_type] = instance
        return self
    
    def resolve(self, service_type: Type[T]) -> T:
        """解析服务"""
        return self._resolve_with_scope(service_type, None)
    
    def create_scope(self) -> ServiceScope:
        """创建服务作用域"""
        return ServiceScope(self)
    
    def _get_service_descriptor(self, service_type: Type[T]) -> ServiceDescriptor:
        """获取服务描述符"""
        if service_type not in self._services:
            # 更好的错误信息，处理字符串类型的情况
            type_name = getattr(service_type, '__name__', str(service_type))
            raise ValueError(f"服务类型 {type_name} 未注册")
        return self._services[service_type]
    
    def _resolve_with_scope(self, service_type: Type[T], scope: Optional[ServiceScope]) -> T:
        """在指定作用域内解析服务"""
        descriptor = self._get_service_descriptor(service_type)
        
        if descriptor.lifetime == ServiceLifetime.SINGLETON:
            # 单例模式
            if service_type not in self._singletons:
                self._singletons[service_type] = self._create_instance(descriptor, scope)
            return self._singletons[service_type]
        
        elif descriptor.lifetime == ServiceLifetime.SCOPED:
            # 作用域模式 - 如果没有作用域，抛出异常
            if scope is None:
                raise RuntimeError(f"作用域服务 {service_type.__name__} 必须在服务作用域内解析")
            return scope.resolve(service_type)
        
        else:
            # 瞬态模式
            return self._create_instance(descriptor, scope)
    
    def _create_instance(self, descriptor: ServiceDescriptor, scope: Optional[ServiceScope]) -> Any:
        """创建服务实例"""
        if descriptor.instance is not None:
            return descriptor.instance
        
        if descriptor.factory is not None:
            # 使用工厂方法创建
            return self._invoke_factory(descriptor.factory, scope)
        
        # 使用构造函数创建
        return self._create_instance_by_constructor(descriptor.implementation_type, scope)
    
    def _invoke_factory(self, factory: Callable, scope: Optional[ServiceScope]) -> Any:
        """调用工厂方法"""
        # 获取工厂方法的参数类型
        sig = inspect.signature(factory)
        args = []
        
        # 获取类型注解，这会解析字符串类型注解
        try:
            type_hints = get_type_hints(factory)
        except Exception:
            type_hints = {}
        
        for param_name, param in sig.parameters.items():
            # 跳过有默认值的参数
            if param.default != inspect.Parameter.empty:
                continue
            
            # 优先使用解析后的类型注解
            param_type = type_hints.get(param_name, param.annotation)
            
            if param_type != inspect.Parameter.empty:
                # 解析参数依赖
                if scope:
                    arg_value = scope.resolve(param_type)
                else:
                    arg_value = self.resolve(param_type)
                args.append(arg_value)
        
        return factory(*args)
    
    def _create_instance_by_constructor(self, implementation_type: Type[T], scope: Optional[ServiceScope]) -> T:
        """通过构造函数创建实例"""
        # 获取构造函数参数
        sig = inspect.signature(implementation_type.__init__)
        args = []
        
        # 获取类型注解，这会解析字符串类型注解
        try:
            type_hints = get_type_hints(implementation_type.__init__)
        except Exception:
            type_hints = {}
        
        for param_name, param in sig.parameters.items():
            if param_name == 'self':
                continue
            
            # 跳过有默认值的参数
            if param.default != inspect.Parameter.empty:
                continue
            
            # 优先使用解析后的类型注解
            param_type = type_hints.get(param_name, param.annotation)
            
            if param_type != inspect.Parameter.empty:
                # 解析构造函数参数依赖
                if scope:
                    arg_value = scope.resolve(param_type)
                else:
                    arg_value = self.resolve(param_type)
                args.append(arg_value)
        
        return implementation_type(*args)


# 全局依赖容器实例
container = DependencyContainer()


def get_container() -> DependencyContainer:
    """获取全局依赖容器"""
    return container


@contextmanager
def service_scope():
    """服务作用域上下文管理器"""
    scope = container.create_scope()
    try:
        yield scope
    finally:
        scope.dispose()


def configure_services() -> DependencyContainer:
    """配置服务注册"""
    from ..db.session import DatabaseManager, db_manager
    from ..db.repositories.script_repository import ScriptRepository
    from ..db.repositories.character_repository import CharacterRepository
    from ..db.repositories.evidence_repository import EvidenceRepository
    from ..db.repositories.location_repository import LocationRepository
    from ..db.repositories.image_repository import ImageRepository
    from ..db.repositories.background_story_repository import BackgroundStoryRepository
    from ..db.repositories.game_phase_repository import GamePhaseRepository
    from ..db.repositories.game_session_repository import GameSessionRepository, GameEventRepository
    from ..services.game_history_service import GameHistoryService, GameResumeService
    from ..services.script_editor_service import ScriptEditorService
    from ..services.llm_service import LLMService, llm_service
    
    # 注册数据库管理器（单例）
    container.register_instance(DatabaseManager, db_manager)
    
    # 注册数据库会话（作用域）
    def create_session(db_manager: DatabaseManager) -> Session:
        # 使用session_scope上下文管理器创建会话
        # 注意：这里我们需要返回一个会话，但事务管理将在ServiceScope中处理
        session = db_manager.get_session()
        # 为会话添加自动提交标记，在ServiceScope销毁时处理
        session._auto_commit = True
        return session
    
    container.register_scoped(
        Session,
        factory=create_session
    )
    
    # 注册Repository（作用域）
    container.register_scoped(ScriptRepository)
    container.register_scoped(CharacterRepository)
    container.register_scoped(EvidenceRepository)
    container.register_scoped(LocationRepository)
    container.register_scoped(ImageRepository)
    container.register_scoped(BackgroundStoryRepository)
    container.register_scoped(GamePhaseRepository)
    container.register_scoped(GameSessionRepository)
    container.register_scoped(GameEventRepository)
    container.register_scoped(GameHistoryService)
    container.register_scoped(GameResumeService)
    
    # 注册服务（作用域）
    container.register_scoped(ScriptEditorService)
    
    # 注册LLM服务（单例）
    container.register_instance(LLMService, llm_service)
    
    return container