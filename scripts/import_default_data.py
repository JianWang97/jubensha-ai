import asyncio
import json
import os
import sys
from pathlib import Path

# Add project root to Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from src.core.database import db_manager
from src.core.script_repository import script_repository

async def load_script_folder_data(script_folder_path):
    """从剧本文件夹加载所有数据"""
    script_data = {}
    
    # 加载剧本基本信息
    script_file = os.path.join(script_folder_path, 'script.json')
    if os.path.exists(script_file):
        with open(script_file, 'r', encoding='utf-8') as f:
            script_data.update(json.load(f))
    
    # 加载角色数据
    characters_file = os.path.join(script_folder_path, 'characters.json')
    if os.path.exists(characters_file):
        with open(characters_file, 'r', encoding='utf-8') as f:
            script_data['characters'] = json.load(f)
    
    # 加载证据数据
    evidence_file = os.path.join(script_folder_path, 'evidence.json')
    if os.path.exists(evidence_file):
        with open(evidence_file, 'r', encoding='utf-8') as f:
            script_data['evidence'] = json.load(f)
    
    # 加载场所数据
    locations_file = os.path.join(script_folder_path, 'locations.json')
    if os.path.exists(locations_file):
        with open(locations_file, 'r', encoding='utf-8') as f:
            script_data['locations'] = json.load(f)
    
    # 加载背景故事数据
    background_file = os.path.join(script_folder_path, 'background.json')
    if os.path.exists(background_file):
        with open(background_file, 'r', encoding='utf-8') as f:
            background_data = json.load(f)
            script_data['background_story'] = background_data
    
    # 加载游戏阶段数据
    phases_file = os.path.join(script_folder_path, 'phases.json')
    if os.path.exists(phases_file):
        with open(phases_file, 'r', encoding='utf-8') as f:
            script_data['game_phases'] = json.load(f)
    
    return script_data

async def import_script_data(script_data, script_name):
    """导入单个剧本数据"""
    try:
        # 创建剧本基本信息
        script_info = {
            'title': script_data.get('title', script_name),
            'description': script_data.get('description', ''),
            'player_count': script_data.get('player_count', len(script_data.get('characters', []))),
            'difficulty': script_data.get('difficulty', 'medium'),
            'estimated_time': script_data.get('estimated_time', 120),
            'tags': script_data.get('tags', []),
            'status': 'published'
        }
        
        # 创建剧本
        script_id = await script_repository.create_script(script_info)
        print(f"创建剧本: {script_info['title']} (ID: {script_id})")
        
        # 导入背景故事
        if 'background_story' in script_data:
            background_data = script_data['background_story']
            if isinstance(background_data, dict):
                # 新格式的背景故事数据
                story_data = {
                    'script_id': script_id,
                    'content': json.dumps(background_data, ensure_ascii=False),
                    'order_index': 0
                }
            else:
                # 旧格式的背景故事数据
                story_data = {
                    'script_id': script_id,
                    'content': str(background_data),
                    'order_index': 0
                }
            await script_repository.create_background_story(story_data)
            print(f"  - 导入背景故事")
        
        # 导入角色
        if 'characters' in script_data:
            for i, char in enumerate(script_data['characters']):
                character_data = {
                    'script_id': script_id,
                    'name': char.get('name', f'角色{i+1}'),
                    'description': char.get('background', ''),
                    'gender': char.get('gender', 'unknown'),
                    'age': char.get('age'),
                    'occupation': char.get('occupation'),
                    'personality': char.get('personality'),
                    'background_story': char.get('background', ''),
                    'secret': char.get('secret'),
                    'motivation': char.get('motivation'),
                    'is_victim': char.get('is_victim', False),
                    'is_murderer': char.get('is_murderer', False),
                    'order_index': i
                }
                await script_repository.create_character(character_data)
            print(f"  - 导入 {len(script_data['characters'])} 个角色")
        
        # 导入证据
        if 'evidence' in script_data:
            for i, evidence in enumerate(script_data['evidence']):
                evidence_data = {
                    'script_id': script_id,
                    'name': evidence.get('name', f'证据{i+1}'),
                    'description': evidence.get('description', ''),
                    'type': evidence.get('type', 'physical'),
                    'location': evidence.get('location'),
                    'discoverer': evidence.get('discoverer'),
                    'discovery_condition': evidence.get('discovery_condition'),
                    'significance': evidence.get('significance'),
                    'is_key_evidence': evidence.get('is_key_evidence', False),
                    'order_index': i
                }
                await script_repository.create_evidence(evidence_data)
            print(f"  - 导入 {len(script_data['evidence'])} 个证据")
        
        # 导入场景
        if 'locations' in script_data:
            for i, location in enumerate(script_data['locations']):
                location_data = {
                    'script_id': script_id,
                    'name': location.get('name', f'场景{i+1}'),
                    'description': location.get('description', ''),
                    'type': location.get('type', 'indoor'),
                    'accessibility': location.get('accessibility'),
                    'special_features': location.get('special_features'),
                    'order_index': i
                }
                await script_repository.create_location(location_data)
            print(f"  - 导入 {len(script_data['locations'])} 个场景")
        
        # 导入游戏阶段
        if 'game_phases' in script_data:
            for i, phase in enumerate(script_data['game_phases']):
                phase_data = {
                    'script_id': script_id,
                    'name': phase.get('name', f'阶段{i+1}'),
                    'description': phase.get('description', ''),
                    'duration_minutes': phase.get('estimated_duration', 30),
                    'objectives': json.dumps(phase.get('objectives', [])),
                    'rules': json.dumps(phase.get('rules', [])),
                    'order_index': phase.get('order_index', i)
                }
                await script_repository.create_game_phase(phase_data)
            print(f"  - 导入 {len(script_data['game_phases'])} 个游戏阶段")
        
        print(f"剧本 '{script_info['title']}' 导入完成\n")
        return script_id
        
    except Exception as e:
        print(f"导入剧本数据失败 ({script_name}): {e}")
        return None

async def main():
    """主函数"""
    try:
        # 初始化数据库
        await db_manager.initialize()
        print("数据库初始化完成")
        
        # 检查是否已有数据
        existing_scripts = await script_repository.get_all_scripts()
        if existing_scripts:
            print(f"数据库中已有 {len(existing_scripts)} 个剧本")
            response = input("是否要清空现有数据并重新导入？(y/N): ")
            if response.lower() != 'y':
                print("取消导入")
                return
        
        # 扫描data目录下的所有剧本文件夹
        data_dir = "data"
        if not os.path.exists(data_dir):
            print(f"数据目录不存在: {data_dir}")
            return
        
        imported_count = 0
        for item in os.listdir(data_dir):
            item_path = os.path.join(data_dir, item)
            # 跳过文件，只处理文件夹
            if not os.path.isdir(item_path):
                continue
            
            # 检查是否包含script.json文件
            script_file = os.path.join(item_path, 'script.json')
            if not os.path.exists(script_file):
                print(f"跳过文件夹 {item}：未找到script.json")
                continue
            
            print(f"正在导入剧本: {item}")
            try:
                # 加载剧本数据
                script_data = await load_script_folder_data(item_path)
                
                # 导入剧本
                script_id = await import_script_data(script_data, item)
                if script_id:
                    imported_count += 1
                    
            except Exception as e:
                print(f"导入剧本 {item} 失败: {e}")
                continue
        
        print(f"\n导入完成！成功导入 {imported_count} 个剧本")
        
    except Exception as e:
        print(f"导入过程中发生错误: {e}")
    finally:
        await db_manager.close()

if __name__ == "__main__":
    asyncio.run(main())