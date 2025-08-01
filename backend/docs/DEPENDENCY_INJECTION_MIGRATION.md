# 依赖注入容器迁移指南

本文档说明如何从现有的手动依赖注入方式迁移到新的依赖注入容器系统。

## 概述

新的依赖注入容器提供了以下优势：

1. **自动依赖解析**：无需手动创建和传递依赖
2. **生命周期管理**：支持单例、瞬态和作用域生命周期
3. **类型安全**：基于类型的依赖注入
4. **易于测试**：可以轻松替换依赖进行单元测试
5. **统一管理**：所有依赖在一个地方配置

## 核心组件

### 1. DependencyContainer

主要的依赖注入容器，负责服务注册和解析。

```python
from src.core.dependency_container import get_container

container = get_container()
```

### 2. ServiceLifetime

服务生命周期枚举：

- `SINGLETON`：单例模式，整个应用生命周期内只创建一个实例
- `TRANSIENT`：瞬态模式，每次请求都创建新实例
- `SCOPED`：作用域模式，在同一作用域内是单例

### 3. ServiceScope

服务作用域，用于管理作用域内服务的生命周期。

```python
from src.core.dependency_container import service_scope

with service_scope() as scope:
    service = scope.resolve(MyService)
```

## 迁移步骤

### 步骤1：更新服务注册

在 `src/core/dependency_container.py` 的 `configure_services()` 函数中注册你的服务：

```python
def configure_services() -> DependencyContainer:
    # 注册你的服务
    container.register_scoped(YourService)
    container.register_singleton(YourSingletonService)
    
    return container
```

### 步骤2：更新API路由

#### 旧方式（手动创建依赖）：

```python
@router.get("/scripts")
async def get_scripts():
    db_gen = get_db_session()
    db = next(db_gen)
    try:
        script_repo = ScriptRepository(db)
        return script_repo.get_scripts_list()
    finally:
        db.close()
```

#### 新方式（使用依赖注入）：

```python
from src.core.container_integration import get_script_repo_generator

@router.get("/scripts")
async def get_scripts(
    script_repo: ScriptRepository = Depends(get_script_repo_generator)
):
    return script_repo.get_scripts_list()
```

### 步骤3：更新服务类

确保你的服务类构造函数参数有正确的类型注解：

```python
class ScriptEditorService:
    def __init__(self, script_repository: ScriptRepository):
        self.script_repository = script_repository
```

### 步骤4：更新WebSocket和其他非HTTP处理

#### 旧方式：

```python
db_gen = get_db_session()
db = next(db_gen)
try:
    script_repo = ScriptRepository(db)
    service = ScriptEditorService(script_repo)
    # 使用service
finally:
    db.close()
```

#### 新方式：

```python
from src.core.dependency_container import get_container

container = get_container()
with container.create_scope() as scope:
    service = scope.resolve(ScriptEditorService)
    # 使用service
```

## 可用的依赖注入函数

### FastAPI依赖注入函数

```python
from src.core.container_integration import (
    get_database_session,
    get_script_repo_generator,
    get_character_repo_generator,
    get_evidence_repo_generator,
    get_location_repo_generator,
    get_script_editor_service,
    get_service
)

# 对于作用域服务，还可以使用便捷的Depends对象工厂函数
from src.core.container_integration import (
    get_db_session_depends,
    get_script_repo_depends,
    get_character_repo_depends,
    get_evidence_repo_depends,
    get_location_repo_depends,
    get_script_editor_svc_depends
)

# 使用示例
@router.get("/example")
async def example(
    db: Session = Depends(get_database_session),
    script_repo: ScriptRepository = Depends(get_script_repository),
    any_service: AnyService = Depends(get_service(AnyService))
):
    pass
```

### 装饰器形式的依赖注入

```python
from src.core.container_integration import inject_multiple as inject

@inject(ScriptRepository, LLMService)
def my_function(script_repo: ScriptRepository, llm_service: LLMService):
    # 函数逻辑
    pass
```

## 测试支持

### 单元测试中替换依赖

```python
import pytest
from src.core.dependency_container import DependencyContainer

@pytest.fixture
def test_container():
    container = DependencyContainer()
    
    # 注册测试用的mock服务
    mock_service = MockService()
    container.register_instance(RealService, mock_service)
    
    return container

def test_with_mock_service(test_container):
    with test_container.create_scope() as scope:
        service = scope.resolve(RealService)
        assert isinstance(service, MockService)
```

## 最佳实践

### 1. 服务生命周期选择

- **Singleton**：用于无状态的服务，如配置、工具类
- **Scoped**：用于数据库相关的服务，如Repository、业务服务
- **Transient**：用于有状态的服务，每次使用都需要新实例

### 2. 避免循环依赖

如果遇到循环依赖，考虑：
- 重构代码结构
- 使用工厂模式
- 延迟注入

### 3. 异常处理

依赖容器会自动处理作用域内的资源释放，但仍需要在业务逻辑中处理异常：

```python
@router.post("/scripts")
async def create_script(
    script_data: ScriptInfo,
    script_repo: ScriptRepository = Depends(get_script_repository)
):
    try:
        return script_repo.create_script(script_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

## 常见问题

### Q: 如何在现有代码中逐步迁移？

A: 可以同时保留旧的依赖注入方式和新的容器系统，逐个API端点进行迁移。

### Q: 性能影响如何？

A: 依赖容器的性能开销很小，主要是反射和类型检查的成本，但相比手动管理依赖的复杂性，这个开销是值得的。

### Q: 如何调试依赖注入问题？

A: 检查：
1. 服务是否正确注册
2. 构造函数参数类型注解是否正确
3. 是否存在循环依赖
4. 服务生命周期是否合适

## 示例代码

完整的示例代码请参考 `src/api/example_with_di.py` 文件。

## 总结

新的依赖注入容器系统提供了更好的代码组织、测试支持和维护性。建议逐步迁移现有代码，优先迁移新功能和经常修改的部分。