/* eslint-disable @typescript-eslint/no-explicit-any */
import { authService } from '@/services/authService';
import { useEffect } from 'react';
import { create } from 'zustand';
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

export interface HistoryData {
  events: Array<{
    character: string;
    content: string;
  }>;
  public_chat: Array<{
    character: string;
    content: string;
  }>;
  truncated: boolean;
  newest_event_id: number;
  earliest_event_id: number;
}

export interface WebSocketMessage {
  type: string;
  data?: Record<string, any>;
  message?: string;
  start_mode?: 'new' | 'resume' | 'already_running';
}



interface WebSocketState {
  // 连接状态
  isConnected: boolean;
  gameState: GameState | null;
  gameStartMode?: 'new' | 'resume' | 'already_running';
  // 会话 / 游戏运行状态扩展
  isGameRunning?: boolean; // 当前是否有进行中的游戏
  gameInitialized?: boolean; // 是否已经初始化过（可以用于决定显示"开始"还是"继续"）
  activeGame?: Record<string, any> | null; // 后端发来的 active_game 原始数据（仅在运行时）
  sessionId?: string; // 会话ID，用于后台模式等功能

  // WebSocket实例
  ws: WebSocket | null;
  reconnectTimeout: NodeJS.Timeout | null;



  // WebSocket操作
  connect: (scriptId?: number) => void;
  disconnect: () => void;
  sendMessage: (message: Record<string, unknown>) => void;

  // 游戏操作
  startGame: (scriptId: string) => void;
  nextPhase: () => void;
  resetGame: () => void;
  fetchHistory: () => void;

  // 辅助方法
  handleMessage: (message: WebSocketMessage) => void;
}

