import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { AlertTriangle, BookOpen, ChevronLeft, LogOut, MessageCircle, ScrollText, Theater, X } from 'lucide-react';

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
      return 'bg-thread/10';
    }
    if (entry.type === 'action') {
      return 'bg-green-900/15';
    }
    if (entry.type === 'evidence') {
      return 'bg-yellow-900/15';
    }
    if (entry.type === 'vote') {
      return 'bg-thread/10';
    }
    if (entry.type === 'phase') {
      return 'bg-brass/10';
    }
    return 'bg-raised';
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
        } bg-panel border border-line hover:bg-raised text-paper p-3 rounded-l-sm`}
      >
        <div className="flex flex-col items-center gap-1">
          <span className="text-brass">{isDrawerOpen ? <BookOpen className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}</span>
          <span className="text-xs font-medium">
            {isDrawerOpen ? '收起' : '日志'}
          </span>
          {gameLog.length > 0 && !isDrawerOpen && (
            <span className="bg-thread text-paper text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {gameLog.length > 99 ? '99+' : gameLog.length}
            </span>
          )}
        </div>
      </button>

      {/* 右侧抽屉 */}
      <div className={`fixed top-0 right-0 h-full bg-panel border-l border-line transform transition-all duration-300 z-40 ${
        isDrawerOpen ? 'translate-x-0' : 'translate-x-full'
      } ${isCollapsed ? 'w-[80px]' : 'w-[400px]'}`}>
        <div className="h-full flex flex-col">
          {/* 抽屉头部 */}
          <div className="p-4 border-b border-line">
            {isCollapsed ? (
              <div className="flex flex-col items-center gap-3">
                <button
                  onClick={() => setIsCollapsed(false)}
                  className="text-faint hover:text-paper transition-colors p-1"
                  title="展开"
                >
                  <ScrollText className="h-5 w-5 text-brass" />
                </button>
                <button
                  onClick={handleExitGame}
                  className="text-thread hover:text-thread-dim transition-colors p-1"
                  title="退出游戏"
                >
                  <LogOut className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="text-faint hover:text-paper transition-colors p-1"
                  title="关闭"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <h3 className="font-dossier text-paper font-bold text-lg flex items-center gap-2">
                  <ScrollText className="h-5 w-5 text-brass" />
                  游戏日志
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExitGame}
                    className="text-thread hover:text-thread-dim transition-colors px-2 py-1 rounded-sm text-sm font-medium"
                    title="退出游戏"
                  >
                    <LogOut className="h-4 w-4 mr-1 inline-block -mt-0.5" />
                    退出
                  </button>
                  <button
                    onClick={() => setIsCollapsed(true)}
                    className="text-faint hover:text-paper transition-colors p-1"
                    title="收缩"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setIsDrawerOpen(false)}
                    className="text-faint hover:text-paper transition-colors p-1"
                    title="关闭"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 抽屉内容 */}
          <div className={`flex-1 overflow-y-auto ${isCollapsed ? 'hidden' : 'p-4'}`}>
            {gameLog.length === 0 ? (
              <div className="text-center text-mist py-16">
                <Theater className="h-12 w-12 text-brass mx-auto mb-4" />
                <p className="font-dossier text-lg mb-2">剧本杀即将开始</p>
                <p className="text-sm text-faint">精彩的故事正在等待...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {gameLog.map((entry, index) => {
                  const charColor = entry.character === '系统' ? '#C9A15F' : getCharacterColor(entry.character);
                  return (
                  <div
                    key={index}
                    className={`p-4 rounded-sm border border-line border-l-4 transition-colors ${getLogStyle(entry)}`}
                    style={{ borderLeftColor: charColor }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-bold text-sm flex items-center gap-2">
                        <span
                          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-ink flex-shrink-0"
                          style={{ backgroundColor: charColor }}
                        >
                          {entry.character[0]}
                        </span>
                        <span className="text-brass">{entry.character}</span>
                      </p>
                      {entry.timestamp && (
                        <span className="font-data text-[11px] text-faint">
                          {formatTimestamp(entry.timestamp.toISOString())}
                        </span>
                      )}
                    </div>
                    <p className="text-mist leading-relaxed text-sm">{entry.content}</p>
                    {entry.type && entry.type !== 'system' && (
                      <div className="mt-2">
                        <span className={`inline-block px-2 py-1 rounded-sm text-xs font-semibold ${
                          entry.type === 'action' ? 'bg-green-600 text-white' :
                          entry.type === 'evidence' ? 'bg-yellow-600 text-black' :
                          entry.type === 'vote' ? 'bg-thread text-white' :
                          entry.type === 'phase' ? 'bg-brass text-ink' :
                          'bg-raised border border-line text-mist'
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
          <div className="bg-panel border border-line rounded-sm p-6 max-w-md mx-4">
            <div className="text-center">
              <AlertTriangle className="text-4xl text-thread mx-auto mb-4" />
              <h3 className="font-dossier text-paper font-bold text-xl mb-2">确认退出游戏</h3>
              <p className="text-mist mb-6">
                退出后将丢失当前游戏进度，确定要离开吗？
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={cancelExitGame}
                  className="px-6 py-2 bg-raised text-mist border border-line hover:bg-panel rounded-sm transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={confirmExitGame}
                  className="px-6 py-2 bg-thread hover:bg-thread-dim text-paper rounded-sm transition-colors"
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