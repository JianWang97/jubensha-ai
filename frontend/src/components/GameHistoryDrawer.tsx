import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Clock, Calendar, BarChart3, Gamepad2, PlayCircle, Eye, X } from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { fetchGameDetail } from '@/services/gameHistoryService';
import { toast } from 'sonner';

interface GameHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId?: string;
  gameStatus?: string;
  scriptTitle?: string;
}

interface GameDetailData {
  session_info: {
    session_id: string;
    script_id: number;
    status: string;
    started_at?: string;
    finished_at?: string;
    created_at: string;
  };
  statistics: {
    total_events: number;
    chat_messages: number;
    system_events: number;
    tts_generated: number;
    duration_minutes: number;
  };
  players: any[];
}

const GameHistoryDrawer: React.FC<GameHistoryDrawerProps> = ({
  isOpen,
  onClose,
  sessionId,
  gameStatus,
  scriptTitle
}) => {
  const router = useRouter();
  const [detail, setDetail] = useState<GameDetailData | null>(null);
  const [loading, setLoading] = useState(false);

  // 加载游戏详情
  useEffect(() => {
    if (isOpen && sessionId) {
      loadGameDetail();
    }
  }, [isOpen, sessionId]);

  const loadGameDetail = async () => {
    if (!sessionId) return;
    
    setLoading(true);
    try {
      const response = await fetchGameDetail(sessionId);
      setDetail(response.data);
    } catch (error) {
      console.error('Failed to load game detail:', error);
      toast.error('加载游戏详情失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取状态显示
  const getStatusDisplay = (status: string) => {
    const statusMap: Record<string, { label: string; color: string }> = {
      STARTED: { label: '进行中', color: 'bg-green-500' },
      PENDING: { label: '等待中', color: 'bg-yellow-500' },
      PAUSED: { label: '已暂停', color: 'bg-orange-500' },
      ENDED: { label: '已结束', color: 'bg-gray-500' },
      CANCELED: { label: '已取消', color: 'bg-red-500' }
    };
    return statusMap[status] || { label: status, color: 'bg-gray-500' };
  };

  // 格式化时间
  const formatDateTime = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 格式化时长
  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}分钟`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}小时${remainingMinutes}分钟`;
  };

  // 处理导航逻辑
  const handleAction = (action: 'continue' | 'replay') => {
    if (!sessionId) return;
    
    const status = detail?.session_info.status || gameStatus;
    
    if (action === 'continue') {
      // STARTED, PENDING, PAUSED 状态进入游戏页面
      if (['STARTED', 'PENDING', 'PAUSED'].includes(status || '')) {
-        router.push(`/game?session_id=${encodeURIComponent(sessionId)}&script_id=${detail?.session_info.script_id}`);
+        router.push(`/game?script_id=${detail?.session_info.script_id}`);
      }
    } else if (action === 'replay') {
      // ENDED 状态进入回放页面
      if (status === 'ENDED') {
        router.push(`/game-history/${sessionId}/replay`);
      }
    }
    
    onClose();
  };

  const status = detail?.session_info.status || gameStatus || '';
  const statusDisplay = getStatusDisplay(status);
  
  // 确定可用的操作
  const canContinue = ['STARTED', 'PENDING', 'PAUSED'].includes(status);
  const canReplay = status === 'ENDED';
  const isCanceled = status === 'CANCELED';

  return (
    <Drawer open={isOpen} onOpenChange={onClose}>
      <DrawerContent className="max-h-[90vh] bg-gradient-to-br from-gray-900/98 via-gray-800/98 to-gray-900/98 backdrop-blur-xl border-gray-700/50">
        <DrawerHeader className="border-b border-gray-700/50 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Gamepad2 className="h-6 w-6 text-purple-400" />
              <DrawerTitle className="text-xl font-bold text-gray-100">
                游戏记录详情
              </DrawerTitle>
            </div>
            <DrawerClose asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-400 hover:text-gray-200 hover:bg-gray-700/50"
              >
                <X className="h-4 w-4" />
              </Button>
            </DrawerClose>
          </div>
        </DrawerHeader>

        <div className="p-6 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
            </div>
          ) : detail ? (
            <div className="space-y-6">
              {/* 基本信息 */}
              <Card className="bg-gray-800/50 border-gray-700/50">
                <CardHeader>
                  <CardTitle className="text-lg text-gray-100 flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-blue-400" />
                    基本信息
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-gray-400">会话ID</div>
                      <div className="text-gray-200 font-mono">{detail.session_info.session_id}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">剧本名称</div>
                      <div className="text-gray-200">{scriptTitle || `剧本 #${detail.session_info.script_id}`}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">游戏状态</div>
                      <Badge className={`${statusDisplay.color} text-white`}>
                        {statusDisplay.label}
                      </Badge>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">游戏模式</div>
                      <div className="text-gray-200">AI 自主演绎</div>
                    </div>
                  </div>
                  
                  <Separator className="bg-gray-700/50" />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-gray-400">创建时间</div>
                      <div className="text-gray-200">{formatDateTime(detail.session_info.created_at)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">开始时间</div>
                      <div className="text-gray-200">{formatDateTime(detail.session_info.started_at)}</div>
                    </div>
                    {detail.session_info.finished_at && (
                      <div>
                        <div className="text-sm text-gray-400">结束时间</div>
                        <div className="text-gray-200">{formatDateTime(detail.session_info.finished_at)}</div>
                      </div>
                    )}
                    <div>
                      <div className="text-sm text-gray-400">游戏时长</div>
                      <div className="text-gray-200">
                        {detail.statistics.duration_minutes > 0 
                          ? formatDuration(detail.statistics.duration_minutes)
                          : '未开始'
                        }
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 游戏统计 */}
              <Card className="bg-gray-800/50 border-gray-700/50">
                <CardHeader>
                  <CardTitle className="text-lg text-gray-100 flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-green-400" />
                    游戏统计
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-gray-700/50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-400">{detail.statistics.total_events}</div>
                      <div className="text-sm text-gray-400">总事件数</div>
                    </div>
                    <div className="text-center p-3 bg-gray-700/50 rounded-lg">
                      <div className="text-2xl font-bold text-green-400">{detail.statistics.chat_messages}</div>
                      <div className="text-sm text-gray-400">聊天消息</div>
                    </div>
                    <div className="text-center p-3 bg-gray-700/50 rounded-lg">
                      <div className="text-2xl font-bold text-purple-400">{detail.statistics.system_events}</div>
                      <div className="text-sm text-gray-400">系统事件</div>
                    </div>
                    <div className="text-center p-3 bg-gray-700/50 rounded-lg">
                      <div className="text-2xl font-bold text-orange-400">{detail.statistics.tts_generated}</div>
                      <div className="text-sm text-gray-400">语音生成</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* AI演绎说明 */}
              <Card className="bg-gray-800/50 border-gray-700/50">
                <CardContent className="pt-6">
                  <div className="text-center space-y-2">
                    <div className="text-gray-300">
                      本游戏为 AI 自主演绎模式，所有角色均由智能体驱动完成
                    </div>
                    <div className="text-sm text-gray-500">
                      无需人类玩家参与，AI 将自动推进剧情发展
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 操作按钮 */}
              <div className="flex gap-3 pt-4">
                {canContinue && (
                  <Button
                    onClick={() => handleAction('continue')}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  >
                    <PlayCircle className="h-4 w-4 mr-2" />
                    {status === 'PENDING' ? '开始游戏' : status === 'PAUSED' ? '继续游戏' : '进入游戏'}
                  </Button>
                )}
                
                {canReplay && (
                  <Button
                    onClick={() => handleAction('replay')}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    观看回放
                  </Button>
                )}
                
                {isCanceled && (
                  <div className="flex-1 text-center py-3 text-gray-500">
                    已取消的游戏无法操作
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              无法加载游戏详情
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default GameHistoryDrawer;