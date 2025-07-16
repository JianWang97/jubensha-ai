# MiniMax API 客户端代理使用指南

本文档介绍如何使用MiniMax API客户端代理进行语音合成、图片生成和声音克隆等功能。

## 功能特性

- **文本转语音 (TTS)**: 支持多种声音和语音参数调节
- **流式语音合成**: 实时获取音频数据块
- **图片生成**: 基于文本提示生成高质量图片
- **声音克隆**: 从音频样本克隆声音特征
- **声音列表**: 获取可用的预设声音
- **服务集成**: 与现有TTS服务框架无缝集成

## 安装依赖

```bash
pip install aiohttp
```

## 快速开始

### 1. 获取API密钥

访问 [MiniMax平台](https://www.minimaxi.com/) 获取API密钥和Group ID。

#### 环境变量配置（推荐）

在 `.env` 文件中设置环境变量：

```bash
# 设置TTS提供商为MiniMax
TTS_PROVIDER=minimax
TTS_API_KEY=your_minimax_api_key_here
MINIMAX_GROUP_ID=your_minimax_group_id_here
TTS_BASE_URL=https://api.minimaxi.chat
TTS_MODEL=speech-01
TTS_DEFAULT_VOICE=male-qn-qingse
```

### 2. 基本使用

```python
import asyncio
from src.services.minimax_service import (
    MiniMaxClient, 
    MiniMaxTTSRequest, 
    MiniMaxImageRequest
)

async def main():
    # 配置API密钥和Group ID
    api_key = "your-api-key"
    group_id = "your-group-id"
    
    async with MiniMaxClient(api_key, group_id) as client:
        # 文本转语音
        tts_request = MiniMaxTTSRequest(
            text="你好，这是MiniMax语音合成测试",
            voice_id="male-qn-qingse",
            speed=1.0
        )
        
        response = await client.text_to_speech(tts_request)
        if response.success:
            print("语音合成成功")
            # response.data["audio_data"] 包含base64编码的音频数据
        
        # 图片生成
        image_request = MiniMaxImageRequest(
            prompt="一只可爱的小猫在花园里",
            aspect_ratio="1:1"
        )
        
        image_response = await client.generate_image(image_request)
        if image_response.success:
            print("图片生成成功")
            # image_response.data["images"] 包含生成的图片

asyncio.run(main())
```

## API 参考

### MiniMaxClient

主要的API客户端类，提供所有MiniMax服务的访问接口。

#### 初始化

```python
client = MiniMaxClient(
    api_key="your-api-key",
    group_id="your-group-id",
    base_url="https://api.minimaxi.chat"  # 可选，默认为官方API地址
)
```

#### 方法

- `text_to_speech(request)`: 文本转语音
- `text_to_speech_stream(request)`: 流式文本转语音
- `generate_image(request)`: 生成图片
- `upload_file(file_path, purpose)`: 上传文件
- `clone_voice(request)`: 克隆声音
- `get_voice_list()`: 获取可用声音列表

### 文本转语音 (TTS)

#### MiniMaxTTSRequest

```python
from src.services.minimax_service import MiniMaxTTSRequest

request = MiniMaxTTSRequest(
    text="要合成的文本",
    voice_id="male-qn-qingse",  # 声音ID
    model="speech-01",          # 模型版本
    speed=1.0,                  # 语速 (0.5-2.0)
    volume=1.0,                 # 音量 (0.1-3.0)
    pitch=0,                    # 音调 (-12到12)
    audio_sample_rate=32000,    # 采样率
    bitrate=128000,             # 比特率
    format="mp3"                # 音频格式
)
```

#### 可用声音ID

- `male-qn-qingse`: 青涩男声
- `female-shaonv`: 少女音
- `female-yujie`: 御姐音
- `audiobook_male_2`: 男性有声书
- 更多声音可通过 `get_voice_list()` 获取

#### 示例：基本语音合成

```python
async def basic_tts():
    async with MiniMaxClient(api_key, group_id) as client:
        request = MiniMaxTTSRequest(
            text="欢迎使用MiniMax语音合成服务",
            voice_id="female-shaonv",
            speed=1.2
        )
        
        response = await client.text_to_speech(request)
        if response.success:
            # 保存音频文件
            import base64
            audio_bytes = base64.b64decode(response.data["audio_data"])
            with open("output.mp3", "wb") as f:
                f.write(audio_bytes)
```

#### 示例：流式语音合成

```python
async def streaming_tts():
    async with MiniMaxClient(api_key, group_id) as client:
        request = MiniMaxTTSRequest(
            text="这是一个长文本，将通过流式方式合成语音",
            voice_id="male-qn-qingse"
        )
        
        audio_chunks = []
        async for chunk in client.text_to_speech_stream(request):
            if "error" in chunk:
                print(f"错误: {chunk['error']}")
                break
            elif "end" in chunk:
                print("合成完成")
                break
            elif "audio" in chunk:
                audio_chunks.append(chunk["audio"])
        
        # 合并音频块
        if audio_chunks:
            full_audio = "".join(audio_chunks)
            # 处理完整音频数据
```

### 图片生成

#### MiniMaxImageRequest

```python
from src.services.minimax_service import MiniMaxImageRequest

request = MiniMaxImageRequest(
    prompt="图片描述文本",
    model="image-01",           # 模型版本
    aspect_ratio="1:1",         # 宽高比: 1:1, 16:9, 9:16, 4:3, 3:4
    guidance_scale=7.5,         # 引导强度 (1.0-20.0)
    seed=42                     # 随机种子，用于复现结果
)
```

#### 示例：图片生成

```python
async def generate_image():
    async with MiniMaxClient(api_key, group_id) as client:
        request = MiniMaxImageRequest(
            prompt="一幅美丽的山水画，中国传统水墨风格，远山如黛，近水含烟",
            aspect_ratio="16:9",
            guidance_scale=8.0
        )
        
        response = await client.generate_image(request)
        if response.success:
            images = response.data["images"]
            for i, image in enumerate(images):
                if "url" in image:
                    print(f"图片URL: {image['url']}")
                elif "base64" in image:
                    # 保存base64图片
                    import base64
                    image_bytes = base64.b64decode(image["base64"])
                    with open(f"generated_{i}.png", "wb") as f:
                        f.write(image_bytes)
```

### 声音克隆

声音克隆功能允许从音频样本中提取声音特征，创建自定义声音。

#### 步骤

1. **上传音频文件** (10-60秒，WAV/MP3格式)
2. **创建声音克隆**
3. **使用克隆的声音进行TTS**

#### 示例：完整声音克隆流程

```python
async def voice_cloning():
    async with MiniMaxClient(api_key, group_id) as client:
        # 1. 上传音频文件
        upload_response = await client.upload_file(
            "sample_voice.wav", 
            "voice_clone"
        )
        
        if not upload_response.success:
            print(f"上传失败: {upload_response.error}")
            return
        
        file_id = upload_response.data["file_id"]
        
        # 2. 克隆声音
        from src.services.minimax_service import MiniMaxVoiceCloneRequest
        
        clone_request = MiniMaxVoiceCloneRequest(
            file_id=file_id,
            voice_id="my_custom_voice"  # 自定义声音ID
        )
        
        clone_response = await client.clone_voice(clone_request)
        if clone_response.success:
            print("声音克隆成功")
            
            # 3. 使用克隆的声音
            tts_request = MiniMaxTTSRequest(
                text="这是使用克隆声音合成的语音",
                voice_id="my_custom_voice"
            )
            
            tts_response = await client.text_to_speech(tts_request)
            if tts_response.success:
                print("克隆声音合成成功")
```

### 与现有TTS服务集成

MiniMax客户端可以无缝集成到现有的TTS服务框架中。

```python
from src.services.tts_service import TTSService, TTSRequest

# 使用工厂模式创建MiniMax TTS服务
tts_service = TTSService.create_service(
    "minimax",
    api_key="your-api-key",
    group_id="your-group-id",
    model="speech-01"
)

# 使用统一的TTS接口
request = TTSRequest(
    text="集成测试文本",
    voice="female-yujie",
    speed=1.1
)

response = await tts_service.synthesize(request)
if response:
    print("TTS服务集成成功")
```

## 错误处理

所有API调用都返回 `MiniMaxResponse` 对象，包含以下字段：

- `success`: 布尔值，表示请求是否成功
- `data`: 成功时的响应数据
- `error`: 失败时的错误信息
- `task_id`: 任务ID（如果适用）

```python
response = await client.text_to_speech(request)
if response.success:
    # 处理成功响应
    audio_data = response.data["audio_data"]
else:
    # 处理错误
    print(f"请求失败: {response.error}")
```

## 故障排除

### 500 Internal Server Error

如果在使用 `/api/tts/stream` 端点时遇到500错误，请检查以下配置：

1. **确保设置了必需的环境变量**：
   ```bash
   TTS_PROVIDER=minimax
   TTS_API_KEY=your_minimax_api_key_here
   MINIMAX_GROUP_ID=your_minimax_group_id_here  # 这个是必需的！
   ```

2. **验证API密钥和Group ID**：
   - 确保API密钥有效且未过期
   - 确保Group ID正确
   - 检查网络连接到MiniMax API

3. **检查依赖项**：
   ```bash
   pip install aiohttp>=3.8.0
   ```

### TTS流式响应只返回 {end: true} 问题

如果TTS流式请求只返回结束标记而没有音频数据：

1. **使用调试脚本测试**：
   ```bash
   python debug_tts_stream.py
   ```

2. **检查API响应格式**：
   - MiniMax API可能返回不同的响应格式
   - 客户端已支持多种响应格式的自动检测
   - 如果仍有问题，检查API文档确认正确的端点和参数

3. **验证请求参数**：
   ```python
   # 确保使用正确的模型和语音ID
   request = MiniMaxTTSRequest(
       text="测试文本",
       voice_id="male-qn-qingse",  # 使用有效的语音ID
       model="speech-01"
   )
   ```

### 常见配置错误

- **缺少MINIMAX_GROUP_ID**：MiniMax TTS服务需要group_id参数
- **错误的TTS_PROVIDER**：确保设置为"minimax"
- **无效的语音ID**：使用 `get_voice_list()` 获取可用语音列表
- **网络问题**：检查防火墙和代理设置
- **API配额限制**：检查API使用配额是否已用完

## 常见问题

### Q: 如何获取API密钥？
A: 访问 [MiniMax官网](https://www.minimaxi.com/) 注册账号并获取API密钥。

### Q: 支持哪些音频格式？
A: 目前支持MP3格式，采样率可选16000、22050、32000、44100Hz。

### Q: 图片生成有什么限制？
A: 支持多种宽高比，生成的图片质量取决于提示词的质量和模型参数。

### Q: 声音克隆需要什么样的音频？
A: 建议使用10-60秒的清晰人声录音，WAV或MP3格式，无背景噪音。

### Q: 如何处理API限流？
A: 客户端会自动处理HTTP错误，建议在业务层面实现重试机制。

### Q: 为什么会出现500错误？
A: 最常见的原因是缺少MINIMAX_GROUP_ID环境变量。请参考上面的故障排除部分。

### Q: 为什么TTS流式响应只返回 {end: true}？
A: 这通常是由于以下原因之一：
- API响应格式与预期不符
- 使用了无效的语音ID或模型
- API配额已用完或网络问题
- 请求参数不正确

解决方法：
1. 运行 `python debug_tts_stream.py` 进行诊断
2. 检查环境变量配置
3. 验证API密钥和配额
4. 使用 `get_voice_list()` 获取有效的语音ID

## 完整示例

查看 `examples/minimax_example.py` 文件获取完整的使用示例，包括：

- 基本TTS功能测试
- 流式语音合成
- 图片生成
- 声音克隆完整流程
- TTS服务集成测试

运行示例：

```bash
cd examples
python minimax_example.py
```

## 注意事项

1. **API密钥安全**: 不要在代码中硬编码API密钥，建议使用环境变量
2. **资源管理**: 使用 `async with` 语句确保客户端正确关闭
3. **错误处理**: 始终检查响应的 `success` 字段
4. **音频文件**: 声音克隆的音频文件大小建议不超过10MB
5. **并发限制**: 注意API的并发请求限制，避免过于频繁的调用

## 更新日志

- **v1.0.0**: 初始版本，支持TTS、图片生成、声音克隆
- 支持流式语音合成
- 集成到现有TTS服务框架
- 完善的错误处理和示例代码