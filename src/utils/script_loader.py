"""剧本数据加载器"""
import json
from typing import Dict

class ScriptLoader:
    """剧本数据加载器"""
    
    @staticmethod
    def load_script_data(script_file: str) -> Dict:
        """从JSON文件加载剧本数据"""
        try:
            with open(script_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except FileNotFoundError:
            raise FileNotFoundError(f"未找到剧本文件: {script_file}")
        except json.JSONDecodeError as e:
            raise ValueError(f"剧本文件格式错误: {script_file}, 错误信息: {e}")
    
    @staticmethod
    def validate_script_data(script_data: Dict) -> bool:
        """验证剧本数据完整性"""
        required_keys = ["script_info", "characters", "evidence", "game_phases"]
        
        for key in required_keys:
            if key not in script_data:
                raise ValueError(f"剧本数据中缺少必要字段: {key}")
        
        # 验证角色数据
        if not isinstance(script_data["characters"], list) or len(script_data["characters"]) == 0:
            raise ValueError("剧本数据中角色信息无效")
        
        # 验证证据数据
        if not isinstance(script_data["evidence"], list) or len(script_data["evidence"]) == 0:
            raise ValueError("剧本数据中证据信息无效")
        
        return True