以下是针对 FastAPI 架构的 Cursor 规则（代码规范与最佳实践），旨在帮助团队保持代码一致性、可维护性和性能优化：


### 1. 项目结构规范
- 采用模块化分层结构，推荐目录如下：
  ```
  project/
  ├── app/
  │   ├── __init__.py
  │   ├── main.py          # 应用入口（创建FastAPI实例）
  │   ├── api/             # 路由模块
  │   │   ├── __init__.py
  │   │   └── deps.py      # 路由依赖
  │   ├── core/            # 核心配置
  │   │   ├── __init__.py
  │   │   ├── config.py    # 配置管理
  │   │   ├── security.py  # 安全工具（JWT等）
  │   ├── services/        # 业务逻辑
  │   ├── dependencies/    # 依赖注入
  │   ├── crud/            # 数据库操作
  │   ├── db/              # 数据库连接
  │   ├── models/          # 数据模型（ORM/Pydantic）
  │   ├── schemas/         # Pydantic序列化模型
  │   └── utils/           # 工具函数
  ├── tests/               # 测试用例
  └── pyproject.toml       # 依赖管理
  ```


### 2. 路由设计规则
- **路由分组**：按业务域划分路由（如`/users`、`/items`），使用`APIRouter`模块化管理。
- **HTTP方法**：严格对应语义（`GET`查询、`POST`创建、`PUT`全量更新、`PATCH`部分更新、`DELETE`删除）。
- **路径命名**：使用小写蛇形命名（`/user-profiles`），避免动词（用`GET /items`而非`GET /get-items`）。
- **版本控制**：通过路由前缀（如`/api/v1`）管理API版本，便于迭代兼容。
- **路由函数**：函数名格式为`{http_method}_{resource}_{action}`，例如`get_item`、`create_user`。

  ```python
  # 示例
  from fastapi import APIRouter

  router = APIRouter(prefix="/items", tags=["items"])

  @router.get("/{item_id}")
  def get_item(item_id: int):
      return {"item_id": item_id}
  ```


### 3. 模型与数据验证
- **区分模型**：使用Pydantic模型分离输入（`CreateItem`）、输出（`Item`）和更新（`UpdateItem`）。
- **字段规范**：必选字段不设默认值，可选字段明确默认值或使用`Optional`。
- **类型严格**：所有字段指定明确类型（避免`Any`），利用`constr`、`Field`做精细化验证。
- **ORM集成**：数据库模型（如SQLAlchemy）与Pydantic模型分离，通过`from_orm`转换。

  ```python
  # 示例
  from pydantic import BaseModel, Field
  from typing import Optional

  class CreateItem(BaseModel):
      name: str = Field(..., min_length=1, max_length=100)
      price: float = Field(..., gt=0)
      is_offer: Optional[bool] = None
  ```


### 4. 依赖注入规则
- **依赖分类**：公共依赖（如认证）放在`api/deps.py`，业务依赖随模块定义。
- **依赖复用**：通过函数或类封装可复用逻辑（如数据库会话、权限校验）。
- **异步优先**：数据库操作等I/O密集型依赖使用异步函数（`async def`）。

  ```python
  # 示例：认证依赖
  from fastapi import Depends, HTTPException
  from fastapi.security import OAuth2PasswordBearer

  oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

  async def get_current_user(token: str = Depends(oauth2_scheme)):
      if not token:
          raise HTTPException(status_code=401, detail="未认证")
      return {"user": "current_user"}
  ```


### 5. 错误处理规则
- **统一异常**：使用`HTTPException`处理已知错误，自定义异常类处理业务异常。
- **异常处理器**：全局注册异常处理器，格式化错误响应（包含`code`、`message`）。
- **日志记录**：异常发生时记录详细日志（避免暴露敏感信息到响应）。

  ```python
  # 示例：全局异常处理
  from fastapi import Request, FastAPI
  from fastapi.responses import JSONResponse

  app = FastAPI()

  @app.exception_handler(ValueError)
  async def value_error_handler(request: Request, exc: ValueError):
      return JSONResponse(
          status_code=400,
          content={"code": "INVALID_VALUE", "message": str(exc)}
      )
  ```


### 6. 文档与注释规范
- **API文档**：为路由、参数、响应添加`summary`、`description`和`response_description`。
- **标签分类**：用`tags`对路由分组（如`["users"]`、`["items"]`），提升文档可读性。
- **类型注释**：所有函数参数、返回值必须添加类型注释（便于FastAPI自动生成文档）。
- **复杂逻辑**：核心业务逻辑需添加文档字符串（说明功能、参数、返回值）。

  ```python
  @router.post(
      "/",
      summary="创建新物品",
      description="根据输入数据创建新物品，返回创建结果",
      response_description="成功创建的物品信息"
  )
  def create_item(item: CreateItem) -> Item:
      """
      创建物品的详细说明：
      - 参数: item - 包含物品名称、价格等信息的对象
      - 返回: 包含创建的物品完整信息（含ID）
      """
      return {"id": 1, **item.dict()}
  ```


### 7. 性能与安全规则
-** 异步支持 **：I/O操作（数据库、HTTP请求）优先使用异步客户端（如`asyncpg`、`httpx.AsyncClient`）。
-** 缓存策略 **：高频访问接口通过`lru_cache`或外部缓存（如Redis）减少计算/数据库压力。
-** 安全头 **：启用`CORSMiddleware`、`HSTS`等安全中间件，限制跨域请求。
-** 数据过滤 **：用户输入必须经过验证，数据库查询避免原始SQL（防注入）。
-** 速率限制 **：添加`slowapi`等中间件限制接口访问频率，防止滥用。


### 8. 测试规则
-** 测试分层 **：单元测试（工具函数）、集成测试（API端点）、端到端测试（关键流程）。
-** 测试客户端 **：使用`TestClient`测试API，覆盖正常流程和异常场景。
-**  fixtures **：通过`pytest fixtures`复用测试资源（如测试数据库会话）。

  ```python
  # 示例：API测试
  from fastapi.testclient import TestClient
  from app.main import app

  client = TestClient(app)

  def test_get_item():
      response = client.get("/items/1")
      assert response.status_code == 200
      assert response.json() == {"item_id": 1}
  ```


### 9. 代码风格规则
-** 格式化 **：使用`black`统一代码格式，`isort`排序导入语句。
-** 命名规范 **：
  - 变量/函数：小写蛇形（`user_id`、`get_user`）
  - 类：帕斯卡命名（`UserModel`、`AuthDependency`）
  - 常量：全大写蛇形（`MAX_RETRY`、`API_PREFIX`）
-** 导入顺序 **：标准库 → 第三方库 → 本地模块，用空行分隔。

