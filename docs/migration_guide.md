# 数据模型统一迁移指南

本指南说明如何从原有的分散数据模型迁移到新的统一数据模型架构。

## 概述

新的统一数据模型架构具有以下优势：

1. **统一的数据定义**：数据库模型和API模型使用相同的字段定义
2. **自动数据验证**：使用Pydantic进行输入验证和序列化
3. **类型安全**：完整的类型提示支持
4. **自动转换**：数据库模型和Pydantic模型之间的自动转换
5. **标准化响应**：统一的API响应格式
6. **关联管理**：SQLAlchemy关系的自动级联操作

## 架构对比

### 旧架构
```python
# 分散的数据定义
@dataclass
class ScriptInfo:
    title: str
    description: str
    # ...

# 手动SQL操作
async def create_script(script: Script) -> int:
    await conn.execute(
        "INSERT INTO scripts (title, description, ...) VALUES ($1, $2, ...)",
        script.info.title, script.info.description, ...
    )

# 手动数据转换
def dict_to_script(data: dict) -> ScriptInfo:
    return ScriptInfo(
        title=data["title"],
        description=data["description"],
        # ...
    )
```

### 新架构
```python
# 统一的数据定义
class ScriptDBModel(BaseSQLAlchemyModel):
    __tablename__ = 'scripts'
    title = Column(String(255), nullable=False)
    description = Column(Text)
    # ...

class ScriptInfo(BaseDataModel):
    title: str = Field(..., description="剧本标题")
    description: str = Field("", description="剧本描述")
    # ...
    
    @classmethod
    def get_db_model(cls) -> Type[SQLAlchemyBase]:
        return ScriptDBModel

# ORM操作
def create_script(script_data: ScriptInfo) -> ScriptInfo:
    db_script = script_data.to_db_model()
    db.add(db_script)
    db.commit()
    return ScriptInfo.from_db_model(db_script)
```

## 迁移步骤

### 1. 更新依赖

确保安装了必要的依赖：

```bash
pip install pydantic sqlalchemy fastapi
```

### 2. 创建基础模型

使用 `src/models/base.py` 中定义的基础类：

- `BaseDataModel`：Pydantic模型基类
- `BaseSQLAlchemyModel`：SQLAlchemy模型基类
- `APIResponse`：标准API响应格式
- `PaginatedResponse`：分页响应格式

### 3. 重构数据模型

#### 3.1 定义数据库模型

```python
class ScriptDBModel(BaseSQLAlchemyModel):
    __tablename__ = 'scripts'
    
    title = Column(String(255), nullable=False)
    description = Column(Text)
    # ... 其他字段
    
    # 关联关系
    characters = relationship("CharacterDBModel", back_populates="script")
```

#### 3.2 定义Pydantic模型

```python
class ScriptInfo(BaseDataModel):
    title: str = Field(..., description="剧本标题")
    description: str = Field("", description="剧本描述")
    # ... 其他字段
    
    @classmethod
    def get_db_model(cls) -> Type[SQLAlchemyBase]:
        return ScriptDBModel
```

### 4. 更新数据访问层

#### 4.1 从原生SQL迁移到ORM

**旧方式：**
```python
async def get_script_by_id(self, script_id: int) -> Optional[Script]:
    script_row = await conn.fetchrow(
        "SELECT * FROM scripts WHERE id = $1", script_id
    )
    if not script_row:
        return None
    
    return ScriptInfo(
        id=script_row["id"],
        title=script_row["title"],
        # ... 手动映射所有字段
    )
```

**新方式：**
```python
def get_script_by_id(self, script_id: int) -> Optional[ScriptInfo]:
    db_script = self.db.query(ScriptDBModel).filter(ScriptDBModel.id == script_id).first()
    if not db_script:
        return None
    return ScriptInfo.from_db_model(db_script)
```

#### 4.2 使用新的Repository模式

参考 `src/core/script_repository_orm.py` 中的实现：

```python
class ScriptRepository:
    def __init__(self, db_session: Session):
        self.db = db_session
    
    def create_script(self, script_data: ScriptInfo) -> ScriptInfo:
        db_script = script_data.to_db_model()
        self.db.add(db_script)
        self.db.commit()
        self.db.refresh(db_script)
        return ScriptInfo.from_db_model(db_script)
```

