import React from 'react';
import { ArrowLeft, Menu, X, Play, Pause, Volume2, VolumeX } from 'lucide-react';
import { TTSEvent } from '@/types/tts';
import { GameDetail } from '@/types/game';

interface ReplayControlDrawerProps {
  open: boolean;
  onToggle: () => void;
  events: TTSEvent[];
  currentEventIndex: number;
  onEventSelect: (event: TTSEvent) => void;
  sessionId: string;
  detail: GameDetail | null;
  totalDurationMs: number;
  onBack: () => void;
  activeSection: 'control' | 'timeline' | 'info';
  onSectionChange: (section: 'control' | 'timeline' | 'info') => void;
  isPlaying: boolean;
  isLoading: boolean;
  volume: number;
  isMuted: boolean;
  onTogglePlay: () => void;
  onVolumeChange: (volume: number) => void;
  onMuteToggle: () => void;
  currentTimeMs: number;
}

export default function ReplayControlDrawer({
  open,
  onToggle,
  events,
  currentEventIndex,
  onEventSelect,
  sessionId,
  detail,
  totalDurationMs,
  onBack,
  activeSection,
  onSectionChange,
  isPlaying,
  isLoading,
  volume,
  isMuted,
  onTogglePlay,
  onVolumeChange,
  onMuteToggle,
  currentTimeMs
}: ReplayControlDrawerProps) {
  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <>
      {/* 顶部导航栏 - 固定在顶部 */}
      <div className="fixed top-0 left-0 right-0 z-30 bg-ink/70 border-b border-hairline">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="text-mist hover:text-paper transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="font-dossier text-xl font-bold text-paper">游戏回放</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="font-data text-sm text-mist">
              Session: {sessionId}
            </div>
            <div className="font-data text-sm text-mist">
              {formatTime(totalDurationMs)} | {events.length} 段语音
            </div>
            <button
              onClick={onToggle}
              className="text-mist hover:text-paper transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>

      {/* 侧边抽屉 */}
      <div className={`fixed top-0 right-0 h-full w-80 bg-panel border-l border-line transform transition-transform duration-300 z-40 ${
        open ? 'translate-x-0' : 'translate-x-full'
      }`}>
        <div className="flex flex-col h-full">
          {/* 抽屉头部 */}
          <div className="flex items-center justify-between p-4 border-b border-line">
            <h2 className="font-dossier text-lg font-semibold text-paper">回放控制</h2>
            <button
              onClick={onToggle}
              className="text-faint hover:text-paper transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 标签页导航 */}
          <div className="flex border-b border-line">
            {[
              { key: 'control', label: '控制' },
              { key: 'timeline', label: '时间线' },
              { key: 'info', label: '信息' }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => onSectionChange(tab.key as any)}
                className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
                  activeSection === tab.key
                    ? 'text-brass border-b-2 border-brass'
                    : 'text-faint hover:text-mist'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* 内容区域 */}
          <div className="flex-1 overflow-y-auto p-4">
            {activeSection === 'control' && (
              <div className="space-y-6">
                {/* 播放控制 */}
                <div className="space-y-4">
                  <h3 className="font-dossier text-sm font-semibold text-brass tracking-wide">播放控制</h3>
                  
                  <div className="flex items-center justify-center">
                    <button
                      onClick={onTogglePlay}
                      disabled={isLoading || events.length === 0}
                      className="bg-brass/10 border border-brass/40 text-brass hover:bg-brass/20 disabled:bg-raised disabled:border-line disabled:text-faint disabled:cursor-not-allowed font-medium py-3 px-6 rounded-sm transition-colors flex items-center gap-2"
                    >
                      {isLoading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-brass border-t-transparent rounded-full animate-spin"></div>
                          加载中
                        </>
                      ) : isPlaying ? (
                        <>
                          <Pause className="w-4 h-4" />
                          暂停
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4" />
                          播放
                        </>
                      )}
                    </button>
                  </div>

                  {/* 音量控制 */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-mist">音量</span>
                      <button
                        onClick={onMuteToggle}
                        className="text-mist hover:text-paper transition-colors"
                      >
                        {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                      </button>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={volume}
                      onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                      className="w-full accent-brass"
                    />
                    <div className="font-data text-xs text-faint text-center">
                      {Math.round(volume * 100)}%
                    </div>
                  </div>

                  {/* 进度信息 */}
                  <div className="bg-raised border border-line rounded-sm p-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-mist">当前时间</span>
                      <span className="font-data text-paper">{formatTime(currentTimeMs)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-mist">总时长</span>
                      <span className="font-data text-paper">{formatTime(totalDurationMs)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-mist">当前事件</span>
                      <span className="font-data text-paper">{currentEventIndex + 1} / {events.length}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'timeline' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-dossier text-sm font-semibold text-brass tracking-wide">事件时间线</h3>
                  <span className="font-data text-xs text-faint">{events.length} 个事件</span>
                </div>
                
                <div className="space-y-2">
                  {events.map((event, index) => (
                    <div
                      key={event.id}
                      className={`p-3 rounded-sm cursor-pointer transition-colors ${
                        index === currentEventIndex
                          ? 'bg-brass/15 border border-brass/40'
                          : 'bg-raised hover:bg-panel border border-line'
                      }`}
                      onClick={() => onEventSelect(event)}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`w-2 h-2 rounded-full ${
                          index === currentEventIndex ? 'bg-brass' : 'bg-faint'
                        }`}></div>
                        <span className="text-sm font-medium text-brass truncate">
                          {event.character_name || '系统'}
                        </span>
                        <span className="font-data text-xs text-faint ml-auto">
                          {formatTime(event.startTimeMs)}
                        </span>
                      </div>
                      <p className="text-xs text-mist line-clamp-2 pl-4">
                        {event.content}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeSection === 'info' && (
              <div className="space-y-4">
                <h3 className="font-dossier text-sm font-semibold text-brass tracking-wide">回放信息</h3>
                
                <div className="space-y-3">
                  <div className="bg-raised border border-line rounded-sm p-3">
                    <div className="font-data text-sm text-mist mb-1">会话ID</div>
                    <div className="text-paper font-data text-xs break-all">{sessionId}</div>
                  </div>
                  
                  {detail && (
                    <>
                      <div className="bg-raised border border-line rounded-sm p-3">
                        <div className="font-data text-sm text-mist mb-1">剧本名称</div>
                        <div className="text-paper">{detail.script_info?.title || '未知剧本'}</div>
                      </div>
                      
                      <div className="bg-raised border border-line rounded-sm p-3">
                        <div className="font-data text-sm text-mist mb-1">游戏时间</div>
                        <div className="text-paper">
                          {detail.session_info?.created_at ? new Date(detail.session_info.created_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) : '未知'}
                        </div>
                      </div>
                      
                      <div className="bg-raised border border-line rounded-sm p-3">
                        <div className="font-data text-sm text-mist mb-1">游戏状态</div>
                        <div className="text-paper">{detail.status}</div>
                      </div>
                    </>
                  )}
                  
                  <div className="bg-raised border border-line rounded-sm p-3">
                    <div className="font-data text-sm text-mist mb-1">语音段数</div>
                    <div className="text-paper">{events.length} 段</div>
                  </div>
                  
                  <div className="bg-raised border border-line rounded-sm p-3">
                    <div className="font-data text-sm text-mist mb-1">总时长</div>
                    <div className="text-paper">{formatTime(totalDurationMs)}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 遮罩层 */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-30"
          onClick={onToggle}
        />
      )}
    </>
  );
}