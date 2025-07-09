#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
游戏引擎使用示例
展示如何使用从JSON文件加载剧本数据的游戏引擎
"""

import asyncio
from src.core import GameEngine
import os
from dotenv import load_dotenv

load_dotenv()

async def main():
    """主函数演示游戏引擎的使用"""
    print("=== 剧本杀游戏引擎演示 ===")
    
    # 创建游戏引擎，加载script_data.json
    # 注意：必须提供有效的JSON文件，否则会抛出异常
    engine = GameEngine("data/script_data.json")
    
    # 显示剧本信息
    script_info = engine.get_script_info()
    print(f"\n剧本: {script_info['title']}")
    print(f"描述: {script_info['description']}")
    print(f"受害者: {script_info['victim']}")
    print(f"场景: {script_info['setting']}")
    
    # 显示参与游戏的角色
    print(f"\n参与角色 ({len(engine.characters)}人):")
    for char in engine.characters:
        role_type = "凶手" if char.is_murderer else "嫌疑人"
        print(f"- {char.name} ({role_type})")
    
    # 显示可搜查的证据
    print(f"\n可发现证据 ({len(engine.evidence_manager.evidence)}个):")
    for evidence in engine.evidence_manager.evidence:
        print(f"- {evidence['name']} (位置: {evidence['location']})")
        print(f"  描述: {evidence['description']}")
    
    # 显示游戏阶段
    phases_info = engine.get_game_phases_info()
    print(f"\n游戏阶段 ({len(phases_info)}个):")
    for i, phase in enumerate(phases_info, 1):
        print(f"{i}. {phase['name']}: {phase['description']}")
    
    # 如果有API密钥，可以初始化AI代理
    api_key = os.getenv("OPENAI_API_KEY")
    if api_key:
        print("\n初始化AI代理...")
        await engine.initialize_agents(api_key)
        print(f"已初始化 {len(engine.agents)} 个AI代理")
        
        # 演示运行一个阶段
        print("\n=== 演示自我介绍阶段 ===")
        actions = await engine.run_phase()
        for action in actions:
            print(f"{action['character']}: {action['action']}")
    else:
        print("\n未找到OPENAI_API_KEY，跳过AI代理演示")
    
    print("\n=== 演示完成 ===")

def create_custom_script_example():
    """创建自定义剧本的示例"""
    custom_script = {
        "script_info": {
            "title": "古宅疑云",
            "description": "一个发生在古老庄园的神秘谋杀案",
            "victim": "庄园主人",
            "setting": "古老的英式庄园"
        },
        "characters": [
            {
                "name": "管家",
                "background": "忠诚的老管家，在庄园工作了30年",
                "secret": "知道主人的财产分配秘密",
                "objective": "保护庄园的秘密",
                "is_murderer": True,
                "is_victim": False
            },
            {
                "name": "继承人",
                "background": "主人的侄子，唯一的法定继承人",
                "secret": "欠下巨额赌债",
                "objective": "尽快继承遗产",
                "is_murderer": False,
                "is_victim": False
            }
        ],
        "evidence": [
            {
                "id": "evidence_1",
                "name": "毒药瓶",
                "location": "厨房橱柜",
                "description": "一个空的毒药瓶，标签已被撕掉",
                "related_to": "管家",
                "significance": "凶器，管家有机会接触"
            }
        ]
    }
    
    # 保存自定义剧本
    import json
    with open("custom_script.json", "w", encoding="utf-8") as f:
        json.dump(custom_script, f, ensure_ascii=False, indent=2)
    
    print("已创建自定义剧本文件: custom_script.json")
    
    # 使用自定义剧本创建游戏引擎
    # 注意：如果custom_script.json不存在，会抛出FileNotFoundError异常
    try:
        custom_engine = GameEngine("data/custom_script.json")
        print("成功加载自定义剧本")
        custom_info = custom_engine.get_script_info()
        print(f"自定义剧本: {custom_info['title']}")
        print(f"角色数量: {len(custom_engine.characters)}")
    except FileNotFoundError:
        print("自定义剧本文件不存在，请先创建custom_script.json文件")

if __name__ == "__main__":
    # 运行主演示
    asyncio.run(main())
    
    print("\n" + "="*50)
    print("自定义剧本示例:")
    create_custom_script_example()