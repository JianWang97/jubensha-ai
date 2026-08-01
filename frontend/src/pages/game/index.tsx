import AppLayout from '@/components/AppLayout';
import CharacterAvatars from '@/components/CharacterAvatars';
import GameControlDrawer from '@/components/GameControlDrawer';
import { useGameState } from '@/hooks/useGameState';
import { cn } from '@/lib/utils';
import { useTTSService } from '@/stores/ttsStore';
import { useWebSocketStore } from '@/stores/websocketStore';
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { Gamepad2, Lightbulb, Play, Theater, UserRound } from 'lucide-react';

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
  const { nextPhase, gameState, isGameRunning, gameInitialized, startGame, fetchHistory, sendMessage, sessionId } = useWebSocketStore() as any;

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

  // 阶段进度条配置
  const PHASES = ['简介', '调查', '讨论', '投票', '揭晓'];
  const PHASE_MAP: Record<string, number> = {
    background: 0, intro: 0,
    investigation: 1,
    discussion: 2,
    voting: 3,
    reveal: 4,
  };
  const currentPhaseIdx = gameState?.phase != null ? (PHASE_MAP[gameState.phase] ?? -1) : -1;
  const currentPhaseName = currentPhaseIdx >= 0 ? PHASES[currentPhaseIdx] : (gameState?.phase || '');

  return (
    <AppLayout showSidebar={false} backgroundImage={getSceneBackground()} isGamePage={true}>
      {(
        <>
          {/* 开始游戏按钮 - 仅在游戏未开始时显示 */}
          {/* 覆盖层显示条件：未在本地标记开始 且 没有进行中的游戏状态或需要继续界面 */}
          {/* 开始或继续覆盖层：未进入游戏视图时显示 */}
          {!enteredGame && !isGameRunning && (
            <div className="fixed inset-0 flex items-center justify-center z-20">
              <div className="bg-panel border border-line rounded-sm p-10">
                <div className="text-center">
                  <Theater className="text-5xl text-brass mx-auto mb-6" />
                  <h2 className="font-dossier text-3xl font-bold text-paper mb-4">
                    {selectedScript?.info.title || '剧本杀'}
                  </h2>
                  <p className="text-mist mb-4 max-w-md">
                    所有角色已就位，准备开始这场精彩的推理之旅
                  </p>
                  {!audioInitialized && (
                    <p className="text-amber-300/90 mb-6 text-sm flex items-center justify-center gap-1.5">
                      <Lightbulb className="h-4 w-4" />
                      提示：点击右上角启用音频以获得更好的游戏体验
                    </p>
                  )}
                  <button
                    onClick={handleStartOrContinueGameWithTTS}
                    className="bg-brass/10 border border-brass/40 text-brass hover:bg-brass/20 font-medium py-3 px-8 rounded-sm text-lg transition-colors"
                  >
                    <Play className="h-5 w-5 mr-2 inline-block -mt-0.5" />
                    {gameInitialized ? '继续游戏' : '开始游戏'}
                  </button>
                </div>
              </div>
            </div>
          )}
          {!enteredGame && isGameRunning && (
            <div className="fixed inset-0 flex items-center justify-center z-20">
              <div className="bg-panel border border-line rounded-sm p-10">
                <div className="text-center">
                  <Gamepad2 className="text-5xl text-brass mx-auto mb-6" />
                  <h2 className="font-dossier text-3xl font-bold text-paper mb-4">继续游戏</h2>
                  <p className="text-mist mb-6 max-w-md">检测到有正在进行的剧本，点击继续加入当前进度</p>
                  <button
                    onClick={handleStartOrContinueGameWithTTS}
                    className="bg-brass/10 border border-brass/40 text-brass hover:bg-brass/20 font-medium py-3 px-8 rounded-sm text-lg transition-colors"
                  >
                    <Play className="h-5 w-5 mr-2 inline-block -mt-0.5" />
                    继续游戏
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* 游戏进行中的界面 - 类似游戏画面布局 */}
          {enteredGame && isGameRunning && (
            <div className="min-h-screen flex flex-col relative overflow-hidden">
              {/* 剧本封面模糊背景 */}
              {selectedScript?.info.cover_image_url && (
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  <div
                    className="absolute inset-0 bg-cover bg-center scale-110 blur-sm opacity-20"
                    style={{ backgroundImage: `url(${selectedScript.info.cover_image_url})` }}
                  />
                </div>
              )}

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
                hideFloatButton={true}
                onExitGame={() => {
                  setShowBackgroundModeDialog(true);
                }}
              />

              {/* 主要内容区域 - 占据大部分空间 */}
              <div className="flex-1 relative mt-32 mb-32 pb-20 flex items-center justify-center">
                {/* 角色头像显示在页面中央 */}
                <div className="flex flex-col items-center space-y-8">
                  {/* 阶段进度条 */}
                  <div className="flex items-center justify-center gap-2 py-2 px-4 bg-ink/60 border border-hairline rounded-sm">
                    {PHASES.map((phase, idx) => (
                      <React.Fragment key={phase}>
                        <div className={cn(
                          'px-3 py-1 rounded-full text-xs font-medium transition-all',
                          idx === currentPhaseIdx
                            ? 'bg-brass text-ink'
                            : idx < currentPhaseIdx
                              ? 'bg-raised text-mist'
                              : 'bg-ink/40 text-faint'
                        )}>
                          {phase}
                        </div>
                        {idx < PHASES.length - 1 && <div className="w-6 h-px bg-line" />}
                      </React.Fragment>
                    ))}
                  </div>

                  <h2 className="font-dossier text-2xl font-bold text-paper mb-4">游戏角色</h2>
                  <CharacterAvatars
                    characters={characters.map((c: any) => ({ ...c, avatar_url: c.avatar_url === null ? undefined : c.avatar_url }))}
                  />
                </div>
              </div>

              {/* 底部字幕区域 - 在 ActionBar 上方 */}
              <div className="flex-shrink-0 bg-ink/70 border-t border-hairline fixed bottom-16 left-0 right-0">
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
                              <div className="relative w-20 h-16 rounded-sm border-4 border-yellow-400 bg-brass/15 flex items-center justify-center overflow-hidden">
                                <div className="relative w-full h-full flex items-center justify-center z-10">
                                  {speakingChar.avatar_url ? (
                                     <Image 
                                       src={speakingChar.avatar_url} 
                                       alt={speakingChar.name || ''}
                                       width={80}
                                       height={64}
                                       className="w-full h-full object-cover rounded-sm"
                                     />
                                   ) : (
                                    <UserRound className="h-10 w-10 text-paper" />
                                  )}
                                </div>
                                
                                {/* 发言指示器 */}
                                <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-sm border-2 border-ink shadow-lg">
                                  <div className="w-full h-full bg-green-500 rounded-sm animate-ping opacity-75"></div>
                                </div>
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
                          <div className="text-xl font-bold text-transparent bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text">
                            {currentSpeakingCharacter}
                          </div>
                          <div className="text-lg text-mist bg-panel border border-line rounded-sm px-6 py-4">
                            {currentSpeechText || '正在发言中...'}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center text-faint text-lg">
                          <div className="bg-ink/40 border border-hairline rounded-sm px-6 py-4">
                            等待角色发言...
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* 底部 ActionBar */}
              <div className="fixed bottom-0 left-0 right-0 z-40 h-16 bg-ink/90 border-t border-line flex items-center px-4 gap-3">
                <button
                  onClick={handleNextPhase}
                  className="bg-brass/10 border border-brass/40 text-brass hover:bg-brass/20 text-sm font-medium px-4 py-2 rounded-sm transition-colors whitespace-nowrap"
                >
                  下一阶段
                </button>
                <div className="flex-1 text-center text-sm text-mist truncate">
                  {currentPhaseName || gameState?.phase || '游戏进行中'}
                </div>
                <button
                  onClick={() => setDrawerOpen(o => !o)}
                  className="bg-raised text-paper hover:bg-panel border border-line text-sm font-medium px-4 py-2 rounded-sm transition-colors whitespace-nowrap"
                >
                  控制面板
                </button>
              </div>
            </div>
          )}
          
          {/* 日志已整合至抽屉 */}
        </>
      )}

      {/* 后台模式确认弹框 */}
      {showBackgroundModeDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-panel border border-line rounded-sm p-6 max-w-md w-full mx-4">
            <h3 className="font-dossier text-lg font-semibold text-paper mb-4">退出游戏</h3>
            <p className="text-mist mb-6">
              是否需要启用后台模式？启用后台模式可以让游戏在后台继续运行。
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleDirectExit}
                disabled={isWaitingBackgroundResponse}
                className="px-4 py-2 text-mist bg-raised border border-line rounded-sm hover:bg-panel disabled:opacity-50 transition-colors"
              >
                直接退出
              </button>
              <button
                onClick={handleEnableBackgroundMode}
                disabled={isWaitingBackgroundResponse}
                className="px-4 py-2 bg-brass/10 border border-brass/40 text-brass hover:bg-brass/20 rounded-sm disabled:opacity-50 flex items-center gap-2 transition-colors"
              >
                {isWaitingBackgroundResponse && (
                  <div className="w-4 h-4 border-2 border-brass border-t-transparent rounded-full animate-spin"></div>
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