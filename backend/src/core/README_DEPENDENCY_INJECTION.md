# 依赖注入容器使用指南

本项目实现了一个完整的依赖注入容器系统，用于统一管理所有服务的依赖关系和生命周期。

## 快速开始

### 1. 基本使用

```python
from src.core.dependency_container import get_container, service_scope
from src.db.repositories.script_repository import ScriptRepository

# 获取全局容器
container = get_container()

# 在作用域内解析服务
with container.create_scope() as scope:
    script_repo = scope.resolve(ScriptRepository)
    # 使用 script_repo

# 或者使用便捷的上下文管理器
with service_scope() as scope:
    script_repo = scope.resolve(ScriptRepository)
    # 使用 script_repo
```

### 2. 在FastAPI路由中使用

```python
from fastapi import APIRouter, Depends
from src.core.container_integration import get_script_repo_generator, get_script_editor_service

router = APIRouter()

@router.get("/scripts")
async def get_scripts(
    script_repo: ScriptRepository = Depends(get_script_repo_generator)
):
    return script_repo.get_scripts_list()

@router.post("/scripts/{script_id}/edit")
async def edit_script(
    script_id: int,
    instruction: str,
    editor_service: ScriptEditorService = Depends(get_script_editor_service)
):
    return await editor_service.parse_user_instruction(instruction, script_id)
```

### 3. 使用装饰器形式的依赖注入

```python
from src.core.container_integration import inject_multiple as inject
from src.services.llm_service import LLMService
from src.db.repositories.script_repository import ScriptRepository

@inject(ScriptRepository, LLMService)
def process_script(script_repo: ScriptRepository, llm_service: LLMService, script_id: int):
    script = script_repo.get_script_by_id(script_id)
    # 处理逻辑
    return result
```

## 核心概念

### 服务生命周期

1. **Singleton（单例）**：整个应用生命周期内只创建一个实例
2. **Transient（瞬态）**：每次请求都创建新实例
3. **Scoped（作用域）**：在同一作用域内是单例

### 服务注册

服务在 `src/core/dependency_container.py` 的 `configure_services()` 函数中注册：

```python
def configure_services() -> DependencyContainer:
    # 注册数据库管理器（单例）
    container.register_instance(DatabaseManager, db_manager)
    
    # 注册数据库会话（作用域）
    def create_session(db_manager: DatabaseManager) -> Session:
        return db_manager.get_session()
    
    container.register_scoped(
        Session,
        factory=create_session
    )
    
    # 注册Repository（作用域）
    container.register_scoped(ScriptRepository)
    container.register_scoped(CharacterRepository)
    # ...
    
    return container
```

## FastAPI集成

### 依赖注入函数

在FastAPI路由中，我们提供了多种方式来注入依赖：

#### 1. 生成器函数（推荐用于Depends）

```python
from src.core.container_integration import (
    get_script_repo_generator,
    get_character_repo_generator,
    get_evidence_repo_generator,
    get_location_repo_generator,
    get_script_editor_service,
    get_database_session
)

@router.get("/scripts")
async def get_scripts(
    script_repo: ScriptRepository = Depends(get_script_repo_generator)
):
    return script_repo.get_scripts_list()
```

#### 2. Depends对象工厂函数

```python
from src.core.container_integration import (
    get_script_repo_depends,
    get_character_repo_depends,
    get_evidence_repo_depends,
    get_location_repo_depends,
    get_script_editor_svc_depends,
    get_db_session_depends
)

@router.get("/scripts")
async def get_scripts(
    script_repo: ScriptRepository = get_script_repo_depends()
):
    return script_repo.get_scripts_list()
```

#### 3. 通用服务解析函数

```python
from src.core.container_integration import get_service

@router.get("/scripts")
async def get_scripts(
    script_repo: ScriptRepository = Depends(get_service(ScriptRepository))
):
    return script_repo.get_scripts_list()
```

### 装饰器注入

对于非路由函数，可以使用装饰器形式的依赖注入：

```python
from src.core.container_integration import inject_multiple as inject

@inject(ScriptRepository, LLMService)
def process_script_with_ai(script_repo: ScriptRepository, llm_service: LLMService, script_id: int):
    # 处理逻辑
    return result
```

## 最佳实践

### 1. 选择合适的生命周期

- 数据库会话：使用Scoped生命周期
- Repository：使用Scoped生命周期
- Service：使用Scoped生命周期
- 工具类服务（如LLM服务）：使用Singleton生命周期

### 2. 避免循环依赖

设计服务时应避免循环依赖，如果确实需要，考虑引入接口抽象或重新设计架构。

### 3. 正确处理作用域

数据库会话等资源应在作用域内使用，确保资源得到正确释放：

```python
# 正确的方式
@router.get("/scripts")
async def get_scripts(
    db: Session = Depends(get_database_session)
):
    # 数据库操作
    pass

# 错误的方式 - 不要在模块级别解析作用域服务
# db = get_container().resolve(Session)  # 这会抛出异常
```

## 测试支持

依赖注入容器使得单元测试更容易，可以通过注册测试替身来替换真实的服务：

```python
# 在测试中
def test_script_service():
    # 创建测试替身
    mock_repo = MockScriptRepository()
    
    # 在测试作用域内注册替身
    with service_scope() as scope:
        scope.container.register_instance(ScriptRepository, mock_repo)
        
        # 解析服务并测试
        service = scope.resolve(ScriptEditorService)
        # 执行测试
```