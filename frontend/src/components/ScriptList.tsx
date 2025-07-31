import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Sparkles, Library, User, Search, Upload } from 'lucide-react';
import { ScriptInfo, ScriptsService, ScriptStatus, Service } from '@/client';

type TabType = 'my-scripts' | 'script-library';

const ScriptList = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('my-scripts');
  const [searchTerm, setSearchTerm] = useState('');
  
  // 分别存储我的剧本和剧本库
  const [myScripts, setMyScripts] = useState<ScriptInfo[]>([]);
  const [libraryScripts, setLibraryScripts] = useState<ScriptInfo[]>([]);
  
  // 获取我的剧本
  const getMyScripts = async () => {
    const response = await ScriptsService.getScriptsApiScriptsGet();
    return response.items || [];
  };
  
  // 获取剧本库（公开剧本）
  const getLibraryScripts = async () => {
    const response = await ScriptsService.getPublicScriptsApiScriptsPublicGet();
    return response.items || [];
  };
  
  const deleteScript = async (scriptId: number) => {
    const response = await ScriptsService.deleteScriptApiScriptsScriptIdDelete(scriptId);
    return response.data;
  };

  // 获取脚本数据
  useEffect(() => {
    const fetchScripts = async () => {
      setLoading(true);
      setError(null);
      try {
        if (activeTab === 'my-scripts') {
          const scriptData = await getMyScripts();
          setMyScripts(scriptData.map(script => ({ ...script })));
        } else {
          const scriptData = await getLibraryScripts();
          setLibraryScripts(scriptData.map(script => ({ ...script })));
        }
      } catch (err) {
        console.error('获取脚本列表失败:', err);
        setError('获取脚本列表失败');
      } finally {
        setLoading(false);
      }
    };

    fetchScripts();
  }, [activeTab]);

  // 编辑脚本处理（仅限我的剧本）
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

  // 发布剧本到剧本库
  const handlePublish = async (scriptId: number) => {
    if (window.confirm('确定要将此剧本发布到剧本库吗？发布后其他用户将可以查看和使用此剧本。')) {
      try {
        // 使用ScriptsService调用更新剧本状态的API
        await ScriptsService.updateScriptStatusApiScriptsScriptIdStatusPatch({
          scriptId: scriptId,
          status: ScriptStatus.PUBLISHED
        });
        
        // 重新获取脚本列表以更新状态
        await fetchScripts();
        alert('剧本发布成功！现在其他用户可以在剧本库中看到您的剧本了。');
      } catch (err) {
        console.error('发布剧本失败:', err);
        setError('发布剧本失败');
      }
    }
  };
  
  // 查看剧本详情（剧本库中的剧本只能查看）
  const handleView = (scriptId: number) => {
    router.push(`/script-manager/view/${scriptId}`);
  };
  

  
  // 过滤脚本
  const filterScripts = (scripts: ScriptInfo[]) => {
    if (!searchTerm) return scripts;
    return scripts.filter(script => 
      script.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      script.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      script.author?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };
  
  const currentScripts = activeTab === 'my-scripts' ? myScripts : libraryScripts;
  const filteredScripts = filterScripts(currentScripts);
  const isMyScripts = activeTab === 'my-scripts';

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
      {/* 标签页导航 */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-4 border border-purple-500/20">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          {/* 标签页切换 */}
          <div className="flex bg-slate-900/50 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('my-scripts')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === 'my-scripts'
                  ? 'bg-purple-500 text-white shadow-lg'
                  : 'text-gray-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <User className="w-4 h-4" />
              我的剧本
            </button>
            <button
              onClick={() => setActiveTab('script-library')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === 'script-library'
                  ? 'bg-purple-500 text-white shadow-lg'
                  : 'text-gray-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Library className="w-4 h-4" />
              剧本库
            </button>
          </div>
          
          {/* 搜索框 */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder={`搜索${isMyScripts ? '我的' : '剧本库'}剧本...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
            />
          </div>
        </div>
      </div>

      {/* 剧本网格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredScripts.map((script) => {
          return (
            <div 
              key={script.id} 
              className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-4 border border-purple-500/20 hover:border-purple-400/40 transition-all"
            >
              {/* 状态徽章和作者信息 */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    script.status === ScriptStatus.ARCHIVED || script.status === ScriptStatus.PUBLISHED
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                  }`}>
                    {script.status === ScriptStatus.ARCHIVED || script.status === ScriptStatus.PUBLISHED ? '已发布' : '草稿'}
                  </span>
                  {!isMyScripts && (
                    <span className="text-xs text-gray-400 bg-slate-700/50 px-2 py-1 rounded">
                      by {script.author}
                    </span>
                  )}
                </div>
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
                {isMyScripts ? (
                  // 我的剧本：可以编辑、删除和发布
                  <>
                    <button 
                      onClick={() => handleEdit(script.id!)}
                      className="flex-1 bg-purple-500 hover:bg-purple-600 text-white py-2 px-3 rounded-lg transition-all text-sm font-medium"
                    >
                      编辑
                    </button>
                    {script.status === ScriptStatus.DRAFT && (
                      <button 
                        onClick={() => handlePublish(script.id!)}
                        className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 px-3 rounded-lg transition-all text-sm font-medium"
                      >
                        发布
                      </button>
                    )}
                    <button 
                      onClick={() => handleDelete(script.id!)}
                      className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 px-3 rounded-lg transition-all text-sm font-medium"
                    >
                      删除
                    </button>
                  </>
                ) : (
                  // 剧本库：只能查看
                  <>
                    <button 
                      onClick={() => handleView(script.id!)}
                      className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 px-3 rounded-lg transition-all text-sm font-medium"
                    >
                      查看
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 空状态 */}
      {filteredScripts.length === 0 && (
        <div className="bg-slate-800/30 rounded-lg p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-6 bg-purple-500/20 rounded-full flex items-center justify-center">
            {isMyScripts ? (
              <User className="w-8 h-8 text-purple-400" />
            ) : (
              <Library className="w-8 h-8 text-purple-400" />
            )}
          </div>
          
          <div className="space-y-3 mb-6">
            <h3 className="text-xl font-semibold text-white">
              {searchTerm ? '没有找到匹配的剧本' : (isMyScripts ? '暂无我的剧本' : '剧本库为空')}
            </h3>
            <p className="text-gray-400">
              {searchTerm 
                ? '尝试使用其他关键词搜索' 
                : (isMyScripts ? '开始创建您的第一个剧本' : '暂时没有公开的剧本')
              }
            </p>
          </div>
          
          {isMyScripts && !searchTerm && (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button 
                onClick={() => router.push('/script-manager/create')}
                className="bg-purple-500 hover:bg-purple-600 text-white px-6 py-3 rounded-lg transition-all font-medium"
              >
                创建新剧本
              </button>
              <button 
                onClick={() => setActiveTab('script-library')}
                className="bg-slate-600 hover:bg-slate-500 text-white px-6 py-3 rounded-lg transition-all font-medium"
              >
                浏览剧本库
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ScriptList;