export const useWebSocketStore = create<WebSocketState>((set, get) => ({
  // 初始状态
  isConnected: false,
  gameState: null,
  gameStartMode: undefined,
  isGameRunning: undefined,
  gameInitialized: undefined,
  activeGame: null,
  sessionId: undefined,
  ws: null,
  reconnectTimeout: null,




  // 处理WebSocket消息
  handleMessage: (message: WebSocketMessage) => {
    console.log('收到消息:', message);

    switch (message.type) {
      case 'game_state':
      case 'game_state_update':
        set({ gameState: message.data as GameState });
        break;

      case 'session_connected': {
        // 新的会话初始化消息，包含会话与游戏状态
        const data = (message.data || {}) as Record<string, any>;
        const { is_game_running, game_initialized, active_game } = data;
        // 提取session_id，优先从message.session_id，其次从message.data.session_id
        const sessionId = (message as any).session_id || data.session_id;
        // 兼容字段解析
        let derivedGameState: GameState | null = null;
        if (active_game) {
          // 后端可能直接把game_state展开或放在 active_game.game_state / active_game.state
            derivedGameState = (active_game.game_state || active_game.state || null) as GameState | null;
            // 如果没有嵌套但 active_game 自身就像 GameState，也做一次兜底判断（存在 phase 与 events）
            if (!derivedGameState && active_game.phase && Array.isArray(active_game.events)) {
              derivedGameState = {
                phase: active_game.phase,
                events: active_game.events || [],
                discovered_evidence: active_game.discovered_evidence || active_game.evidence || []
              } as GameState;
            }
        }
        set({
          isGameRunning: is_game_running,
          gameInitialized: game_initialized,
          activeGame: active_game || null,
          gameState: derivedGameState,
          sessionId: sessionId || null
        });
        // 推送一个自定义事件，方便界面或其他逻辑监听
        window.dispatchEvent(new CustomEvent('session_connected', {
          detail: {
            isGameRunning: is_game_running,
            gameInitialized: game_initialized,
            activeGame: active_game,
            gameState: derivedGameState
          }
        }));
        break;
      }

      case 'game_started':
        // 游戏开始 / 继续
        set((state) => ({
          gameStartMode: message.start_mode || state.gameStartMode,
          isGameRunning: true,
          gameInitialized: true
        }));
        break;

      case 'ai_action':
        // AI行动处理 - 直接将action转换为事件格式
        if (message.data && (message.data as any).character && (message.data as any).action) {
          set((state) => {
            if (!state.gameState) return state;
            // 创建新的事件
            const data = message.data as Record<string, any>;
            const newEvent = {
              character: data.character,
              content: data.action
            };
            // 添加到现有事件列表中
            const updatedEvents = [...(state.gameState.events || []), newEvent];
            const ttsStore = useTTSStore.getState();
            // 兼容多种可能字段: tts_status / tts_url / audio_url / speech_url / tts_voice / voice_id
            const ttsStatus = data.tts_status || data.status;
            const ttsUrl = data.tts_url || data.audio_url || data.speech_url || data.ttsAudioUrl;
            const voiceId = data.tts_voice || data.voice_id || data.voice;
            // 放宽条件：只要有可用的音频URL且启用tts就加入队列（若后端仍使用completed则保持兼容）
            if (ttsStore.ttsEnabled && ttsUrl && (ttsStatus === 'completed' || !ttsStatus || ttsStatus === 'ready')) {
              // 自动初始化音频（若尚未初始化）
              if (!ttsStore.audioInitialized) {
                ttsStore.initializeAudio().catch(() => {});
              }
              ttsStore.queueTTS(data.character, data.action, voiceId, ttsUrl);
              // 确保队列处理器已启动
              if (!ttsStore.queueTimer) {
                ttsStore.startQueueProcessor();
              }
            }
            return {
              ...state,
              gameState: {
                ...state.gameState,
                events: updatedEvents,
                discovered_evidence: data.discovered_evidence || state.gameState.discovered_evidence
              }
            };
          });
        }
        break;

      case 'phase_changed':
        message.data = message.data as Record<string, any>;
        set({ gameState: message.data.game_state });
        break;

      case 'voting_complete':
      case 'game_result':
        // 投票完成和游戏结果处理
        break;

      case 'game_ended':
        console.log('游戏已结束:', message.data?.message);
        set({ isGameRunning: false, gameInitialized: true });
        break;

      case 'game_reset':
        set({ gameState: null, isGameRunning: false, gameInitialized: false });
        break;

      case 'instruction_processing':
      case 'edit_result':
      case 'instruction_completed':
      case 'script_data_update':
      case 'script_editing_started':
      case 'script_editing_stopped':
      case 'ai_suggestion':
      case 'ai_suggestion_generating':
        // 剧本编辑相关消息统一处理
        console.log(`${message.type}:`, message.data);
        window.dispatchEvent(new CustomEvent('script_edit_result', {
          detail: {
            type: message.type,
            data: message.data
          }
        }));
        break;

      case 'script_edit_result':
        // 剧本编辑结果处理（保持向后兼容）
        console.log('剧本编辑结果:', message.data);
        window.dispatchEvent(new CustomEvent('script_edit_result', {
          detail: message
        }));
        break;

      case 'script_edit_error':
        // 剧本编辑错误处理（保持向后兼容）
        console.error('剧本编辑错误:', message.data);
        window.dispatchEvent(new CustomEvent('script_edit_result', {
          detail: {
            type: 'script_edit_error',
            data: {
              success: false,
              message: message.data?.message || '编辑操作失败',
              message_id: message.data?.message_id
            }
          }
        }));
        break;

      case 'history':
        // 处理历史消息
        if (message.data) {
          const historyData = message.data as HistoryData;
          console.log('收到历史消息:', historyData);
          
          set((state) => {
            if (!state.gameState) return state;
            
            // 合并历史事件到当前游戏状态，避免重复
            const existingEvents = state.gameState.events || [];
            const newEvents = historyData.events || [];
            
            // 简单去重：基于character和content的组合
            const eventSet = new Set(existingEvents.map(e => `${e.character}:${e.content}`));
            const uniqueNewEvents = newEvents.filter(e => !eventSet.has(`${e.character}:${e.content}`));
            
            const mergedEvents = [...existingEvents, ...uniqueNewEvents];
            
            return {
              ...state,
              gameState: {
                ...state.gameState,
                events: mergedEvents
              }
            };
          });
          
          // 将public_chat添加到游戏日志中（通过自定义事件通知其他组件）
          if (historyData.public_chat && historyData.public_chat.length > 0) {
            window.dispatchEvent(new CustomEvent('history_chat_received', {
              detail: historyData.public_chat
            }));
          }
        }
        break;

      case 'background_mode_response':
        console.log('后台模式响应:', message.data);
        window.dispatchEvent(new CustomEvent('background_mode_response', {
          detail: message.data
        }));
        break;

      case 'error':
        console.error('游戏错误:', message.message);
        break;
    }
  },

  // 连接WebSocket
  connect: (scriptId?: number) => {
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

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // 从API配置中提取后端端口
    const config = useConfigStore.getState();
    const apiUrl = new URL(config.api.baseUrl);
    const backendPort = apiUrl.port || '8010';

    // 构建WebSocket URL，包含script_id和token参数
    const params = new URLSearchParams();
    if (scriptId) {
      params.append('script_id', scriptId.toString());
    }
    
    // 添加token参数用于身份验证
    const token = authService.getToken();
    if (token) {
      params.append('token', token);
    }

    const wsUrl = `${protocol}//${apiUrl.hostname}:${backendPort}/ws${params.toString() ? '?' + params.toString() : ''}`;
    console.log('正在连接WebSocket:', wsUrl);

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket连接已建立');
      set({ isConnected: true });
      
      // 如果有scriptId，自动启动编辑模式
      if (scriptId) {
        console.log('自动启动剧本编辑模式, script_id:', scriptId);
        setTimeout(() => {
          get().sendMessage({
            type: 'start_script_editing',
            script_id: scriptId
          });
        }, 100); // 稍微延迟确保连接稳定
      }
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
          get().connect(scriptId);
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
  sendMessage: (message: Record<string, unknown>) => {
    const state = get();

    if (state.ws && state.ws.readyState === WebSocket.OPEN) {
      state.ws.send(JSON.stringify(message));
    } else {
      console.error('WebSocket未连接');
    }
  },

  // 开始游戏
  startGame: (scriptId: string) => {
    set({ isGameRunning: true, gameInitialized: true });
    get().sendMessage({ type: 'start_game', script_id: scriptId });
    setTimeout(() => get().fetchHistory(), 500);
  },

  // 下一阶段
  nextPhase: () => {
    get().sendMessage({ type: 'next_phase' });
  },

  // 重置游戏
  resetGame: () => {
    get().sendMessage({ type: 'reset_game' });
  },

  // 获取历史消息
  fetchHistory: () => {
    get().sendMessage({ type: 'fetch_history' });
  }
}));

// WebSocket Hook - 兼容原有的useWebSocket接口
export const useWebSocket = (scriptId?: number) => {
  const {
    isConnected,
    gameState,
    isGameRunning,
    gameInitialized,
    connect,
    disconnect,
    sendMessage,
    startGame,
    nextPhase,
    resetGame
  } = useWebSocketStore();

  useEffect(() => {
    connect(scriptId);
    return () => disconnect();
  }, [scriptId, connect, disconnect]);

  return {
    isConnected,
    gameState,
    isGameRunning,
    gameInitialized,
    sendMessage,
    startGame,
    nextPhase,
    resetGame
  };
};