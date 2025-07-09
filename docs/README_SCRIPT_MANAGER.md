# 🎭 AI剧本杀游戏 - 剧本管理系统

一个功能完整的剧本杀剧本创作与管理平台，支持剧本创建、角色设计、证据管理、场景设置等全流程功能。

## ✨ 主要功能

### 📝 剧本管理
- **剧本创建**: 支持创建新剧本，设置基本信息、玩家人数、游戏时长等
- **剧本编辑**: 完整的剧本编辑功能，支持实时保存
- **状态管理**: 草稿、已发布、已归档三种状态管理
- **搜索筛选**: 按标题、作者、状态等条件搜索和筛选剧本

### 👥 角色系统
- **角色设计**: 详细的角色信息设置（姓名、背景、秘密、目标等）
- **头像上传**: 支持角色头像图片上传和管理
- **性别设置**: 支持男性、女性、中性角色设定
- **特殊角色**: 凶手、受害者等特殊角色标记

### 🔍 证据管理
- **证据创建**: 支持多种类型证据（物理证据、文档、照片等）
- **图片上传**: 证据相关图片上传和存储
- **重要性分级**: 关键、重要、一般三个重要性等级
- **关联角色**: 证据与角色的关联关系管理

### 🏠 场景系统
- **场景设计**: 详细的游戏场景描述和设置
- **背景图片**: 场景背景图片上传和管理
- **场景关联**: 场景与剧情的关联管理

### 📊 数据统计
- **剧本统计**: 总剧本数、发布状态分布等
- **存储统计**: 图片资源使用情况统计
- **作者统计**: 各作者的剧本创作数量

## 🏗️ 技术架构

### 后端技术栈
- **FastAPI**: 现代化的Python Web框架
- **PostgreSQL**: 关系型数据库，存储剧本文本数据
- **MinIO**: 对象存储，管理图片和文件资源
- **SQLAlchemy**: ORM框架，异步数据库操作
- **Pydantic**: 数据验证和序列化

### 前端技术栈
- **原生HTML/CSS/JavaScript**: 轻量级前端实现
- **现代CSS**: 渐变背景、毛玻璃效果、响应式设计
- **异步JavaScript**: Fetch API进行数据交互

### 存储架构
```
📁 PostgreSQL 数据库
├── scripts (剧本表)
├── characters (角色表)
├── evidence (证据表)
├── locations (场景表)
├── background_stories (背景故事表)
└── game_phases (游戏阶段表)

📁 MinIO 对象存储
├── covers/ (剧本封面)
├── avatars/ (角色头像)
├── evidence/ (证据图片)
└── scenes/ (场景背景)
```

## 🚀 快速开始

### 1. 环境要求
- Python 3.8+
- PostgreSQL 12+
- MinIO服务器
- 8GB+ RAM推荐

### 2. 安装依赖
```bash
# 克隆项目
git clone <repository-url>
cd JUBENSHA_2

# 安装Python依赖
pip install -r requirements.txt
```

### 3. 环境配置
```bash
# 复制环境配置文件
cp .env.example .env

# 编辑配置文件
nano .env
```

配置示例：
```env
# 数据库配置
DB_HOST=localhost
DB_PORT=5432
DB_NAME=jubensha_db
DB_USER=postgres
DB_PASSWORD=your_password

# MinIO配置
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET_NAME=jubensha-storage
```

### 4. 服务准备

#### PostgreSQL安装
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib

# 创建数据库
sudo -u postgres createdb jubensha_db
```

#### MinIO安装
```bash
# 使用Docker运行MinIO
docker run -p 9000:9000 -p 9001:9001 \
  -e "MINIO_ROOT_USER=minioadmin" \
  -e "MINIO_ROOT_PASSWORD=minioadmin" \
  minio/minio server /data --console-address ":9001"
```

### 5. 一键初始化
```bash
# 运行设置脚本
python scripts/setup.py
```

或手动初始化：
```bash
# 初始化数据库
python scripts/init_database.py

# 初始化存储系统
python scripts/init_storage.py
```

### 6. 启动服务
```bash
# 启动服务器
python main.py
```

访问地址：
- 游戏主页: http://localhost:8000
- 剧本管理: http://localhost:8000/script-manager

## 📖 使用指南

### 创建第一个剧本

1. **访问剧本管理页面**
   - 打开 http://localhost:8000/script-manager
   - 点击"创建剧本"按钮

2. **填写剧本基本信息**
   - 剧本标题：给剧本起一个吸引人的名字
   - 作者：填写作者姓名
   - 描述：详细描述剧本的故事背景
   - 玩家人数：设置适合的玩家数量
   - 游戏时长：预估游戏时间
   - 难度等级：简单/中等/困难

3. **上传封面图片**
   - 点击上传区域或拖拽图片文件
   - 支持JPG、PNG等常见格式
   - 建议尺寸：800x600像素

4. **设置标签**
   - 用逗号分隔多个标签
   - 例如：悬疑, 推理, 现代, 校园

### 管理剧本内容

1. **编辑剧本**
   - 在剧本列表中点击"编辑"按钮
   - 修改剧本信息并保存

2. **查看剧本详情**
   - 点击"查看"按钮查看完整剧本信息
   - 包括角色、证据、场景等详细内容

3. **状态管理**
   - 草稿：正在创作中的剧本
   - 已发布：可以用于游戏的完整剧本
   - 已归档：不再使用的历史剧本

### 搜索和筛选

1. **关键词搜索**
   - 在搜索框输入关键词
   - 支持搜索标题、描述、作者

2. **状态筛选**
   - 使用状态下拉菜单筛选
   - 可按草稿、已发布、已归档筛选

3. **作者筛选**
   - 使用作者下拉菜单筛选
   - 显示各作者的剧本数量

## 🔧 API接口

### 剧本管理API

```http
# 获取剧本列表
GET /api/scripts/

