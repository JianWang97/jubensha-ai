import { GameHistoryResponse as GameHistory, GameSessionDeleteRequest, GameSessionDeleteResponse } from '@/client';
import { Service } from '@/client/services/Service';
import AppLayout from '@/components/AppLayout';
import GameHistoryDrawer from '@/components/GameHistoryDrawer';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { authService } from '@/services/authService';
import { useAuthStore } from '@/stores/authStore';
import { Search, Filter, RefreshCw, Trophy, Trash2, CheckSquare, Square } from 'lucide-react';
import { useRouter } from 'next/router';
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const GameHistoryPage: React.FC = () => {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const [gameHistory, setGameHistory] = useState<GameHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const pageSize = 10;

  // 抽屉相关状态
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | undefined>(undefined);
  const [selectedStatus, setSelectedStatus] = useState<string | undefined>(undefined);
  const [selectedScriptTitle, setSelectedScriptTitle] = useState<string | undefined>(undefined);

  // 删除相关状态
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'single' | 'batch'; sessionIds: string[] }>({ type: 'single', sessionIds: [] });
  const [isDeleting, setIsDeleting] = useState(false);

  // 检查认证状态
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login');
    }
  }, [isAuthenticated, router]);

  // 加载游戏历史
  const loadGameHistory = useCallback(async (page: number = 1, reset: boolean = false) => {
    try {
      if (reset) {
        setIsLoading(true);
      }
      const skip = (page - 1) * pageSize;
      const newHistory = await authService.getUserGameHistory(skip, pageSize);
      
      if (reset) {
        setGameHistory(newHistory);
      } else {
        setGameHistory(prev => [...prev, ...newHistory]);
      }
      
      setHasMore(newHistory.length === pageSize);
      setCurrentPage(page);
    } catch (error) {
      toast.error('加载游戏历史失败');
      console.error('Load game history error:', error);
      if (reset) {
        setGameHistory([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [pageSize]);

  // 刷新游戏历史
  const refreshGameHistory = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const newHistory = await authService.getUserGameHistory(0, pageSize);
      setGameHistory(newHistory);
      setHasMore(newHistory.length === pageSize);
      setCurrentPage(1);
      toast.success('刷新成功');
    } catch (error) {
      toast.error('刷新失败');
      console.error('Refresh game history error:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [pageSize]);

  useEffect(() => {
    if (isAuthenticated) {
      loadGameHistory(1, true);
    }
  }, [isAuthenticated]);

  // 过滤游戏历史
  const filteredHistory = useMemo(() => {
    return gameHistory.filter(game => {
      const title = (game as any).script_title || '';
      const sessionId = game.session_id || '';
      const searchText = searchTerm.toLowerCase();
      const matchesSearch = title.toLowerCase().includes(searchText) || 
                           sessionId.toLowerCase().includes(searchText);
      const matchesStatus = statusFilter === 'all' || game.status === statusFilter;
      return matchesSearch && matchesStatus;
    }).sort((a, b) => new Date((b as any).created_at || 0).getTime() - new Date((a as any).created_at || 0).getTime());
  }, [gameHistory, searchTerm, statusFilter]);

  // 加载更多
  const loadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      loadGameHistory(currentPage + 1, false);
    }
  }, [isLoading, hasMore, currentPage, loadGameHistory]);

  // 删除游戏会话
  const deleteGameSessions = useCallback(async (sessionIds: string[]) => {
    try {
      setIsDeleting(true);
      const deleteRequest: GameSessionDeleteRequest = {
        session_ids: sessionIds
      };
      
      const response: GameSessionDeleteResponse = await Service.deleteGameSessionsApiGameSessionsDelete(deleteRequest);
      
      if (response.total_success > 0) {
        toast.success(`成功删除 ${response.total_success} 个游戏记录`);
        // 刷新游戏历史列表
        await refreshGameHistory();
        // 清空选中状态
        setSelectedSessions(new Set());
      }
      
      if (response.total_failed > 0) {
        const failedMessages = response.failed?.map(item => `${item.session_id}: ${item.error}`).join('\n') || '';
        toast.error(`删除失败 ${response.total_failed} 个记录:\n${failedMessages}`);
      }
    } catch (error) {
      console.error('Delete game sessions error:', error);
      toast.error('删除游戏记录失败');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  }, [refreshGameHistory]);

  // 处理单个删除
  const handleSingleDelete = useCallback((sessionId: string) => {
    setDeleteTarget({ type: 'single', sessionIds: [sessionId] });
    setShowDeleteConfirm(true);
  }, []);

  // 处理批量删除
  const handleBatchDelete = useCallback(() => {
    if (selectedSessions.size === 0) {
      toast.warning('请先选择要删除的游戏记录');
      return;
    }
    setDeleteTarget({ type: 'batch', sessionIds: Array.from(selectedSessions) });
    setShowDeleteConfirm(true);
  }, [selectedSessions]);

  // 确认删除
  const confirmDelete = useCallback(() => {
    deleteGameSessions(deleteTarget.sessionIds);
  }, [deleteGameSessions, deleteTarget.sessionIds]);

  // 取消删除
  const cancelDelete = useCallback(() => {
    setShowDeleteConfirm(false);
  }, []);

  // 切换单个选择
  const toggleSessionSelection = useCallback((sessionId: string) => {
    setSelectedSessions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sessionId)) {
        newSet.delete(sessionId);
      } else {
        newSet.add(sessionId);
      }
      return newSet;
    });
  }, []);

  // 全选/取消全选
  const toggleSelectAll = useCallback(() => {
    if (selectedSessions.size === filteredHistory.length) {
      setSelectedSessions(new Set());
    } else {
      setSelectedSessions(new Set(filteredHistory.map(game => game.session_id)));
    }
  }, [selectedSessions.size, filteredHistory]);

  // 检查是否全选
  const isAllSelected = useMemo(() => {
    return filteredHistory.length > 0 && selectedSessions.size === filteredHistory.length;
  }, [filteredHistory.length, selectedSessions.size]);

  // 检查是否部分选中
  const isIndeterminate = useMemo(() => {
    return selectedSessions.size > 0 && selectedSessions.size < filteredHistory.length;
  }, [selectedSessions.size, filteredHistory.length]);



  // 获取状态显示（兼容大小写）
  const getStatusDisplay = (status: string) => {
    const s = (status || '').toUpperCase();
    const statusMap: Record<string, { label: string; className: string }> = {
      PENDING: { label: '等待中', className: 'bg-yellow-500/20 text-yellow-400' },
      STARTED: { label: '进行中', className: 'bg-blue-500/20 text-blue-400' },
      PAUSED: { label: '已暂停', className: 'bg-orange-500/20 text-orange-400' },
      ENDED: { label: '已结束', className: 'bg-green-500/20 text-green-400' },
      CANCELED: { label: '已取消', className: 'bg-red-500/20 text-red-400' },
      WAITING: { label: '等待中', className: 'bg-yellow-500/20 text-yellow-400' },
      PLAYING: { label: '进行中', className: 'bg-blue-500/20 text-blue-400' },
      FINISHED: { label: '已结束', className: 'bg-green-500/20 text-green-400' },
      CANCELLED: { label: '已取消', className: 'bg-red-500/20 text-red-400' },
    };
    return statusMap[s] || { label: status, className: 'bg-gray-500/20 text-gray-400' };
  };

  const isActiveStatus = (status: string) => {
    const s = (status || '').toUpperCase();
    return ['STARTED','PENDING','PAUSED','PLAYING','WAITING'].includes(s);
  };
  const isEndedStatus = (status: string) => {
    const s = (status || '').toUpperCase();
    return ['ENDED','FINISHED'].includes(s);
  };
  const isCanceledStatus = (status: string) => {
    const s = (status || '').toUpperCase();
    return ['CANCELED','CANCELLED'].includes(s);
  };

  // 格式化时间
  const formatDate = useCallback((dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Shanghai'
    });
  }, []);





  if (!isAuthenticated) {
    return null;
  }

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="max-w-6xl mx-auto">
          {/* 页面头部 */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Trophy className="h-6 w-6 text-purple-400" />
              <h1 className="text-2xl font-bold text-white">游戏历史</h1>
            </div>
            
            {/* 批量操作按钮 */}
            {filteredHistory.length > 0 && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={toggleSelectAll}
                    className="data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
                  />
                  <span>全选 ({selectedSessions.size}/{filteredHistory.length})</span>
                </div>
                
                {selectedSessions.size > 0 && (
                  <Button
                    onClick={handleBatchDelete}
                    disabled={isDeleting}
                    variant="destructive"
                    size="sm"
                    className="bg-red-600/80 hover:bg-red-600 text-white"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    删除选中 ({selectedSessions.size})
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* 搜索和过滤 */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="搜索剧本名称或房间ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white/10 border-white/20 text-white placeholder-gray-400"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40 bg-white/10 border-white/20 text-white">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="状态筛选" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="PENDING">等待中</SelectItem>
                <SelectItem value="STARTED">进行中</SelectItem>
                <SelectItem value="PAUSED">已暂停</SelectItem>
                <SelectItem value="ENDED">已结束</SelectItem>
                <SelectItem value="CANCELED">已取消</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 游戏历史列表 */}
          {isLoading && gameHistory.length === 0 ? (
            <Card className="bg-white/10 backdrop-blur-md border-white/20">
              <CardContent className="text-center py-12">
                <div className="text-white/70">加载中...</div>
              </CardContent>
            </Card>
          ) : filteredHistory.length === 0 ? (
            <Card className="bg-white/10 backdrop-blur-md border-white/20">
              <CardContent className="text-center py-12">
                <Trophy className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">暂无游戏记录</h3>
                <p className="text-gray-400 mb-4">
                  {searchTerm || statusFilter !== 'all' 
                    ? '没有找到符合条件的游戏记录，请尝试调整搜索条件' 
                    : '您还没有参与过任何游戏，开始您的第一场剧本杀吧！'}
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  {(searchTerm || statusFilter !== 'all') && (
                    <Button
                      onClick={() => {
                        setSearchTerm('');
                        setStatusFilter('all');
                      }}
                      variant="outline"
                      className="border-white/20 text-white hover:bg-white/10"
                    >
                      清除筛选
                    </Button>
                  )}
                  <Button
                    onClick={() => router.push('/script-center')}
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    开始游戏
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredHistory.map((game) => {
                const statusDisplay = getStatusDisplay(game.status);
                const openDrawer = () => {
                  setSelectedSessionId(game.session_id);
                  setSelectedStatus(game.status);
                  setSelectedScriptTitle((game as any).script_title);
                  setDrawerOpen(true);
                };
                return (
                  <Card key={game.id} className="bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/15 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        {/* 选择框 */}
                        <div className="pt-1">
                          <Checkbox
                            checked={selectedSessions.has(game.session_id)}
                            onCheckedChange={() => toggleSessionSelection(game.session_id)}
                            className="data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
                          />
                        </div>
                        
                        {/* 游戏信息 */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="text-base font-medium text-white truncate">
                              {(game as any).script_title || '未知剧本'}
                            </h3>
                            <Badge className={statusDisplay.className}>
                              {statusDisplay.label}
                            </Badge>
                          </div>
                          
                          <div className="text-sm text-white/70 mb-1">
                            会话ID: {game.session_id}
                          </div>
                          
                          <div className="text-sm text-white/60">
                            创建时间: {formatDate((game as any).created_at || new Date().toISOString())}
                          </div>
                        </div>
                        
                        {/* 操作按钮 */}
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <div className="flex gap-2 flex-wrap">
                            {isActiveStatus(game.status) && (
                              <Button
                                onClick={() => router.push(`/game?script_id=${(game as any).script_id}`)}
                                size="sm"
                                className="bg-green-600 hover:bg-green-700"
                              >
                                继续游戏
                              </Button>
                            )}
                            {isEndedStatus(game.status) && (
                              <Button
                                onClick={() => router.push(`/game-history/${encodeURIComponent(game.session_id)}/replay`)}
                                size="sm"
                                className="bg-blue-600 hover:bg-blue-700"
                              >
                                回放
                              </Button>
                            )}
                            <Button
                              onClick={openDrawer}
                              variant="outline"
                              size="sm"
                              className="border-white/30 text-white hover:bg-white/10"
                            >
                              详情
                            </Button>
                            <Button
                              onClick={() => handleSingleDelete(game.session_id)}
                              disabled={isDeleting}
                              variant="outline"
                              size="sm"
                              className="border-red-500/50 text-red-400 hover:bg-red-500/20 hover:border-red-500"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {hasMore && (
                <div className="flex justify-center pt-2">
                  <Button onClick={loadMore} variant="outline" className="border-white/20 text-white hover:bg-white/10">加载更多</Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 删除确认对话框 */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-black/80 backdrop-blur-xl rounded-2xl p-6 border border-white/20 shadow-2xl max-w-md mx-4">
              <div className="text-center">
                <div className="text-4xl mb-4">⚠️</div>
                <h3 className="text-white font-bold text-xl mb-2">
                  {deleteTarget.type === 'single' ? '确认删除游戏记录' : '确认批量删除'}
                </h3>
                <p className="text-gray-300 mb-6">
                  {deleteTarget.type === 'single' 
                    ? '删除后将无法恢复该游戏记录，确定要删除吗？'
                    : `确定要删除选中的 ${deleteTarget.sessionIds.length} 个游戏记录吗？删除后将无法恢复。`
                  }
                </p>
                <div className="flex gap-3 justify-center">
                  <Button
                    onClick={cancelDelete}
                    disabled={isDeleting}
                    variant="outline"
                    className="border-white/30 text-white hover:bg-white/10"
                  >
                    取消
                  </Button>
                  <Button
                    onClick={confirmDelete}
                    disabled={isDeleting}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    {isDeleting ? '删除中...' : '确认删除'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 游戏记录详情抽屉 */}
        <GameHistoryDrawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          sessionId={selectedSessionId}
          gameStatus={selectedStatus}
          scriptTitle={selectedScriptTitle}
        />
      </AppLayout>
    </ProtectedRoute>
  );
};

export default GameHistoryPage;