"""测试工具模块"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.utils import ScriptLoader
import json

def test_script_loader():
    """测试剧本加载器"""
    print("=== 测试剧本加载器 ===")
    
    # 测试加载有效的剧本文件
    try:
        script_data = ScriptLoader.load_script_data("script_data.json")
        print("成功加载剧本数据")
        print(f"剧本标题: {script_data['script_info']['title']}")
        print(f"角色数量: {len(script_data['characters'])}")
        print(f"证据数量: {len(script_data['evidence'])}")
    except Exception as e:
        print(f"加载剧本失败: {e}")
        return
    
    # 测试数据验证
    try:
        ScriptLoader.validate_script_data(script_data)
        print("剧本数据验证通过")
    except Exception as e:
        print(f"数据验证失败: {e}")
        return
    
    print("剧本加载器测试通过")

def test_error_handling():
    """测试错误处理"""
    print("\n=== 测试错误处理 ===")
    
    # 测试文件不存在
    try:
        ScriptLoader.load_script_data("non_existent.json")
        print("错误：应该抛出FileNotFoundError")
    except FileNotFoundError as e:
        print(f"正确：捕获文件不存在异常 - {e}")
    
    # 测试无效JSON格式
    try:
        with open("invalid.json", "w", encoding="utf-8") as f:
            f.write("{invalid json}")
        
        ScriptLoader.load_script_data("invalid.json")
        print("错误：应该抛出ValueError")
    except ValueError as e:
        print(f"正确：捕获JSON格式错误 - {e}")
    finally:
        if os.path.exists("invalid.json"):
            os.remove("invalid.json")
    
    # 测试数据验证失败
    try:
        invalid_data = {"script_info": {}}
        ScriptLoader.validate_script_data(invalid_data)
        print("错误：应该抛出数据验证异常")
    except ValueError as e:
        print(f"正确：捕获数据验证异常 - {e}")
    
    print("错误处理测试通过")

if __name__ == "__main__":
    test_script_loader()
    test_error_handling()
    print("\n=== 所有工具测试通过 ===")