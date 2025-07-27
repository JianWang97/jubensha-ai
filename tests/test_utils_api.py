"""工具API测试"""
import pytest
from fastapi.testclient import TestClient
from src.core.server import app

client = TestClient(app)


class TestUtilsAPI:
    """工具API测试类"""
    
    def test_file_upload_unauthorized(self):
        """测试未认证文件上传"""
        response = client.post("/api/utils/upload")
        # 应该返回401未认证错误
        assert response.status_code == 401

    def test_get_assets(self):
        """测试获取资源列表"""
        response = client.get("/api/utils/assets")
        # 可能需要认证或返回资源列表
        assert response.status_code in [200, 401]

    def test_tts_stream_unauthorized(self):
        """测试未认证TTS流"""
        response = client.post("/api/utils/tts/stream")
        # 应该返回401未认证错误
        assert response.status_code == 401

    def test_get_game_status(self):
        """测试获取游戏状态"""
        response = client.get("/api/utils/status")
        # 可能需要认证或返回状态信息
        assert response.status_code in [200, 401]


if __name__ == "__main__":
    pytest.main([__file__])