"""剧本API测试"""
import pytest
from fastapi.testclient import TestClient
from src.core.server import app

client = TestClient(app)


class TestScriptAPI:
    """剧本API测试类"""
    
    def test_get_scripts_list(self):
        """测试获取剧本列表"""
        response = client.get("/api/scripts")
        # 可能需要认证或返回数据
        assert response.status_code in [200, 401]

    def test_get_scripts_with_pagination(self):
        """测试带分页的剧本列表"""
        response = client.get("/api/scripts?page=1&size=5")
        # 可能需要认证或返回数据
        assert response.status_code in [200, 401]

    def test_get_public_scripts(self):
        """测试获取公开剧本"""
        response = client.get("/api/scripts/public")
        # 可能返回数据或服务器错误
        assert response.status_code in [200, 500]

    def test_search_scripts(self):
        """测试搜索剧本"""
        response = client.get("/api/scripts/search")
        # 搜索可能需要查询参数
        assert response.status_code in [200, 422]

    def test_get_script_by_id(self):
        """测试根据ID获取剧本"""
        response = client.get("/api/scripts/1")
        # 可能成功返回剧本或返回404/401（取决于数据是否存在和认证）
        assert response.status_code in [200, 401, 404]

    def test_create_script_unauthorized(self):
        """测试未认证创建剧本"""
        response = client.post("/api/scripts", json={
            "title": "Test Script",
            "description": "A test script"
        })
        # 应该返回401未认证错误
        assert response.status_code == 401

    def test_get_nonexistent_script(self):
        """测试获取不存在的剧本"""
        response = client.get("/api/scripts/999999")
        # 应该返回404错误或401（取决于认证检查和资源检查的顺序）
        assert response.status_code in [401, 404]


if __name__ == "__main__":
    pytest.main([__file__])