import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { ArrowLeft, Calendar, Users, Trophy, Clock, Search, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuthStore } from '@/stores/authStore';
import { authService } from '@/services/authService';
import { GameHistoryResponse as GameHistory } from '@/client';
import AppLayout from '@/components/AppLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { toast } from 'sonner';

const GameHistoryPage: React.FC = () => {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const [gameHistory, setGameHistory] = useState<GameHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const pageSize = 10;

  // 检查认证状态
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login');
    }
  }, [isAuthenticated, router]);

  // 加载游戏历史
  const loadGameHistory = async (page: number = 1, reset: boolean = false) => {
    try {
      setIsLoading(true);
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
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadGameHistory(1, true);
    }
  }, [isAuthenticated]);

  // 过滤游戏历史
  const filteredHistory = gameHistory.filter(game => {
    const matchesSearch = game.script_title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || game.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // 加载更多
  const loadMore = () => {
    if (!isLoading && hasMore) {
      loadGameHistory(currentPage + 1, false);
    }
  };

  // 获取状态显示
  const getStatusDisplay = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      waiting: { label: '等待中', className: 'bg-yellow-500/20 text-yellow-400' },
      playing: { label: '进行中', className: 'bg-blue-500/20 text-blue-400' },
      finished: { label: '已完成', className: 'bg-green-500/20 text-green-400' },
      cancelled: { label: '已取消', className: 'bg-red-500/20 text-red-400' },
    };
    return statusMap[status] || { label: status, className: 'bg-gray-500/20 text-gray-400' };
  };

  // 格式化时间
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 计算游戏时长
  const getGameDuration = (startTime: string, endTime?: string) => {
    if (!endTime) return '进行中';
    const start = new Date(startTime);
    const end = new Date(endTime);
    const duration = Math.floor((end.getTime() - start.getTime()) / (1000 * 60)); // 分钟
    if (duration < 60) {
      return `${duration}分钟`;
    }
    const hours = Math.floor(duration / 60);
    const minutes = duration % 60;
    return `${hours}小时${minutes}分钟`;
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <ProtectedRoute>
      <AppLayout title="游戏历史">
        <div className="max-w-6xl mx-auto">
          {/* 返回按钮 */}
          <div className="mb-6">
            <Link
              href="/profile"
              className="inline-flex items-center text-white hover:text-gray-300 transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回个人资料
            </Link>
          </div>

          {/* 搜索和过滤 */}
          <Card className="bg-white/10 backdrop-blur-md border-white/20 mb-6">
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="搜索剧本名称或房间名称..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-white/10 border-white/20 text-white placeholder-gray-400"
                  />
                </div>
                <div className="sm:w-48">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="bg-white/10 border-white/20 text-white">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="状态筛选" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部状态</SelectItem>
                      <SelectItem value="waiting">等待中</SelectItem>
                      <SelectItem value="playing">进行中</SelectItem>
                      <SelectItem value="finished">已完成</SelectItem>
                      <SelectItem value="cancelled">已取消</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 游戏历史列表 */}
          {isLoading && gameHistory.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            </div>
          ) : filteredHistory.length === 0 ? (
            <Card className="bg-white/10 backdrop-blur-md border-white/20">
              <CardContent className="text-center py-12">
                <Trophy className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">暂无游戏记录</h3>
                <p className="text-gray-400 mb-4">
                  {searchTerm || statusFilter !== 'all' 
                    ? '没有找到符合条件的游戏记录' 
                    : '您还没有参与过任何游戏'}
                </p>
                <Button
                  onClick={() => router.push('/script-manager')}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  开始游戏
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredHistory.map((game) => {
                const statusDisplay = getStatusDisplay(game.status);
                return (
                  <Card key={game.id} className="bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/15 transition-colors">
                    <CardContent className="p-6">
                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-medium text-white">
                              {game.script_title}
                            </h3>
                            <Badge className={statusDisplay.className}>
                              {statusDisplay.label}
                            </Badge>
                          </div>
                          <p className="text-gray-300 mb-3">
                            房间：{game.session_id}
                          </p>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-gray-500">
                            <div className="flex items-center">
                              <Calendar className="w-4 h-4 mr-1" />
                              {new Date(game.created_at).toLocaleDateString()}
                            </div>
                            <div className="flex items-center">
                              <Users className="w-4 h-4 mr-1" />
                              {game.participants?.length || 0} players
                            </div>
                            <div className="flex items-center">
                              <Trophy className="w-4 h-4 mr-1" />
                              {game.status}
                            </div>
                          </div>
                          {game.script_title && (
                            <p className="text-sm text-gray-600 mt-2">
                              剧本: {game.script_title}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2">
                          {game.status === 'playing' && (
                            <Button
                              onClick={() => router.push(`/game?sessionId=${game.id}&scriptId=${game.script_id}`)}
                              className="bg-blue-600 hover:bg-blue-700 text-white"
                            >
                              继续游戏
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            className="border-white/20 text-white hover:bg-white/10"
                            onClick={() => {
                              // TODO: 实现游戏详情查看
                              toast.info('游戏详情功能开发中');
                            }}
                          >
                            查看详情
                          </Button>
                        </div>
                      </div>
                      
                      {/* 参与者列表 */}
                      {game.participants && game.participants.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-white/20">
                          <h4 className="text-sm font-medium text-white mb-2">参与者：</h4>
                          <div className="flex flex-wrap gap-2">
                            {game.participants.map((participant, index) => (
                              <div key={index} className="flex items-center gap-2 bg-white/10 rounded-full px-3 py-1">
                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-400 to-blue-500 flex items-center justify-center text-xs font-medium">
                                  {participant.nickname ? participant.nickname.charAt(0).toUpperCase() : participant.username.charAt(0).toUpperCase()}
                                </div>
                                <span className="text-sm text-white">
                                  {participant.nickname || participant.username}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
              
              {/* 加载更多按钮 */}
              {hasMore && (
                <div className="text-center pt-6">
                  <Button
                    onClick={loadMore}
                    disabled={isLoading}
                    variant="outline"
                    className="border-white/20 text-white hover:bg-white/10"
                  >
                    {isLoading ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        加载中...
                      </div>
                    ) : (
                      '加载更多'
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
};

export default GameHistoryPage;