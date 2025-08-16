import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AppLayout from '../../../components/AppLayout';
import { GameEventItem } from '../../../services/gameHistoryService';
import { useGameHistoryStore } from '../../../stores/gameHistoryStore';
import ReplayControlDrawer from '@/components/ReplayControlDrawer';
import CharacterAvatars from '@/components/CharacterAvatars';
import { ScriptCharacter, Service } from '@/client';
import { useTTSStore } from '@/stores/ttsStore';
import { TTSEvent, AudioCache } from '@/types/tts';



export default function ReplayPage() {
  const router = useRouter();
  const { sessionId } = router.query;
  const { loadAllEvents, events, loadDetail, detail, eventsLoading, error } = useGameHistoryStore();
  
  // 角色数据状态
  const [characters, setCharacters] = useState<ScriptCharacter[]>([]);
  
  // TTS store for managing current speaking character
  const setCurrentSpeakingCharacter = (character: string | null) => {
    // 使用zustand的setState来更新currentSpeakingCharacter
    useTTSStore.setState({ currentSpeakingCharacter: character });
  };
  
  // 获取角色数据
  const loadCharacters = useCallback(async (scriptId: number) => {
    try {
      const response = await Service.getCharactersApiCharactersScriptIdCharactersGet(scriptId);
      if (response.success && response.data) {
        setCharacters(response.data);
      }
    } catch (error) {
      console.error('获取角色数据失败:', error);
    }
  }, []);
  
  // 播放状态
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [currentEventIndex, setCurrentEventIndex] = useState(0);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  
  // 抽屉状态 - 与游戏页面保持一致
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [activeSection, setActiveSection] = useState<'timeline' | 'control' | 'info'>('timeline');

  const audioCache = useRef<AudioCache>({});


  // 初始化数据
  useEffect(() => {
    console.log('回放页面初始化 - isReady:', router.isReady, ' sessionId:', sessionId);
    if (!router.isReady) return; // 等待路由准备好，避免 sessionId 初始未定义
    if (sessionId && typeof sessionId === 'string') {
      console.log('开始加载数据 - sessionId:', sessionId);
      loadDetail(sessionId);
      loadAllEvents(sessionId);
    }
  }, [router.isReady, sessionId, loadDetail, loadAllEvents]);
  
  // 当detail加载完成后，获取角色数据
  useEffect(() => {
    if (detail?.script_info?.id) {
      loadCharacters(detail.script_info.id);
    }
  }, [detail, loadCharacters]);
  
  // 调试输出
  useEffect(() => {
    console.log('数据状态更新:', {
      sessionId,
      eventsLoading,
      eventsCount: events.length,
      detailExists: !!detail,
      error,
      ttsEventsCount: ttsTimeline.events.length
    });
  }, [sessionId, eventsLoading, events.length, detail, error]);

  // 计算TTS时间线
  const ttsTimeline = useMemo(() => {
    if (!events.length) return { events: [], totalDurationMs: 0 };
    
    const ttsEvents: TTSEvent[] = [];
    let currentTime = 0;
    
    for (const event of events) {
      if (event.tts_file_url && event.tts_duration && event.tts_duration > 0) {
        const durationMs = Math.round(event.tts_duration * 1000);
        ttsEvents.push({
          ...event,
          startTimeMs: currentTime,
          endTimeMs: currentTime + durationMs,
          durationMs
        });
        currentTime += durationMs;
      }
    }
    
    return { events: ttsEvents, totalDurationMs: currentTime };
  }, [events]);

  // 更新当前发言角色
  useEffect(() => {
    const currentEvent = getCurrentEvent();
    if (currentEvent?.character_name) {
      setCurrentSpeakingCharacter(currentEvent.character_name);
    } else {
      setCurrentSpeakingCharacter(null);
    }
  }, [currentEventIndex, currentTimeMs, ttsTimeline.events]);





  // 查找当前播放事件
  const getCurrentEvent = () => {
    // 优先使用currentEventIndex来获取当前事件，确保与右侧列表选中项一致
    if (currentEventIndex >= 0 && currentEventIndex < ttsTimeline.events.length) {
      return ttsTimeline.events[currentEventIndex];
    }
    // 备用方案：根据时间查找
    return ttsTimeline.events.find(
      event => currentTimeMs >= event.startTimeMs && currentTimeMs <= event.endTimeMs
    );
  };

  // 懒加载并播放指定事件（含缓存与音量控制）
  const playEvent = useCallback(async (event: TTSEvent) => {
     try {
       setIsLoading(true);
       if (currentAudio) {
         currentAudio.pause();
         currentAudio.onended = null;
       }

       // 懒加载：仅在需要时创建/取缓存
       const key = String(event.id);
       let audio = audioCache.current[key];
       if (!audio) {
         audio = new Audio(event.tts_file_url!);
         audio.preload = 'metadata';
         audioCache.current[key] = audio;
       }

       setCurrentAudio(audio);

       // 音量/静音
       audio.muted = isMuted;
       audio.volume = volume;

       // 自动吸附：从事件开头播放
       audio.currentTime = 0;
       setCurrentTimeMs(event.startTimeMs);

       // 更新当前事件索引
       const eventIndex = ttsTimeline.events.findIndex(e => e.id === event.id);
       if (eventIndex !== -1) {
         setCurrentEventIndex(eventIndex);
       }

       // 设置音频结束处理器
       audio.onended = () => {
         // 通过事件ID找到当前事件的索引，避免闭包问题
         const currentEventIdx = ttsTimeline.events.findIndex(e => e.id === event.id);
         const nextEventIndex = currentEventIdx + 1;
         if (nextEventIndex < ttsTimeline.events.length) {
           setCurrentEventIndex(nextEventIndex);
           const nextEvent = ttsTimeline.events[nextEventIndex];
           setCurrentTimeMs(nextEvent.startTimeMs);
           playEvent(nextEvent);
         } else {
           setIsPlaying(false);
           // 播放完毕后停留在最后位置
           setCurrentTimeMs(ttsTimeline.totalDurationMs);
         }
       };
       
       await audio.play();
       setIsPlaying(true);
       

     } catch (error) {
       console.error('播放音频失败:', error);
       setIsPlaying(false);
       setIsLoading(false);
     } finally {
       setIsLoading(false);
     }
  }, [currentAudio, isMuted, volume, ttsTimeline.events, ttsTimeline.totalDurationMs]);





  // 播放/暂停
  const togglePlay = useCallback(async () => {
    console.log('togglePlay 被调用:', { isPlaying, hasCurrentAudio: !!currentAudio, currentEventIndex });
    
    if (!ttsTimeline.events.length) return;
    
    if (isPlaying) {
      console.log('暂停播放');
      currentAudio?.pause();
      setIsPlaying(false);

    } else {
      const currentEvent = getCurrentEvent();
      console.log('开始播放, 当前事件:', currentEvent?.id, currentEvent?.character_name);
      
      if (currentEvent) {
        // 如果有当前音频且正处于该事件中间，直接恢复播放
        const cached = audioCache.current[String(currentEvent.id)];
        console.log('检查缓存音频:', {
          hasCurrentAudio: !!currentAudio,
          hasCached: !!cached,
          isSameAudio: cached === currentAudio,
          currentTime: currentAudio?.currentTime,
          duration: currentAudio?.duration
        });
        
        if (
          currentAudio &&
          cached === currentAudio &&
          !isNaN(currentAudio.duration) &&
          currentAudio.duration > 0 &&
          currentAudio.currentTime > 0 &&
          currentAudio.currentTime < currentAudio.duration
        ) {
          console.log('恢复播放已暂停的音频');
          try {
            // 清除旧的 onended 回调，避免冲突
            currentAudio.onended = null;
            
            currentAudio.muted = isMuted;
            currentAudio.volume = volume;
            
            // 重新设置 onended 回调
            currentAudio.onended = () => {
              console.log('音频播放结束, 当前事件:', currentEvent.id);
              const currentEventIdx = ttsTimeline.events.findIndex(e => e.id === currentEvent.id);
              const nextEventIndex = currentEventIdx + 1;
              if (nextEventIndex < ttsTimeline.events.length) {
                console.log('播放下一个事件:', nextEventIndex);
                setCurrentEventIndex(nextEventIndex);
                const nextEvent = ttsTimeline.events[nextEventIndex];
                setCurrentTimeMs(nextEvent.startTimeMs);
                playEvent(nextEvent);
              } else {
                console.log('所有音频播放完毕');
                setIsPlaying(false);
                setCurrentTimeMs(ttsTimeline.totalDurationMs);
              }
            };
            
            await currentAudio.play();
            setIsPlaying(true);
            console.log('恢复播放成功');


          } catch (error) {
            console.error('恢复播放失败:', error);
            setIsPlaying(false);
            // 如果恢复失败，尝试重新播放
            playEvent(currentEvent);
          }
        } else {
          console.log('从头开始播放事件');
          // 否则从事件头开始播放
          playEvent(currentEvent);
        }
      } else {
        // 如果当前时间在任何事件范围外，播放第一个事件
        const firstEvent = ttsTimeline.events[0];
        if (firstEvent) {
          console.log('播放第一个事件');
          setCurrentTimeMs(firstEvent.startTimeMs);
          setCurrentEventIndex(0);
          playEvent(firstEvent);
        }
      }
    }
  }, [ttsTimeline.events, isPlaying, currentAudio, getCurrentEvent, playEvent, isMuted, volume]);



  // 清理
  useEffect(() => {
    return () => {
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.onended = null;
      }

    };
  }, [currentAudio]);

  const currentEvent = getCurrentEvent();

  // 获取场景背景图片 - 与游戏页面保持一致
  const getSceneBackground = () => {
    if (detail?.script_info?.cover_image_url) {
      return detail.script_info.cover_image_url;
    }
    return '/background.png';
  };

  return (
    <AppLayout 
      backgroundImage={getSceneBackground()}
      isGamePage={true}
      showSidebar={false}
    >
      <div className="min-h-screen text-white">

        {eventsLoading ? (
          <div className="fixed inset-0 flex items-center justify-center z-20">
            <div className="bg-black/60 backdrop-blur-xl rounded-3xl p-8 border border-white/20 shadow-2xl">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400 mb-4"></div>
                <p className="text-gray-300">正在加载回放数据...</p>
                {sessionId && <p className="text-xs text-gray-500 mt-2">Session: {sessionId}</p>}
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="fixed inset-0 flex items-center justify-center z-20">
            <div className="bg-black/60 backdrop-blur-xl rounded-3xl p-8 border border-white/20 shadow-2xl">
              <div className="text-center">
                <div className="text-6xl mb-4">⚠️</div>
                <h2 className="text-xl font-semibold text-red-300 mb-2">加载失败</h2>
                <p className="text-gray-400 mb-4">{error}</p>
                <button 
                  onClick={() => {
                    if (sessionId && typeof sessionId === 'string') {
                      loadDetail(sessionId);
                      loadAllEvents(sessionId);
                    }
                  }}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white transition-colors"
                >
                  重试
                </button>
              </div>
            </div>
          </div>
        ) : !sessionId ? (
          <div className="fixed inset-0 flex items-center justify-center z-20">
            <div className="bg-black/60 backdrop-blur-xl rounded-3xl p-8 border border-white/20 shadow-2xl">
              <div className="text-center">
                <div className="text-6xl mb-4">🔍</div>
                <h2 className="text-xl font-semibold text-yellow-300 mb-2">缺少会话ID</h2>
                <p className="text-gray-400">无法加载回放数据，请检查URL中的sessionId参数</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="min-h-screen flex flex-col relative">
            {/* 回放控制抽屉 - 与游戏页面GameControlDrawer保持一致的结构 */}
            <ReplayControlDrawer
              open={drawerOpen}
              onToggle={() => setDrawerOpen(o => !o)}
              events={ttsTimeline.events}
              currentEventIndex={currentEventIndex}
              onEventSelect={playEvent}
              sessionId={sessionId as string}
              detail={detail}
              totalDurationMs={ttsTimeline.totalDurationMs}
              onBack={() => router.back()}
              activeSection={activeSection}
              onSectionChange={setActiveSection}
              isPlaying={isPlaying}
              isLoading={isLoading}
              volume={volume}
              isMuted={isMuted}
              onTogglePlay={togglePlay}
              onVolumeChange={setVolume}
              onMuteToggle={() => setIsMuted(!isMuted)}
              currentTimeMs={currentTimeMs}
            />

            {/* 主要内容区域 - 占据大部分空间 */}
            <div className="flex-1 relative mt-32 mb-32">
              {/* 角色头像显示区域 */}
              <div className="flex items-center justify-center h-full p-6">
                {characters.length > 0 ? (
                  <div className="flex flex-col items-center">
                    {/* 角色头像列表 - 当前发言角色会自动高亮 */}
                    <CharacterAvatars characters={characters} />
                  </div>
                ) : events.length > 0 ? (
                  <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-4xl shadow-2xl border-4 border-white/20">
                    🎭
                  </div>
                ) : (
                  <div className="w-32 h-32 rounded-full bg-gradient-to-br from-gray-500 to-gray-600 flex items-center justify-center text-white text-4xl shadow-2xl border-4 border-white/20">
                    📵
                  </div>
                )}
              </div>
            </div>

            {/* 底部游戏界面区域 - 类似游戏画面 */}
            <div className="flex-shrink-0 bg-black/40 backdrop-blur-sm border-t border-white/10 fixed bottom-0 left-0 right-0">
              {/* 字幕显示区域 */}
              <div className="px-6 py-4 min-h-[120px] flex items-center justify-center">
                <div className="w-full max-w-4xl">
                  {currentEvent ? (
                    <div className="text-center space-y-2">
                      <div className="text-lg font-semibold text-white">
                        {currentEvent.character_name || '系统'}
                      </div>
                      <div className="text-base text-gray-200 bg-black/50 rounded-lg px-4 py-2">
                        {currentEvent.content}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-gray-400">
                      等待回放开始...
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
