import AppLayout from '@/components/AppLayout';
import CharacterAvatars from '@/components/CharacterAvatars';
import GameControlDrawer from '@/components/GameControlDrawer';
import { useGameState } from '@/hooks/useGameState';
import { useTTSService } from '@/stores/ttsStore';
import { useWebSocketStore } from '@/stores/websocketStore';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import Image from 'next/image';
import { useRouter } from 'next/router';

const GamePage = () => {
  // 从URL参数获取script_id
  const getUrlParams = () => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      return {
        scriptId: urlParams.get('script_id') ? parseInt(urlParams.get('script_id')!) : undefined
      };
    }
    return { scriptId: undefined };
  };

  const { scriptId } = getUrlParams();
  const router = useRouter();

  const {
    selectedScript,
    characters,
    gameLog,
    isGameStarted, // 仍保留但将逐步替换为ws标志
    handleStartGame
  } = useGameState(scriptId);

  // WebSocket store for game control
  const { nextPhase, gameState, isGameRunning, gameInitialized, startGame, fetchHistory, resetGame, sendMessage, sessionId } = useWebSocketStore() as any;

  // 本地进入标记：刷新后即使有运行中的游戏也先展示"继续游戏"
  const [enteredGame, setEnteredGame] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [showBackgroundModeDialog, setShowBackgroundModeDialog] = useState(false);
  const [isWaitingBackgroundResponse, setIsWaitingBackgroundResponse] = useState(false);
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

  // 监听后台模式响应
  useEffect(() => {
    const handleBackgroundModeResponse = (event: CustomEvent) => {
      console.log('收到后台模式响应:', event.detail);
      setIsWaitingBackgroundResponse(false);
      setShowBackgroundModeDialog(false);
      toast.success('已启用后台模式');
      router?.push('/script-center');
    };

    window.addEventListener('background_mode_response', handleBackgroundModeResponse as EventListener);
    
    return () => {
      window.removeEventListener('background_mode_response', handleBackgroundModeResponse as EventListener);
    };
  }, [router]);

  // 手动推进到下一阶段
  const handleNextPhase = () => {
    nextPhase();
  };

  // 增强的开始游戏函数，包含语音播报
  const handleStartOrContinueGameWithTTS = async () => {
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
      
      // 调用原始的开始/继续游戏函数 (统一)
      // 若后端已在 session_connected 提供 is_game_running, UI 决定按钮文字，但启动消息仍使用 startGame 语义
      if (!isGameRunning) {
        const scriptIdentifier = (selectedScript as any)?.id || (selectedScript as any)?.script_id || (selectedScript as any)?.info?.id;
        if (scriptIdentifier) {
          startGame(String(scriptIdentifier));
        } else {
          handleStartGame(); // 保留原逻辑兜底
        }
      } else {
        // 已有运行中的游戏：拉取历史以补齐客户端
        fetchHistory?.();
      }
      setEnteredGame(true);
      
      // 添加欢迎语音到队列
      setTimeout(() => {
        queueTTS('系统', '游戏开始！欢迎来到剧本杀的世界，本次由AI角色自主演绎，我们一起见证故事的展开。', 'female-shaonv');
      }, 500); // 延迟500ms确保游戏状态已更新
    } catch (error) {
      console.error('启动游戏时出错:', error);
      // 即使音频初始化失败，也要启动游戏
      if (!isGameRunning) {
        const scriptIdentifier = (selectedScript as any)?.id || (selectedScript as any)?.script_id || (selectedScript as any)?.info?.id;
        if (scriptIdentifier) {
          startGame(String(scriptIdentifier));
        } else {
          handleStartGame();
        }
      } else {
        fetchHistory?.();
      }
      setEnteredGame(true);
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
    const shouldRun = (isGameRunning || isGameStarted) && ttsEnabled;
    if (shouldRun) {
      // 确保音频已初始化（可能刷新后未初始化但用户已开启TTS）
      if (!audioInitialized) {
        initializeAudio().catch(err => console.warn('音频初始化失败(可能需要用户交互):', err));
      }
      startQueueProcessor();
    } else {
      stopQueueProcessor();
    }
  }, [isGameRunning, isGameStarted, ttsEnabled, audioInitialized, initializeAudio, startQueueProcessor, stopQueueProcessor]);

  // 监听首次用户交互，若TTS开启但尚未初始化则尝试初始化
  useEffect(() => {
    if (ttsEnabled && !audioInitialized) {
      const handler = () => {
        initializeAudio().catch(() => {});
        window.removeEventListener('pointerdown', handler);
      };
      window.addEventListener('pointerdown', handler);
      return () => window.removeEventListener('pointerdown', handler);
    }
  }, [ttsEnabled, audioInitialized, initializeAudio]);

  // 直接退出游戏
  const handleDirectExit = () => {
    try {
      localStorage.removeItem('gameState');
      localStorage.removeItem('currentSession');
    } catch {}
    setShowBackgroundModeDialog(false);
    router?.push('/script-center');
  };

  // 启用后台模式
  const handleEnableBackgroundMode = () => {
    if (!sessionId) {
      toast.error('无法获取当前会话ID');
      return;
    }
    
    setIsWaitingBackgroundResponse(true);
    
    const message = {
      type: "set_background_mode",
      session_id: sessionId,
      background_mode: true
    };
    
    sendMessage(message);
  };

  return (
    <AppLayout showSidebar={false} backgroundImage={getSceneBackground()} isGamePage={true}>
      {(
        <>
          {/* 开始游戏按钮 - 仅在游戏未开始时显示 */}
          {/* 覆盖层显示条件：未在本地标记开始 且 没有进行中的游戏状态或需要继续界面 */}
          {/* 开始或继续覆盖层：未进入游戏视图时显示 */}
          {!enteredGame && !isGameRunning && (
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
                    onClick={handleStartOrContinueGameWithTTS}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-4 px-8 rounded-2xl text-xl transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
                  >
                    🚀 {gameInitialized ? '继续游戏' : '开始游戏'}
                  </button>
                </div>
              </div>
            </div>
          )}
          {!enteredGame && isGameRunning && (
            <div className="fixed inset-0 flex items-center justify-center z-20">
              <div className="bg-black/60 backdrop-blur-xl rounded-3xl p-8 border border-white/20 shadow-2xl">
                <div className="text-center">
                  <div className="text-6xl mb-6">🎮</div>
                  <h2 className="text-3xl font-bold text-white mb-4">继续游戏</h2>
                  <p className="text-gray-300 mb-4 max-w-md">检测到有正在进行的剧本，点击继续加入当前进度</p>
                  <button
                    onClick={handleStartOrContinueGameWithTTS}
                    className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold py-4 px-8 rounded-2xl text-xl transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
                  >➡️ 继续游戏</button>
                </div>
              </div>
            </div>
          )}
          
          {/* 游戏进行中的界面 - 类似游戏画面布局 */}
          {enteredGame && isGameRunning && (
            <div className="min-h-screen flex flex-col relative">
              <GameControlDrawer
                open={drawerOpen}
                onToggle={() => setDrawerOpen(o => !o)}
                characters={characters}
                gameLog={gameLog}
                ttsEnabled={ttsEnabled}
                audioInitialized={audioInitialized}
                toggleTTS={toggleTTS}
                initializeAudio={initializeAudio}
                phase={gameState?.phase || (isGameRunning ? '加载中' : '未知')}
                onNextPhase={handleNextPhase}
                currentSpeakingCharacter={currentSpeakingCharacter}
                currentSpeechText={currentSpeechText}
                onExitGame={() => {
                  setShowBackgroundModeDialog(true);
                }}
              />

              {/* 主要内容区域 - 占据大部分空间 */}
              <div className="flex-1 relative mt-32 mb-32 flex items-center justify-center">
                {/* 角色头像显示在页面中央 */}
                <div className="flex flex-col items-center space-y-8">
                  <h2 className="text-2xl font-bold text-white mb-4">游戏角色</h2>
                  <CharacterAvatars
                    characters={characters.map((c: any) => ({ ...c, avatar_url: c.avatar_url === null ? undefined : c.avatar_url }))}
                  />
                </div>
              </div>

              {/* 底部游戏界面区域 - 类似游戏画面 */}
              <div className="flex-shrink-0 bg-black/40 backdrop-blur-sm border-t border-white/10 fixed bottom-0 left-0 right-0">
                {/* 字幕显示区域 */}
                <div className="px-6 py-6 min-h-[140px] flex items-center justify-center">
                  <div className="w-full max-w-5xl flex items-start gap-6">
                    {/* 当前播报人物头像 */}
                     {currentSpeakingCharacter && (
                       <div className="flex-shrink-0 mt-2">
                        {(() => {
                          const speakingChar = characters.find(c => c.name === currentSpeakingCharacter);
                          if (speakingChar) {
                            return (
                              <div className="relative w-20 h-16 rounded-xl border-4 border-yellow-400 bg-gradient-to-br from-yellow-400/20 to-orange-400/20 backdrop-blur-sm flex items-center justify-center shadow-xl overflow-hidden">
                                {/* 背景装饰 */}
                                <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/10 to-orange-400/10 animate-pulse"></div>
                                
                                <div className="relative w-full h-full flex items-center justify-center text-2xl z-10">
                                  {speakingChar.avatar_url ? (
                                     <Image 
                                       src={speakingChar.avatar_url} 
                                       alt={speakingChar.name || ''}
                                       width={80}
                                       height={64}
                                       className="w-full h-full object-cover rounded-lg"
                                     />
                                   ) : (
                                    <span className="text-3xl">
                                      {speakingChar.gender === '女' ? '👩' :
                                       speakingChar.gender === '男' ? '👨' : '🕵️'}
                                    </span>
                                  )}
                                </div>
                                
                                {/* 发言指示器 - 改为更现代的设计 */}
                                <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-r from-green-400 to-emerald-500 rounded-lg border-2 border-white shadow-lg">
                                  <div className="w-full h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-lg animate-ping opacity-75"></div>
                                </div>
                                
                                {/* 边框光效 */}
                                <div className="absolute inset-0 rounded-xl border-2 border-yellow-400/50 animate-pulse"></div>
                              </div>
                            );
                          }
                          return null;
                        })()} 
                      </div>
                    )}
                    
                    {/* 字幕内容 */}
                    <div className="flex-1">
                      {currentSpeakingCharacter ? (
                        <div className="space-y-3">
                          <div className="text-xl font-bold text-white bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
                            {currentSpeakingCharacter}
                          </div>
                          <div className="text-lg text-gray-100 bg-gradient-to-r from-black/60 to-black/40 backdrop-blur-md rounded-2xl px-6 py-4 border border-white/10 shadow-2xl">
                            <div className="relative">
                              {currentSpeechText || '正在发言中...'}
                              {/* 文字装饰效果 */}
                              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-pulse rounded-xl"></div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center text-gray-400 text-lg">
                          <div className="bg-black/30 backdrop-blur-sm rounded-2xl px-6 py-4 border border-white/10">
                            等待角色发言...
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* 日志已整合至抽屉 */}
        </>
      )}

      {/* 后台模式确认弹框 */}
      {showBackgroundModeDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">退出游戏</h3>
            <p className="text-gray-600 mb-6">
              是否需要启用后台模式？启用后台模式可以让游戏在后台继续运行。
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleDirectExit}
                disabled={isWaitingBackgroundResponse}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
              >
                直接退出
              </button>
              <button
                onClick={handleEnableBackgroundMode}
                disabled={isWaitingBackgroundResponse}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2"
              >
                {isWaitingBackgroundResponse && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                )}
                启用后台模式
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
};

export default GamePage;