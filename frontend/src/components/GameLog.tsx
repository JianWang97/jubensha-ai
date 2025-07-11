import React, { useEffect, useRef } from 'react';

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
    <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 shadow-2xl h-[500px] overflow-y-auto border border-white/20">
      <h3 className="text-2xl font-bold text-white mb-5">游戏日志 ({gameLog.length})</h3>
      {gameLog.length === 0 ? (
        <div className="text-center text-gray-300 py-8">
          <p>暂无游戏日志</p>
          <p className="text-sm mt-2">开始游戏后将显示对话和行动</p>
        </div>
      ) : (
        <div className="space-y-4">
          {gameLog.map((entry, index) => (
            <div key={index} className={`p-4 rounded-lg transition-all duration-300 hover:bg-opacity-80 ${getLogStyle(entry)}`}>
              <div className="flex items-center justify-between mb-2">
                <p className="font-bold text-lg text-white flex items-center gap-2">
                  <span className="text-xl">{getCharacterIcon(entry.character)}</span>
                  {entry.character}
                </p>
                {entry.timestamp && (
                  <span className="text-xs text-gray-400">
                    {formatTimestamp(entry.timestamp.toISOString())}
                  </span>
                )}
              </div>
              <p className="text-gray-300 leading-relaxed">{entry.content}</p>
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
  );
};

export default GameLog;