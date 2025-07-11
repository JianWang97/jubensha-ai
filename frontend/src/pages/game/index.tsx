import React, { useEffect, useRef } from 'react';
import Layout from '@/components/Layout';
import CharacterList from '@/components/CharacterList';
import GameLog from '@/components/GameLog';
import ScriptSelection from '@/components/ScriptSelection';
import { useGameState } from '@/hooks/useGameState';
import { useTTSService } from '@/services/ttsService';

const Header = ({ scriptTitle, isConnected, sessionId }: { scriptTitle?: string; isConnected: boolean; sessionId?: string }) => (
  <header className="text-center mb-8 text-white">
    <h1 className="text-4xl font-bold mb-2 text-shadow-lg">{scriptTitle ? `进行中: ${scriptTitle}` : 'AI剧本杀游戏'}</h1>
    <div className="flex justify-center items-center gap-3 mb-2">
      <div className={`inline-block px-3 py-1 rounded-full text-sm ${
        isConnected ? 'bg-green-500' : 'bg-red-500'
      }`}>
        {isConnected ? '已连接' : '连接断开'}
      </div>
      {sessionId && (
        <div className="inline-block px-3 py-1 rounded-full text-sm bg-blue-500">
          房间: {sessionId}
        </div>
      )}
    </div>
  </header>
);

interface GameControlsProps {
  onBack: () => void;
  onStartGame: () => void;
  onNextPhase: () => void;
  onResetGame: () => void;
  isGameStarted: boolean;
  selectedScript: any;
}

const GameControls = ({ 
  onBack, 
  onStartGame, 
  onNextPhase, 
  onResetGame, 
  isGameStarted, 
  selectedScript 
}: GameControlsProps) => (
  <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 mb-5 text-center shadow-lg flex justify-center items-center gap-4">
    <button 
      onClick={onBack} 
      className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-full shadow-lg transform hover:scale-105 transition-all duration-300"
    >
      返回选择
    </button>
    <button 
      onClick={onStartGame}
      disabled={!selectedScript || isGameStarted}
      className="bg-gradient-to-r from-green-400 to-blue-500 hover:from-pink-500 hover:to-yellow-500 text-white font-bold py-3 px-6 rounded-full shadow-lg transform hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isGameStarted ? '游戏进行中' : '开始游戏'}
    </button>
    <button 
      onClick={onNextPhase}
      disabled={!isGameStarted}
      className="bg-gradient-to-r from-blue-400 to-purple-500 hover:from-purple-500 hover:to-pink-500 text-white font-bold py-3 px-6 rounded-full shadow-lg transform hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      下一阶段
    </button>
    <button 
      onClick={onResetGame}
      className="bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white font-bold py-3 px-6 rounded-full shadow-lg transform hover:scale-105 transition-all duration-300"
    >
      重置游戏
    </button>
  </div>
);

interface AudioControlsProps {
  ttsEnabled: boolean;
  isPlaying: boolean;
  audioStatus: string;
  audioInitialized: boolean;
  onToggleTTS: () => void;
  onStopAudio: () => void;
  onInitializeAudio: () => void;
}

const AudioControls = ({ ttsEnabled, isPlaying, audioStatus, audioInitialized, onToggleTTS, onStopAudio, onInitializeAudio }: AudioControlsProps) => (
  <div className={`bg-white/20 backdrop-blur-sm rounded-xl p-4 mb-5 text-center shadow-lg ${
    ttsEnabled && audioInitialized ? 'border-2 border-green-400' : 'border-2 border-gray-400'
  }`}>
    <div className="flex justify-center items-center gap-3 mb-2">
      {!audioInitialized && (
        <button 
          onClick={onInitializeAudio}
          className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-full shadow-lg transform hover:scale-105 transition-all duration-300"
        >
          🎵 初始化音频
        </button>
      )}
      <button 
        onClick={onToggleTTS}
        disabled={!audioInitialized}
        className={`font-bold py-2 px-4 rounded-full shadow-lg transform hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${
          ttsEnabled 
            ? 'bg-green-500 hover:bg-green-600 text-white' 
            : 'bg-gray-500 hover:bg-gray-600 text-white'
        }`}
      >
        {ttsEnabled ? '🔊 禁用语音' : '🔇 启用语音'}
      </button>
      <button 
        onClick={onStopAudio}
        disabled={!isPlaying}
        className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-full shadow-lg transform hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        ⏹️ 停止播放
      </button>
    </div>
    <div className="text-white text-sm">{audioStatus}</div>
  </div>
);

