"""测试认证工具"""
from typing import Generator, Dict, Any
import pytest
from fastapi.testclient import TestClient


class MockAuth:
    """模拟认证工具类"""
    
    def __init__(self, client: TestClient):
        self.client = client
        self.token = None
        self.user_data = None
    
    def register_and_login(self, user_data: Dict[str, Any]) -> bool:
        """注册并登录用户"""
        # 尝试注册用户
        register_response = self.client.post("/api/auth/register", json=user_data)
        
        # 尝试登录用户
        login_data = {
            "username": user_data["username"],
            "password": user_data["password"]
        }
        login_response = self.client.post("/api/auth/login", json=login_data)
        
        if login_response.status_code == 200:
            response_data = login_response.json()
            self.token = response_data.get("access_token") or response_data.get("data", {}).get("access_token")
            self.user_data = response_data.get("user") or response_data.get("data", {}).get("user")
            return True
        
        return False
    
    def get_auth_header(self) -> Dict[str, str]:
        """获取认证头"""
        if self.token:
            return {"Authorization": f"Bearer {self.token}"}
        return {}


@pytest.fixture(scope="module")
def mock_auth(test_client: TestClient) -> Generator[MockAuth, None, None]:
    """创建模拟认证夹具"""
    auth = MockAuth(test_client)
    yield auth