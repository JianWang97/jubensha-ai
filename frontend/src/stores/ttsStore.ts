import { create } from 'zustand';

interface TTSQueueItem {
  character: string;
  text: string;
  voice?: string;
  audioUrl?: string; // 仅支持已生成的音频URL
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
  queueTimer: NodeJS.Timeout | null;
  
  // 核心功能
  initializeAudio: () => Promise<void>;
  playNext: () => void;
  queueTTS: (character: string, text: string, voice?: string, audioUrl?: string) => void;
  toggleTTS: () => void;
  startQueueProcessor: () => void;
  stopQueueProcessor: () => void;
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
  queueTimer: null,
  
  
  // 初始化音频
  initializeAudio: async () => {
    const state = get();
    if (state.audioInitialized) return;
    
    try {
      const context = new (window.AudioContext || (window as unknown as typeof window.AudioContext))();
      
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
  queueTTS: (character: string, text: string, voice?: string, audioUrl?: string) => {
    const state = get();
    
    if (!state.ttsEnabled || !text.trim()) return;
    
    // 简单的重复检查
    const isDuplicate = state.audioQueue.some(item => 
      item.character === character && item.text === text && (!!item.audioUrl === !!audioUrl)
    );
    
    if (isDuplicate) return;
    
    // 限制文本长度
    const processedText = text.length > 500 ? text.substring(0, 500) + '...' : text;
    
    set(state => ({
      audioQueue: [...state.audioQueue, { character, text: processedText, voice, audioUrl }]
    }));
  },
  
  // 播放音频块
  // 已移除流式音频块播放逻辑（统一通过已生成的URL播放）
  
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
      if (item.audioUrl) {
        // 播放已生成音频
        const resp = await fetch(item.audioUrl);
        if (!resp.ok) throw new Error(`获取音频失败: ${resp.status}`);
        const arrayBuf = await resp.arrayBuffer();
        const ctx = get().audioContext;
        if (ctx) {
          const audioBuffer = await ctx.decodeAudioData(arrayBuf.slice(0));
          const source = ctx.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(ctx.destination);
          source.start();
          await new Promise<void>(resolve => source.onended = () => resolve());
        } else {
          await new Promise<void>((resolve, reject) => {
            const audioEl = new Audio(item.audioUrl);
            audioEl.onended = () => resolve();
            audioEl.onerror = () => reject(new Error('HTMLAudio 播放失败'));
            audioEl.play().catch(reject);
          });
        }
      } else {
        // 没有音频URL则直接跳过播放
        console.debug('[TTS] 跳过：无可播放音频URL');
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
export const useTTSService = () => {
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
  } = useTTSStore();



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