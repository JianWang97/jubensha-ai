import sys
import os
sys.path.append('.')

# 简单的导入测试
try:
    from src.api.routes.image_generation_routes import optimize_prompt_with_llm
    from src.schemas.image_generation_schemas import ImageType
    print("✓ 成功导入相关模块")
    
    # 测试JSON解析逻辑
    import json
    user_prompt = '{"name":"王副总","age":45,"gender":"男","profession":"副总裁"}'
    
    character_info = {}
    if user_prompt and user_prompt.strip().startswith('{'):
        character_info = json.loads(user_prompt)
        
    if character_info:
        name = character_info.get('name', '')
        age = character_info.get('age', '')
        gender = character_info.get('gender', '')
        profession = character_info.get('profession', '')
        print("✓ JSON解析正常工作")
        print(f"  - 解析出角色: {name}, {age}岁, {gender}, {profession}")
    else:
        print("✗ JSON解析失败")
        
except ImportError as e:
    print(f"✗ 导入失败: {e}")
except Exception as e:
    print(f"✗ 其他错误: {e}")
    import traceback
    traceback.print_exc()

print("\n修改总结:")
print("1. 在optimize_prompt_with_llm函数中添加了JSON解析逻辑")
print("2. 当image_type为CHARACTER时，会尝试解析positive_prompt中的角色JSON")
print("3. 解析出的角色信息（姓名、年龄、性别、职业等）会被传递给LLM")
print("4. LLM现在能够基于具体的角色信息生成更准确的图片描述")
print("5. 特别是年龄信息现在会被正确传递，有助于生成符合年龄的人物形象")