### 5. 更新API路由

#### 5.1 使用统一的响应格式

**旧方式：**
```python
@router.get("/scripts/{script_id}")
async def get_script(script_id: int):
    script = await script_repo.get_script_by_id(script_id)
    if not script:
        raise HTTPException(status_code=404, detail="Script not found")
    return script
```

**新方式：**
```python
@router.get("/scripts/{script_id}", response_model=APIResponse[Script])
async def get_script(
    script_id: int,
    repo: ScriptRepository = Depends(get_script_repository)
) -> APIResponse[Script]:
    script = repo.get_script_by_id(script_id)
    if not script:
        raise HTTPException(status_code=404, detail="剧本不存在")
    
    return APIResponse(
        success=True,
        data=script,
        message="获取剧本成功"
    )
```

#### 5.2 使用分页响应

```python
@router.get("/scripts", response_model=PaginatedResponse[ScriptInfo])
async def get_scripts(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    repo: ScriptRepository = Depends(get_script_repository)
) -> PaginatedResponse[ScriptInfo]:
    return repo.get_scripts_list(page=page, size=size)
```

### 6. 数据验证和错误处理

#### 6.1 自动数据验证

新模型会自动进行数据验证：

```python
# 这会自动触发验证
try:
    script = ScriptInfo(
        title="",  # 验证失败：标题不能为空
        player_count=-1  # 验证失败：玩家数量必须为正数
    )
except ValidationError as e:
    print(f"验证错误: {e}")
```

#### 6.2 统一错误处理

```python
@router.post("/scripts")
async def create_script(script_data: ScriptInfo):
    try:
        created_script = repo.create_script(script_data)
        return APIResponse(
            success=True,
            data=created_script,
            message="剧本创建成功"
        )
    except ValidationError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"创建剧本失败: {str(e)}")
```

## 迁移检查清单

- [ ] 安装必要依赖
- [ ] 创建基础模型类
- [ ] 定义数据库模型（继承BaseSQLAlchemyModel）
- [ ] 定义Pydantic模型（继承BaseDataModel）
- [ ] 实现模型转换方法
- [ ] 更新Repository类使用ORM
- [ ] 更新API路由使用统一响应格式
- [ ] 添加数据验证
- [ ] 测试所有API端点
- [ ] 更新前端代码适配新的API响应格式

## 最佳实践

### 1. 字段命名一致性

确保数据库字段名、Pydantic字段名和API字段名保持一致：

```python
class ScriptDBModel(BaseSQLAlchemyModel):
    player_count = Column(Integer, default=6)  # 数据库字段

class ScriptInfo(BaseDataModel):
    player_count: int = Field(6, description="玩家数量")  # API字段
```

### 2. 使用描述性字段说明

```python
class ScriptInfo(BaseDataModel):
    title: str = Field(..., description="剧本标题", min_length=1, max_length=255)
    player_count: int = Field(6, description="玩家数量", ge=1, le=20)
    estimated_duration: int = Field(180, description="预计时长（分钟）", ge=30)
```

### 3. 合理使用关联关系

```python
class ScriptDBModel(BaseSQLAlchemyModel):
    characters = relationship(
        "CharacterDBModel", 
        back_populates="script", 
        cascade="all, delete-orphan"  # 级联删除
    )
```

### 4. 统一的API响应

所有API都应该返回标准格式：

```python
# 成功响应
APIResponse(
    success=True,
    data=result,
    message="操作成功"
)

# 分页响应
PaginatedResponse(
    success=True,
    data=items,
    message="获取列表成功",
    total=100,
    page=1,
    size=20,
    pages=5
)
```

## 示例代码

完整的示例代码可以参考：

- `src/models/base.py` - 基础模型定义
- `src/models/script.py` - 剧本模型定义
- `src/models/example_usage.py` - 使用示例
- `src/core/script_repository_orm.py` - ORM数据访问层
- `src/api/routes/script_routes_unified.py` - 统一API路由

通过这种统一的数据模型架构，你只需要在一个地方定义字段，就可以在数据库、API和前端之间保持一致性，大大减少了重复工作和出错的可能性。