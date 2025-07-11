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

## MinIO 文件管理 API

### 1. 通用文件上传

```bash
# 使用 curl 上传文件
curl -X POST "http://localhost:8000/api/files/upload" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@/path/to/your/file.jpg" \
  -F "category=covers"

# 支持的分类: covers, avatars, evidence, scenes, general
```

```javascript
// 使用 JavaScript/TypeScript
const uploadFile = async (file, category = 'general') => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('category', category);
  
  const response = await fetch('/api/files/upload', {
    method: 'POST',
    body: formData
  });
  
  return await response.json();
};

// 使用示例
const fileInput = document.getElementById('fileInput');
const file = fileInput.files[0];
const result = await uploadFile(file, 'covers');
console.log('上传结果:', result.data.file_url);
```

### 2. 获取文件列表

```bash
# 获取所有文件
curl "http://localhost:8000/api/files/list"

# 按分类过滤
curl "http://localhost:8000/api/files/list?category=covers"
```

```javascript
// JavaScript/TypeScript
const getFileList = async (category = null) => {
  const url = category 
    ? `/api/files/list?category=${category}`
    : '/api/files/list';
  
  const response = await fetch(url);
  return await response.json();
};

// 使用示例
const allFiles = await getFileList();
const coverImages = await getFileList('covers');
```

### 3. 删除文件

```bash
# 删除指定文件
curl -X DELETE "http://localhost:8000/api/files/delete" \
  -H "Content-Type: application/json" \
  -d '{"file_url": "http://localhost:9000/jubensha-assets/covers/abc123.jpg"}'
```

```javascript
// JavaScript/TypeScript
const deleteFile = async (fileUrl) => {
  const response = await fetch('/api/files/delete', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ file_url: fileUrl })
  });
  
  return await response.json();
};

// 使用示例
const result = await deleteFile('http://localhost:9000/jubensha-assets/covers/abc123.jpg');
```

### 4. 文件下载

```bash
# 直接下载文件
curl "http://localhost:8000/api/files/download/covers/abc123.jpg" \
  -o downloaded_file.jpg
```

```javascript
// JavaScript/TypeScript - 在浏览器中触发下载
const downloadFile = (filePath) => {
  const downloadUrl = `/api/files/download/${filePath}`;
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = filePath.split('/').pop(); // 使用文件名
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// 使用示例
downloadFile('covers/abc123.jpg');
```

### 5. 获取存储统计信息

```bash
# 获取存储统计
curl "http://localhost:8000/api/files/stats"
```

```javascript
// JavaScript/TypeScript
const getStorageStats = async () => {
  const response = await fetch('/api/files/stats');
  return await response.json();
};

// 使用示例
const stats = await getStorageStats();
console.log('存储统计:', stats.data.stats);
// 输出示例: { covers: 5, avatars: 10, evidence: 3, scenes: 2, total: 20 }
```

### 6. 完整的文件管理组件示例

```typescript
import React, { useState, useEffect } from 'react';

interface FileItem {
  name: string;
  size: number;
  last_modified: string;
  url: string;
}

const FileManager: React.FC = () => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('general');

  // 加载文件列表
  const loadFiles = async (category?: string) => {
    try {
      const response = await fetch(
        category ? `/api/files/list?category=${category}` : '/api/files/list'
      );
      const result = await response.json();
      if (result.success) {
        setFiles(result.data.files);
      }
    } catch (error) {
      console.error('加载文件列表失败:', error);
    }
  };

  // 上传文件
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', selectedCategory);

      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      if (result.success) {
        alert('文件上传成功!');
        loadFiles(selectedCategory);
      } else {
        alert('上传失败: ' + result.message);
      }
    } catch (error) {
      alert('上传失败: ' + error);
    } finally {
      setUploading(false);
    }
  };

  // 删除文件
  const handleFileDelete = async (fileUrl: string) => {
    if (!confirm('确定要删除这个文件吗？')) return;

    try {
      const response = await fetch('/api/files/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_url: fileUrl })
      });

      const result = await response.json();
      if (result.success) {
        alert('文件删除成功!');
        loadFiles(selectedCategory);
      } else {
        alert('删除失败: ' + result.message);
      }
    } catch (error) {
      alert('删除失败: ' + error);
    }
  };

  useEffect(() => {
    loadFiles(selectedCategory);
  }, [selectedCategory]);

  return (
    <div className="file-manager">
      <div className="upload-section">
        <select 
          value={selectedCategory} 
          onChange={(e) => setSelectedCategory(e.target.value)}
        >
          <option value="general">通用</option>
          <option value="covers">封面</option>
          <option value="avatars">头像</option>
          <option value="evidence">证据</option>
          <option value="scenes">场景</option>
        </select>
        
        <input 
          type="file" 
          onChange={handleFileUpload} 
          disabled={uploading}
        />
        
        {uploading && <span>上传中...</span>}
      </div>

      <div className="file-list">
        {files.map((file, index) => (
          <div key={index} className="file-item">
            <img src={file.url} alt={file.name} width="100" />
            <div>
              <p>{file.name}</p>
              <p>大小: {(file.size / 1024).toFixed(2)} KB</p>
              <button onClick={() => handleFileDelete(file.url)}>
                删除
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FileManager;
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