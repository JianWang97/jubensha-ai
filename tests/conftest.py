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


@pytest.fixture(scope="module")
def test_db():
    """创建测试数据库"""
    # 这里可以设置测试数据库
    pass


@pytest.fixture(scope="function")
def clean_db():
    """创建干净的测试数据库"""
    # 每个测试函数前清理数据库
    pass
    yield
    # 每个测试函数后清理数据库
    pass


@pytest.fixture(autouse=True)
def mock_db_session():
    """模拟数据库会话"""
    with patch('src.db.session.db_manager') as mock_db_manager:
        mock_session = Mock()
        mock_db_manager.get_session.return_value = mock_session
        mock_db_manager.session_scope.return_value.__enter__.return_value = mock_session
        # 模拟initialize方法
        mock_db_manager.initialize.return_value = None
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
        is_superuser=False
    )
    return user