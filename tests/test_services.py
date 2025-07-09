#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试新的服务抽象层
"""

import sys
import os
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

def test_imports():
    """测试所有导入"""
    try:
        print("测试配置模块...")
        from src.core.config import config
        print(f"✓ 配置模块导入成功")
        print(f"  LLM提供商: {config.llm_config.provider}")
        print(f"  TTS提供商: {config.tts_config.provider}")
        
        print("\n测试LLM服务...")
        from src.services import LLMService
        from src.services.llm_service import LLMMessage
        print("✓ LLM服务模块导入成功")
        
        print("\n测试TTS服务...")
        from src.services import TTSService
        from src.services.tts_service import TTSRequest
        print("✓ TTS服务模块导入成功")
        
        print("\n测试AI代理...")
        from src.agents.ai_agent import AIAgent
        from src.models import Character
        print("✓ AI代理模块导入成功")
        
        print("\n测试游戏引擎...")
        from src.core import GameEngine
        print("✓ 游戏引擎模块导入成功")
        
        return True
        
    except Exception as e:
        print(f"✗ 导入失败: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_service_creation():
    """测试服务创建"""
    try:
        print("\n测试服务创建...")
        from src.core.config import config
        from src.services import LLMService, TTSService
        
        # 测试LLM服务创建
        llm_service = LLMService.from_config(config.llm_config)
        print(f"✓ LLM服务创建成功: {type(llm_service).__name__}")
        
        # 测试TTS服务创建
        tts_service = TTSService.from_config(config.tts_config)
        print(f"✓ TTS服务创建成功: {type(tts_service).__name__}")
        
        return True
        
    except Exception as e:
        print(f"✗ 服务创建失败: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_ai_agent_creation():
    """测试AI代理创建"""
    try:
        print("\n测试AI代理创建...")
        from src.agents.ai_agent import AIAgent
        from src.models import Character
        
        # 创建测试角色
        character = Character(
            name="测试角色",
            background="测试背景",
            secret="测试秘密",
            objective="测试目标",
            gender="中性"
        )
        
        # 创建AI代理
        agent = AIAgent(character)
        print(f"✓ AI代理创建成功: {agent.character.name}")
        
        return True
        
    except Exception as e:
        print(f"✗ AI代理创建失败: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """主测试函数"""
    print("=== 服务抽象层测试 ===")
    print(f"Python版本: {sys.version}")
    print(f"工作目录: {os.getcwd()}")
    
    # 检查环境变量
    print(f"\n环境变量检查:")
    print(f"  LLM_PROVIDER: {os.getenv('LLM_PROVIDER', '未设置')}")
    print(f"  TTS_PROVIDER: {os.getenv('TTS_PROVIDER', '未设置')}")
    print(f"  OPENAI_API_KEY: {'已设置' if os.getenv('OPENAI_API_KEY') else '未设置'}")
    print(f"  DASHSCOPE_API_KEY: {'已设置' if os.getenv('DASHSCOPE_API_KEY') else '未设置'}")
    
    # 运行测试
    tests = [
        ("导入测试", test_imports),
        ("服务创建测试", test_service_creation),
        ("AI代理创建测试", test_ai_agent_creation)
    ]
    
    results = []
    for test_name, test_func in tests:
        print(f"\n{'='*50}")
        print(f"运行 {test_name}...")
        result = test_func()
        results.append((test_name, result))
    
    # 总结
    print(f"\n{'='*50}")
    print("测试总结:")
    for test_name, result in results:
        status = "✓ 通过" if result else "✗ 失败"
        print(f"  {test_name}: {status}")
    
    all_passed = all(result for _, result in results)
    if all_passed:
        print("\n🎉 所有测试通过！服务抽象层工作正常。")
    else:
        print("\n❌ 部分测试失败，请检查错误信息。")
    
    return all_passed

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)