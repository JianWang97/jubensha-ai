"""图片数据模型"""
import uuid
from enum import Enum
from sqlalchemy import Column, String, ForeignKey, Text, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from src.db.base import BaseSQLAlchemyModel

class ImageType(str, Enum):
    """图片类型枚举"""
    COVER = "COVER"       # 封面
    CHARACTER = "CHARACTER"  # 角色
    EVIDENCE = "EVIDENCE"    # 证据
    SCENE = "SCENE"         # 场景

class ImageDBModel(BaseSQLAlchemyModel):
    """图片数据模型"""
    __tablename__ = "images"
    
    # 主键使用UUID
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, comment="图片ID")
    
    # 基本信息
    image_type = Column(SQLEnum(ImageType), nullable=False, comment="图片类型")
    url = Column(Text, nullable=False, comment="图片URL")
    path = Column(Text, nullable=True, comment="图片存储路径")
    
    # 关联信息
    script_id = Column(ForeignKey("scripts.id"), nullable=False, comment="剧本ID")
    author_id = Column(ForeignKey("users.id"), nullable=False, comment="作者ID")
    
    # 生成相关信息
    positive_prompt = Column(Text, nullable=True, comment="正向提示词")
    negative_prompt = Column(Text, nullable=True, comment="负向提示词")
    
    # 图片参数
    width = Column(String(10), nullable=True, comment="图片宽度")
    height = Column(String(10), nullable=True, comment="图片高度")
    
    # 关联关系
    script = relationship("ScriptDBModel", back_populates="images")
    author = relationship("User", back_populates="images")
    
    def __repr__(self):
        return f"<Image(id={self.id}, type={self.image_type}, script_id={self.script_id})>"
    
    def to_dict(self):
        """转换为字典"""
        return {
            'id': str(self.id),
            'image_type': self.image_type.value,
            'url': self.url,
            'path': self.path,
            'script_id': self.script_id,
            'author_id': self.author_id,
            'positive_prompt': self.positive_prompt,
            'negative_prompt': self.negative_prompt,
            'width': self.width,
            'height': self.height,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
