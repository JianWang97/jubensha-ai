import React, { useState } from 'react';
import CharacterAvatars from './CharacterAvatars';
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
}

const GameControlDrawer: React.FC<GameControlDrawerProps> = ({
  open,
  onToggle,
  characters,
  gameLog,
  onExitGame,
  ttsEnabled,
  audioInitialized,
  toggleTTS,
  initializeAudio,
  phase,
  onNextPhase,
  currentSpeakingCharacter,
  currentSpeechText
}) => {
  const [activeSection, setActiveSection] = useState<'log' | 'controls' | 'tts'>('log');

  // 日志相关辅助
  const getLogStyle = (entry: any) => {
    if (entry.character === '系统') return 'bg-blue-800/40 border-l-4 border-blue-400/70';
    if (entry.type === 'action') return 'bg-green-800/40 border-l-4 border-green-400/70';
    if (entry.type === 'evidence') return 'bg-yellow-700/40 border-l-4 border-yellow-400/70';
    if (entry.type === 'vote') return 'bg-red-800/40 border-l-4 border-red-400/70';
    if (entry.type === 'phase') return 'bg-purple-800/40 border-l-4 border-purple-400/70';
    return 'bg-white/10 border-l-4 border-gray-500/60';
  };
  const getCharacterIcon = (character: string) => {
    if (character === '系统') return '🤖';
    if (character.includes('侦探')) return '🕵️';
    if (character.includes('医生')) return '👨‍⚕️';
    if (character.includes('小姐') || character.includes('女士')) return '👩';
    if (character.includes('先生')) return '👨';
    return '👤';
  };
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
      className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
        activeSection === id ? 'bg-white/20 text-white' : 'text-gray-300 hover:text-white hover:bg-white/10'
      }`}
    >
      {label}
    </button>
  );

  return (
    <>
      <button
        onClick={onToggle}
        className={`fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full shadow-lg border border-white/20 backdrop-blur-md transition-all flex items-center justify-center text-white font-semibold text-sm ${
          open ? 'bg-purple-600/80 hover:bg-purple-600' : 'bg-black/50 hover:bg-black/70'
        }`}
        title="打开/关闭控制面板"
      >
        {open ? '关闭' : '面板'}
      </button>

      <div
        className={`fixed top-0 right-0 h-full w-full max-w-[440px] z-30 transform transition-transform duration-300 ease-in-out backdrop-blur-xl bg-gradient-to-b from-black/80 to-black/60 border-l border-white/10 flex flex-col ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* 退出按钮区域 */}
        <div className="px-5 pt-4 pb-2 border-b border-white/10 flex justify-end">
          {onExitGame && (
            <button
              onClick={onExitGame}
              className="text-xs px-3 py-1.5 rounded-md bg-red-600/80 hover:bg-red-600 text-white font-medium shadow flex items-center gap-1"
            >
              🚪 退出游戏
            </button>
          )}
        </div>
        
        {/* Tab导航区域 */}
        <div className="px-5 pt-3 pb-3 border-b border-white/10 flex items-center justify-between">
          <div className="flex gap-2">
            <SectionButton id="log" label="日志" />
            <SectionButton id="controls" label="控制" />
            <SectionButton id="tts" label="TTS" />
          </div>
          <button
            onClick={onToggle}
            className="text-gray-400 hover:text-white text-xs"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {activeSection === 'controls' && (
            <div className="space-y-4">
              <h3 className="text-white font-semibold text-sm tracking-wide">游戏控制</h3>
              <div className="flex items-center justify-between bg-white/5 rounded-lg px-4 py-3 border border-white/10">
                <div className="text-sm text-gray-300">阶段: <span className="text-white font-medium">{phase || '未知'}</span></div>
                <button
                  onClick={onNextPhase}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-3 py-1.5 rounded-md text-xs font-medium shadow"
                >下一阶段</button>
              </div>
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-gray-400 uppercase">当前发言</h4>
                <div className="bg-white/5 border border-white/10 rounded-lg p-3 min-h-[90px] text-sm text-gray-200">
                  {currentSpeakingCharacter ? (
                    <div className="space-y-2">
                      <div className="font-semibold text-white">{currentSpeakingCharacter}</div>
                      <div className="text-gray-300 text-xs leading-relaxed whitespace-pre-wrap">
                        {currentSpeechText || '正在发言中...'}
                      </div>
                    </div>
                  ) : (
                    <div className="text-gray-400 text-xs">等待角色发言...</div>
                  )}
                </div>
              </div>
            </div>
          )}



          {activeSection === 'tts' && (
            <div className="space-y-4">
              <h3 className="text-white font-semibold text-sm tracking-wide">TTS 语音</h3>
              <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-lg p-3">
                <div className="text-2xl">{ttsEnabled ? '🔊' : '🔇'}</div>
                <div className="flex-1 text-sm text-gray-300">
                  <div className="font-medium text-white">{ttsEnabled ? '语音已启用' : '语音已禁用'}</div>
                  <div className="text-[11px] mt-1 opacity-70">
                    {ttsEnabled
                      ? (audioInitialized ? '音频已初始化，可正常播放' : '等待用户交互或点击初始化')
                      : '点击启用以播报角色语音'}
                  </div>
                </div>
                <button
                  onClick={toggleTTS}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shadow transition-colors ${
                    ttsEnabled ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}
                >{ttsEnabled ? '禁用' : '启用'}</button>
              </div>
              {ttsEnabled && !audioInitialized && (
                <button
                  onClick={() => initializeAudio().catch(()=>{})}
                  className="w-full bg-amber-600/80 hover:bg-amber-600 text-white text-xs font-medium px-3 py-2 rounded-md border border-amber-400/40"
                >初始化音频</button>
              )}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-gray-400 uppercase">最新发言</h4>
                <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-xs min-h-[80px] text-gray-300">
                  {currentSpeakingCharacter ? (
                    <>
                      <div className="font-semibold text-white mb-1">{currentSpeakingCharacter}</div>
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
                <h3 className="text-white font-semibold text-sm tracking-wide flex items-center gap-2">📜 游戏日志</h3>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg p-3 max-h-[60vh] overflow-y-auto space-y-3 custom-scrollbar">
                {(!gameLog || gameLog.length === 0) && (
                  <div className="text-center text-gray-400 text-xs py-8">
                    暂无日志，等待游戏事件...
                  </div>
                )}
                {gameLog && gameLog.map((entry: any, idx: number) => (
                  <div key={idx} className={`p-3 rounded-xl transition-colors ${getLogStyle(entry)} shadow-sm`}> 
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-semibold text-xs text-white flex items-center gap-2">
                        <span className="text-base leading-none">{getCharacterIcon(entry.character)}</span>
                        <span>{entry.character}</span>
                      </p>
                      {entry.timestamp && (
                        <span className="text-[10px] text-gray-400">{formatTimestamp(entry.timestamp)}</span>
                      )}
                    </div>
                    <p className="text-gray-200 text-xs leading-relaxed whitespace-pre-wrap">{entry.content}</p>
                    {entry.type && entry.type !== 'system' && (
                      <div className="mt-2">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide ${
                          entry.type === 'action' ? 'bg-green-600 text-white' :
                          entry.type === 'evidence' ? 'bg-yellow-400 text-black' :
                          entry.type === 'vote' ? 'bg-red-600 text-white' :
                          entry.type === 'phase' ? 'bg-purple-600 text-white' : 'bg-gray-600 text-white'
                        }`}>
                          {entry.type === 'action' ? '行动' :
                           entry.type === 'evidence' ? '证据' :
                           entry.type === 'vote' ? '投票' :
                           entry.type === 'phase' ? '阶段' : entry.type}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-white/10 text-[10px] text-gray-400 flex items-center justify-between">
          <span>统一控制面板</span>
          <span className="opacity-70">按“面板”快速开关</span>
        </div>
      </div>
    </>
  );
};

export default GameControlDrawer;
