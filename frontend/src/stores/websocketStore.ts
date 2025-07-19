import { create } from 'zustand';
import { useEffect } from 'react';
import { useConfigStore } from './configStore';
import { useTTSStore } from './ttsStore';

export interface GameState {
  phase: string;
  events: Array<{
    character: string;
    content: string;
  }>;
  discovered_evidence?: Array<{
    name: string;
    description: string;
    location: string;
  }>;
}

export interface WebSocketMessage {
  type: string;
  data?: any;
  message?: string;
}

export interface VoiceMapping {
  [character: string]: string;
}

interface WebSocketState {
  // 连接状态
  isConnected: boolean;
  gameState: GameState | null;
  currentSessionId: string | null;

  // WebSocket实例
  ws: WebSocket | null;
  reconnectTimeout: NodeJS.Timeout | null;

  // Actions
  setIsConnected: (connected: boolean) => void;
  setGameState: (state: GameState | null) => void;
  setCurrentSessionId: (sessionId: string | null) => void;
  setWebSocket: (ws: WebSocket | null) => void;
  setReconnectTimeout: (timeout: NodeJS.Timeout | null) => void;

  // WebSocket操作
  connect: (sessionId?: string, scriptId?: number) => void;
  disconnect: () => void;
  sendMessage: (message: any) => void;

  // 游戏操作
  startGame: (scriptId: string) => void;
  nextPhase: () => void;
  resetGame: () => void;

  // 辅助方法
  handleMessage: (message: WebSocketMessage) => void;
  generateRoomId: () => string;
}

