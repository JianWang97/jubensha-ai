from enum import Enum
class EvidenceType(Enum):
    """证据类型"""
    PHYSICAL = "PHYSICAL"  # 物理证据
    DOCUMENT = "DOCUMENT"  # 文件证据
    VIDEO = "VIDEO"  # 视频证据
    AUDIO = "AUDIO"  # 音频证据
    IMAGE = "IMAGE"  # 图片证据