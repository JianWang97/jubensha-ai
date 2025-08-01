#!/usr/bin/env python3
"""测试运行脚本"""

import subprocess
import sys
import os


def run_tests(test_type: str = "all"):
    """运行测试"""
    try:
        if test_type == "all":
            # 运行所有测试
            result = subprocess.run(["uv", "run", "pytest"], cwd=os.getcwd())
        elif test_type == "api":
            # 只运行API测试
            result = subprocess.run(["uv", "run", "pytest", "-m", "api"], cwd=os.getcwd())
        elif test_type == "unit":
            # 只运行单元测试
            result = subprocess.run(["uv", "run", "pytest", "-m", "unit"], cwd=os.getcwd())
        else:
            # 运行特定测试文件
            result = subprocess.run(["uv", "run", "pytest", test_type], cwd=os.getcwd())
        
        return result.returncode == 0
    except Exception as e:
        print(f"运行测试时出错: {e}")
        return False


if __name__ == "__main__":
    if len(sys.argv) > 1:
        test_type = sys.argv[1]
    else:
        test_type = "all"
    
    success = run_tests(test_type)
    sys.exit(0 if success else 1)