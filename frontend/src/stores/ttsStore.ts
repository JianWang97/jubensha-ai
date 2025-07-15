import { create } from 'zustand';
import { useEffect } from 'react';
import { useConfigStore } from './configStore';

interface TTSQueueItem {
  character: string;
  text: string;
}

interface TTSState {
  // 核心状态
  ttsEnabled: boolean;
  isPlaying: boolean;
  audioInitialized: boolean;
  audioQueue: TTSQueueItem[];
  currentSpeakingCharacter: string | null;
  currentSpeechText: string | null;
  
  // 音频相关
  audioContext: AudioContext | null;
  voiceMapping: Record<string, string>;
  queueTimer: NodeJS.Timeout | null;
  
  // 核心功能
  initializeAudio: () => Promise<void>;
  playNext: () => void;
  queueTTS: (character: string, text: string) => void;
  toggleTTS: () => void;
  playAudioChunk: (audioData: string) => Promise<void>;
  startQueueProcessor: () => void;
  stopQueueProcessor: () => void;
  setVoiceMapping: (mapping: Record<string, string>) => void;
}

export const useTTSStore = create<TTSState>((set, get) => ({
  // 初始状态
  ttsEnabled: true,
  isPlaying: false,
  audioInitialized: false,
  audioQueue: [],
  currentSpeakingCharacter: null,
  currentSpeechText: null,
  audioContext: null,
  voiceMapping: {},
  queueTimer: null,
  
  // 设置语音映射
  setVoiceMapping: (mapping) => set({ voiceMapping: mapping }),
  
  // 初始化音频
  initializeAudio: async () => {
    const state = get();
    if (state.audioInitialized) return;
    
    try {
      const context = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      if (context.state === 'suspended') {
        await context.resume();
      }
      
      set({ 
        audioContext: context, 
        audioInitialized: true,
        ttsEnabled: true
      });
      
      console.log('音频初始化成功');
    } catch (error) {
      console.error('音频初始化失败:', error);
      throw error;
    }
  },
  
  // 添加到TTS队列
  queueTTS: (character: string, text: string) => {
    const state = get();
    
    if (!state.ttsEnabled || !text.trim()) return;
    
    // 简单的重复检查
    const isDuplicate = state.audioQueue.some(item => 
      item.character === character && item.text === text
    );
    
    if (isDuplicate) return;
    
    // 限制文本长度
    const processedText = text.length > 500 ? text.substring(0, 500) + '...' : text;
    
    set(state => ({
      audioQueue: [...state.audioQueue, { character, text: processedText }]
    }));
  },
  
  // 播放音频块
  playAudioChunk: async (audioData: string) => {
    const state = get();
    if (!state.audioContext) return;
    
    try {
      const binaryString = atob(audioData);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const audioBuffer = new Int16Array(bytes.buffer);
      const buffer = state.audioContext.createBuffer(1, audioBuffer.length, 24000);
      const channelData = buffer.getChannelData(0);
      
      for (let i = 0; i < audioBuffer.length; i++) {
        channelData[i] = audioBuffer[i] / 32768.0;
      }
      
      const source = state.audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(state.audioContext.destination);
      source.start();
      
      return new Promise<void>((resolve) => {
        source.onended = () => resolve();
      });
    } catch (error) {
      console.error('播放音频块失败:', error);
    }
  },
  
  // 播放下一个队列项目
  playNext: async () => {
    const state = get();
    
    if (state.audioQueue.length === 0 || state.isPlaying || !state.audioInitialized) {
      return;
    }
    
    const item = state.audioQueue[0];
    set(state => ({
      audioQueue: state.audioQueue.slice(1),
      isPlaying: true,
      currentSpeakingCharacter: item.character,
      currentSpeechText: item.text
    }));
    
    try {
      const config = useConfigStore.getState();
      const response = await fetch(`${config.api.baseUrl}/tts/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: item.text, character: item.character })
      });
      
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const reader = response.body?.getReader();
      if (!reader) throw new Error('无法获取响应流读取器');
      
      const decoder = new TextDecoder();
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.trim()) {
            try {
              const jsonData = JSON.parse(line.startsWith('data: ') ? line.substring(6) : line);
              if (jsonData.audio) {
                await get().playAudioChunk(jsonData.audio);
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }
    } catch (error) {
      console.error('TTS播放错误:', error);
    } finally {
      set({ 
        isPlaying: false,
        currentSpeakingCharacter: null,
        currentSpeechText: null
      });
    }
  },
  
  // 切换TTS开关
  toggleTTS: () => {
    const state = get();
    const newEnabled = !state.ttsEnabled;
    
    set({ ttsEnabled: newEnabled });
    
    if (!newEnabled) {
      set({ 
        audioQueue: [],
        isPlaying: false,
        currentSpeakingCharacter: null,
        currentSpeechText: null
      });
    }
  },
  
  // 启动队列处理器
  startQueueProcessor: () => {
    const state = get();
    if (state.queueTimer) {
      clearInterval(state.queueTimer);
    }
    
    const timer = setInterval(() => {
      get().playNext();
    }, 200);
    
    set({ queueTimer: timer });
  },
  
  // 停止队列处理器
  stopQueueProcessor: () => {
    const state = get();
    if (state.queueTimer) {
      clearInterval(state.queueTimer);
      set({ queueTimer: null });
    }
  }
}));

// TTS Service Hook
export const useTTSService = (voiceMapping: Record<string, string>) => {
  const {
    ttsEnabled,
    isPlaying,
    audioInitialized,
    queueTTS,
    toggleTTS,
    initializeAudio,
    startQueueProcessor,
    stopQueueProcessor,
    currentSpeakingCharacter,
    currentSpeechText,
    setVoiceMapping
  } = useTTSStore();

  useEffect(() => {
    setVoiceMapping(voiceMapping);
  }, [voiceMapping, setVoiceMapping]);

  return {
    ttsEnabled,
    isPlaying,
    audioInitialized,
    audioStatus: ttsEnabled ? (isPlaying ? '正在播放' : '等待发言') : '已禁用',
    queueTTS,
    toggleTTS,
    initializeAudio,
    startQueueProcessor,
    stopQueueProcessor,
    currentSpeakingCharacter,
    currentSpeechText,
    stopAllAudio: () => useTTSStore.getState().toggleTTS() // 简化为切换功能
  };
};