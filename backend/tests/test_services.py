"""服务层测试"""
import pytest
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def test_imports():
    """测试服务模块导入"""
    try:
        from src.services import (
            LLMService,
            TTSService
        )
        # 如果导入成功，测试通过
        assert True
    except ImportError as e:
        # 如果导入失败，测试失败
        pytest.fail(f"服务模块导入失败: {e}")


def test_service_creation():
    """测试服务实例创建"""
    try:
        from src.services.llm_service import LLMService
        from src.services.tts_service import TTSService
        from src.services.auth_service import AuthService
        
        # 尝试创建服务实例
        llm_service = LLMService()
        tts_service = TTSService()
        auth_service = AuthService()
        
        # 验证实例创建成功
        assert llm_service is not None
        assert tts_service is not None
        assert auth_service is not None
    except Exception as e:
        pytest.fail(f"服务实例创建失败: {e}")


def test_ai_agent_creation():
    """测试AI代理创建"""
    try:
        from src.agents import AIAgent
        from src.schemas.script import ScriptCharacter
        
        # 创建角色对象
        character = ScriptCharacter(
            id=1,
            name="Test Character",
            background="Test Info",
            secret="",
            objective="",
            is_murderer=False,
            is_victim=False,
            knowledge=""
        )
        
        # 尝试创建AI代理实例
        agent = AIAgent(character=character)
        
        # 验证实例创建成功
        assert agent is not None
        assert agent.character == character
    except ImportError:
        # 如果AI代理模块不存在，跳过测试
        pytest.skip("AI代理模块未找到")
    except Exception as e:
        pytest.fail(f"AI代理创建失败: {e}")


def test_auth_service_password_functions():
    """测试认证服务的密码功能"""
    try:
        from src.services.auth_service import AuthService
        
        # 测试密码哈希
        password = "testpassword123"
        hashed = AuthService.get_password_hash(password)
        
        # 验证哈希不为空且与原密码不同
        assert hashed is not None
        assert hashed != password
        
        # 测试密码验证
        assert AuthService.verify_password(password, hashed) is True
        assert AuthService.verify_password("wrongpassword", hashed) is False
    except Exception as e:
        pytest.fail(f"认证服务密码功能测试失败: {e}")


if __name__ == "__main__":
    pytest.main([__file__])