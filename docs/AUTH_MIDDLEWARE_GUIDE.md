# FastAPI 统一认证中间件使用指南

## 概述

本项目实现了一个统一的认证中间件 `UnifiedAuthMiddleware`，用于自动管理所有路由的鉴权，避免在每个路由中重复添加认证依赖。

## 核心文件

- `src/core/auth_middleware.py` - 认证中间件主文件
- `src/core/middleware_dependencies.py` - 基于中间件的依赖注入函数
- `src/core/server.py` - 中间件集成配置

## 认证级别

中间件支持四种认证级别：

### 1. `AuthLevel.NONE` - 无需认证
- 完全公开的路径
- 示例：静态文件、文档、注册、登录等

### 2. `AuthLevel.OPTIONAL` - 可选认证
- 可以访问，但如果提供了有效令牌会设置用户信息
- 示例：文件下载（可能需要访问控制）

### 3. `AuthLevel.REQUIRED` - 必需认证
- 必须提供有效令牌和活跃用户
- 示例：用户资料、剧本管理、角色管理等

### 4. `AuthLevel.ADMIN` - 管理员权限
- 必须是活跃的管理员用户
- 示例：用户管理、系统管理等

## 路径配置规则

中间件使用正则表达式匹配路径，按优先级顺序配置：

```python
# 完全公开
AuthRule(r"^/static/.*", AuthLevel.NONE),
AuthRule(r"^/api/auth/register", AuthLevel.NONE, ["POST"]),
AuthRule(r"^/api/auth/login", AuthLevel.NONE, ["POST"]),

# 公开的剧本浏览
AuthRule(r"^/api/scripts/public", AuthLevel.NONE, ["GET"]),
AuthRule(r"^/api/scripts/search", AuthLevel.NONE, ["GET"]),

# 管理员专用
AuthRule(r"^/api/admin/.*", AuthLevel.ADMIN),
AuthRule(r"^/api/auth/users", AuthLevel.ADMIN, ["GET"]),

# 需要认证的路径
AuthRule(r"^/api/scripts(?!/public|/search).*", AuthLevel.REQUIRED),
AuthRule(r"^/api/characters/.*", AuthLevel.REQUIRED),

# 默认规则
AuthRule(r"^/api/.*", AuthLevel.REQUIRED),
```

## 在路由中使用

### 传统方式（逐步淘汰）

```python
from src.core.auth_dependencies import get_current_active_user

@router.get("/me")
async def get_user_info(
    current_user: User = Depends(get_current_active_user)
):
    return current_user
```

### 新方式（推荐）

```python
from src.core.middleware_dependencies import get_current_active_user_middleware

@router.get("/me")
async def get_user_info(
    current_user: User = Depends(get_current_active_user_middleware)
):
    return current_user
```

### 可用的中间件依赖函数

1. **`get_current_user_middleware()`** - 获取当前用户（可能为None）
2. **`get_current_active_user_middleware()`** - 获取当前活跃用户（必须存在）
3. **`get_current_admin_user_middleware()`** - 获取当前管理员用户
4. **`get_optional_current_user_middleware()`** - 获取可选的当前用户
5. **`is_authenticated_middleware()`** - 检查是否已认证

## 直接从Request获取用户

对于不使用依赖注入的场景：

```python
from fastapi import Request
from src.core.auth_middleware import get_current_user_from_request

@router.get("/example")
async def example_endpoint(request: Request):
    user = get_current_user_from_request(request)
    is_auth = getattr(request.state, 'is_authenticated', False)
    return {"user": user, "authenticated": is_auth}
```

## 优势

### 1. 统一管理
- 所有认证逻辑集中在中间件中
- 易于维护和修改认证规则
- 避免在路由中重复代码

### 2. 灵活配置
- 支持基于路径和HTTP方法的精确匹配
- 支持正则表达式模式
- 支持不同级别的认证要求

### 3. 性能优化
- 中间件在请求早期处理认证
- 避免重复的令牌验证
- 减少数据库查询次数

### 4. 一致的错误响应
- 统一的认证失败响应格式
- 标准化的错误代码和消息

## 迁移指南

### 步骤1：更新导入

```python
# 添加新的导入
from src.core.middleware_dependencies import (
    get_current_active_user_middleware,
    get_current_admin_user_middleware
)
```

### 步骤2：替换依赖

```python
# 旧的
current_user: User = Depends(get_current_active_user)

# 新的
current_user: User = Depends(get_current_active_user_middleware)
```

### 步骤3：移除手动权限检查

```python
# 旧的（需要手动检查管理员权限）
@router.get("/admin-only")
async def admin_endpoint(
    current_user: User = Depends(get_current_active_user)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="需要管理员权限")
    return {"message": "管理员功能"}

# 新的（中间件自动检查）
@router.get("/admin-only")
async def admin_endpoint(
    current_user: User = Depends(get_current_admin_user_middleware)
):
    return {"message": "管理员功能"}
```

### 步骤4：测试验证

确保迁移后的路由功能正常：
- 认证要求正确执行
- 错误响应格式一致
- 性能没有下降

## 配置自定义规则

如需添加新的认证规则，修改 `auth_middleware.py` 中的 `auth_rules` 列表：

```python
# 添加新规则（注意优先级顺序）
self.auth_rules = [
    # 高优先级规则在前
    AuthRule(r"^/api/special/.*", AuthLevel.ADMIN),
    # ... 其他规则
]
```

## 调试和监控

中间件会在请求状态中设置以下属性：
- `request.state.current_user` - 当前用户对象
- `request.state.is_authenticated` - 认证状态

可以在路由中访问这些属性进行调试：

```python
@router.get("/debug")
async def debug_auth(request: Request):
    return {
        "user": getattr(request.state, 'current_user', None),
        "authenticated": getattr(request.state, 'is_authenticated', False),
        "path": request.url.path,
        "method": request.method
    }
```

## 注意事项

1. **中间件顺序**：认证中间件必须在CORS中间件之后添加
2. **数据库连接**：中间件会自动管理数据库连接的生命周期
3. **令牌格式**：支持标准的 `Bearer <token>` 格式
4. **错误处理**：所有认证错误都会返回统一格式的JSON响应
5. **向后兼容**：现有的认证依赖仍然可用，可以逐步迁移

## 示例项目结构

```
src/
├── core/
│   ├── auth_middleware.py          # 认证中间件
│   ├── middleware_dependencies.py  # 中间件依赖函数
│   ├── auth_dependencies.py        # 传统认证依赖（逐步淘汰）
│   └── server.py                   # 应用配置
├── api/
│   └── routes/
│       ├── auth_routes.py          # 已迁移示例
│       ├── script_routes.py        # 待迁移
│       └── ...
└── ...
```