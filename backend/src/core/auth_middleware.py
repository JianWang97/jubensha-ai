"""统一认证中间件

这个中间件提供了统一的路由鉴权管理，支持：
1. 基于路径的自动认证
2. 不同级别的认证要求（可选、必需、管理员）
3. 白名单路径配置
4. 统一的认证失败响应
"""

import re
from typing import List, Optional, Dict, Any
from fastapi import Request, Response, HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from src.db.session import get_db_session
from src.services.auth_service import AuthService
from src.db.models.user import User


class AuthLevel:
    """认证级别常量"""
    NONE = "none"  # 无需认证
    OPTIONAL = "optional"  # 可选认证
    REQUIRED = "required"  # 必需认证
    ADMIN = "admin"  # 管理员权限


class AuthRule:
    """认证规则配置"""
    def __init__(self, pattern: str, auth_level: str, methods: Optional[List[str]] = None):
        self.pattern = re.compile(pattern)
        self.auth_level = auth_level
        self.methods = methods or ["GET", "POST", "PUT", "DELETE", "PATCH"]
    
    def matches(self, path: str, method: str) -> bool:
        """检查路径和方法是否匹配此规则"""
        return bool(self.pattern.match(path)) and method.upper() in self.methods


class UnifiedAuthMiddleware(BaseHTTPMiddleware):
    """统一认证中间件"""
    
    def __init__(self, app: ASGIApp):
        super().__init__(app)
        self.security = HTTPBearer(auto_error=False)
        
        # 配置认证规则（按优先级排序，越靠前优先级越高）
        self.auth_rules = [
            # 完全公开的路径
            AuthRule(r"^/static/.*", AuthLevel.NONE),
            AuthRule(r"^/docs.*", AuthLevel.NONE),
            AuthRule(r"^/redoc.*", AuthLevel.NONE),
            AuthRule(r"^/openapi.json", AuthLevel.NONE),
            AuthRule(r"^/favicon.ico", AuthLevel.NONE),
            AuthRule(r"^/health", AuthLevel.NONE),
            
            # 认证相关路径（注册、登录等）
            AuthRule(r"^/api/auth/register", AuthLevel.NONE, ["POST"]),
            AuthRule(r"^/api/auth/login", AuthLevel.NONE, ["POST"]),
            AuthRule(r"^/api/auth/verify-token", AuthLevel.NONE, ["POST"]),
            
            # 公开的剧本搜索和浏览
            AuthRule(r"^/api/scripts/public", AuthLevel.NONE, ["GET"]),
            AuthRule(r"^/api/scripts/search", AuthLevel.NONE, ["GET"]),
            
            # 文件下载（可选认证，用于访问控制）
            AuthRule(r"^/api/files/download/.*", AuthLevel.OPTIONAL, ["GET"]),
            
            # 管理员专用路径
            AuthRule(r"^/api/admin/.*", AuthLevel.ADMIN),
            AuthRule(r"^/api/auth/users", AuthLevel.ADMIN, ["GET"]),
            
            # 需要认证的用户相关路径
            AuthRule(r"^/api/auth/me", AuthLevel.REQUIRED),
            AuthRule(r"^/api/auth/logout", AuthLevel.REQUIRED),
            AuthRule(r"^/api/auth/change-password", AuthLevel.REQUIRED),
            
            # 需要认证的剧本管理
            AuthRule(r"^/api/scripts(?!/public|/search).*", AuthLevel.REQUIRED),
            
            # 需要认证的角色管理
            AuthRule(r"^/api/characters/.*", AuthLevel.REQUIRED),
            
            # 需要认证的用户功能
            AuthRule(r"^/api/users/.*", AuthLevel.REQUIRED),
            
            # 需要认证的证据管理
            AuthRule(r"^/api/evidence/.*", AuthLevel.REQUIRED),
            
            # 需要认证的文件上传
            AuthRule(r"^/api/files/upload", AuthLevel.REQUIRED, ["POST"]),
            
            # 默认规则：其他API路径需要认证
            AuthRule(r"^/api/.*", AuthLevel.REQUIRED),
        ]
    
    def get_auth_level(self, path: str, method: str) -> str:
        """根据路径和方法获取认证级别"""
        for rule in self.auth_rules:
            if rule.matches(path, method):
                return rule.auth_level
        
        # 默认不需要认证（用于非API路径）
        return AuthLevel.NONE
    
    async def get_user_from_token(self, token: str) -> Optional[User]:
        """从令牌获取用户信息"""
        try:
            # 验证令牌
            token_data = AuthService.verify_token(token)
            
            # 获取数据库会话
            db_gen = get_db_session()
            db = next(db_gen)
            
            try:
                # 获取用户
                user = AuthService.get_user_by_username(db, token_data.username)
                return user
            finally:
                db.close()
                
        except Exception:
            return None
    
    def create_auth_error_response(self, message: str, status_code: int = 401) -> JSONResponse:
        """创建认证错误响应"""
        return JSONResponse(
            status_code=status_code,
            content={
                "success": False,
                "message": message,
                "error_code": "AUTH_ERROR"
            }
        )
    
    async def dispatch(self, request: Request, call_next) -> Response:
        """中间件主要逻辑"""
        path = request.url.path
        method = request.method
        
        # 获取此路径的认证级别
        auth_level = self.get_auth_level(path, method)
        
        # 如果不需要认证，直接通过
        if auth_level == AuthLevel.NONE:
            return await call_next(request)
        
        # 尝试获取认证令牌
        authorization = request.headers.get("Authorization")
        token = None
        user = None
        
        if authorization and authorization.startswith("Bearer "):
            token = authorization[7:]  # 移除 "Bearer " 前缀
            user = await self.get_user_from_token(token)
        
        # 根据认证级别进行验证
        if auth_level == AuthLevel.OPTIONAL:
            # 可选认证：无论是否有有效令牌都允许通过
            # 但会在请求中设置用户信息（如果有的话）
            if user:
                request.state.current_user = user
                request.state.is_authenticated = True
            else:
                request.state.current_user = None
                request.state.is_authenticated = False
            
        elif auth_level == AuthLevel.REQUIRED:
            # 必需认证：必须有有效令牌和用户
            if not token:
                return self.create_auth_error_response("缺少认证令牌")
            
            if not user:
                return self.create_auth_error_response("无效的认证令牌")
            
            if not user.is_active:
                return self.create_auth_error_response("账户已被禁用", 403)
            
            request.state.current_user = user
            request.state.is_authenticated = True
            
        elif auth_level == AuthLevel.ADMIN:
            # 管理员权限：必须有有效令牌、用户且为管理员
            if not token:
                return self.create_auth_error_response("缺少认证令牌")
            
            if not user:
                return self.create_auth_error_response("无效的认证令牌")
            
            if not user.is_active:
                return self.create_auth_error_response("账户已被禁用", 403)
            
            if not user.is_admin:
                return self.create_auth_error_response("需要管理员权限", 403)
            
            request.state.current_user = user
            request.state.is_authenticated = True
        
        # 继续处理请求
        return await call_next(request)


# 便利函数：从请求中获取当前用户
def get_current_user_from_request(request: Request) -> Optional[User]:
    """从请求中获取当前用户（用于替代依赖注入）"""
    return getattr(request.state, 'current_user', None)


def get_current_active_user_from_request(request: Request) -> User:
    """从请求中获取当前活跃用户（用于替代依赖注入）"""
    user = get_current_user_from_request(request)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="未认证的用户"
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="账户已被禁用"
        )
    return user


def get_current_admin_user_from_request(request: Request) -> User:
    """从请求中获取当前管理员用户（用于替代依赖注入）"""
    user = get_current_active_user_from_request(request)
    if not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要管理员权限"
        )
    return user


def is_authenticated(request: Request) -> bool:
    """检查请求是否已认证"""
    return getattr(request.state, 'is_authenticated', False)