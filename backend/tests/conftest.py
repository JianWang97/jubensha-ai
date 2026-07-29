"""测试配置文件"""
import pytest
import sys
import os
from unittest.mock import Mock, patch
from typing import Generator

# 将src目录添加到系统路径中
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from fastapi.testclient import TestClient
from src.core.server import app


@pytest.fixture(scope="module")
def test_client() -> Generator:
    """创建测试客户端"""
    with TestClient(app) as client:
        yield client


@pytest.fixture(autouse=True)
def mock_db_session():
    """模拟数据库会话"""
    with patch('src.db.session.db_manager') as mock_db_manager:
        mock_session = Mock()
        mock_db_manager.get_session.return_value = mock_session
        mock_db_manager.session_scope.return_value.__enter__.return_value = mock_session
        # 模拟initialize方法
        mock_db_manager.initialize.return_value = None
        # 配置DI容器：生产环境在 app startup 事件里执行 configure_services()，
        # 但测试环境数据库被 mock，startup 初始化会提前失败导致容器未注册 Session 等服务。
        # configure_services 内部延迟导入 db_manager，此处调用会注册到上面的 mock。
        from src.core.dependency_container import configure_services
        configure_services()
        yield mock_session


@pytest.fixture(autouse=True)
def mock_db_initialized():
    """模拟数据库已初始化"""
    with patch('src.db.session.db_manager._engine') as mock_engine:
        mock_engine.return_value = Mock()
        yield


@pytest.fixture
def mock_current_user():
    """模拟当前用户"""
    from src.db.models.user import User
    user = User(
        id=1,
        username="testuser",
        email="test@example.com",
        nickname="Test User",
        is_active=True,
        is_admin=False
    )
    return user