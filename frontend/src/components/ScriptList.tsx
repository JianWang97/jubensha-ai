import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Sparkles } from 'lucide-react';
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
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-8 text-center border border-purple-500/20">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center animate-spin">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div className="text-white text-lg font-medium">加载中...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/50 backdrop-blur-sm rounded-lg p-6 text-center border border-red-500/20">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
            <span className="text-white text-sm">!</span>
          </div>
          <div className="space-y-2">
            <div className="text-white font-medium">加载失败</div>
            <div className="text-red-300 text-sm">{error}</div>
            <button 
              onClick={() => window.location.reload()}
              className="mt-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-all text-sm"
            >
              重新加载
            </button>
          </div>
        </div>
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
    <div className="space-y-4">
      {/* 剧本网格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {scripts.map((script) => {
          return (
            <div 
              key={script.id} 
              className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-4 border border-purple-500/20 hover:border-purple-400/40 transition-all"
            >
              {/* 状态徽章 */}
              <div className="flex items-center justify-between mb-3">
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  script.status === ScriptStatus.ARCHIVED || script.status === ScriptStatus.PUBLISHED
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                }`}>
                  {script.status === ScriptStatus.ARCHIVED || script.status === ScriptStatus.PUBLISHED ? '已发布' : '草稿'}
                </span>
                <span className="text-purple-300 text-sm">{script.player_count}人</span>
              </div>

              {/* 标题和描述 */}
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-white mb-2 line-clamp-1">
                  {script.title}
                </h3>
                <p className="text-gray-400 text-sm line-clamp-2">
                  {script.description || '暂无描述'}
                </p>
              </div>

              {/* 操作按钮 */}
              <div className="flex gap-2">
                <button 
                  onClick={() => handleEdit(script.id!)}
                  className="flex-1 bg-purple-500 hover:bg-purple-600 text-white py-2 px-3 rounded-lg transition-all text-sm font-medium"
                >
                  编辑
                </button>
                <button 
                  onClick={() => handleDelete(script.id!)}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 px-3 rounded-lg transition-all text-sm font-medium"
                >
                  删除
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 空状态 */}
      {scripts.length === 0 && (
        <div className="bg-slate-800/30 rounded-lg p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-6 bg-purple-500/20 rounded-full flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-purple-400" />
          </div>
          
          <div className="space-y-3 mb-6">
            <h3 className="text-xl font-semibold text-white">暂无剧本</h3>
            <p className="text-gray-400">开始创建您的第一个剧本</p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button className="bg-purple-500 hover:bg-purple-600 text-white px-6 py-3 rounded-lg transition-all font-medium">
              创建新剧本
            </button>
            <button className="bg-slate-600 hover:bg-slate-500 text-white px-6 py-3 rounded-lg transition-all font-medium">
              浏览模板
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScriptList;