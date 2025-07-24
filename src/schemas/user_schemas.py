"""用户相关的Pydantic模式"""
from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional, List
from datetime import datetime

# 用户注册
class UserRegister(BaseModel):
    """用户注册模式"""
    username: str = Field(..., min_length=3, max_length=50, description="用户名")
    email: EmailStr = Field(..., description="邮箱地址")
    password: str = Field(..., min_length=6, max_length=100, description="密码")
    nickname: Optional[str] = Field(None, max_length=50, description="昵称")
    
    @validator('username')
    def validate_username(cls, v):
        if not v.isalnum() and '_' not in v:
            raise ValueError('用户名只能包含字母、数字和下划线')
        return v
    
    @validator('password')
    def validate_password(cls, v):
        if len(v) < 6:
            raise ValueError('密码长度至少6位')
        return v

# 用户登录
class UserLogin(BaseModel):
    """用户登录模式"""
    username: str = Field(..., description="用户名或邮箱")
    password: str = Field(..., description="密码")

# 用户信息更新
class UserUpdate(BaseModel):
    """用户信息更新模式"""
    nickname: Optional[str] = Field(None, max_length=50, description="昵称")
    bio: Optional[str] = Field(None, max_length=500, description="个人简介")
    avatar_url: Optional[str] = Field(None, description="头像URL")

# 密码修改
class PasswordChange(BaseModel):
    """密码修改模式"""
    old_password: str = Field(..., description="旧密码")
    new_password: str = Field(..., min_length=6, max_length=100, description="新密码")
    
    @validator('new_password')
    def validate_new_password(cls, v):
        if len(v) < 6:
            raise ValueError('新密码长度至少6位')
        return v

# 用户响应模式
class UserResponse(BaseModel):
    """用户响应模式"""
    id: int
    username: str
    email: str
    nickname: Optional[str]
    avatar_url: Optional[str]
    bio: Optional[str]
    is_active: bool
    is_verified: bool
    is_admin: bool
    last_login_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

# 用户简要信息
class UserBrief(BaseModel):
    """用户简要信息模式"""
    id: int
    username: str
    nickname: Optional[str]
    avatar_url: Optional[str]
    
    class Config:
        from_attributes = True

# 认证令牌
class Token(BaseModel):
    """认证令牌模式"""
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse

# 令牌数据
class TokenData(BaseModel):
    """令牌数据模式"""
    user_id: Optional[int] = None
    username: Optional[str] = None

# 游戏会话相关模式
class GameSessionCreate(BaseModel):
    """创建游戏会话模式"""
    script_id: int = Field(..., description="剧本ID")
    max_players: int = Field(4, ge=2, le=8, description="最大玩家数")

class GameSessionResponse(BaseModel):
    """游戏会话响应模式"""
    id: int
    session_id: str
    script_id: int
    host_user_id: int
    status: str
    current_phase: Optional[str]
    max_players: int
    current_players: int
    started_at: Optional[datetime]
    finished_at: Optional[datetime]
    created_at: datetime
    
    class Config:
        from_attributes = True

class GameParticipantResponse(BaseModel):
    """游戏参与者响应模式"""
    id: int
    user_id: int
    character_id: Optional[int]
    role: str
    status: str
    is_winner: bool
    score: int
    joined_at: datetime
    left_at: Optional[datetime]
    user: UserBrief
    
    class Config:
        from_attributes = True

class GameHistoryResponse(BaseModel):
    """游戏历史响应模式"""
    session: GameSessionResponse
    participation: GameParticipantResponse
    
    class Config:
        from_attributes = True