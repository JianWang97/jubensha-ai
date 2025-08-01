"""用户认证API路由"""
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer
from sqlalchemy.orm import Session
from src.db.session import get_db_session
from src.services.auth_service import AuthService, ACCESS_TOKEN_EXPIRE_MINUTES
from src.core.auth_dependencies import get_current_active_user
from src.core.middleware_dependencies import (
    get_current_admin_user_middleware,
)
from src.schemas.user_schemas import (
    UserRegister, UserLogin, UserResponse, UserUpdate, PasswordChange,
    Token, UserBrief
)
from src.db.models.user import User

router = APIRouter(prefix="/api/auth", tags=["用户认证"])
security = HTTPBearer()

@router.post("/register", response_model=UserResponse, summary="用户注册")
async def register(
    user_data: UserRegister,
    db: Session = Depends(get_db_session)
):
    """用户注册"""
    try:
        # 创建用户
        user = AuthService.create_user(
            db=db,
            username=user_data.username,
            email=user_data.email,
            password=user_data.password,
            nickname=user_data.nickname
        )
        
        return UserResponse.from_orm(user)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"注册失败: {str(e)}"
        )

@router.post("/login", response_model=Token, summary="用户登录")
async def login(
    user_data: UserLogin,
    db: Session = Depends(get_db_session)
):
    """用户登录"""
    # 认证用户
    user = AuthService.authenticate_user(db, user_data.username, user_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 检查用户是否激活
    if user.is_active is False:  # 使用显式字段比较，避免SQLAlchemy布尔比较问题
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户账户已被禁用",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 创建访问令牌
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = AuthService.create_access_token(
        data={"sub": user.username, "user_id": getattr(user, 'id')},  # 获取实际的id值
        expires_delta=access_token_expires
    )
        
    # 更新最后登录时间
    AuthService.update_last_login(db, getattr(user, 'id'))  # 获取实际的id值
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,  # 转换为秒
        user=UserResponse.from_orm(user)
    )

@router.get("/me", response_model=UserResponse, summary="获取当前用户信息")
async def get_current_user_info(
    request: Request,
    current_user: User = Depends(get_current_active_user)
):
    """获取当前用户信息（使用中间件认证）"""
    # 可以选择使用中间件的用户信息或传统依赖
    # middleware_user = get_current_active_user_middleware(request)
    return UserResponse.from_orm(current_user)

@router.put("/me", response_model=UserResponse, summary="更新用户资料")
async def update_profile(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db_session)
):
    """更新用户资料"""
    try:
        # 更新用户资料
        updated_user = AuthService.update_user_profile(
            db=db,
            user_id=getattr(current_user, 'id'),  # 获取实际的id值
            nickname=user_update.nickname,
            bio=user_update.bio,
            avatar_url=user_update.avatar_url
        )
        
        return UserResponse.from_orm(updated_user)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"更新资料失败: {str(e)}"
        )

@router.post("/change-password", summary="修改密码")
async def change_password(
    password_data: PasswordChange,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db_session)
):
    """修改密码"""
    try:
        # 修改密码
        success = AuthService.change_password(
            db=db,
            user_id=getattr(current_user, 'id'),  # 获取实际的id值
            old_password=password_data.old_password,
            new_password=password_data.new_password
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="密码修改失败"
            )
            
        return {"message": "密码修改成功"}
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"密码修改失败: {str(e)}"
        )

@router.post("/logout", summary="用户登出")
async def logout(
    current_user: User = Depends(get_current_active_user)
):
    """用户登出"""
    # 注意：JWT是无状态的，实际的登出需要在客户端删除令牌
    # 这里只是提供一个登出端点，可以用于记录日志等
    return {"message": "登出成功"}

@router.get("/users", response_model=list[UserBrief], summary="获取用户列表")
async def get_users(
    request: Request,
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db_session)
):
    """获取用户列表（使用中间件管理员认证）"""
    # 使用中间件验证管理员权限
    current_user = get_current_admin_user_middleware(request)
    users = db.query(User).filter(User.is_active == True).offset(skip).limit(limit).all()
    return [UserBrief.from_orm(user) for user in users]

@router.get("/users/{user_id}", response_model=UserBrief, summary="获取指定用户信息")
async def get_user_by_id(
    user_id: int,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user)
):
    """获取指定用户信息"""
    user = AuthService.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    # 检查用户是否激活
    if user.is_active is False:  # 使用显式字段比较，避免SQLAlchemy布尔比较问题
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    return UserBrief.from_orm(user)

@router.get("/verify-token", summary="验证令牌")
async def verify_token(
    current_user: User = Depends(get_current_active_user)
):
    """验证令牌有效性"""
    return {
        "valid": True,
        "user_id": current_user.id,
        "username": current_user.username
    }