# 获取剧本详情
GET /api/scripts/{script_id}

# 创建剧本
POST /api/scripts/

# 更新剧本
PUT /api/scripts/{script_id}

# 删除剧本
DELETE /api/scripts/{script_id}

# 搜索剧本
GET /api/scripts/search/{keyword}

# 获取统计信息
GET /api/scripts/stats/overview
```

### 文件上传API

```http
# 上传剧本封面
POST /api/scripts/upload/cover

# 上传角色头像
POST /api/scripts/upload/avatar

# 上传证据图片
POST /api/scripts/upload/evidence

# 上传场景背景
POST /api/scripts/upload/scene
```

## 🛠️ 开发指南

### 项目结构
```
JUBENSHA_2/
├── src/
│   ├── api/                 # API路由
│   │   └── script_routes.py # 剧本管理API
│   ├── core/                # 核心模块
│   │   ├── database.py      # 数据库管理
│   │   ├── storage.py       # 存储管理
│   │   └── script_repository.py # 剧本数据访问
│   └── models/              # 数据模型
│       └── script.py        # 剧本数据模型
├── static/                  # 静态文件
│   └── script_manager.html  # 剧本管理页面
├── scripts/                 # 工具脚本
│   ├── setup.py            # 一键设置脚本
│   ├── init_database.py    # 数据库初始化
│   └── init_storage.py     # 存储初始化
├── main.py                  # 应用入口
├── server.py               # FastAPI应用
└── requirements.txt        # 依赖列表
```

### 添加新功能

1. **数据模型**
   - 在 `src/models/` 中定义数据结构
   - 使用 `@dataclass` 装饰器

2. **数据库操作**
   - 在 `src/core/script_repository.py` 中添加数据访问方法
   - 使用异步SQL操作

3. **API接口**
   - 在 `src/api/script_routes.py` 中添加新的路由
   - 使用FastAPI的依赖注入

4. **前端界面**
   - 修改 `static/script_manager.html`
   - 使用原生JavaScript进行交互

### 数据库迁移

```bash
# 备份数据库
pg_dump jubensha_db > backup.sql

# 修改表结构
# 编辑 src/core/database.py 中的 CREATE_TABLES_SQL

# 重新初始化
python scripts/init_database.py
```

## 🔒 安全考虑

### 数据安全
- 数据库连接使用连接池
- SQL查询使用参数化防止注入
- 文件上传类型和大小限制

### 访问控制
- 文件上传权限验证
- API接口访问频率限制
- 敏感信息环境变量存储

### 存储安全
- MinIO访问密钥管理
- 文件路径规范化
- 图片格式验证

## 🐛 故障排除

### 常见问题

1. **数据库连接失败**
   ```
   检查PostgreSQL服务状态
   验证.env中的数据库配置
   确认数据库用户权限
   ```

2. **MinIO连接失败**
   ```
   检查MinIO服务状态
   验证访问密钥配置
   确认网络连接
   ```

3. **文件上传失败**
   ```
   检查文件大小限制
   验证文件格式支持
   确认存储空间充足
   ```

4. **页面加载错误**
   ```
   检查静态文件路径
   验证API接口响应
   查看浏览器控制台错误
   ```

### 日志查看

```bash
# 查看应用日志
python main.py

# 查看数据库日志
sudo tail -f /var/log/postgresql/postgresql-*.log

# 查看MinIO日志
docker logs <minio-container-id>
```

## 📈 性能优化

### 数据库优化
- 使用连接池减少连接开销
- 添加适当的数据库索引
- 定期清理无用数据

### 存储优化
- 图片压缩和格式优化
- CDN加速静态资源
- 缓存常用文件

### 应用优化
- 异步处理文件上传
- 分页加载大量数据
- 前端资源压缩

## 🤝 贡献指南

欢迎提交Issue和Pull Request！

1. Fork项目
2. 创建功能分支
3. 提交更改
4. 推送到分支
5. 创建Pull Request

## 📄 许可证

本项目采用MIT许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

感谢所有为这个项目做出贡献的开发者和用户！

---

**Happy Scripting! 🎭✨**