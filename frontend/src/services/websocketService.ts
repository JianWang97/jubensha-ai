import { useEffect, useRef, useState, useCallback } from 'react';
import { config } from '@/config';

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

export const useWebSocket = (sessionId?: string, scriptId?: number) => {
  const [isConnected, setIsConnected] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [voiceMapping, setVoiceMapping] = useState<VoiceMapping>({});
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(sessionId || null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const loadVoiceMapping = useCallback(async () => {
    try {
      // 使用配置的API基础URL
      const response = await fetch(`${config.api.baseUrl}/voices`);
      const data = await response.json();
      if (data.status === 'success') {
        setVoiceMapping(data.data.mapping);
        console.log('声音映射已加载:', data.data.mapping);
      }
    } catch (error) {
      console.error('加载声音映射失败:', error);
    }
  }, []);

  const handleMessage = useCallback((message: WebSocketMessage) => {
    console.log('收到消息:', message);
    
    // 更新session_id（如果消息中包含）
    if (message.data?.session_id || (message as any).session_id) {
      const sessionId = message.data?.session_id || (message as any).session_id;
      if (sessionId !== currentSessionId) {
        setCurrentSessionId(sessionId);
      }
    }
    
    switch(message.type) {
      case 'game_state':
      case 'game_state_update':
        setGameState(message.data);
        break;
        
      case 'game_started':
        // 游戏开始处理
        loadVoiceMapping();
        break;
        
      case 'ai_action':
        // AI行动处理 - 直接将action转换为事件格式
        if (message.data && message.data.character && message.data.action) {
          setGameState(prevState => {
            console.log(prevState);
            
            if (!prevState) return prevState;
            console.log('收到AI行动:', message.data);
            
            // 创建新的事件
            const newEvent = {
              character: message.data.character,
              content: message.data.action
            };
            
            // 添加到现有事件列表中
            const updatedEvents = [...(prevState.events || []), newEvent];
            
            return {
              ...prevState,
              events: updatedEvents,
              discovered_evidence: message.data.discovered_evidence || prevState.discovered_evidence
            };
          });
        }
        break;
        
      case 'phase_changed':
        setGameState(message.data.game_state);
        break;
        
      case 'voting_complete':
        // 投票完成处理
        break;
        
      case 'game_result':
        // 游戏结果处理
        break;
        
      case 'game_reset':
        // 游戏重置处理
        setGameState(null);
        break;
        
      case 'error':
        console.error('游戏错误:', message.message);
        break;
    }
  }, [loadVoiceMapping]);

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // 从API配置中提取后端端口
    const apiUrl = new URL(config.api.baseUrl);
    const backendPort = apiUrl.port || '8010';
    
    // 构建WebSocket URL，包含session_id和script_id参数
    const params = new URLSearchParams();
    if (currentSessionId) {
      params.append('session_id', currentSessionId);
    }
    if (scriptId) {
      params.append('script_id', scriptId.toString());
    }
    
    const wsUrl = `${protocol}//${apiUrl.hostname}:${backendPort}/ws${params.toString() ? '?' + params.toString() : ''}`;
    
    wsRef.current = new WebSocket(wsUrl);
    
    wsRef.current.onopen = () => {
      console.log('WebSocket连接已建立');
      setIsConnected(true);
      loadVoiceMapping();
    };
    
    wsRef.current.onmessage = (event) => {
      const message: WebSocketMessage = JSON.parse(event.data);
      handleMessage(message);
    };
    
    wsRef.current.onclose = () => {
      console.log('WebSocket连接已关闭');
      setIsConnected(false);
      // 尝试重连
      reconnectTimeoutRef.current = setTimeout(connect, 3000);
    };
    
    wsRef.current.onerror = (error) => {
      console.error('WebSocket错误:', error);
      setIsConnected(false);
    };
  }, [handleMessage, loadVoiceMapping]);

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      // 在消息中添加session_id
      const messageWithSession = {
        ...message,
        session_id: currentSessionId
      };
      wsRef.current.send(JSON.stringify(messageWithSession));
    } else {
      console.error('WebSocket未连接');
    }
  }, [currentSessionId]);

  const startGame = useCallback((scriptId: string) => {
    sendMessage({ type: 'start_game', script_id: scriptId });
  }, [sendMessage]);

  const nextPhase = useCallback(() => {
    sendMessage({ type: 'next_phase' });
  }, [sendMessage]);

  const resetGame = useCallback(() => {
    sendMessage({ type: 'reset_game' });
  }, [sendMessage]);

  useEffect(() => {
    connect();
    
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect, currentSessionId, scriptId]);

  return {
    isConnected,
    gameState,
    voiceMapping,
    currentSessionId,
    sendMessage,
    startGame,
    nextPhase,
    resetGame
  };
};