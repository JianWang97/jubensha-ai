"""用户数据模型"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from src.db.base import BaseSQLAlchemyModel

class User(BaseSQLAlchemyModel):
    """用户模型"""
    __tablename__ = "users"
    
    # 基本信息
    username = Column(String(50), unique=True, nullable=False, index=True, comment="用户名")
    email = Column(String(100), unique=True, nullable=False, index=True, comment="邮箱")
    hashed_password = Column(String(255), nullable=False, comment="加密密码")
    
    # 个人资料
    nickname = Column(String(50), nullable=True, comment="昵称")
    avatar_url = Column(Text, nullable=True, comment="头像URL")
    bio = Column(Text, nullable=True, comment="个人简介")
    
    # 状态字段
    is_active = Column(Boolean, default=True, nullable=False, comment="是否激活")
    is_verified = Column(Boolean, default=False, nullable=False, comment="是否已验证邮箱")
    is_admin = Column(Boolean, default=False, nullable=False, comment="是否管理员")
    
    # 时间戳
    last_login_at = Column(DateTime(timezone=True), nullable=True, comment="最后登录时间")
    
    # 关联关系
    hosted_sessions = relationship("GameSession", back_populates="host_user")
    game_participations = relationship("GameParticipant", back_populates="user")
    images = relationship("ImageDBModel", back_populates="author")
    
    def set_hashed_password(self, hashed_password: str) -> None:
        """设置加密密码"""
        self.__setattr__('hashed_password', hashed_password)

    def __repr__(self):
        return f"<User(id={self.id}, username='{self.username}', email='{self.email}')>"
    
    def to_dict(self, include_sensitive=False):
        """转换为字典，默认不包含敏感信息"""
        data = {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'nickname': self.nickname,
            'avatar_url': self.avatar_url,
            'bio': self.bio,
            'is_active': self.is_active,
            'is_verified': self.is_verified,
            'is_admin': self.is_admin,
            'last_login_at': self.last_login_at.isoformat() if self.last_login_at is not None else None,  # 修复：明确检查None
            'created_at': self.created_at.isoformat() if self.created_at is not None else None,  # 修复：明确检查None
            'updated_at': self.updated_at.isoformat() if self.updated_at is not None else None,  # 修复：明确检查None
            'hashed_password': self.hashed_password,
        }
        
        if include_sensitive:
            data['hashed_password'] = self.hashed_password
            
        return data

