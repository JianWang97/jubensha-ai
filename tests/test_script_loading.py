#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试剧本数据加载功能
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.core import GameEngine
import json

def test_script_loading():
    """测试从JSON文件加载剧本数据"""
    print("=== 测试剧本数据加载 ===")
    
    # 创建游戏引擎实例
    engine = GameEngine("data/script_data.json")
    
    # 测试剧本信息
    script_info = engine.get_script_info()
    print(f"\n剧本标题: {script_info.get('title')}")
    print(f"剧本描述: {script_info.get('description')}")
    print(f"受害者: {script_info.get('victim')}")
    print(f"场景: {script_info.get('setting')}")
    
    # 测试角色加载
    print(f"\n加载的角色数量: {len(engine.characters)}")
    for char in engine.characters:
        print(f"- {char.name}: {char.background}")
        print(f"  秘密: {char.secret}")
        print(f"  目标: {char.objective}")
        print(f"  是否为凶手: {char.is_murderer}")
        print()
    
    # 测试证据加载
    print(f"证据数量: {len(engine.evidence_manager.evidence)}")
    for evidence in engine.evidence_manager.evidence:
        print(f"- {evidence['name']} (位置: {evidence['location']})")
        print(f"  描述: {evidence['description']}")
        print(f"  相关角色: {evidence['related_to']}")
        print()
    
    # 测试游戏阶段信息
    phases_info = engine.get_game_phases_info()
    print(f"游戏阶段数量: {len(phases_info)}")
    for phase in phases_info:
        print(f"- {phase.get('name', phase.get('phase'))}: {phase.get('description')}")
    
    print("\n=== 测试完成 ===")

def test_error_handling():
    """测试错误处理机制"""
    print("\n=== 测试错误处理 ===")
    
    # 测试文件不存在的情况
    try:
        engine = GameEngine("non_existent_file.json")
        print("错误：应该抛出FileNotFoundError异常")
    except FileNotFoundError as e:
        print(f"正确：捕获到文件不存在异常 - {e}")
    
    # 测试JSON格式错误的情况
    try:
        # 创建一个格式错误的JSON文件
        with open("invalid.json", "w", encoding="utf-8") as f:
            f.write("{invalid json}")
        
        engine = GameEngine("invalid.json")
        print("错误：应该抛出ValueError异常")
    except ValueError as e:
        print(f"正确：捕获到JSON格式错误异常 - {e}")
    finally:
        # 清理测试文件
        import os
        if os.path.exists("invalid.json"):
            os.remove("invalid.json")

if __name__ == "__main__":
    test_script_loading()
    test_error_handling()