"""用户API测试"""
import pytest
from fastapi.testclient import TestClient
from src.core.server import app

client = TestClient(app)


class TestUserAPI:
    """用户API测试类"""
    
    def test_create_game_session_unauthorized(self):
        """测试未认证创建游戏会话"""
        response = client.post("/api/users/sessions", json={
            "script_id": 1,
            "session_name": "Test Session"
        })
        # 应该返回401未认证错误
        assert response.status_code == 401

    def test_get_game_history_unauthorized(self):
        """测试未认证获取游戏历史"""
        response = client.get("/api/users/history")
        # 应该返回401未认证错误
        assert response.status_code == 401

    def test_get_game_participants_unauthorized(self):
        """测试未认证获取游戏参与者"""
        response = client.get("/api/users/participants/1")
        # 应该返回401未认证错误
        assert response.status_code == 401

    def test_create_game_session_with_invalid_data(self):
        """测试使用无效数据创建游戏会话"""
        response = client.post("/api/users/sessions", json={
            # 缺少必需字段
        }, headers={"Authorization": "Bearer fake_token"})
        
        # 应该返回422验证错误或401（取决于认证检查和验证检查的顺序）
        assert response.status_code in [401, 422]

    def test_get_nonexistent_game_history(self):
        """测试获取不存在的游戏历史"""
        response = client.get("/api/users/history", headers={"Authorization": "Bearer fake_token"})
        # 可能返回200空列表、404或401，取决于实现
        assert response.status_code in [200, 401, 404]


if __name__ == "__main__":
    pytest.main([__file__])