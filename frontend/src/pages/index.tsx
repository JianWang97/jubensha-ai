import Link from 'next/link';
import { useState, useEffect } from 'react';
import { ScriptsService, ScriptInfo } from '@/client';

// 剧本数据接口
interface ScriptDisplay {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  players: string;
  duration: string;
}

// 将后端数据转换为显示格式
const convertScriptInfo = (scriptInfo: ScriptInfo): ScriptDisplay => {
  const playerCount = scriptInfo.player_count || 0;
  const duration = scriptInfo.estimated_duration || 0;
  
  return {
    id: scriptInfo.id?.toString() || '0',
    title: scriptInfo.title || '未命名剧本',
    description: scriptInfo.description || '暂无描述',
    difficulty: scriptInfo.difficulty_level || '未知',
    players: `${playerCount}人`,
    duration: `${Math.floor(duration / 60)}小时${duration % 60 > 0 ? `${duration % 60}分钟` : ''}`
  };
};

export default function HomePage() {
  const [sessionId, setSessionId] = useState('');
  const [scriptId, setScriptId] = useState('1');
  const [scripts, setScripts] = useState<ScriptDisplay[]>([]);
  const [selectedScript, setSelectedScript] = useState<ScriptDisplay | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 获取剧本列表
  const fetchScripts = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await ScriptsService.getScriptsApiScriptsGet();
      
      if (response.items) {
        const convertedScripts = response.items.map(convertScriptInfo);
        setScripts(convertedScripts);
        
        // 设置默认选中的剧本
        const defaultScript = convertedScripts.find(s => s.id === scriptId) || convertedScripts[0];
        if (defaultScript) {
          setSelectedScript(defaultScript);
        }
      } else {
        setError('获取剧本列表失败');
      }
    } catch (err) {
      console.error('获取剧本列表失败:', err);
      setError('获取剧本列表失败，请检查网络连接');
    } finally {
      setLoading(false);
    }
  };

  // 组件挂载时获取剧本列表
  useEffect(() => {
    fetchScripts();
  }, []);

  // 当scriptId改变时更新selectedScript
  useEffect(() => {
    if (scripts.length > 0) {
      const script = scripts.find(s => s.id === scriptId) || scripts[0];
      setSelectedScript(script);
    }
  }, [scriptId, scripts]);

  const gameUrl = sessionId 
    ? `/game?session_id=${encodeURIComponent(sessionId)}&script_id=${scriptId}`
    : `/game?script_id=${scriptId}`;

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
      <div className="text-center max-w-2xl">
        <h1 className="text-5xl md:text-7xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600" style={{ textShadow: '0 0 15px rgba(255, 255, 255, 0.3)' }}>
          AI 剧本杀
        </h1>
        <p className="text-lg md:text-xl text-gray-300 mb-8">
          欢迎来到 AI 驱动的剧本杀世界。在这里，每个选择都至关重要，每个线索都可能揭示真相。与您的朋友一起，或与我们的 AI 角色对战，解开复杂的谜团。
        </p>
        
        {/* 游戏设置区域 */}
        <div className="mb-8 p-6 bg-gray-800 rounded-lg shadow-lg">
          <h2 className="text-2xl font-semibold mb-4 text-purple-400">快速开始</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="sessionId" className="block text-sm font-medium text-gray-300 mb-2">
                房间ID (可选)
              </label>
              <input
                id="sessionId"
                type="text"
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                placeholder="输入房间ID加入现有游戏，留空则创建新游戏"
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                选择剧本
              </label>
              
              {/* 加载状态 */}
              {loading && (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                  <span className="ml-2 text-gray-400">加载剧本列表中...</span>
                </div>
              )}
              
              {/* 错误状态 */}
              {error && (
                <div className="p-4 bg-red-900/20 border border-red-500 rounded-lg mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-red-400">{error}</span>
                    <button
                      onClick={fetchScripts}
                      className="text-sm text-purple-400 hover:text-purple-300 underline"
                    >
                      重试
                    </button>
                  </div>
                </div>
              )}
              
              {/* 剧本列表 */}
              {!loading && !error && scripts.length > 0 && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                    {scripts.map((script) => (
                      <div
                        key={script.id}
                        onClick={() => setScriptId(script.id)}
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                          scriptId === script.id
                            ? 'border-purple-500 bg-purple-900/30'
                            : 'border-gray-600 bg-gray-700/50 hover:border-purple-400 hover:bg-gray-700'
                        }`}
                      >
                        <h3 className={`font-semibold mb-2 ${
                          scriptId === script.id ? 'text-purple-300' : 'text-white'
                        }`}>
                          {script.title}
                        </h3>
                        <p className="text-sm text-gray-400 mb-2 line-clamp-2">
                          {script.description}
                        </p>
                        <div className="flex flex-wrap gap-2 text-xs">
                          <span className={`px-2 py-1 rounded ${
                            script.difficulty === '简单' ? 'bg-green-600/20 text-green-400' :
                            script.difficulty === '中等' ? 'bg-yellow-600/20 text-yellow-400' :
                            'bg-red-600/20 text-red-400'
                          }`}>
                            {script.difficulty}
                          </span>
                          <span className="px-2 py-1 rounded bg-blue-600/20 text-blue-400">
                            {script.players}
                          </span>
                          <span className="px-2 py-1 rounded bg-gray-600/20 text-gray-400">
                            {script.duration}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* 选中剧本的详细信息 */}
                  {selectedScript && (
                    <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                      <h4 className="text-lg font-semibold text-purple-300 mb-2">
                        当前选择: {selectedScript.title}
                      </h4>
                      <p className="text-sm text-gray-300 mb-3">
                        {selectedScript.description}
                      </p>
                      <div className="flex flex-wrap gap-3 text-sm">
                        <div className="flex items-center gap-1">
                          <span className="text-gray-400">难度:</span>
                          <span className={`font-medium ${
                            selectedScript.difficulty === '简单' ? 'text-green-400' :
                            selectedScript.difficulty === '中等' ? 'text-yellow-400' :
                            'text-red-400'
                          }`}>
                            {selectedScript.difficulty}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-gray-400">人数:</span>
                          <span className="text-blue-400 font-medium">{selectedScript.players}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-gray-400">时长:</span>
                          <span className="text-gray-300 font-medium">{selectedScript.duration}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
              
              {/* 无剧本状态 */}
              {!loading && !error && scripts.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-gray-400 mb-4">暂无可用剧本</p>
                  <button
                    onClick={fetchScripts}
                    className="text-purple-400 hover:text-purple-300 underline"
                  >
                    刷新列表
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href={gameUrl} className="px-8 py-4 bg-purple-600 hover:bg-purple-700 rounded-lg text-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg shadow-purple-500/50">
            进入游戏大厅
          </Link>
          <Link href="/script-manager" className="px-8 py-4 bg-gray-700 hover:bg-gray-600 rounded-lg text-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg shadow-gray-500/50">
            管理我的剧本
          </Link>
        </div>
      </div>
      <footer className="absolute bottom-8 text-gray-500">
        <p>&copy; {new Date().getFullYear()} AI JUBENSHA. All rights reserved.</p>
      </footer>
    </div>
  );
}

