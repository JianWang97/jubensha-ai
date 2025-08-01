"""基于中间件的依赖注入函数

这些函数用于在路由中获取由认证中间件设置的用户信息，
可以逐步替代传统的认证依赖注入。
"""

from fastapi import Request, Depends, HTTPException, status
from src.db.models.user import User
from typing import Optional


def get_current_user_middleware(request: Request) -> Optional[User]:
    """从中间件获取当前用户（可能为None）"""
    return getattr(request.state, 'current_user', None)


def get_current_active_user_middleware(request: Request) -> User:
    """从中间件获取当前活跃用户（必须存在且活跃）"""
    user = getattr(request.state, 'current_user', None)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="未认证的用户",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="账户已被禁用"
        )
    return user


def get_current_admin_user_middleware(request: Request) -> User:
    """从中间件获取当前管理员用户（必须存在、活跃且为管理员）"""
    user = get_current_active_user_middleware(request)
    if not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要管理员权限"
        )
    return user


def get_optional_current_user_middleware(request: Request) -> Optional[User]:
    """从中间件获取可选的当前用户（用于可选认证的路由）"""
    user = getattr(request.state, 'current_user', None)
    # 如果用户存在但不活跃，返回None
    if user and not user.is_active:
        return None
    return user


def is_authenticated_middleware(request: Request) -> bool:
    """检查当前请求是否已认证"""
    return getattr(request.state, 'is_authenticated', False)