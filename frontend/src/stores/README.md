# TTS Store (Zustand)

这个目录包含使用Zustand重构的TTS状态管理。

## 主要改进

### 1. 集中化状态管理
- 所有TTS相关状态统一在`ttsStore.ts`中管理
- 消除了原有的多个ref和useState的分散状态

### 2. 更好的状态同步
- 使用Zustand的响应式状态更新
- 避免了原有的状态同步问题

### 3. 简化的API
- `useTTSService` hook现在只是Zustand store的一个简单包装
- 保持了原有的接口兼容性

### 4. 改进的调试体验
- 状态变化更容易追踪
- 可以使用Zustand DevTools进行调试

## 使用方式

```typescript
import { useTTSService } from '@/services/ttsService';

const MyComponent = () => {
  const { queueTTS, stopAllAudio, toggleTTS } = useTTSService(voiceMapping);
  
  // 使用方式与之前完全相同
  const handleSpeak = () => {
    queueTTS('角色名', '要说的话');
  };
  
  return (
    <button onClick={handleSpeak}>播放语音</button>
  );
};
```

## 状态结构

```typescript
interface TTSState {
  // 基础状态
  ttsEnabled: boolean;
  isPlaying: boolean;
  audioStatus: string;
  audioInitialized: boolean;
  
  // 队列管理
  audioQueue: TTSQueueItem[];
  playingLock: boolean;
  
  // 音频相关
  audioContext: AudioContext | null;
  currentAudioSources: AudioBufferSourceNode[];
  voiceMapping: Record<string, string>;
  
  // Actions
  queueTTS: (character: string, text: string) => Promise<void>;
  playNextInQueue: () => Promise<void>;
  stopAllAudio: () => void;
  toggleTTS: () => void;
  // ... 其他方法
}
```

## 主要优势

1. **性能优化**: 减少了不必要的重渲染
2. **代码简化**: 消除了复杂的ref管理
3. **状态一致性**: 避免了状态同步问题
4. **更好的测试性**: 状态逻辑与UI分离
5. **扩展性**: 易于添加新功能和状态