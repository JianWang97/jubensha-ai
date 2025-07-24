"""用户认证依赖项"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from src.db.session import get_db_session
from src.services.auth_service import AuthService
from src.db.models.user import User
from typing import Optional

# HTTP Bearer 认证方案
security = HTTPBearer()

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db_session)
) -> User:
    """获取当前认证用户"""
    token = credentials.credentials
    
    # 验证令牌
    token_data = AuthService.verify_token(token)
    
    # 获取用户
    user = AuthService.get_user_by_id(db, token_data.user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户不存在",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 检查用户是否激活
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户账户已被禁用",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return user

def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    """获取当前激活用户"""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户账户已被禁用"
        )
    return current_user

def get_current_admin_user(current_user: User = Depends(get_current_user)) -> User:
    """获取当前管理员用户"""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="权限不足，需要管理员权限"
        )
    return current_user

def get_optional_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False)),
    db: Session = Depends(get_db_session)
) -> Optional[User]:
    """获取可选的当前用户（用于可选认证的接口）"""
    if credentials is None:
        return None
    
    try:
        token = credentials.credentials
        token_data = AuthService.verify_token(token)
        user = AuthService.get_user_by_id(db, token_data.user_id)
        
        if user and user.is_active:
            return user
    except HTTPException:
        # 如果令牌无效，返回None而不是抛出异常
        pass
    
    return None