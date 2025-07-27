# 🎭 AI剧本杀游戏

一个基于AI的剧本杀游戏demo，所有角色都由AI扮演，使用LangChain和OpenAI构建智能代理。

## ✨ 特色功能

- 🤖 **多AI角色扮演**: 每个角色都有独特的背景、秘密和目标
- 🎯 **完整游戏流程**: 包含介绍、调查、讨论、投票、揭晓等完整阶段
- 🌐 **实时同步**: 使用WebSocket实时同步游戏进度
- 💻 **精美界面**: 响应式Web界面，支持移动端
- 🧠 **智能推理**: 基于OpenAI的AI推理引擎

## 🎮 游戏角色

### 张医生 (凶手)
- **背景**: 知名外科医生，40岁，性格严谨
- **秘密**: 曾经因为医疗事故被受害者威胁
- **目标**: 隐藏医疗事故的真相

### 李秘书
- **背景**: 公司高级秘书，28岁，聪明能干
- **秘密**: 发现了公司的财务造假
- **目标**: 保护自己不被灭口

### 王律师
- **背景**: 资深律师，45岁，口才很好
- **秘密**: 与受害者有经济纠纷
- **目标**: 证明自己的清白

### 陈老板 (受害者)
- **背景**: 成功商人，50岁，手段狠辣
- **秘密**: 欠受害者一大笔钱
- **状态**: 已死亡，不参与游戏

## 🚀 快速开始

### 环境要求

- Python 3.13+
- OpenAI API Key
- uv (Python包管理器)

### 安装步骤

1. **克隆项目**
   ```bash
   git clone <repository-url>
   cd JUBENSHA_2
   ```

2. **安装依赖**
   ```bash
   uv sync
   ```

3. **配置环境变量**
   
   编辑 `.env` 文件，设置你的OpenAI API Key:
   ```env
   OPENAI_API_KEY=your_actual_openai_api_key_here
   OPENAI_MODEL=gpt-3.5-turbo
   HOST=localhost
   PORT=8000
   ```

4. **启动游戏**
   ```bash
   uv run python main.py
   ```

5. **开始游戏**
   
   打开浏览器访问: http://localhost:8000

## 🎯 游戏流程

1. **自我介绍阶段**: AI角色介绍自己的身份背景
2. **调查阶段**: AI角色互相询问，寻找线索
3. **讨论阶段**: AI角色分享发现和推理
4. **投票阶段**: AI角色投票选出认为的凶手
5. **揭晓阶段**: 公布真相和游戏结果

## 🛠️ 技术架构

### 后端技术栈
- **FastAPI**: Web框架和API服务
- **WebSocket**: 实时通信
- **LangChain**: AI代理框架
- **OpenAI**: 大语言模型
- **Python asyncio**: 异步编程

### 前端技术栈
- **HTML5/CSS3**: 界面结构和样式
- **JavaScript**: 交互逻辑
- **WebSocket API**: 实时通信

### 项目结构
```
JUBENSHA_2/
├── main.py              # 主程序入口
├── server.py            # FastAPI服务器
├── websocket_server.py  # WebSocket服务器
├── game_engine.py       # 游戏引擎和AI代理
├── static/
│   └── index.html       # 前端页面
├── .env                 # 环境配置
├── pyproject.toml       # 项目配置
└── README.md           # 项目说明
```

## 🔧 自定义配置

### 修改角色设定

编辑 `game_engine.py` 中的 `_init_characters()` 方法来自定义角色:

```python
def _init_characters(self) -> List[Character]:
    return [
        Character(
            name="角色名",
            background="角色背景",
            secret="角色秘密",
            objective="角色目标",
            is_murderer=False,  # 是否为凶手
            is_victim=False     # 是否为受害者
        ),
        # 添加更多角色...
    ]
```

### 调整AI模型

在 `.env` 文件中修改模型设置:
```env
OPENAI_MODEL=gpt-4  # 使用更强大的模型
```

### 修改服务器配置

在 `.env` 文件中修改服务器设置:
```env
HOST=0.0.0.0  # 允许外部访问
PORT=8080     # 修改端口
```

## 🐛 故障排除

### 常见问题

1. **OpenAI API错误**
   - 确保API Key正确设置
   - 检查API额度是否充足
   - 确认网络连接正常

2. **WebSocket连接失败**
   - 检查防火墙设置
   - 确认端口未被占用
   - 尝试刷新页面重新连接

3. **依赖安装失败**
   - 确保Python版本>=3.13
   - 尝试使用虚拟环境
   - 检查网络连接

### 调试模式

启动时添加调试参数:
```bash
DEBUG=true uv run python main.py
```

## 🤝 贡献指南

欢迎提交Issue和Pull Request来改进项目！

1. Fork项目
2. 创建特性分支
3. 提交更改
4. 推送到分支
5. 创建Pull Request

## 📄 许可证

本项目采用MIT许可证 - 查看LICENSE文件了解详情。

## 🙏 致谢

- [LangChain](https://langchain.com/) - AI应用开发框架
- [OpenAI](https://openai.com/) - 大语言模型服务
- [FastAPI](https://fastapi.tiangolo.com/) - 现代Web框架

---

**享受AI剧本杀的乐趣！** 🎭✨

## 测试

项目包含全面的单元测试和API测试，确保代码质量和接口稳定性。

### 测试结构

```
tests/
├── conftest.py          # 测试配置
├── factories.py         # 测试数据工厂
├── test_auth_api.py     # 认证API测试
├── test_auth_utils.py   # 认证工具测试
├── test_api_routes.py   # API路由测试
├── test_script_api.py   # 剧本API测试
├── test_user_api.py     # 用户API测试
├── test_utils_api.py    # 工具API测试
├── test_models.py       # 数据模型测试
├── test_script_loading.py # 剧本加载测试
├── test_services.py     # 服务层测试
└── test_utils.py        # 工具函数测试
```

### 运行测试

使用以下命令运行测试：

```bash
# 运行所有测试
uv run pytest

# 运行特定测试文件
uv run pytest tests/test_script_api.py

# 运行带标记的测试
uv run pytest -m api

# 生成测试覆盖率报告
uv run pytest --cov=src --cov-report=html
```

也可以使用测试运行脚本：

```bash
# 运行所有测试
python tests/run_tests.py

# 运行API测试
python tests/run_tests.py api
```

