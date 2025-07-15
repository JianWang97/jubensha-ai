import React, { useEffect, useRef, useState } from 'react';

interface GameLogEntry {
  character: string;
  content: string;
  type?: string;
  timestamp?: Date;
}

interface GameLogProps {
  gameLog: GameLogEntry[];
}

const GameLog = ({ gameLog = [] }: GameLogProps) => {
  const logEndRef = useRef<HTMLDivElement>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // 自动滚动到最新日志
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [gameLog]);


  const getLogStyle = (entry: GameLogEntry) => {
    if (entry.character === '系统') {
      return 'bg-blue-800/50 border-l-4 border-blue-400';
    }
    if (entry.type === 'action') {
      return 'bg-green-800/50 border-l-4 border-green-400';
    }
    if (entry.type === 'evidence') {
      return 'bg-yellow-800/50 border-l-4 border-yellow-400';
    }
    if (entry.type === 'vote') {
      return 'bg-red-800/50 border-l-4 border-red-400';
    }
    if (entry.type === 'phase') {
      return 'bg-purple-800/50 border-l-4 border-purple-400';
    }
    return 'bg-white/10 border-l-4 border-gray-400';
  };

  const getCharacterIcon = (character: string) => {
    if (character === '系统') return '🤖';
    if (character.includes('侦探')) return '🕵️';
    if (character.includes('医生')) return '👨‍⚕️';
    if (character.includes('小姐') || character.includes('女士')) return '👩';
    if (character.includes('先生')) return '👨';
    return '👤';
  };

  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  return (
    <>
      {/* 抽屉切换按钮 */}
      <button
        onClick={() => setIsDrawerOpen(!isDrawerOpen)}
        className={`fixed top-1/2 -translate-y-1/2 z-50 transition-all duration-300 ${
          isDrawerOpen ? 'right-[420px]' : 'right-4'
        } bg-white/10 backdrop-blur-lg hover:bg-white/20 text-white p-3 rounded-l-xl border border-white/20 shadow-lg`}
      >
        <div className="flex flex-col items-center gap-1">
          <span className="text-lg">{isDrawerOpen ? '📖' : '💬'}</span>
          <span className="text-xs font-medium">
            {isDrawerOpen ? '收起' : '日志'}
          </span>
          {gameLog.length > 0 && !isDrawerOpen && (
            <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {gameLog.length > 99 ? '99+' : gameLog.length}
            </span>
          )}
        </div>
      </button>

      {/* 右侧抽屉 */}
      <div className={`fixed top-0 right-0 h-full w-[400px] bg-black/40 backdrop-blur-xl border-l border-white/20 shadow-2xl transform transition-transform duration-300 z-40 ${
        isDrawerOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        <div className="h-full flex flex-col">
          {/* 抽屉头部 */}
          <div className="p-4 border-b border-white/20">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-bold text-lg flex items-center gap-2">
                <span>📜</span>
                游戏日志
              </h3>
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="text-white/60 hover:text-white transition-colors p-1"
              >
                ✕
              </button>
            </div>
          </div>

          {/* 抽屉内容 */}
          <div className="flex-1 overflow-y-auto p-4">
            {gameLog.length === 0 ? (
              <div className="text-center text-gray-300 py-16">
                <div className="text-4xl mb-4">🎭</div>
                <p className="text-lg mb-2">剧本杀即将开始</p>
                <p className="text-sm opacity-70">精彩的故事正在等待...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {gameLog.map((entry, index) => (
                  <div key={index} className={`p-4 rounded-xl transition-all duration-300 hover:scale-[1.02] ${getLogStyle(entry)}`}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-bold text-sm text-white flex items-center gap-2">
                        <span className="text-lg">{getCharacterIcon(entry.character)}</span>
                        {entry.character}
                      </p>
                      {entry.timestamp && (
                        <span className="text-xs text-gray-400 opacity-60">
                          {formatTimestamp(entry.timestamp.toISOString())}
                        </span>
                      )}
                    </div>
                    <p className="text-gray-200 leading-relaxed text-sm">{entry.content}</p>
                    {entry.type && entry.type !== 'system' && (
                      <div className="mt-2">
                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${
                          entry.type === 'action' ? 'bg-green-600 text-white' :
                          entry.type === 'evidence' ? 'bg-yellow-600 text-black' :
                          entry.type === 'vote' ? 'bg-red-600 text-white' :
                          entry.type === 'phase' ? 'bg-purple-600 text-white' :
                          'bg-gray-600 text-white'
                        }`}>
                          {entry.type === 'action' ? '行动' :
                           entry.type === 'evidence' ? '证据' :
                           entry.type === 'vote' ? '投票' :
                           entry.type === 'phase' ? '阶段' :
                           entry.type}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 遮罩层 */}
      {isDrawerOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-30"
          onClick={() => setIsDrawerOpen(false)}
        />
      )}
    </>
  );
};

export default GameLog;