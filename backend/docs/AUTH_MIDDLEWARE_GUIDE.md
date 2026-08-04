# FastAPI 统一认证中间件使用指南

## 概述

本项目实现了一个统一的认证中间件 `UnifiedAuthMiddleware`，用于自动管理所有路由的鉴权，避免在每个路由中重复添加认证依赖。

## 核心文件

- `src/core/auth_middleware.py` - 认证中间件主文件（含路由内取用户的 helper 函数）
- `src/core/server.py` - 中间件集成配置
- `src/services/auth_service.py` - 令牌验证与用户查询的统一入口

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

中间件完成验证后，路由通过 `auth_middleware.py` 提供的 helper 从 `request.state` 获取用户：

```python
from src.core.auth_middleware import get_current_active_user_from_request

@router.get("/me")
async def get_user_info(
    current_user: User = Depends(get_current_active_user_from_request)
):
    return current_user
```

helper 是普通函数，也可以直接在函数体内调用：

```python
from fastapi import Request
from src.core.auth_middleware import get_current_active_user_from_request

@router.get("/me")
async def get_user_info(request: Request):
    current_user = get_current_active_user_from_request(request)
    return current_user
```

### 可用的 helper 函数

1. **`get_current_user_from_request(request)`** - 获取当前用户（可能为 None）
2. **`get_current_active_user_from_request(request)`** - 获取当前活跃用户（必须存在且活跃，否则 401/403）
3. **`get_current_admin_user_from_request(request)`** - 获取当前管理员用户（非管理员返回 403）
4. **`is_authenticated(request)`** - 检查是否已认证

> 注意：helper 不再自行验证令牌，只读取中间件注入的 `request.state`。
> 因此路由路径必须先被中间件规则覆盖（见上方路径配置规则），
> helper 才能取到用户；REQUIRED/ADMIN 路径的 401/403 由中间件统一返回。

## 直接从Request获取用户

对于可选认证等场景：

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

## 添加新路由

新路由无需任何认证依赖代码，只需两步：

### 步骤1：确认路径已被中间件规则覆盖

默认规则 `^/api/.*` 为 REQUIRED。如需 NONE/OPTIONAL/ADMIN 语义，
在 `auth_middleware.py` 的 `auth_rules` 中添加规则（注意优先级顺序，越靠前优先级越高）：

```python
self.auth_rules = [
    # 高优先级规则在前
    AuthRule(r"^/api/special/.*", AuthLevel.ADMIN),
    # ... 其他规则
]
```

### 步骤2：在路由中获取用户

```python
from src.core.auth_middleware import (
    get_current_active_user_from_request,
    get_current_admin_user_from_request,
)

# 普通登录用户
current_user: User = Depends(get_current_active_user_from_request)

# 管理员（中间件已按路径策略校验，helper 作为防御性检查）
current_user: User = Depends(get_current_admin_user_from_request)
```

### 步骤3：测试验证

确保新路由功能正常：
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
5. **单一入口**：令牌验证统一走 `AuthService.verify_token` / `AuthService.get_user_from_token`，WebSocket 端点同样复用该入口

## 示例项目结构

```
src/
├── core/
│   ├── auth_middleware.py          # 认证中间件 + 路由 helper 函数
│   └── server.py                   # 应用配置（含 WebSocket 端点）
├── services/
│   └── auth_service.py             # 令牌验证与用户查询统一入口
├── api/
│   └── routes/
│       ├── auth_routes.py
│       ├── script_routes.py
│       └── ...
└── ...
```