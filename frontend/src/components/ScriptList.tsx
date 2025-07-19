import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { ScriptInfo, ScriptsService, ScriptStatus, Service } from '@/client';

const ScriptList = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 使用 client services 替代 useApiClient
  const getScripts = async () => {
    const response = await ScriptsService.getScriptsApiScriptsGet();
    return response.items || [];
  };
  
  const deleteScript = async (scriptId: number) => {
    const response = await ScriptsService.deleteScriptApiScriptsScriptIdDelete(scriptId);
    return response.data;
  };
  const [scripts, setScripts] = useState<ScriptInfo[]>([]);

  // 获取脚本数据
  useEffect(() => {
    const fetchScripts = async () => {
      setLoading(true);
      setError(null);
      try {
        const scriptData = await getScripts();
        setScripts(scriptData.map(script => ({
          ...script
        })));
      } catch (err) {
        console.error('获取脚本列表失败:', err);
        setError('获取脚本列表失败');
      } finally {
        setLoading(false);
      }
    };

    fetchScripts();
  }, []);

  // 编辑脚本处理
  const handleEdit = (scriptId: number) => {
    router.push(`/script-manager/edit/${scriptId}`);
  };

  // 删除脚本处理
  const handleDelete = async (scriptId: number) => {
    if (window.confirm('确定要删除这个脚本吗？')) {
      try {
        await deleteScript(scriptId);
        // 重新获取脚本列表
        const scriptData = await getScripts();
        setScripts(scriptData);
      } catch (err) {
        console.error('删除脚本失败:', err);
        setError('删除脚本失败');
      }
    }
  };

  if (loading) {
    return (
      <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-lg p-8 text-center">
        <div className="text-gray-600">加载中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-lg p-8 text-center">
        <div className="text-red-600">错误: {error}</div>
      </div>
    );
  }

  // 获取难度对应的颜色和图标
  const getDifficultyStyle = (difficulty: string) => {
    switch (difficulty) {
      case '简单':
        return { bg: 'from-green-400 to-emerald-500', icon: '⭐', glow: 'shadow-green-500/25' };
      case '中等':
        return { bg: 'from-yellow-400 to-orange-500', icon: '⚡', glow: 'shadow-yellow-500/25' };
      case '困难':
        return { bg: 'from-red-500 to-pink-600', icon: '🔥', glow: 'shadow-red-500/25' };
      default:
        return { bg: 'from-gray-400 to-gray-500', icon: '❓', glow: 'shadow-gray-500/25' };
    }
  };

  // 获取状态样式
  const getStatusStyle = (status: ScriptStatus) => {
    if (status === ScriptStatus.ARCHIVED || status === ScriptStatus.PUBLISHED) {
      return 'bg-gradient-to-r from-green-400 to-emerald-500 text-white shadow-lg shadow-green-500/25';
    }
    return 'bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-500/25';
  };

  return (
    <div className="space-y-6">
      {/* 游戏化标题栏 */}
      <div className="bg-gradient-to-r from-purple-900 via-blue-900 to-indigo-900 rounded-2xl p-6 shadow-2xl border border-purple-500/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-400 to-pink-500 rounded-xl flex items-center justify-center text-2xl shadow-lg">
              🎭
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">剧本档案库</h2>
              <p className="text-purple-200">共 {scripts.length} 个剧本等待探索</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">
              {scripts.filter(s => s.status === ScriptStatus.ARCHIVED || s.status === ScriptStatus.PUBLISHED).length}
            </div>
            <div className="text-sm text-purple-200">已发布</div>
          </div>
        </div>
      </div>

      {/* 游戏化卡片网格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {scripts.map((script) => {
          return (
            <div 
              key={script.id} 
              className="group relative bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 rounded-2xl p-6 shadow-2xl border border-purple-500/20 hover:border-purple-400/40 transition-all duration-300 hover:scale-105 hover:shadow-purple-500/25"
            >
              {/* 背景光效 */}
              <div className="absolute inset-0 bg-gradient-to-br from-purple-600/10 to-pink-600/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              
              {/* 状态徽章 */}
              <div className="absolute -top-2 -right-2">
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusStyle(script.status!)} transform rotate-12`}>
                  {script.status === ScriptStatus.ARCHIVED ? '🚀 已发布' : 
                   script.status === ScriptStatus.PUBLISHED ? '🚀 已发布' :
                   script.status === ScriptStatus.DRAFT ? '📝 草稿' : script.status}
                </span>
              </div>

              {/* 主要内容 */}
              <div className="relative z-10">
                {/* 标题区域 */}
                <div className="mb-4">
                  <h3 className="text-xl font-bold text-white mb-2 group-hover:text-purple-200 transition-colors">
                    {script.title}
                  </h3>
                  <p className="text-gray-400 text-sm line-clamp-2">
                    {script.description || '暂无描述'}
                  </p>
                </div>

                {/* 游戏信息 */}
                <div className="space-y-3 mb-6">
                  {/* 玩家人数 */}
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center text-white font-bold shadow-lg">
                      👥
                    </div>
                    <span className="text-gray-300">{script.player_count} 人游戏</span>
                  </div>
                </div>

                {/* 操作按钮 */}
                <div className="flex space-x-3">
                  <button 
                    onClick={() => handleEdit(script.id!)}
                    className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-2 px-4 rounded-lg transition-all duration-200 shadow-lg hover:shadow-purple-500/25 transform hover:scale-105"
                  >
                    ✏️ 编辑
                  </button>
                  <button 
                    onClick={() => handleDelete(script.id!)}
                    className="flex-1 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white font-bold py-2 px-4 rounded-lg transition-all duration-200 shadow-lg hover:shadow-red-500/25 transform hover:scale-105"
                  >
                    🗑️ 删除
                  </button>
                </div>
              </div>

              {/* 装饰性元素 */}
              <div className="absolute top-4 right-4 text-6xl opacity-10 group-hover:opacity-20 transition-opacity duration-300">
                🎲
              </div>
            </div>
          );
        })}
      </div>

      {/* 空状态 */}
      {scripts.length === 0 && (
        <div className="text-center py-16">
          <div className="w-32 h-32 mx-auto mb-6 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-6xl shadow-2xl">
            🎭
          </div>
          <h3 className="text-2xl font-bold text-white mb-2">暂无剧本</h3>
          <p className="text-gray-400">开始创建你的第一个剧本吧！</p>
        </div>
      )}
    </div>
  );
};

export default ScriptList;