import { useState, useCallback, useEffect, useRef } from 'react';
import { useWebSocket, GameState } from '@/stores/websocketStore';
import { Script_Output as Script, ScriptCharacter, Service } from '@/client';
import { ScriptsService } from '@/client';
import { toast } from 'sonner';

export interface GameLogEntry {
  character: string;
  content: string;
  timestamp: Date;
}

export interface VoteResult {
  [voter: string]: string;
}

export interface GameResult {
  success: boolean;
  murderer: string;
  victim: string;
  most_voted: string;
  vote_counts: { [name: string]: number };
}

export const useGameState = (scriptId?: number) => {
  const { isConnected, gameState, sendMessage, startGame, nextPhase, resetGame } = useWebSocket(scriptId);
  // 使用 client services 替代 useApiClient
  const getCharacters = async (scriptId: number) => {
    const response = await Service.getCharactersApiCharactersScriptIdCharactersGet(scriptId);
    if(!response.success){
      throw new Error(response.message);
    }
    return response.data;
  };
  
  const getScript = async (scriptId: number) => {
    const response = await ScriptsService.getScriptApiScriptsScriptIdGet(scriptId);
    if(!response.success){
      throw new Error(response.message);
    }
    return response.data;
  };
  const [selectedScript, setSelectedScript] = useState<Script | null>(null);
  const [characters, setCharacters] = useState<ScriptCharacter[]>([]);
  const [gameLog, setGameLog] = useState<GameLogEntry[]>([
    {
      character: '系统',
      content: '欢迎来到AI剧本杀游戏！选择剧本开始体验。',
      timestamp: new Date()
    }
  ]);
  const [currentPhase, setCurrentPhase] = useState<string>('等待开始');
  const [votes, setVotes] = useState<VoteResult | null>(null);
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [isGameStarted, setIsGameStarted] = useState(false);
  const processedEventsCountRef = useRef<number>(0);

  // 阶段显示名称映射
  const getPhaseDisplayName = useCallback((phase: string) => {
    const phaseNames: { [key: string]: string } = {
      'introduction': '自我介绍',
      'evidence_collection': '搜证阶段',
      'investigation': '调查取证',
      'discussion': '自由讨论',
      'voting': '投票表决',
      'revelation': '真相揭晓',
      'ended': '游戏结束'
    };
    return phaseNames[phase] || phase;
  }, []);

  // 添加游戏日志
  const addLogEntry = useCallback((character: string, content: string) => {
    const newEntry: GameLogEntry = {
      character,
      content,
      timestamp: new Date()
    };
    setGameLog(prev => [...prev, newEntry]);
  }, []);

  // 加载角色信息
  const loadCharacters = useCallback(async (scriptId: number) => {
    try {
      const charactersData = await getCharacters(scriptId);
      setCharacters(charactersData!);
    } catch (error) {
      console.error('加载角色信息失败:', error);
    }
  }, []);

  // 处理剧本选择
  const handleSelectScript = useCallback((script: Script) => {
    setSelectedScript(script);
    loadCharacters(script.info.id!);
    // 重置游戏状态
    setGameLog([
      {
        character: '系统',
        content: `已选择剧本: ${script.info.title}`,
        timestamp: new Date()
      }
    ]);
    setVotes(null);
    setGameResult(null);
    setIsGameStarted(false);
  }, [loadCharacters]);

  // 开始游戏
  const handleStartGame = useCallback(() => {
    if (!selectedScript) {
      toast('请先选择一个剧本！');
      return;
    }
    startGame(selectedScript.info.id!.toString());
    setIsGameStarted(true);
    addLogEntry('系统', '游戏开始！');
  }, [selectedScript, startGame, addLogEntry]);

  // 下一阶段
  const handleNextPhase = useCallback(() => {
    nextPhase();
  }, [nextPhase]);

  // 重置游戏
  const handleResetGame = useCallback(() => {
    resetGame();
    setGameLog([
      {
        character: '系统',
        content: '游戏已重置，选择剧本重新开始。',
        timestamp: new Date()
      }
    ]);
    setVotes(null);
    setGameResult(null);
    setIsGameStarted(false);
    setCurrentPhase('等待开始');
    processedEventsCountRef.current = 0; // 重置已处理事件计数
  }, [resetGame]);

  // 自动加载URL参数中指定的剧本
  useEffect(() => {
    if (scriptId && !selectedScript) {
      const loadScriptFromUrl = async () => {
        try {
          const script = await getScript(scriptId);
          setSelectedScript(script!);
          loadCharacters(scriptId);
          setGameLog([
            {
              character: '系统',
              content: `已自动选择剧本: ${script!.info.title}`,
              timestamp: new Date()
            }
          ]);
        } catch (error) {
          console.error('自动加载剧本失败:', error);
          addLogEntry('系统', '自动加载剧本失败，请手动选择剧本。');
          // 添加一个更明确的错误提示
          setGameLog(prev => [
            ...prev,
            {
              character: '系统',
              content: `错误：无法加载ID为${scriptId}的剧本，可能是剧本不存在或者无访问权限。`,
              timestamp: new Date()
            }
          ]);
        }
      };
      loadScriptFromUrl();
    }
  }, [scriptId, selectedScript, loadCharacters, addLogEntry]);

  // 监听WebSocket消息并更新状态
  useEffect(() => {
    if (gameState) {
      setCurrentPhase(getPhaseDisplayName(gameState.phase));
      
      // 处理游戏事件 - 使用ref跟踪已处理的事件数量
      if (gameState.events && gameState.events.length > processedEventsCountRef.current) {
        // 只处理新增的事件
        const newEvents = gameState.events.slice(processedEventsCountRef.current);

        newEvents.forEach(event => {
          addLogEntry(event.character, event.content);
        });
        processedEventsCountRef.current = gameState.events.length;
      }
    }
  }, [gameState, getPhaseDisplayName, addLogEntry]); // 移除gameLog依赖，避免循环

  // 监听历史聊天消息事件
  useEffect(() => {
    const handleHistoryChat = (event: CustomEvent) => {
      const historyChatMessages = event.detail;
      if (Array.isArray(historyChatMessages)) {
        historyChatMessages.forEach((msg: { character: string; content: string }) => {
          addLogEntry(msg.character, msg.content);
        });
      }
    };

    window.addEventListener('history_chat_received', handleHistoryChat as EventListener);
    
    return () => {
      window.removeEventListener('history_chat_received', handleHistoryChat as EventListener);
    };
  }, [addLogEntry]);

  return {
    // 连接状态
    isConnected,
    
    // 游戏状态
    selectedScript,
    characters,
    gameLog,
    currentPhase,
    votes,
    gameResult,
    isGameStarted,
    gameState,
    
    // 操作函数
    handleSelectScript,
    handleStartGame,
    handleNextPhase,
    handleResetGame,
    addLogEntry,
    
    // 工具函数
    getPhaseDisplayName
  };
};