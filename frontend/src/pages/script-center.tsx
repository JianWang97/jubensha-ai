import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BookOpen, Grid, Library, List, Loader2, Plus, Search, User } from 'lucide-react';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useState } from 'react';

import { ScriptInfo, ScriptsService, ScriptStatus } from '@/client';
import AppLayout from '@/components/AppLayout';
import AuthGuard from '@/components/AuthGuard';
import ScriptCard, { ScriptCardSkeleton } from '@/components/ScriptCard';
import ScriptDetailDrawer from '@/components/ScriptDetailDrawer';
import ScriptFilterChips from '@/components/ScriptFilterChips';
import { toast } from 'sonner';

type TabType = 'my-scripts' | 'script-library';

export default function ScriptCenter() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('my-scripts');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const isDebouncing = searchQuery !== searchTerm;
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const [selectedScript, setSelectedScript] = useState<ScriptInfo | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // 分别存储我的剧本和剧本库
  const [myScripts, setMyScripts] = useState<ScriptInfo[]>([]);
  const [libraryScripts, setLibraryScripts] = useState<ScriptInfo[]>([]);

  // 获取我的剧本
  const getMyScripts = useCallback(async () => {
    const response = await ScriptsService.getScriptsApiScriptsGet();
    return response.items || [];
  }, []);

  // 获取剧本库（公开剧本）
  const getLibraryScripts = useCallback(async () => {
    const response = await ScriptsService.getPublicScriptsApiScriptsPublicGet();
    return response.items || [];
  }, []);

  const deleteScript = async (scriptId: number) => {
    await ScriptsService.deleteScriptApiScriptsScriptIdDelete(scriptId);
  };

  // 获取脚本数据
  const fetchScripts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === 'my-scripts') {
        const scriptData = await getMyScripts();
        setMyScripts(scriptData);
      } else {
        const scriptData = await getLibraryScripts();
        setLibraryScripts(scriptData);
      }
    } catch (err) {
      console.error('获取脚本列表失败:', err);
      setError('获取脚本列表失败');
    } finally {
      setLoading(false);
    }
  }, [activeTab, getMyScripts, getLibraryScripts]);

  useEffect(() => {
    fetchScripts();
  }, [activeTab, fetchScripts]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

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
        await fetchScripts();
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
        await ScriptsService.updateScriptStatusApiScriptsScriptIdStatusPatch(
          scriptId,
          ScriptStatus.PUBLISHED
        );

        await fetchScripts();
        toast.success('剧本发布成功！现在其他用户可以在剧本库中看到您的剧本了。');
      } catch (err) {
        console.error('发布剧本失败:', err);
        setError('发布剧本失败');
      }
    }
  };

  // 收藏切换
  const handleFavoriteToggle = (scriptId: number) => {
    // 实现收藏功能
    console.log('Toggle favorite for script:', scriptId);
  };

  // 查看剧本详情
  const handleScriptDetail = (script: ScriptInfo) => {
    setSelectedScript(script);
    setIsDetailOpen(true);
  };

  // 过滤脚本
  const filterScripts = (scripts: ScriptInfo[]) => {
    let filtered = scripts;

    // 搜索过滤
    if (searchTerm) {
      filtered = filtered.filter(script =>
        script.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        script.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        script.author?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // 难度筛选
    if (selectedDifficulty) {
      filtered = filtered.filter(script => script.difficulty === selectedDifficulty);
    }

    // 时长筛选
    if (selectedDuration) {
      filtered = filtered.filter(script => {
        const duration = script.duration_minutes;
        if (selectedDuration === '1小时内') return duration != null && duration <= 60;
        if (selectedDuration === '1-2小时') return duration != null && duration > 60 && duration <= 120;
        if (selectedDuration === '2小时以上') return duration != null && duration > 120;
        return true;
      });
    }

    return filtered;
  };

  const currentScripts = activeTab === 'my-scripts' ? myScripts : libraryScripts;
  const filteredScripts = filterScripts(currentScripts);
  const isMyScripts = activeTab === 'my-scripts';

  return (
    <AuthGuard>
      <AppLayout>
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950/30 to-slate-900">
          {/* 现代化头部 */}
          <div className="sticky top-0 z-10 bg-slate-950/80 backdrop-blur-xl border-b border-indigo-500/20">
            <div className="max-w-7xl mx-auto px-6 py-4">
              <div className="flex items-center justify-between">
                {/* 左侧标题和搜索 */}
                <div className="flex items-center gap-6 flex-1 max-w-3xl">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-6 h-6 text-purple-400" />
                    <h1 className="text-2xl font-bold text-white">剧本中心</h1>
                  </div>

                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <Input
                      placeholder="搜索剧本..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-12 pr-12 h-12 bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-400 focus:border-indigo-400 focus:bg-slate-800/70 transition-all rounded-xl"
                    />
                    {isDebouncing && (
                      <Loader2 className="absolute right-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400 animate-spin" />
                    )}
                  </div>
                </div>

                {/* 右侧控制 */}
                <div className="flex items-center gap-3">
                  {/* 创建按钮 */}
                  <Button
                    onClick={() => router.push('/script-manager/create')}
                    className="h-12 px-6 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-medium rounded-md shadow-lg"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    创建剧本
                  </Button>

                  {/* 视图切换 */}
                  <div className="flex bg-slate-800/50 border border-slate-700/50 rounded-xl p-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setViewMode('grid')}
                      className={`h-10 px-4 rounded-md transition-all ${viewMode === 'grid'
                          ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg'
                          : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                        }`}
                    >
                      <Grid className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setViewMode('list')}
                      className={`h-10 px-4 rounded-md transition-all ${viewMode === 'list'
                          ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg'
                          : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                        }`}
                    >
                      <List className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 标签页与筛选工具栏 */}
          <div className="max-w-7xl mx-auto px-6 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
              <div className="flex bg-slate-900/60 backdrop-blur-sm border border-slate-700/40 rounded-lg p-1">
                <button
                  onClick={() => setActiveTab('my-scripts')}
                  className={`flex items-center gap-2 px-5 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'my-scripts'
                      ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`}
                >
                  <User className="w-4 h-4" />
                  我的剧本
                </button>
                <button
                  onClick={() => setActiveTab('script-library')}
                  className={`flex items-center gap-2 px-5 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'script-library'
                      ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`}
                >
                  <Library className="w-4 h-4" />
                  剧本库
                </button>
              </div>
              <ScriptFilterChips
                selectedDifficulty={selectedDifficulty}
                onDifficultyChange={setSelectedDifficulty}
                selectedDuration={selectedDuration}
                onDurationChange={setSelectedDuration}
              />
            </div>
          </div>

          {/* 主内容区域 */}
          <div className="max-w-7xl mx-auto px-6 pt-5 pb-16">
            <div className="flex gap-8 min-h-[50vh]">

              {/* 主内容区域 */}
              <div className="flex-1 min-w-0">
                {!loading && !error && filteredScripts.length > 0 && (
                  <p className="text-sm text-slate-500 mb-4">共 {filteredScripts.length} 个剧本</p>
                )}
                {loading ? (
                  <div className={`grid gap-6 ${viewMode === 'grid'
                      ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                      : 'grid-cols-1 max-w-4xl mx-auto'
                    }`}>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <ScriptCardSkeleton key={i} />
                    ))}
                  </div>
                ) : error ? (
                  <div className="flex items-center justify-center min-h-[420px]">
                    <div className="text-center space-y-4">
                      <div className="text-red-400 text-lg mb-4">{error}</div>
                      <Button
                        onClick={() => fetchScripts()}
                        className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-8 py-3 rounded-md"
                      >
                        重新加载
                      </Button>
                    </div>
                  </div>
                ) : filteredScripts.length === 0 ? (
                  (searchTerm || selectedDifficulty || selectedDuration) ? (
                    <div className="bg-slate-900/50 border border-slate-700/30 rounded-lg p-12 text-center min-h-[420px] flex flex-col items-center justify-center">
                      <div className="w-20 h-20 mx-auto mb-6 bg-slate-800/60 border border-slate-700/40 rounded-full flex items-center justify-center">
                        <Search className="w-9 h-9 text-slate-400" />
                      </div>
                      <div className="space-y-3 mb-6">
                        <h3 className="text-xl font-semibold text-white">没有找到匹配的剧本</h3>
                        <p className="text-slate-400">尝试调整搜索条件或筛选项</p>
                      </div>
                      <Button
                        onClick={() => {
                          setSearchQuery('');
                          setSearchTerm('');
                          setSelectedDifficulty(null);
                          setSelectedDuration(null);
                        }}
                        variant="outline"
                        className="border-slate-600/50 text-slate-300 hover:bg-slate-800/50 px-6 py-3 rounded-md font-medium"
                      >
                        清除筛选
                      </Button>
                    </div>
                  ) : (
                    <div className="bg-slate-900/50 border border-slate-700/30 rounded-lg p-12 text-center min-h-[420px] flex flex-col items-center justify-center">
                      <div className="w-20 h-20 mx-auto mb-6 bg-indigo-500/15 border border-indigo-500/25 rounded-full flex items-center justify-center">
                        {isMyScripts ? (
                          <User className="w-9 h-9 text-indigo-400" />
                        ) : (
                          <Library className="w-9 h-9 text-indigo-400" />
                        )}
                      </div>

                      <div className="space-y-3 mb-6">
                        <h3 className="text-xl font-semibold text-white">
                          {isMyScripts ? '暂无我的剧本' : '剧本库为空'}
                        </h3>
                        <p className="text-slate-400">
                          {isMyScripts ? '开始创建您的第一个剧本' : '暂时没有公开的剧本'}
                        </p>
                      </div>

                      {isMyScripts && (
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                          <Button
                            onClick={() => router.push('/script-manager/create')}
                            className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-6 py-3 rounded-md font-medium"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            创建新剧本
                          </Button>
                          <Button
                            onClick={() => setActiveTab('script-library')}
                            variant="outline"
                            className="border-slate-600/50 text-slate-300 hover:bg-slate-800/50 px-6 py-3 rounded-md font-medium"
                          >
                            <Library className="w-4 h-4 mr-2" />
                            浏览剧本库
                          </Button>
                        </div>
                      )}
                    </div>
                  )
                ) : (
                  <div className={`grid gap-6 ${viewMode === 'grid'
                      ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                      : 'grid-cols-1 max-w-4xl mx-auto'
                    }`}>
                    {filteredScripts.map((script) => (
                      <ScriptCard
                        key={script.id}
                        script={script}
                        onDetailClick={handleScriptDetail}
                        onFavoriteToggle={handleFavoriteToggle}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onPublish={handlePublish}

                        isMyScript={isMyScripts}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 剧本详情抽屉 */}
          <ScriptDetailDrawer
            script={selectedScript}
            isOpen={isDetailOpen}
            onClose={() => setIsDetailOpen(false)}
          />
        </div>
      </AppLayout>
    </AuthGuard>
  );
}
