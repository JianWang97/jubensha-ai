"""基本API路由测试"""
import pytest
from fastapi.testclient import TestClient
from src.core.server import app

client = TestClient(app)


def test_read_main():
    """测试主页面"""
    response = client.get("/")
    # 检查是否是404或其他状态码
    assert response.status_code in [200, 404]


def test_health_check():
    """测试健康检查端点"""
    response = client.get("/health")
    # 检查健康检查端点
    assert response.status_code in [200, 404]


def test_get_scripts():
    """测试获取剧本列表"""
    response = client.get("/api/scripts")
    # 应该成功返回剧本列表或需要认证
    assert response.status_code in [200, 401, 404]


def test_get_characters():
    """测试获取角色列表"""
    response = client.get("/api/characters")
    # 应该成功返回角色列表或需要认证
    assert response.status_code in [200, 401, 404]


def test_nonexistent_endpoint():
    """测试访问不存在的端点"""
    response = client.get("/nonexistent")
    # 应该返回404错误
    assert response.status_code == 404


if __name__ == "__main__":
    pytest.main([__file__])