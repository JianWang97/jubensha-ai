import React, { useEffect, useRef } from 'react';
import AppLayout from '@/components/AppLayout';
import CharacterAvatars from '@/components/CharacterAvatars';
import GameLog from '@/components/GameLog';
import { useGameState } from '@/hooks/useGameState';
import { useTTSService } from '@/stores/ttsStore';
import { useWebSocketStore } from '@/stores/websocketStore';

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
    selectedScript,
    characters,
    gameLog,
    isGameStarted,
    handleSelectScript,
    handleStartGame
  } = useGameState(sessionId, scriptId);

  // WebSocket store for game control
  const { nextPhase, gameState } = useWebSocketStore();

  // 初始化TTS服务
  const { 
    queueTTS, 
    initializeAudio, 
    ttsEnabled, 
    audioInitialized, 
    toggleTTS,
    startQueueProcessor,
    stopQueueProcessor,
    currentSpeakingCharacter,
    currentSpeechText
  } = useTTSService();

  // 手动推进到下一阶段
  const handleNextPhase = () => {
    nextPhase();
  };

  // 增强的开始游戏函数，包含语音播报
  const handleStartGameWithTTS = async () => {
    try {
      // 如果TTS未启用，先启用它
      if (!ttsEnabled) {
        toggleTTS();
      }
      
      // 初始化音频（如果还未初始化）
      if (!audioInitialized) {
        console.log('正在初始化音频...');
        await initializeAudio();
      }
      
      // 启动队列处理器
      startQueueProcessor();
      
      // 调用原始的开始游戏函数
      handleStartGame();
      
      // 添加欢迎语音到队列
      setTimeout(() => {
        queueTTS('系统', '游戏开始！欢迎来到剧本杀的世界，请各位玩家准备好开始这场精彩的推理之旅！', 'female-shaonv');
      }, 500); // 延迟500ms确保游戏状态已更新
    } catch (error) {
      console.error('启动游戏时出错:', error);
      // 即使音频初始化失败，也要启动游戏
      handleStartGame();
    }
  };

  // 获取场景背景图片
  const getSceneBackground = () => {
    // 优先使用剧本封面图片，如果没有则使用默认背景
    if (selectedScript?.info.cover_image_url) {
      return selectedScript.info.cover_image_url;
    }
    return '/background.png';
  };

  // 游戏结束时停止队列处理器
  useEffect(() => {
    return () => {
      // 组件卸载时停止队列处理器
      stopQueueProcessor();
    };
  }, [stopQueueProcessor]);
  
  // 游戏状态变化时管理队列处理器
  useEffect(() => {
    if (isGameStarted && ttsEnabled) {
      startQueueProcessor();
    } else {
      stopQueueProcessor();
    }
  }, [isGameStarted, ttsEnabled, startQueueProcessor, stopQueueProcessor]);

  return (
    <AppLayout title={`游戏进行中 - ${selectedScript?.info.title || '未知剧本'}`} showSidebar={false} backgroundImage={getSceneBackground()} isGamePage={true}>
      {(
        <>
          {/* 开始游戏按钮 - 仅在游戏未开始时显示 */}
          {!isGameStarted && (
            <div className="fixed inset-0 flex items-center justify-center z-20">
              <div className="bg-black/60 backdrop-blur-xl rounded-3xl p-8 border border-white/20 shadow-2xl">
                <div className="text-center">
                  <div className="text-6xl mb-6">🎭</div>
                  <h2 className="text-3xl font-bold text-white mb-4">
                    {selectedScript?.info.title || '剧本杀'}
                  </h2>
                  <p className="text-gray-300 mb-4 max-w-md">
                    所有角色已就位，准备开始这场精彩的推理之旅
                  </p>
                  {!audioInitialized && (
                    <p className="text-yellow-300 mb-6 text-sm">
                      💡 提示：点击右上角启用音频以获得更好的游戏体验
                    </p>
                  )}
                  <button
                    onClick={handleStartGameWithTTS}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-4 px-8 rounded-2xl text-xl transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
                  >
                    🚀 开始游戏
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* 游戏进行中的界面 - 类似游戏画面布局 */}
          {isGameStarted && (
            <div className="min-h-screen flex flex-col relative">
              {/* 角色头像区域 - 移到顶部 */}
              <div className="fixed top-16 left-1/2 transform -translate-x-1/2 z-30">
                <div className="flex items-center bg-black/60 backdrop-blur-sm rounded-lg p-2 border border-white/20 shadow-lg">
                  <CharacterAvatars 
                    characters={characters.map(char => ({
                      ...char,
                      avatar_url: char.avatar_url === null ? undefined : char.avatar_url
                    }))} 
                    gameLog={gameLog} 
                  />
                </div>
              </div>

              {/* 合并的控制面板 */}
              <div className="fixed top-16 left-4 z-30">
                <div className="bg-black/60 backdrop-blur-sm rounded-lg p-3 border border-white/20 shadow-lg flex items-center space-x-4">
                  {/* TTS控制 */}
                  <div className="flex items-center space-x-2">
                    <div className="text-lg">{ttsEnabled ? '🔊' : '🔇'}</div>
                    <div className="text-white text-sm">
                      <div className="font-medium">
                        语音: {ttsEnabled ? '启用' : '禁用'}
                      </div>
                    </div>
                    <button
                      onClick={toggleTTS}
                      className={`px-2 py-1 rounded text-xs transition-colors ${
                        ttsEnabled 
                          ? 'bg-red-600 hover:bg-red-700 text-white' 
                          : 'bg-green-600 hover:bg-green-700 text-white'
                      }`}
                    >
                      {ttsEnabled ? '禁用' : '启用'}
                    </button>
                  </div>
                  
                  {/* 游戏控制 */}
                  <div className="flex items-center space-x-2 border-l border-gray-600 pl-4">
                    <div className="text-white text-sm">
                      <div className="font-medium">
                        阶段: {gameState?.phase || '未知'}
                      </div>
                    </div>
                    <button
                      onClick={handleNextPhase}
                      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-3 py-1 rounded-lg text-sm font-medium transition-all duration-300 shadow-lg hover:shadow-xl"
                    >
                      下一阶段
                    </button>
                  </div>
                </div>
              </div>

              {/* 主要内容区域 - 占据大部分空间 */}
              <div className="flex-1 relative mt-32 mb-32">
                {/* 原角色头像区域已移至顶部 */}
              </div>

              {/* 底部游戏界面区域 - 类似游戏画面 */}
              <div className="flex-shrink-0 bg-black/40 backdrop-blur-sm border-t border-white/10 fixed bottom-0 left-0 right-0">
                {/* 字幕显示区域 */}
                <div className="px-6 py-4 min-h-[120px] flex items-center justify-center">
                  <div className="w-full max-w-4xl">
                    {currentSpeakingCharacter ? (
                      <div className="text-center space-y-2">
                        <div className="text-lg font-semibold text-white">
                          {currentSpeakingCharacter}
                        </div>
                        <div className="text-base text-gray-200 bg-black/50 rounded-lg px-4 py-2">
                          {currentSpeechText || '正在发言中...'}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center text-gray-400">
                        等待角色发言...
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* 游戏日志右侧抽屉 */}
          <GameLog gameLog={gameLog} />
        </>
      )}
    </AppLayout>
  );
};

export default GamePage;