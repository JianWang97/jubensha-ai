import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { ArrowLeft, Crown, Users, Clock, Settings, Play, UserPlus, UserMinus, MessageCircle, Share2, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import AppLayout from '@/components/AppLayout';

// 模拟房间详情数据
const mockRoomDetail = {
  id: 1,
  name: '古宅疑云 - 推理之夜',
  script: {
    id: 1,
    title: '古宅疑云',
    description: '一座古老的宅院中发生了离奇的命案，每个人都有不可告人的秘密...',
    difficulty: '中等',
    duration: '2-3小时',
    category: '推理',
    rating: 4.5,
    image: 'https://trae-api-sg.mchost.guru/api/ide/v1/text_to_image?prompt=ancient%20chinese%20mansion%20mystery%20dark%20atmosphere&image_size=landscape_4_3'
  },
  host: { id: 1, name: '玩家A', avatar: '' },
  currentPlayers: 4,
  maxPlayers: 6,
  status: 'waiting', // waiting, playing, finished
  isPrivate: false,
  createdAt: '2024-01-15 20:30',
  estimatedStart: '2024-01-15 21:00',
  description: '欢迎新手玩家，我们会耐心引导游戏流程',
  settings: {
    allowSpectators: true,
    autoStart: false,
    voiceChat: true,
    recordGame: true
  },
  players: [
    { 
      id: 1, 
      name: '玩家A', 
      avatar: '', 
      isHost: true, 
      status: 'ready',
      character: null,
      joinedAt: '2024-01-15 20:30'
    },
    { 
      id: 2, 
      name: '玩家B', 
      avatar: '', 
      isHost: false, 
      status: 'ready',
      character: null,
      joinedAt: '2024-01-15 20:35'
    },
    { 
      id: 3, 
      name: '玩家C', 
      avatar: '', 
      isHost: false, 
      status: 'not_ready',
      character: null,
      joinedAt: '2024-01-15 20:40'
    },
    { 
      id: 4, 
      name: '玩家D', 
      avatar: '', 
      isHost: false, 
      status: 'ready',
      character: null,
      joinedAt: '2024-01-15 20:45'
    }
  ],
  chatMessages: [
    { id: 1, playerId: 1, playerName: '玩家A', message: '欢迎大家！', timestamp: '20:30' },
    { id: 2, playerId: 2, playerName: '玩家B', message: '大家好！', timestamp: '20:35' },
    { id: 3, playerId: 1, playerName: '玩家A', message: '等人齐了就开始', timestamp: '20:40' }
  ]
};

const PlayerCard = ({ player, isCurrentUser, isHost, onKickPlayer, onPromotePlayer }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'ready': return 'bg-green-500';
      case 'not_ready': return 'bg-yellow-500';
      case 'disconnected': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'ready': return '准备就绪';
      case 'not_ready': return '未准备';
      case 'disconnected': return '已断线';
      default: return '未知';
    }
  };

  return (
    <Card className={`${isCurrentUser ? 'ring-2 ring-purple-500' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Avatar className="h-12 w-12">
                <AvatarFallback>
                  {player.name.charAt(player.name.length - 1)}
                </AvatarFallback>
              </Avatar>
              {player.isHost && (
                <Crown className="absolute -top-1 -right-1 h-5 w-5 text-yellow-500" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h4 className="font-medium">{player.name}</h4>
                {isCurrentUser && <Badge variant="secondary">你</Badge>}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={`${getStatusColor(player.status)} text-white text-xs`}>
                  {getStatusText(player.status)}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {player.joinedAt}
                </span>
              </div>
              {player.character && (
                <div className="mt-2">
                  <Badge variant="outline">{player.character}</Badge>
                </div>
              )}
            </div>
          </div>
          {isHost && !player.isHost && !isCurrentUser && (
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onPromotePlayer(player.id)}
                title="设为房主"
              >
                <Crown className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onKickPlayer(player.id)}
                title="踢出房间"
                className="text-red-500 hover:text-red-700"
              >
                <UserMinus className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const ChatPanel = ({ messages, onSendMessage }) => {
  const [newMessage, setNewMessage] = useState('');

  const handleSend = () => {
    if (newMessage.trim()) {
      onSendMessage(newMessage);
      setNewMessage('');
    }
  };

  return (
    <Card className="h-96 flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          房间聊天
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-0">
        <ScrollArea className="flex-1 px-4">
          <div className="space-y-3">
            {messages.map((msg) => (
              <div key={msg.id} className="flex gap-2">
                <Avatar className="h-6 w-6 mt-1">
                  <AvatarFallback className="text-xs">
                    {msg.playerName.charAt(msg.playerName.length - 1)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{msg.playerName}</span>
                    <span className="text-xs text-muted-foreground">{msg.timestamp}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{msg.message}</p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        <div className="p-4 border-t">
          <div className="flex gap-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="输入消息..."
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            />
            <Button onClick={handleSend}>
              发送
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const RoomSettingsModal = ({ room, isOpen, onClose, onSaveSettings }) => {
  const [settings, setSettings] = useState(room?.settings || {});

  const handleSave = () => {
    onSaveSettings(settings);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>房间设置</DialogTitle>
          <DialogDescription>
            调整房间的游戏设置
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="allowSpectators">允许观战</Label>
            <Switch
              id="allowSpectators"
              checked={settings.allowSpectators}
              onCheckedChange={(checked) => setSettings({...settings, allowSpectators: checked})}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="autoStart">人满自动开始</Label>
            <Switch
              id="autoStart"
              checked={settings.autoStart}
              onCheckedChange={(checked) => setSettings({...settings, autoStart: checked})}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="voiceChat">语音聊天</Label>
            <Switch
              id="voiceChat"
              checked={settings.voiceChat}
              onCheckedChange={(checked) => setSettings({...settings, voiceChat: checked})}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="recordGame">录制游戏</Label>
            <Switch
              id="recordGame"
              checked={settings.recordGame}
              onCheckedChange={(checked) => setSettings({...settings, recordGame: checked})}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handleSave}>
            保存设置
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default function RoomDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const [room, setRoom] = useState(mockRoomDetail);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [currentUserId] = useState(1); // 模拟当前用户ID

  const isHost = room.host.id === currentUserId;
  const isPlayerInRoom = room.players.some(p => p.id === currentUserId);
  const readyPlayersCount = room.players.filter(p => p.status === 'ready').length;
  const canStartGame = readyPlayersCount === room.currentPlayers && room.currentPlayers >= 3;

  const handleStartGame = () => {
    if (canStartGame) {
      router.push(`/rooms/${id}/game`);
    } else {
      toast.error('需要所有玩家都准备就绪才能开始游戏');
    }
  };

  const handleJoinRoom = () => {
    if (room.currentPlayers < room.maxPlayers) {
      const newPlayer = {
        id: currentUserId,
        name: '当前用户',
        avatar: '',
        isHost: false,
        status: 'not_ready',
        character: null,
        joinedAt: new Date().toLocaleString('zh-CN')
      };
      setRoom({
        ...room,
        currentPlayers: room.currentPlayers + 1,
        players: [...room.players, newPlayer]
      });
      toast.success('成功加入房间');
    }
  };

  const handleLeaveRoom = () => {
    setRoom({
      ...room,
      currentPlayers: room.currentPlayers - 1,
      players: room.players.filter(p => p.id !== currentUserId)
    });
    router.push('/rooms');
  };

  const handleKickPlayer = (playerId) => {
    setRoom({
      ...room,
      currentPlayers: room.currentPlayers - 1,
      players: room.players.filter(p => p.id !== playerId)
    });
    toast.success('玩家已被踢出房间');
  };

  const handlePromotePlayer = (playerId) => {
    setRoom({
      ...room,
      host: room.players.find(p => p.id === playerId) || room.host,
      players: room.players.map(p => ({
        ...p,
        isHost: p.id === playerId
      }))
    });
    toast.success('房主已转让');
  };

  const handleToggleReady = () => {
    setRoom({
      ...room,
      players: room.players.map(p => 
        p.id === currentUserId 
          ? { ...p, status: p.status === 'ready' ? 'not_ready' : 'ready' }
          : p
      )
    });
  };

  const handleSendMessage = (message) => {
    const newMessage = {
      id: room.chatMessages.length + 1,
      playerId: currentUserId,
      playerName: '当前用户',
      message,
      timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    };
    setRoom({
      ...room,
      chatMessages: [...room.chatMessages, newMessage]
    });
  };

  const handleSaveSettings = (newSettings) => {
    setRoom({
      ...room,
      settings: newSettings
    });
    toast.success('房间设置已保存');
  };

  const handleShareRoom = () => {
    const roomUrl = `${window.location.origin}/rooms/${id}`;
    navigator.clipboard.writeText(roomUrl);
    toast.success('房间链接已复制到剪贴板');
  };

  if (!room) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">房间不存在</h2>
            <Button onClick={() => router.push('/rooms')}>返回房间列表</Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
        {/* 头部导航 */}
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-4">
                <Button variant="ghost" onClick={() => router.push('/rooms')}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  返回
                </Button>
                <div>
                  <h1 className="text-xl font-bold">{room.name}</h1>
                  <p className="text-sm text-muted-foreground">{room.script.title}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={handleShareRoom}>
                  <Share2 className="h-4 w-4 mr-2" />
                  分享
                </Button>
                {isHost && (
                  <Button variant="outline" onClick={() => setIsSettingsOpen(true)}>
                    <Settings className="h-4 w-4 mr-2" />
                    设置
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* 左侧主要内容 */}
            <div className="lg:col-span-2 space-y-6">
              {/* 剧本信息卡片 */}
              <Card>
                <CardHeader>
                  <div className="flex gap-4">
                    <img 
                      src={room.script.image} 
                      alt={room.script.title}
                      className="w-24 h-24 object-cover rounded-lg"
                    />
                    <div className="flex-1">
                      <CardTitle className="text-xl mb-2">{room.script.title}</CardTitle>
                      <CardDescription className="mb-3">
                        {room.script.description}
                      </CardDescription>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          <span>{room.currentPlayers}/{room.maxPlayers}人</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          <span>{room.script.duration}</span>
                        </div>
                        <Badge>{room.script.category}</Badge>
                        <Badge variant="outline">{room.script.difficulty}</Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>
              </Card>

              {/* 房间状态 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>房间状态</span>
                    <Badge className={room.status === 'waiting' ? 'bg-green-500' : 'bg-yellow-500'}>
                      {room.status === 'waiting' ? '等待中' : '游戏中'}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span>玩家准备状态</span>
                        <span>{readyPlayersCount}/{room.currentPlayers}</span>
                      </div>
                      <Progress value={(readyPlayersCount / room.currentPlayers) * 100} />
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">房主:</span>
                        <span className="ml-2 font-medium">{room.host.name}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">创建时间:</span>
                        <span className="ml-2">{room.createdAt}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">预计开始:</span>
                        <span className="ml-2">{room.estimatedStart}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">房间类型:</span>
                        <span className="ml-2">{room.isPrivate ? '私人' : '公开'}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 玩家列表 */}
              <Card>
                <CardHeader>
                  <CardTitle>玩家列表 ({room.currentPlayers}/{room.maxPlayers})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3">
                    {room.players.map((player) => (
                      <PlayerCard
                        key={player.id}
                        player={player}
                        isCurrentUser={player.id === currentUserId}
                        isHost={isHost}
                        onKickPlayer={handleKickPlayer}
                        onPromotePlayer={handlePromotePlayer}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 右侧聊天和操作 */}
            <div className="space-y-6">
              {/* 操作按钮 */}
              <Card>
                <CardContent className="p-4 space-y-3">
                  {!isPlayerInRoom ? (
                    <Button 
                      className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                      onClick={handleJoinRoom}
                      disabled={room.currentPlayers >= room.maxPlayers}
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      {room.currentPlayers >= room.maxPlayers ? '房间已满' : '加入房间'}
                    </Button>
                  ) : (
                    <>
                      {isHost ? (
                        <Button 
                          className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
                          onClick={handleStartGame}
                          disabled={!canStartGame}
                        >
                          <Play className="h-4 w-4 mr-2" />
                          {canStartGame ? '开始游戏' : '等待玩家准备'}
                        </Button>
                      ) : (
                        <Button 
                          className="w-full"
                          onClick={handleToggleReady}
                          variant={room.players.find(p => p.id === currentUserId)?.status === 'ready' ? 'default' : 'outline'}
                        >
                          {room.players.find(p => p.id === currentUserId)?.status === 'ready' ? '取消准备' : '准备就绪'}
                        </Button>
                      )}
                      <Button 
                        variant="outline" 
                        className="w-full"
                        onClick={handleLeaveRoom}
                      >
                        离开房间
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* 聊天面板 */}
              <ChatPanel 
                messages={room.chatMessages}
                onSendMessage={handleSendMessage}
              />
            </div>
          </div>
        </div>

        {/* 房间设置模态框 */}
        <RoomSettingsModal
          room={room}
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          onSaveSettings={handleSaveSettings}
        />
      </div>
    </AppLayout>
  );
}