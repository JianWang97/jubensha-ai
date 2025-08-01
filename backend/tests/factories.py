"""测试数据工厂"""
from typing import Any, Dict
import uuid


class TestDataFactory:
    """测试数据工厂类"""
    
    @staticmethod
    def create_user_data(**kwargs) -> Dict[str, Any]:
        """创建用户测试数据"""
        default_data = {
            "username": f"testuser_{uuid.uuid4().hex[:8]}",
            "email": f"test_{uuid.uuid4().hex[:8]}@example.com",
            "password": "testpassword123",
            "nickname": "Test User"
        }
        default_data.update(kwargs)
        return default_data
    
    @staticmethod
    def create_script_data(**kwargs) -> Dict[str, Any]:
        """创建剧本测试数据"""
        default_data = {
            "title": "Test Script",
            "description": "A test script for unit testing",
            "player_count": 4,
            "estimated_duration": 180,
            "difficulty_level": "medium",
            "category": "推理",
            "tags": ["test", "unit-test"]
        }
        default_data.update(kwargs)
        return default_data
    
    @staticmethod
    def create_character_data(**kwargs) -> Dict[str, Any]:
        """创建角色测试数据"""
        default_data = {
            "name": "Test Character",
            "background": "A test character for unit testing",
            "secret": "This is a secret",
            "objective": "Test objective",
            "gender": "中性",
            "is_murderer": False,
            "is_victim": False
        }
        default_data.update(kwargs)
        return default_data
    
    @staticmethod
    def create_evidence_data(**kwargs) -> Dict[str, Any]:
        """创建证据测试数据"""
        default_data = {
            "name": "Test Evidence",
            "description": "A test evidence for unit testing",
            "location": "Test Location",
            "related_to": "Test Character"
        }
        default_data.update(kwargs)
        return default_data
    
    @staticmethod
    def create_location_data(**kwargs) -> Dict[str, Any]:
        """创建场景测试数据"""
        default_data = {
            "name": "Test Location",
            "description": "A test location for unit testing"
        }
        default_data.update(kwargs)
        return default_data


# 全局实例
test_data_factory = TestDataFactory()