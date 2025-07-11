import { create } from 'zustand';
import { config } from '@/config';

interface TTSQueueItem {
  character: string;
  text: string;
}

interface TTSState {
  // 状态
  ttsEnabled: boolean;
  isPlaying: boolean;
  audioStatus: string;
  audioInitialized: boolean;
  audioQueue: TTSQueueItem[];
  playingLock: boolean;
  lastPlayedCharacter: string;
  lastPlayedText: string;
  
  // 音频相关
  audioContext: AudioContext | null;
  currentAudioSources: AudioBufferSourceNode[];
  voiceMapping: Record<string, string>;
  
  // Actions
  setTtsEnabled: (enabled: boolean) => void;
  setIsPlaying: (playing: boolean) => void;
  setAudioStatus: (status: string) => void;
  setAudioInitialized: (initialized: boolean) => void;
  setVoiceMapping: (mapping: Record<string, string>) => void;
  
  // 队列操作
  addToQueue: (item: TTSQueueItem) => void;
  removeFromQueue: () => TTSQueueItem | undefined;
  clearQueue: () => void;
  
  // 播放控制
  setPlayingLock: (locked: boolean) => void;
  setLastPlayed: (character: string, text: string) => void;
  clearLastPlayed: () => void;
  
  // 音频操作
  setAudioContext: (context: AudioContext | null) => void;
  addAudioSource: (source: AudioBufferSourceNode) => void;
  clearAudioSources: () => void;
  
  // 复合操作
  queueTTS: (character: string, text: string) => Promise<void>;
  playNextInQueue: () => Promise<void>;
  stopAllAudio: () => void;
  toggleTTS: () => void;
  initializeAudio: () => Promise<void>;
  playAudioChunk: (audioData: string) => Promise<void>;
}

