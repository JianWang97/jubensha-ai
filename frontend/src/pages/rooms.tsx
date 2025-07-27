import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Search, Users, Clock, Play, Settings, Crown, Lock, Globe, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import AppLayout from '@/components/AppLayout';
import AuthGuard from '@/components/AuthGuard';
import { useRouter } from 'next/router';
import { useRoomsStore, Room } from '@/stores/roomsStore';

const RoomCard = ({ room, onJoin, onViewDetails }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'waiting': return 'bg-green-500';
      case 'playing': return 'bg-yellow-500';
      case 'finished': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'waiting': return '等待中';
      case 'playing': return '游戏中';
      case 'finished': return '已结束';
      default: return '未知';
    }
  };

  const progressPercentage = (room.currentPlayers / room.maxPlayers) * 100;

  return (
    <Card className="hover:shadow-lg transition-all duration-300">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <CardTitle className="text-lg line-clamp-1">{room.name}</CardTitle>
              {room.isPrivate && <Lock className="h-4 w-4 text-muted-foreground" />}
              {!room.isPrivate && <Globe className="h-4 w-4 text-muted-foreground" />}
            </div>
            <CardDescription className="line-clamp-1">{room.script}</CardDescription>
          </div>
          <Badge className={`${getStatusColor(room.status)} text-white`}>
            {getStatusText(room.status)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 房主信息 */}
        <div className="flex items-center gap-2">
          <Crown className="h-4 w-4 text-yellow-500" />
          <span className="text-sm font-medium">{room.host}</span>
        </div>

        {/* 玩家进度 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              玩家人数
            </span>
            <span className="font-medium">{room.currentPlayers}/{room.maxPlayers}</span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>

        {/* 时间信息 */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            <span>创建: {room.createdAt}</span>
          </div>
        </div>

        {/* 房间描述 */}
        {room.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {room.description}
          </p>
        )}

        {/* 玩家头像列表 */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">玩家:</span>
          <div className="flex -space-x-2">
            {room.players.slice(0, 4).map((player) => (
              <Avatar key={player.id} className="h-6 w-6 border-2 border-white">
                <AvatarFallback className="text-xs">
                  {player.name.charAt(player.name.length - 1)}
                </AvatarFallback>
              </Avatar>
            ))}
            {room.players.length > 4 && (
              <div className="h-6 w-6 rounded-full bg-muted border-2 border-white flex items-center justify-center">
                <span className="text-xs text-muted-foreground">+{room.players.length - 4}</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex gap-2">
        <Button 
          variant="outline" 
          className="flex-1"
          onClick={() => onViewDetails(room)}
        >
          查看详情
        </Button>
        {room.status === 'waiting' && room.currentPlayers < room.maxPlayers && (
          <Button 
            className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            onClick={() => onJoin(room)}
          >
            加入房间
          </Button>
        )}
        {room.status === 'playing' && (
          <Button 
            className="flex-1 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
            onClick={() => onViewDetails(room)}
          >
            <Play className="h-4 w-4 mr-2" />
            观战
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

const CreateRoomModal = ({ isOpen, onClose, onCreateRoom }) => {
  const [formData, setFormData] = useState({
    name: '',
    script: '',
    maxPlayers: 6,
    isPrivate: false,
    description: '',
    password: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onCreateRoom(formData);
    onClose();
    setFormData({
      name: '',
      script: '',
      maxPlayers: 6,
      isPrivate: false,
      description: '',
      password: ''
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>创建房间</DialogTitle>
          <DialogDescription>
            设置房间信息，邀请朋友一起游戏
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">房间名称</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              placeholder="输入房间名称"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="script">选择剧本</Label>
            <Select value={formData.script} onValueChange={(value) => setFormData({...formData, script: value})}>
              <SelectTrigger>
                <SelectValue placeholder="选择剧本" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="古宅疑云">古宅疑云</SelectItem>
                <SelectItem value="末日求生">末日求生</SelectItem>
                <SelectItem value="校园青春">校园青春</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxPlayers">最大人数</Label>
            <Select value={formData.maxPlayers.toString()} onValueChange={(value) => setFormData({...formData, maxPlayers: parseInt(value)})}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3人</SelectItem>
                <SelectItem value="4">4人</SelectItem>
                <SelectItem value="5">5人</SelectItem>
                <SelectItem value="6">6人</SelectItem>
                <SelectItem value="7">7人</SelectItem>
                <SelectItem value="8">8人</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">房间描述</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              placeholder="描述房间特色或要求（可选）"
              rows={3}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="private"
              checked={formData.isPrivate}
              onCheckedChange={(checked) => setFormData({...formData, isPrivate: checked})}
            />
            <Label htmlFor="private">私人房间</Label>
          </div>

          {formData.isPrivate && (
            <div className="space-y-2">
              <Label htmlFor="password">房间密码</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                placeholder="设置房间密码"
              />
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button type="submit" className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700">
              创建房间
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const QuickMatchCard = ({ onQuickMatch }) => {
  const [preferences, setPreferences] = useState({
    script: '',
    playerCount: '',
    difficulty: ''
  });

  return (
    <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Play className="h-5 w-5" />
          快速匹配
        </CardTitle>
        <CardDescription>
          根据你的偏好自动匹配合适的房间
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>剧本偏好</Label>
            <Select value={preferences.script} onValueChange={(value) => setPreferences({...preferences, script: value})}>
              <SelectTrigger>
                <SelectValue placeholder="任意剧本" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">任意剧本</SelectItem>
                <SelectItem value="推理">推理类</SelectItem>
                <SelectItem value="生存">生存类</SelectItem>
                <SelectItem value="情感">情感类</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>人数偏好</Label>
            <Select value={preferences.playerCount} onValueChange={(value) => setPreferences({...preferences, playerCount: value})}>
              <SelectTrigger>
                <SelectValue placeholder="任意人数" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">任意人数</SelectItem>
                <SelectItem value="3-4">3-4人</SelectItem>
                <SelectItem value="5-6">5-6人</SelectItem>
                <SelectItem value="7-8">7-8人</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>难度偏好</Label>
            <Select value={preferences.difficulty} onValueChange={(value) => setPreferences({...preferences, difficulty: value})}>
              <SelectTrigger>
                <SelectValue placeholder="任意难度" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">任意难度</SelectItem>
                <SelectItem value="简单">简单</SelectItem>
                <SelectItem value="中等">中等</SelectItem>
                <SelectItem value="困难">困难</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button 
          className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
          onClick={() => onQuickMatch(preferences)}
        >
          <Play className="h-4 w-4 mr-2" />
          开始匹配
        </Button>
      </CardFooter>
    </Card>
  );
};

export default function RoomsPage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [filteredRooms, setFilteredRooms] = useState<Room[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    filterRooms();
  }, [searchTerm, statusFilter, activeTab]);

  const filterRooms = () => {
    let filtered = rooms;

    // 标签页过滤
    if (activeTab === 'my') {
      // 这里应该根据当前用户过滤
      filtered = filtered.filter(room => room.host.name === '当前用户');
    } else if (activeTab === 'public') {
      filtered = filtered.filter(room => !room.isPrivate);
    }

    // 搜索过滤
    if (searchTerm) {
      filtered = filtered.filter(room => 
        room.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (typeof room.script === 'string' ? room.script : room.script.title).toLowerCase().includes(searchTerm.toLowerCase()) ||
        room.host.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // 状态过滤
    if (statusFilter) {
      filtered = filtered.filter(room => room.status === statusFilter);
    }

    setFilteredRooms(filtered);
  };

  const handleCreateRoom = (roomData) => {
    const newRoom = {
      id: rooms.length + 1,
      ...roomData,
      host: '当前用户',
      currentPlayers: 1,
      status: 'waiting',
      createdAt: new Date().toLocaleString('zh-CN'),
      estimatedStart: new Date(Date.now() + 30 * 60000).toLocaleString('zh-CN'),
      players: [
        { id: 999, name: '当前用户', avatar: '', isHost: true }
      ]
    };
    setRooms([newRoom, ...rooms]);
  };

  const handleJoinRoom = (room) => {
    // 这里应该实现加入房间的逻辑
    console.log('加入房间:', room.id);
    router.push(`/rooms/${room.id}`);
  };

  const handleViewDetails = (room) => {
    router.push(`/rooms/${room.id}`);
  };

  const handleQuickMatch = (preferences) => {
    // 这里应该实现快速匹配的逻辑
    console.log('快速匹配偏好:', preferences);
    // 模拟匹配成功
    const availableRooms = rooms.filter(room => 
      room.status === 'waiting' && 
      room.currentPlayers < room.maxPlayers &&
      !room.isPrivate
    );
    if (availableRooms.length > 0) {
      handleJoinRoom(availableRooms[0]);
    } else {
      // 没有合适的房间，创建新房间
      setIsCreateModalOpen(true);
    }
  };

  return (
    <AuthGuard>
      <AppLayout>
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
        {/* 头部导航 */}
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-4">
                <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-purple-600 transition-colors">
                  <ArrowLeft className="h-4 w-4" />
                  <span className="text-sm">返回首页</span>
                </Link>
                <div className="h-6 w-px bg-gray-300"></div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                  房间管理
                </h1>
                <Badge variant="secondary">{filteredRooms.length} 个房间</Badge>
              </div>
              <div className="flex items-center gap-4">
                {/* 搜索框 */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="搜索房间..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-64"
                  />
                </div>
                {/* 状态筛选 */}
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">全部状态</SelectItem>
                    <SelectItem value="waiting">等待中</SelectItem>
                    <SelectItem value="playing">游戏中</SelectItem>
                    <SelectItem value="finished">已结束</SelectItem>
                  </SelectContent>
                </Select>
                {/* 创建房间按钮 */}
                <Button 
                  onClick={() => setIsCreateModalOpen(true)}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  创建房间
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* 快速匹配卡片 */}
          <div className="mb-8">
            <QuickMatchCard onQuickMatch={handleQuickMatch} />
          </div>

          {/* 房间列表标签页 */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 max-w-md">
              <TabsTrigger value="all">全部房间</TabsTrigger>
              <TabsTrigger value="public">公开房间</TabsTrigger>
              <TabsTrigger value="my">我的房间</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-6">
              {filteredRooms.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-muted-foreground mb-4">没有找到符合条件的房间</div>
                  <Button onClick={() => {
                    setSearchTerm('');
                    setStatusFilter('');
                  }}>
                    清除筛选条件
                  </Button>
                </div>
              ) : (
                <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                  {filteredRooms.map((room) => (
                    <RoomCard
                      key={room.id}
                      room={room}
                      onJoin={handleJoinRoom}
                      onViewDetails={handleViewDetails}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="public" className="space-y-6">
              <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {filteredRooms.map((room) => (
                  <RoomCard
                    key={room.id}
                    room={room}
                    onJoin={handleJoinRoom}
                    onViewDetails={handleViewDetails}
                  />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="my" className="space-y-6">
              {filteredRooms.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-muted-foreground mb-4">你还没有创建任何房间</div>
                  <Button 
                    onClick={() => setIsCreateModalOpen(true)}
                    className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    创建第一个房间
                  </Button>
                </div>
              ) : (
                <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                  {filteredRooms.map((room) => (
                    <RoomCard
                      key={room.id}
                      room={room}
                      onJoin={handleJoinRoom}
                      onViewDetails={handleViewDetails}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* 创建房间模态框 */}
        <CreateRoomModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onCreateRoom={handleCreateRoom}
        />
      </div>
      </AppLayout>
    </AuthGuard>
  );
}