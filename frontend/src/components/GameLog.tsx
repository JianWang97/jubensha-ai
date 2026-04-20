import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';

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
  const router = useRouter();
  const logEndRef = useRef<HTMLDivElement>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // 自动滚动到最新日志
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [gameLog]);

  // 退出游戏处理
  const handleExitGame = () => {
    setShowExitConfirm(true);
  };

  const confirmExitGame = () => {
    // 清理游戏状态
    localStorage.removeItem('gameState');
    localStorage.removeItem('currentSession');
    // 跳转到剧本库页面
    router.push('/scripts');
  };

  const cancelExitGame = () => {
    setShowExitConfirm(false);
  };


  const getCharacterColor = (name: string): string => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 60%)`;
  };

  const getLogStyle = (entry: GameLogEntry) => {
    if (entry.character === '系统') {
      return 'bg-blue-800/50';
    }
    if (entry.type === 'action') {
      return 'bg-green-800/50';
    }
    if (entry.type === 'evidence') {
      return 'bg-yellow-800/50';
    }
    if (entry.type === 'vote') {
      return 'bg-red-800/50';
    }
    if (entry.type === 'phase') {
      return 'bg-purple-800/50';
    }
    return 'bg-white/10';
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
          isDrawerOpen ? (isCollapsed ? 'right-[80px]' : 'right-[420px]') : 'right-4'
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
      <div className={`fixed top-0 right-0 h-full bg-black/40 backdrop-blur-xl border-l border-white/20 shadow-2xl transform transition-all duration-300 z-40 ${
        isDrawerOpen ? 'translate-x-0' : 'translate-x-full'
      } ${isCollapsed ? 'w-[80px]' : 'w-[400px]'}`}>
        <div className="h-full flex flex-col">
          {/* 抽屉头部 */}
          <div className="p-4 border-b border-white/20">
            {isCollapsed ? (
              <div className="flex flex-col items-center gap-3">
                <button
                  onClick={() => setIsCollapsed(false)}
                  className="text-white/60 hover:text-white transition-colors p-1 text-lg"
                  title="展开"
                >
                  📜
                </button>
                <button
                  onClick={handleExitGame}
                  className="text-red-400 hover:text-red-300 transition-colors p-1 text-lg"
                  title="退出游戏"
                >
                  🚪
                </button>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="text-white/60 hover:text-white transition-colors p-1 text-lg"
                  title="关闭"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <h3 className="text-white font-bold text-lg flex items-center gap-2">
                  <span>📜</span>
                  游戏日志
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExitGame}
                    className="text-red-400 hover:text-red-300 transition-colors px-2 py-1 rounded text-sm font-medium"
                    title="退出游戏"
                  >
                    🚪 退出
                  </button>
                  <button
                    onClick={() => setIsCollapsed(true)}
                    className="text-white/60 hover:text-white transition-colors p-1"
                    title="收缩"
                  >
                    ⬅
                  </button>
                  <button
                    onClick={() => setIsDrawerOpen(false)}
                    className="text-white/60 hover:text-white transition-colors p-1"
                    title="关闭"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 抽屉内容 */}
          <div className={`flex-1 overflow-y-auto ${isCollapsed ? 'hidden' : 'p-4'}`}>
            {gameLog.length === 0 ? (
              <div className="text-center text-gray-300 py-16">
                <div className="text-4xl mb-4">🎭</div>
                <p className="text-lg mb-2">剧本杀即将开始</p>
                <p className="text-sm opacity-70">精彩的故事正在等待...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {gameLog.map((entry, index) => {
                  const charColor = entry.character === '系统' ? 'rgb(96, 165, 250)' : getCharacterColor(entry.character);
                  return (
                  <div
                    key={index}
                    className={`p-4 rounded-xl transition-all duration-300 hover:scale-[1.02] ${getLogStyle(entry)} border-l-4`}
                    style={{ borderLeftColor: charColor }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-bold text-sm flex items-center gap-2">
                        <span
                          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                          style={{ backgroundColor: charColor }}
                        >
                          {entry.character[0]}
                        </span>
                        <span style={{ color: charColor }}>{entry.character}</span>
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
                  );
                })}
                <div ref={logEndRef} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 遮罩层 */}
      {isDrawerOpen && !isCollapsed && (
        <div 
          className="fixed inset-0 bg-black/20 z-30"
          onClick={() => setIsDrawerOpen(false)}
        />
      )}

      {/* 退出游戏确认对话框 */}
      {showExitConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-black/80 backdrop-blur-xl rounded-2xl p-6 border border-white/20 shadow-2xl max-w-md mx-4">
            <div className="text-center">
              <div className="text-4xl mb-4">⚠️</div>
              <h3 className="text-white font-bold text-xl mb-2">确认退出游戏</h3>
              <p className="text-gray-300 mb-6">
                退出后将丢失当前游戏进度，确定要离开吗？
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={cancelExitGame}
                  className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={confirmExitGame}
                  className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                >
                  确认退出
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GameLog;