export const useTTSStore = create<TTSState>((set, get) => ({
  // 初始状态
  ttsEnabled: true,
  isPlaying: false,
  audioStatus: '等待发言...',
  audioInitialized: false,
  audioQueue: [],
  playingLock: false,
  lastPlayedCharacter: '',
  lastPlayedText: '',
  audioContext: null,
  currentAudioSources: [],
  voiceMapping: {},
  
  // 基础状态设置
  setTtsEnabled: (enabled) => set({ ttsEnabled: enabled }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setAudioStatus: (status) => set({ audioStatus: status }),
  setAudioInitialized: (initialized) => set({ audioInitialized: initialized }),
  setVoiceMapping: (mapping) => set({ voiceMapping: mapping }),
  
  // 队列操作
  addToQueue: (item) => set((state) => ({ 
    audioQueue: [...state.audioQueue, item] 
  })),
  removeFromQueue: () => {
    const state = get();
    if (state.audioQueue.length === 0) return undefined;
    const item = state.audioQueue[0];
    set({ audioQueue: state.audioQueue.slice(1) });
    return item;
  },
  clearQueue: () => set({ audioQueue: [] }),
  
  // 播放控制
  setPlayingLock: (locked) => set({ playingLock: locked }),
  setLastPlayed: (character, text) => set({ 
    lastPlayedCharacter: character, 
    lastPlayedText: text 
  }),
  clearLastPlayed: () => set({ 
    lastPlayedCharacter: '', 
    lastPlayedText: '' 
  }),
  
  // 音频操作
  setAudioContext: (context) => set({ audioContext: context }),
  addAudioSource: (source) => set((state) => ({
    currentAudioSources: [...state.currentAudioSources, source]
  })),
  clearAudioSources: () => {
    const state = get();
    state.currentAudioSources.forEach(source => {
      try {
        source.stop();
      } catch (e) {
        // 音频源可能已经停止
      }
    });
    set({ currentAudioSources: [] });
  },
  
  // 初始化音频上下文
  initializeAudio: async () => {
    const state = get();
    if (state.audioContext) return;
    
    try {
      const context = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (context.state === 'suspended') {
        await context.resume();
      }
      set({ 
        audioContext: context, 
        audioInitialized: true,
        audioStatus: '音频已初始化'
      });
      console.log('音频上下文初始化成功');
    } catch (error) {
      console.error('音频上下文初始化失败:', error);
      set({ audioStatus: '音频初始化失败' });
    }
  },
  
  // 播放音频块
  playAudioChunk: async (audioData: string) => {
    const state = get();
    if (!state.audioContext || !state.audioInitialized) {
      console.warn('音频上下文未初始化');
      return;
    }
    
    try {
      const binaryString = atob(audioData);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // 将字节数据转换为Int16Array
      const audioBuffer = new Int16Array(bytes.buffer);
      
      // 创建AudioBuffer
      const buffer = state.audioContext.createBuffer(1, audioBuffer.length, 24000);
      const channelData = buffer.getChannelData(0);
      
      // 将Int16数据转换为Float32 (-1.0 到 1.0)
      for (let i = 0; i < audioBuffer.length; i++) {
        channelData[i] = audioBuffer[i] / 32768.0;
      }
      
      const source = state.audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(state.audioContext.destination);
      
      get().addAudioSource(source);
      source.start();
      
      return new Promise<void>((resolve) => {
        source.onended = () => {
          set((state) => ({
            currentAudioSources: state.currentAudioSources.filter(s => s !== source)
          }));
          resolve();
        };
      });
    } catch (error) {
      console.error('播放音频块失败:', error);
    }
  },
  
  // 队列TTS请求
  queueTTS: async (character: string, text: string, voiceMapping?: Record<string, string>) => {
    const state = get();
    
    if (!state.ttsEnabled || !state.audioInitialized) {
      console.log('TTS未启用或音频未初始化');
      return;
    }
    
    // 如果传入了voiceMapping，更新store中的voiceMapping
    if (voiceMapping) {
      set({ voiceMapping });
    }
    
    const trimmedText = text.trim();
    if (!trimmedText) return;
    
    // 尝试解析JSON，如果是JSON则跳过
    if (trimmedText.startsWith('{') || trimmedText.startsWith('[')) {
      try {
        JSON.parse(trimmedText);
        return;
      } catch (e) {
        // 不是有效的JSON，可以继续处理
      }
    }
    
    // 限制文本长度
    let processedText = trimmedText;
    if (processedText.length > 500) {
      processedText = processedText.substring(0, 500) + '...';
    }
    
    // 只检查是否正在播放完全相同的内容
    const isCurrentlyPlaying = state.playingLock && 
      character === state.lastPlayedCharacter && 
      processedText === state.lastPlayedText;
    
    if (isCurrentlyPlaying) {
      console.log('检测到正在播放相同内容，跳过:', character, processedText.substring(0, 50));
      return;
    }
    
    console.log('添加TTS到队列:', character, processedText.substring(0, 50));
    console.log(`添加前队列长度: ${state.audioQueue.length}, 播放锁: ${state.playingLock}`);
    
    get().addToQueue({ character, text: processedText });
    
    const newState = get();
    console.log(`添加后队列长度: ${newState.audioQueue.length}`);
    console.log('当前队列内容:', newState.audioQueue.map(item => `${item.character}: ${item.text.substring(0, 30)}`));
    
    // 如果当前没有在播放，立即开始播放队列
    if (!newState.playingLock) {
      console.log('开始处理队列');
      get().playNextInQueue();
    } else {
      console.log('当前正在播放，TTS已添加到队列等待播放');
    }
  },
  
  // 播放队列中的下一个
  playNextInQueue: async () => {
    const state = get();
    
    if (state.audioQueue.length === 0) {
      set({ 
        isPlaying: false, 
        playingLock: false, 
        audioStatus: '等待发言...' 
      });
      console.log('队列为空，停止播放');
      return;
    }
    
    if (state.playingLock) {
      console.log('播放锁激活，跳过队列处理');
      return;
    }
    
    // 设置播放锁和状态
    const item = get().removeFromQueue();
    if (!item) return;
    
    set({ 
      playingLock: true, 
      isPlaying: true,
      audioStatus: `正在播放: ${item.character}`
    });
    
    // 立即设置当前播放内容
    get().setLastPlayed(item.character, item.text);
    
    console.log(`开始播放队列项目: ${item.character} - ${item.text.substring(0, 50)}`);
    
    try {
      const currentState = get();
      const voiceToUse = currentState.voiceMapping[item.character] || item.character;
      console.log(`角色 ${item.character} 使用声音: ${voiceToUse}`);
      
      const response = await fetch(`${config.api.baseUrl}/tts/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: item.text, character: item.character })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('无法获取响应流读取器');
      }
      
      const decoder = new TextDecoder();
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        if (!get().playingLock) {
          console.log('检测到播放停止，中断TTS流处理');
          break;
        }
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.trim()) {
            try {
              let jsonData;
              if (line.startsWith('data: ')) {
                const jsonStr = line.substring(6);
                jsonData = JSON.parse(jsonStr);
              } else {
                jsonData = JSON.parse(line);
              }
              
              if (jsonData.audio) {
                await get().playAudioChunk(jsonData.audio);
              } else if (jsonData.error) {
                throw new Error(jsonData.error);
              }
            } catch (parseError) {
              console.error(`解析数据时出错: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
            }
          }
        }
      }
      
      console.log(`播放完成: ${item.character}`);
    } catch (error) {
      console.error('TTS播放错误:', error);
      set({ audioStatus: '播放出错' });
    } finally {
      // 释放播放锁和重置播放状态
      set({ 
        playingLock: false, 
        isPlaying: false 
      });
      get().clearLastPlayed();
    }
    
    // 检查是否还有待播放项目
    const finalState = get();
    if (finalState.audioQueue.length > 0) {
      console.log(`队列中还有 ${finalState.audioQueue.length} 个项目，继续播放`);
      setTimeout(() => get().playNextInQueue(), 200);
    } else {
      console.log('队列播放完成');
      set({ audioStatus: '播放完成' });
    }
  },
  
  // 停止所有音频
  stopAllAudio: () => {
    get().clearQueue();
    get().clearAudioSources();
    get().clearLastPlayed();
    
    set({ 
      playingLock: false,
      isPlaying: false,
      audioStatus: get().ttsEnabled ? '已停止播放' : '语音播放: 已禁用'
    });
    
    console.log('所有音频已停止，保持音频上下文运行状态');
  },
  
  // 切换TTS
  toggleTTS: () => {
    const state = get();
    const newEnabled = !state.ttsEnabled;
    
    set({ 
      ttsEnabled: newEnabled,
      audioStatus: newEnabled ? '语音播放: 已启用' : '语音播放: 已禁用'
    });
    
    if (!newEnabled) {
      get().stopAllAudio();
    }
  }
}));