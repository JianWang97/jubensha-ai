import React, { useState } from 'react';
import { LogOut, ScrollText, Volume2, VolumeX, X } from 'lucide-react';
// 已内联日志渲染逻辑，避免单独抽屉重复

interface GameControlDrawerProps {
  open: boolean;
  onToggle: () => void;
  characters: any[];
  gameLog: any[];
  onExitGame?: () => void;
  ttsEnabled: boolean;
  audioInitialized: boolean;
  toggleTTS: () => void;
  initializeAudio: () => Promise<void>;
  phase: string | undefined;
  onNextPhase: () => void;
  currentSpeakingCharacter?: string | null;
  currentSpeechText?: string | null;
  hideFloatButton?: boolean;
}

const GameControlDrawer: React.FC<GameControlDrawerProps> = ({
  open,
  onToggle,
  gameLog,
  onExitGame,
  ttsEnabled,
  audioInitialized,
  toggleTTS,
  initializeAudio,
  phase,
  onNextPhase,
  currentSpeakingCharacter,
  currentSpeechText,
  hideFloatButton = false,
}) => {
  const [activeSection, setActiveSection] = useState<'log' | 'controls' | 'tts'>('log');

  // 根据角色名字生成固定 HSL 颜色
  const getCharacterColor = (name: string): string => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 60%)`;
  };

  // 日志相关辅助
  const getLogBg = (entry: any) => {
    if (entry.character === '系统') return 'bg-thread/10';
    if (entry.type === 'action') return 'bg-green-900/15';
    if (entry.type === 'evidence') return 'bg-yellow-900/15';
    if (entry.type === 'vote') return 'bg-thread/10';
    if (entry.type === 'phase') return 'bg-brass/10';
    return 'bg-raised';
  };
  const getLogStyle = (entry: any) => getLogBg(entry);
  const formatTimestamp = (timestamp?: string | Date) => {
    if (!timestamp) return '';
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };
  const logEndRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (activeSection === 'log') {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [gameLog, activeSection]);

  const SectionButton = ({ id, label }: { id: 'log' | 'controls' | 'tts'; label: string }) => (
    <button
      onClick={() => setActiveSection(id)}
      className={`px-3 py-1 rounded-sm text-sm font-medium transition-colors ${
        activeSection === id ? 'bg-brass/15 text-brass' : 'text-mist hover:text-paper hover:bg-raised/60'
      }`}
    >
      {label}
    </button>
  );

  return (
    <>
      {!hideFloatButton && (
      <button
        onClick={onToggle}
        className={`fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full shadow-lg border transition-all flex items-center justify-center font-semibold text-sm ${
          open ? 'bg-brass/20 border-brass/40 text-brass' : 'bg-panel border-line text-mist hover:bg-raised'
        }`}
        title="打开/关闭控制面板"
      >
        {open ? '关闭' : '面板'}
      </button>
      )}

      <div
        className={`fixed top-0 right-0 h-full w-full max-w-[440px] z-30 transform transition-transform duration-300 ease-in-out bg-panel border-l border-line flex flex-col ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* 退出按钮区域 */}
        <div className="px-5 pt-4 pb-2 border-b border-line flex justify-end">
          {onExitGame && (
            <button
              onClick={onExitGame}
              className="text-xs px-3 py-1.5 rounded-sm bg-thread/10 border border-thread/30 text-thread hover:bg-thread/20 font-medium flex items-center gap-1 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              退出游戏
            </button>
          )}
        </div>
        
        {/* Tab导航区域 */}
        <div className="px-5 pt-3 pb-3 border-b border-line flex items-center justify-between">
          <div className="flex gap-2">
            <SectionButton id="log" label="日志" />
            <SectionButton id="controls" label="控制" />
            <SectionButton id="tts" label="TTS" />
          </div>
          <button
            onClick={onToggle}
            className="text-faint hover:text-paper text-xs"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {activeSection === 'controls' && (
            <div className="space-y-4">
              <h3 className="font-dossier text-paper font-semibold text-sm tracking-wide">游戏控制</h3>
              <div className="flex items-center justify-between bg-raised rounded-sm px-4 py-3 border border-line">
                <div className="text-sm text-mist">阶段: <span className="text-paper font-medium">{phase || '未知'}</span></div>
                <button
                  onClick={onNextPhase}
                  className="bg-brass/10 border border-brass/40 text-brass hover:bg-brass/20 px-3 py-1.5 rounded-sm text-xs font-medium transition-colors"
                >下一阶段</button>
              </div>
              <div className="space-y-2">
                <h4 className="font-data text-[11px] font-semibold text-faint uppercase tracking-wider">当前发言</h4>
                <div className="bg-raised border border-line rounded-sm p-3 min-h-[90px] text-sm text-mist">
                  {currentSpeakingCharacter ? (
                    <div className="space-y-2">
                      <div className="font-semibold text-paper">{currentSpeakingCharacter}</div>
                      <div className="text-mist text-xs leading-relaxed whitespace-pre-wrap">
                        {currentSpeechText || '正在发言中...'}
                      </div>
                    </div>
                  ) : (
                    <div className="text-faint text-xs">等待角色发言...</div>
                  )}
                </div>
              </div>
            </div>
          )}



          {activeSection === 'tts' && (
            <div className="space-y-4">
              <h3 className="font-dossier text-paper font-semibold text-sm tracking-wide">TTS 语音</h3>
              <div className="flex items-center gap-3 bg-raised border border-line rounded-sm p-3">
                <div className="text-brass">{ttsEnabled ? <Volume2 className="h-6 w-6" /> : <VolumeX className="h-6 w-6" />}</div>
                <div className="flex-1 text-sm text-mist">
                  <div className="font-medium text-paper">{ttsEnabled ? '语音已启用' : '语音已禁用'}</div>
                  <div className="text-[11px] mt-1 opacity-70">
                    {ttsEnabled
                      ? (audioInitialized ? '音频已初始化，可正常播放' : '等待用户交互或点击初始化')
                      : '点击启用以播报角色语音'}
                  </div>
                </div>
                <button
                  onClick={toggleTTS}
                  className={`px-3 py-1.5 rounded-sm text-xs font-medium whitespace-nowrap transition-colors ${
                    ttsEnabled ? 'bg-thread hover:bg-thread-dim text-paper' : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}
                >{ttsEnabled ? '禁用' : '启用'}</button>
              </div>
              {ttsEnabled && !audioInitialized && (
                <button
                  onClick={() => initializeAudio().catch(()=>{})}
                  className="w-full bg-amber-600/80 hover:bg-amber-600 text-white text-xs font-medium px-3 py-2 rounded-sm border border-amber-400/40"
                >初始化音频</button>
              )}
              <div className="space-y-2">
                <h4 className="font-data text-[11px] font-semibold text-faint uppercase tracking-wider">最新发言</h4>
                <div className="bg-raised border border-line rounded-sm p-3 text-xs text-mist min-h-[80px]">
                  {currentSpeakingCharacter ? (
                    <>
                      <div className="font-semibold text-paper mb-1">{currentSpeakingCharacter}</div>
                      <div className="leading-relaxed whitespace-pre-wrap">{currentSpeechText || '正在发言中...'}</div>
                    </>
                  ) : '暂无'}
                </div>
              </div>
            </div>
          )}

          {activeSection === 'log' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-dossier text-paper font-semibold text-sm tracking-wide flex items-center gap-2">
                  <ScrollText className="h-4 w-4 text-brass" /> 游戏日志
                </h3>
              </div>
              <div className="bg-ink/40 border border-line rounded-sm p-3 max-h-[60vh] overflow-y-auto space-y-3 custom-scrollbar">
                {(!gameLog || gameLog.length === 0) && (
                  <div className="text-center text-faint text-xs py-8">
                    暂无日志，等待游戏事件...
                  </div>
                )}
                {gameLog && gameLog.map((entry: any, idx: number) => {
                  const charColor = entry.character === '系统' ? '#C9A15F' : getCharacterColor(entry.character);
                  return (
                  <div
                    key={idx}
                    className={`p-3 rounded-sm border border-line border-l-4 transition-colors ${getLogStyle(entry)}`}
                    style={{ borderLeftColor: charColor }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-semibold text-xs flex items-center gap-1.5">
                        <span
                          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-ink flex-shrink-0"
                          style={{ backgroundColor: charColor }}
                        >
                          {entry.character[0]}
                        </span>
                        <span className="text-brass">{entry.character}</span>
                      </p>
                      {entry.timestamp && (
                        <span className="font-data text-[11px] text-faint">{formatTimestamp(entry.timestamp)}</span>
                      )}
                    </div>
                    <p className="text-mist text-xs leading-relaxed whitespace-pre-wrap">{entry.content}</p>
                    {entry.type && entry.type !== 'system' && (
                      <div className="mt-2">
                        <span className={`inline-block px-2 py-0.5 rounded-sm text-[10px] font-semibold tracking-wide ${
                          entry.type === 'action' ? 'bg-green-600 text-white' :
                          entry.type === 'evidence' ? 'bg-yellow-400 text-black' :
                          entry.type === 'vote' ? 'bg-thread text-white' :
                          entry.type === 'phase' ? 'bg-brass text-ink' : 'bg-raised border border-line text-mist'
                        }`}>
                          {entry.type === 'action' ? '行动' :
                           entry.type === 'evidence' ? '证据' :
                           entry.type === 'vote' ? '投票' :
                           entry.type === 'phase' ? '阶段' : entry.type}
                        </span>
                      </div>
                    )}
                  </div>
                  );
                })}
                <div ref={logEndRef} />
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-line font-data text-[10px] text-faint flex items-center justify-between">
          <span>统一控制面板</span>
          <span className="opacity-70">按“面板”快速开关</span>
        </div>
      </div>
    </>
  );
};

export default GameControlDrawer;
