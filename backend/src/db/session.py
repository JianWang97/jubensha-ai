"""数据库会话管理"""
from typing import Generator, Optional
from contextlib import contextmanager
from sqlalchemy import create_engine, Engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool
from ..core.config import get_database_config
from .base import SQLAlchemyBase

class DatabaseManager:
    """数据库管理器"""
    
    def __init__(self):
        self._engine: Optional[Engine] = None
        self._session_factory: Optional[sessionmaker] = None
    
    def initialize(self, database_url: Optional[str] = None) -> None:
        """初始化数据库连接
        
        Args:
            database_url: 数据库连接URL，如果为None则从配置获取
        """
        if database_url is None:
            config = get_database_config()
            database_url = f"postgresql://{config.username}:{config.password}@{config.host}:{config.port}/{config.database}"
        
        # 创建引擎
        self._engine = create_engine(
            database_url,
            echo=False,  # 生产环境关闭SQL日志
            pool_pre_ping=True,  # 连接池预检查
            pool_recycle=3600,   # 连接回收时间
            pool_size=config.pool_size,  # 连接池大小
            max_overflow=20,  # 最大溢出连接数
            pool_timeout=60,  # 连接池超时时间（秒）
        )
        
        # 创建会话工厂
        self._session_factory = sessionmaker(
            bind=self._engine,
            autocommit=False,
            autoflush=False
        )
    
    def create_tables(self) -> None:
        """创建所有表"""
        if self._engine is None:
            raise RuntimeError("数据库未初始化")
        
        SQLAlchemyBase.metadata.create_all(bind=self._engine)
    
    def drop_tables(self) -> None:
        """删除所有表"""
        if self._engine is None:
            raise RuntimeError("数据库未初始化")
        
        SQLAlchemyBase.metadata.drop_all(bind=self._engine)
    
    def get_session(self) -> Session:
        """获取数据库会话
        
        Returns:
            数据库会话实例
        """
        if self._session_factory is None:
            raise RuntimeError("数据库未初始化")
        
        return self._session_factory()
    
    @contextmanager
    def session_scope(self) -> Generator[Session, None, None]:
        """会话上下文管理器
        
        自动处理事务提交和回滚
        
        Yields:
            数据库会话
        """
        session = self.get_session()
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()
    
    @property
    def engine(self) -> Engine:
        """获取数据库引擎"""
        if self._engine is None:
            raise RuntimeError("数据库未初始化")
        return self._engine
    
    def close(self) -> None:
        """关闭数据库连接"""
        if self._engine:
            self._engine.dispose()
            self._engine = None
            self._session_factory = None

# 全局数据库管理器实例
db_manager = DatabaseManager()

# 便捷函数
def get_db_session() -> Generator[Session, None, None]:
    """FastAPI依赖注入用的数据库会话生成器"""
    with db_manager.session_scope() as session:
        yield session

def get_db_session_from_container():
    """从依赖容器获取数据库会话"""
    from ..core.dependency_container import service_scope
    return service_scope()

def init_database(database_url: Optional[str] = None) -> None:
    """初始化数据库"""
    db_manager.initialize(database_url)
    db_manager.create_tables()