const GamePage = () => {
  // 从URL参数获取session_id和script_id
  const getUrlParams = () => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      return {
        sessionId: urlParams.get('session_id') || undefined,
        scriptId: urlParams.get('script_id') ? parseInt(urlParams.get('script_id')!) : undefined
      };
    }
    return { sessionId: undefined, scriptId: undefined };
  };

  const { sessionId, scriptId } = getUrlParams();

  const {
    isConnected,
    selectedScript,
    characters,
    gameLog,
    currentPhase,
    isGameStarted,
    voiceMapping,
    currentSessionId,
    handleSelectScript,
    handleStartGame,
    handleNextPhase,
    handleResetGame,
    addLogEntry
  } = useGameState(sessionId, scriptId);

  const {
    ttsEnabled,
    isPlaying,
    audioStatus,
    audioInitialized,
    queueTTS,
    stopAllAudio,
    toggleTTS,
    initializeAudio
  } = useTTSService(voiceMapping);

  const playedLogCountRef = useRef<number>(0);

  const handleBackToSelection = () => {
    handleSelectScript(null as any);
    playedLogCountRef.current = 0; // 重置已播放计数
  };

  // 监听音频初始化状态，自动启用TTS
  useEffect(() => {
    if (audioInitialized && !ttsEnabled && isGameStarted) {
      toggleTTS();
    }
  }, [audioInitialized, ttsEnabled, isGameStarted]);

  // 监听游戏日志变化，自动播放TTS
  useEffect(() => {
    if (gameLog.length > playedLogCountRef.current && ttsEnabled && audioInitialized) {
      // 播放所有新增的日志条目
      const newEntries = gameLog.slice(playedLogCountRef.current);
      
      newEntries.forEach(entry => {
        queueTTS(entry.character, entry.content);
      });
      playedLogCountRef.current = gameLog.length;
    }
  }, [gameLog, ttsEnabled, audioInitialized]); // 添加audioInitialized依赖

  return (
    <Layout>
      {!selectedScript ? (
        <ScriptSelection onSelectScript={handleSelectScript} />
      ) : (
        <>
          <Header scriptTitle={selectedScript.title} isConnected={isConnected} sessionId={currentSessionId || undefined} />
          
          <GameControls 
            onBack={handleBackToSelection}
            onStartGame={() => {
              handleStartGame();
              // 自动初始化音频并启用TTS
              if (!audioInitialized) {
                initializeAudio();
              }
            }}
            onNextPhase={handleNextPhase}
            onResetGame={() => {
              handleResetGame();
              playedLogCountRef.current = 0; // 重置已播放计数
            }}
            isGameStarted={isGameStarted}
            selectedScript={selectedScript}
          />
          
          <AudioControls 
            ttsEnabled={ttsEnabled}
            isPlaying={isPlaying}
            audioStatus={audioStatus}
            audioInitialized={audioInitialized}
            onToggleTTS={toggleTTS}
            onStopAudio={stopAllAudio}
            onInitializeAudio={initializeAudio}
          />
          
          <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 mb-5 text-center shadow-lg">
            <div className="text-white font-bold text-lg">
              当前阶段: {currentPhase}
            </div>
          </div>
          
          <div className="grid md:grid-cols-3 gap-5">
            <div className="md:col-span-1">
              <CharacterList characters={characters} />
            </div>
            <div className="md:col-span-2">
              <GameLog gameLog={gameLog} />
            </div>
          </div>
        </>
      )}
    </Layout>
  );
};

export default GamePage;