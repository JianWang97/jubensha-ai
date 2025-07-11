# API Client Hook 使用示例

本文档展示了如何使用 `useApiClient` hook 中的各种 API 方法。

## 基本用法

```typescript
import { useApiClient } from '@/hooks/useApiClient';

function MyComponent() {
  const {
    loading,
    error,
    getScripts,
    createScript,
    getGameStatus,
    // ... 其他方法
  } = useApiClient();

  // 使用 API 方法
}
```

## 剧本管理 API

### 1. 获取剧本列表

```typescript
// 基本获取
const scripts = await getScripts();

// 带过滤和分页
const filteredScripts = await getScriptsWithFilters({
  status: 'active',
  author: '作者名',
  page: 1,
  page_size: 20
});
```

### 2. 获取单个剧本详情

```typescript
const script = await getScript(scriptId);
```

### 3. 创建新剧本

```typescript
const scriptData = {
  script_data: JSON.stringify({
    title: '新剧本',
    description: '剧本描述',
    // ... 其他剧本数据
  }),
  cover_image: coverImageFile // File 对象（可选）
};

const result = await createScript(scriptData);
```

### 4. 更新剧本

```typescript
const updateData = {
  title: '更新后的标题',
  description: '更新后的描述',
  status: 'active'
};

const result = await updateScript(scriptId, updateData);
```

### 5. 删除剧本

```typescript
const result = await deleteScript(scriptId);
```

### 6. 搜索剧本

```typescript
const searchResults = await searchScripts('关键词', 20);
```

### 7. 获取剧本统计信息

```typescript
const stats = await getScriptStats();
// 返回: { total_scripts, active_scripts, total_characters, average_duration }
```

## 角色管理 API

### 获取指定剧本的角色列表

```typescript
const characters = await getCharacters(scriptId);
```

## 游戏管理 API

### 1. 获取游戏状态

```typescript
// 不指定会话ID
const status = await getGameStatus();

// 指定会话ID
const status = await getGameStatus('session_123');
```

### 2. 启动游戏

```typescript
// 使用默认剧本
const result = await startGame();

// 指定剧本和会话
const result = await startGame('session_123', 2);
```

### 3. 重置游戏

```typescript
const result = await resetGame('session_123');
```

## 背景故事 API

### 1. 获取指定剧本的背景故事

```typescript
const background = await getBackgroundByScript(scriptId);
```

### 2. 获取背景故事（兼容旧版本）

```typescript
const background = await getBackground();
```

## 声音相关 API

### 1. 获取声音分配信息

```typescript
const voiceAssignments = await getVoiceAssignments('session_123');
```

### 2. TTS 流式音频生成

```typescript
const ttsRequest = {
  text: '要转换的文本',
  character: 'character_name' // 可选
};

const audioResult = await streamTTS(ttsRequest);
```

## 文件上传 API

### 1. 上传封面图片

```typescript
const coverFile = // File 对象
const result = await uploadCoverImage(coverFile);
```

### 2. 上传角色头像

```typescript
const avatarFile = // File 对象
const result = await uploadAvatarImage(avatarFile);
```

### 3. 上传证据图片

```typescript
const evidenceFile = // File 对象
const result = await uploadEvidenceImage(evidenceFile);
```

### 4. 上传场景背景图

```typescript
const sceneFile = // File 对象
const result = await uploadSceneImage(sceneFile);
```

## 错误处理

```typescript
function MyComponent() {
  const { loading, error, getScripts, clearError } = useApiClient();

  const handleGetScripts = async () => {
    try {
      const scripts = await getScripts();
      console.log('获取剧本成功:', scripts);
    } catch (err) {
      console.error('获取剧本失败:', err);
      // error 状态会自动更新
    }
  };

  const handleClearError = () => {
    clearError();
  };

  if (loading) return <div>加载中...</div>;
  if (error) return <div>错误: {error} <button onClick={handleClearError}>清除错误</button></div>;

  return (
    <div>
      <button onClick={handleGetScripts}>获取剧本列表</button>
      {/* 其他 UI */}
    </div>
  );
}
```

## 数据类型定义

所有的数据类型都已在 `useApiClient.ts` 中定义：

- `Script`: 剧本数据结构
- `Character`: 角色数据结构
- `GameStatus`: 游戏状态数据结构
- `Background`: 背景故事数据结构
- `VoiceAssignment`: 声音分配数据结构
- `TTSRequest`: TTS 请求数据结构
- `ScriptCreateRequest`: 剧本创建请求数据结构
- `ScriptUpdateRequest`: 剧本更新请求数据结构
- `ScriptStats`: 剧本统计数据结构

## 注意事项

1. 所有 API 方法都是异步的，需要使用 `await` 或 `.then()`
2. 文件上传方法需要传入 `File` 对象
3. 某些方法支持可选参数，如会话ID、分页参数等
4. 错误会自动设置到 `error` 状态中，可以通过 `clearError()` 清除
5. 加载状态会自动管理，在请求期间 `loading` 为 `true`