export const useWebSocketStore = create<WebSocketState>((set, get) => ({
  // 初始状态
  isConnected: false,
  gameState: null,
  voiceMapping: {},
  currentSessionId: null,
  ws: null,
  reconnectTimeout: null,

  // 基础状态设置
  setIsConnected: (connected) => set({ isConnected: connected }),
  setGameState: (state) => set({ gameState: state }),
  setCurrentSessionId: (sessionId) => set({ currentSessionId: sessionId }),
  setWebSocket: (ws) => set({ ws }),
  setReconnectTimeout: (timeout) => set({ reconnectTimeout: timeout }),


  // 处理WebSocket消息
  handleMessage: (message: WebSocketMessage) => {
    console.log('收到消息:', message);
    const state = get();

    // 验证session_id
    const messageSessionId = message.data?.session_id || (message as any).session_id;

    // 如果消息包含session_id且与当前session_id不匹配，则忽略该消息
    if (messageSessionId && state.currentSessionId && messageSessionId !== state.currentSessionId) {
      console.warn(`忽略来自不同会话的消息: 消息session_id=${messageSessionId}, 当前session_id=${state.currentSessionId}`);
      return;
    }

    // 如果消息包含session_id但当前没有session_id，则更新当前session_id
    if (messageSessionId && !state.currentSessionId) {
      console.log(`更新当前session_id: ${messageSessionId}`);
      set({ currentSessionId: messageSessionId });
    }

    switch (message.type) {
      case 'game_state':
      case 'game_state_update':
        set({ gameState: message.data });
        break;

      case 'game_started':
        // 游戏开始处理
        break;

      case 'ai_action':
        // AI行动处理 - 直接将action转换为事件格式
        if (message.data && message.data.character && message.data.action) {
          set((state) => {
            if (!state.gameState) return state;
            console.log('收到AI行动:', message.data);
            // 创建新的事件
            const newEvent = {
              character: message.data.character,
              content: message.data.action
            };
            // 添加到现有事件列表中
            const updatedEvents = [...(state.gameState.events || []), newEvent];
            const ttsStore = useTTSStore.getState();
            const voiceId = message.data.voice_id;
            ttsStore.queueTTS(message.data.character, message.data.action, voiceId);
            return {
              ...state,
              gameState: {
                ...state.gameState,
                events: updatedEvents,
                discovered_evidence: message.data.discovered_evidence || state.gameState.discovered_evidence
              }
            };
          });
        }
        break;

      case 'phase_changed':
        set({ gameState: message.data.game_state });
        break;

      case 'voting_complete':
        // 投票完成处理
        break;

      case 'game_result':
        // 游戏结果处理
        break;

      case 'game_ended':
        // 游戏结束处理
        console.log('游戏已结束:', message.data?.message);
        
        // 添加TTS语音播报
        if (message.data?.message) {
          const ttsStore = useTTSStore.getState();
          ttsStore.queueTTS('系统', message.data.message, 'female-shaonv');
        }
        
        // 可以在这里添加游戏结束的UI提示或其他处理逻辑
        break;

      case 'game_reset':
        // 游戏重置处理
        set({ gameState: null });
        break;

      case 'error':
        console.error('游戏错误:', message.message);
        break;
    }
  },

  // 生成唯一的房间ID
  generateRoomId: () => {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 8);
    return `room_${timestamp}_${randomStr}`;
  },

  // 连接WebSocket
  connect: (sessionId?: string, scriptId?: number) => {
    const state = get();

    // 如果已经有连接且状态正常，不重复连接
    if (state.ws && (state.ws.readyState === WebSocket.CONNECTING || state.ws.readyState === WebSocket.OPEN)) {
      console.log('WebSocket已连接或正在连接中，跳过重复连接');
      return;
    }

    // 清理现有连接
    if (state.ws) {
      state.ws.close();
    }

    // 如果没有传入sessionId且当前也没有sessionId，自动生成一个
    let finalSessionId = sessionId;
    if (!finalSessionId && !state.currentSessionId) {
      finalSessionId = get().generateRoomId();
      console.log('自动生成房间ID:', finalSessionId);
    }

    // 如果传入了sessionId或生成了新的sessionId，更新当前sessionId
    if (finalSessionId && finalSessionId !== state.currentSessionId) {
      set({ currentSessionId: finalSessionId });
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // 从API配置中提取后端端口
    const config = useConfigStore.getState();
    const apiUrl = new URL(config.api.baseUrl);
    const backendPort = apiUrl.port || '8010';

    // 构建WebSocket URL，包含session_id和script_id参数
    const params = new URLSearchParams();
    const currentSessionId = finalSessionId || state.currentSessionId;
    if (currentSessionId) {
      params.append('session_id', currentSessionId);
    }
    if (scriptId) {
      params.append('script_id', scriptId.toString());
    }

    const wsUrl = `${protocol}//${apiUrl.hostname}:${backendPort}/ws${params.toString() ? '?' + params.toString() : ''}`;
    console.log('正在连接WebSocket:', wsUrl);

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket连接已建立');
      set({ isConnected: true });
    };

    ws.onmessage = (event) => {
      const message: WebSocketMessage = JSON.parse(event.data);
      get().handleMessage(message);
    };

    ws.onclose = () => {
      console.log('WebSocket连接已关闭');
      set({ isConnected: false });
      // 只有在非主动断开的情况下才重连
      if (get().ws === ws) {
        const timeout = setTimeout(() => {
          console.log('尝试重新连接WebSocket...');
          get().connect(sessionId, scriptId);
        }, 3000);
        set({ reconnectTimeout: timeout });
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket错误:', error);
      set({ isConnected: false });
    };

    set({ ws });
  },

  // 断开连接
  disconnect: () => {
    const state = get();

    if (state.reconnectTimeout) {
      clearTimeout(state.reconnectTimeout);
      set({ reconnectTimeout: null });
    }

    if (state.ws) {
      state.ws.close();
      set({ ws: null, isConnected: false });
    }
  },

  // 发送消息
  sendMessage: (message: any) => {
    const state = get();

    if (state.ws && state.ws.readyState === WebSocket.OPEN) {
      // 在消息中添加session_id
      const messageWithSession = {
        ...message,
        session_id: state.currentSessionId
      };
      state.ws.send(JSON.stringify(messageWithSession));
    } else {
      console.error('WebSocket未连接');
    }
  },

  // 开始游戏
  startGame: (scriptId: string) => {
    get().sendMessage({ type: 'start_game', script_id: scriptId });
  },

  // 下一阶段
  nextPhase: () => {
    get().sendMessage({ type: 'next_phase' });
  },

  // 重置游戏
  resetGame: () => {
    get().sendMessage({ type: 'reset_game' });
  }
}));

// WebSocket Hook - 兼容原有的useWebSocket接口
export const useWebSocket = (sessionId?: string, scriptId?: number) => {
  const {
    isConnected,
    gameState,
    currentSessionId,
    connect,
    disconnect,
    sendMessage,
    startGame,
    nextPhase,
    resetGame
  } = useWebSocketStore();

  // 连接WebSocket
  useEffect(() => {
    connect(sessionId, scriptId);
  }, [sessionId, scriptId]);

  // 组件卸载时断开连接
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []); // 空依赖数组，只在组件卸载时执行

  return {
    isConnected,
    gameState,
    currentSessionId,
    sendMessage,
    startGame,
    nextPhase,
    resetGame
  };
};