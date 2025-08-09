"""数据库模块聚合

精简导出以减少循环依赖风险。避免使用 `from src.db import *` 方式，直接按需导入。
Alembic 只需要 SQLAlchemyBase 来进行元数据反射，业务层再显式导入仓储与模型。
"""
from .base import SQLAlchemyBase, BaseSQLAlchemyModel  # noqa: F401
from .session import DatabaseManager, get_db_session, db_manager  # noqa: F401

__all__ = [
    'SQLAlchemyBase',
    'BaseSQLAlchemyModel',
    'DatabaseManager',
    'get_db_session',
    'db_manager'
]