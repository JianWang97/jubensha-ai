import json

# 测试JSON解析逻辑
user_prompt = '{"name":"王副总","age":45,"gender":"男","profession":"副总裁","personality_traits":[],"background":"背景故事...","is_victim":false,"is_murderer":false}'

character_info = {}
try:
    if user_prompt and user_prompt.strip().startswith('{'):
        character_info = json.loads(user_prompt)
        print('JSON解析成功:')
        print('姓名:', character_info.get('name', ''))
        print('年龄:', character_info.get('age', ''))
        print('性别:', character_info.get('gender', ''))
        print('职业:', character_info.get('profession', ''))
        print('背景:', character_info.get('background', ''))
        print('是否凶手:', character_info.get('is_murderer', False))
        print('是否受害者:', character_info.get('is_victim', False))
        
        # 构建角色描述
        name = character_info.get('name', '')
        age = character_info.get('age', '')
        gender = character_info.get('gender', '')
        profession = character_info.get('profession', '')
        background = character_info.get('background', '')
        is_murderer = character_info.get('is_murderer', False)
        is_victim = character_info.get('is_victim', False)
        
        character_desc = f"""
角色信息：
- 姓名：{name}
- 年龄：{age}岁
- 性别：{gender}
- 职业：{profession}
- 背景：{background}
- 身份：{'凶手' if is_murderer else '受害者' if is_victim else '普通角色'}
"""
        print('\n生成的角色描述:')
        print(character_desc)
        
except Exception as e:
    print('解析错误:', e)
