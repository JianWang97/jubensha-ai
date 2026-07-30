import AppLayout from '@/components/AppLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { authService } from '@/services/authService';
import { useAuthStore } from '@/stores/authStore';
import { UserUpdate } from '@/types/auth';
import { Camera, ChevronRight, Edit3, History, Lock, Mail, Save, Smile, User, X } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/router';
import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

const ProfilePage: React.FC = () => {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, updateProfile } = useAuthStore();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<UserUpdate>({
    nickname: '',
    email: '',
    avatar_url: '',
  });
  const [avatarPreview, setAvatarPreview] = useState<string>('');
  const [gameHistoryCount, setGameHistoryCount] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 检查认证状态
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login');
      return;
    }
    // 移除getCurrentUser调用，因为ProtectedRoute已经处理了认证状态
  }, [isAuthenticated, router]);

  // 加载游戏历史场次
  useEffect(() => {
    if (isAuthenticated) {
      authService.getUserGameHistory(0, 200).then(history => {
        setGameHistoryCount(history.length);
      }).catch(() => {});
    }
  }, [isAuthenticated]);

  // 初始化表单数据
  useEffect(() => {
    if (user) {
      setFormData({
        nickname: user.nickname || '',
        email: user.email || '',
        avatar_url: user.avatar_url || '',
      });
    }
  }, [user]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const base64 = evt.target?.result as string;
      setAvatarPreview(base64);
      setFormData(prev => ({ ...prev, avatar_url: base64 }));
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    try {
      await updateProfile(formData);
      setIsEditing(false);
      toast.success('个人资料更新成功！');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '更新失败');
    }
  };

  const handleCancel = () => {
    if (user) {
      setFormData({
        nickname: user.nickname || '',
        email: user.email || '',
        avatar_url: user.avatar_url || '',
      });
    }
    setAvatarPreview('');
    setIsEditing(false);
  };

  if (!isAuthenticated) {
    return null;
  }

  if (!user) {
    return (
      <ProtectedRoute>
        <AppLayout>
          <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400"></div>
          </div>
        </AppLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">

          {/* 页面标题 */}
          <div className="flex items-center gap-3">
            <User className="h-6 w-6 text-purple-400" />
            <h1 className="text-2xl font-bold text-white">个人中心</h1>
          </div>

          <Tabs defaultValue="profile" className="gap-6">
            <TabsList className="grid w-full grid-cols-2 bg-slate-900/50 backdrop-blur-md border border-slate-700/30">
              <TabsTrigger value="profile">
                基本信息
              </TabsTrigger>
              <TabsTrigger value="settings">
                账户设置
              </TabsTrigger>
            </TabsList>

            <TabsContent value="profile">
              <Card className="bg-slate-900/50 backdrop-blur-md border border-slate-700/30 rounded-lg">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-white">基本信息</CardTitle>
                      <CardDescription className="text-slate-400">
                        更新您的个人资料信息
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      {isEditing ? (
                        <>
                          <Button
                            onClick={handleSave}
                            disabled={isLoading}
                            className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"
                          >
                            <Save className="h-4 w-4 mr-2" />
                            保存
                          </Button>
                          <Button
                            onClick={handleCancel}
                            variant="outline"
                            className="border-slate-600/50 text-slate-300 hover:bg-slate-800/50 hover:text-white"
                          >
                            <X className="h-4 w-4 mr-2" />
                            取消
                          </Button>
                        </>
                      ) : (
                        <Button
                          onClick={() => setIsEditing(true)}
                          className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"
                        >
                          <Edit3 className="h-4 w-4 mr-2" />
                          编辑
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* 战绩统计卡片 */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: '游玩场次', value: gameHistoryCount !== null ? String(gameHistoryCount) : '--' },
                      { label: '完成率', value: '--' },
                      { label: '最爱角色', value: '--' },
                      { label: '游玩时长', value: '--' },
                    ].map(stat => (
                      <div key={stat.label} className="bg-slate-800/50 rounded-lg p-4 text-center border border-slate-700/30">
                        <div className="text-2xl font-bold text-purple-400">{stat.value}</div>
                        <div className="text-xs text-slate-400 mt-1">{stat.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* 头像 */}
                  <div className="flex items-center gap-5">
                    <div className="relative w-24 h-24 cursor-pointer group flex-shrink-0" onClick={() => fileInputRef.current?.click()}>
                      {(avatarPreview || user.avatar_url) ? (
                        <Image
                          src={avatarPreview || user.avatar_url || ''}
                          alt="头像"
                          fill
                          unoptimized
                          className="rounded-full object-cover ring-2 ring-purple-500/50"
                        />
                      ) : (
                        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center ring-2 ring-purple-500/50">
                          <User className="h-10 w-10 text-white" />
                        </div>
                      )}
                      <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Camera className="w-6 h-6 text-white" />
                      </div>
                      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-lg font-semibold text-white">
                        {user.nickname || user.username}
                      </h3>
                      <p className="text-slate-400 text-sm">
                        @{user.username}
                      </p>
                      <p className="text-slate-400 text-xs">点击头像可上传图片</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* 用户名 */}
                    <div className="space-y-2">
                      <Label className="text-slate-300">用户名</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          value={user.username}
                          disabled
                          className="pl-10 bg-slate-800/40 border border-slate-700/30 text-slate-400"
                        />
                      </div>
                      <p className="text-xs text-slate-400">用户名不可修改</p>
                    </div>

                    {/* 昵称 */}
                    <div className="space-y-2">
                      <Label className="text-slate-300">昵称</Label>
                      <div className="relative">
                        <Smile className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          name="nickname"
                          value={formData.nickname}
                          onChange={handleInputChange}
                          disabled={!isEditing}
                          placeholder="请输入昵称"
                          className={`pl-10 border ${isEditing ? 'bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-500 focus:border-indigo-400' : 'bg-slate-800/40 border-slate-700/30 text-slate-400'}`}
                        />
                      </div>
                    </div>

                    {/* 邮箱 */}
                    <div className="space-y-2">
                      <Label className="text-slate-300">邮箱地址</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          name="email"
                          type="email"
                          value={formData.email}
                          onChange={handleInputChange}
                          disabled={!isEditing}
                          placeholder="请输入邮箱地址"
                          className={`pl-10 border ${isEditing ? 'bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-500 focus:border-indigo-400' : 'bg-slate-800/40 border-slate-700/30 text-slate-400'}`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* 账户信息 */}
                  <div className="border-t border-slate-700/30 pt-6">
                    <h4 className="text-sm font-medium text-slate-300 mb-3">账户信息</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-slate-400">注册时间：</span>
                        <span className="text-white ml-2">
                          {new Date(user.created_at).toLocaleDateString('zh-CN')}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400">最后更新：</span>
                        <span className="text-white ml-2">
                          {new Date(user.updated_at).toLocaleDateString('zh-CN')}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400">账户状态：</span>
                        <span className={`ml-2 px-2 py-0.5 rounded-md text-xs font-medium ${
                          user.is_active 
                            ? 'bg-green-500/20 text-green-400' 
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {user.is_active ? '正常' : '已禁用'}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="settings">
              <Card className="bg-slate-900/50 backdrop-blur-md border border-slate-700/30 rounded-lg">
                <CardHeader>
                  <CardTitle className="text-white">账户设置</CardTitle>
                  <CardDescription className="text-slate-400">
                    管理您的账户安全和偏好设置
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="divide-y divide-slate-700/30 rounded-lg border border-slate-700/30 bg-slate-800/30 overflow-hidden">
                    <button
                      onClick={() => router.push('/profile/change-password')}
                      className="flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-slate-800/60"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-indigo-500/15">
                        <Lock className="h-4 w-4 text-indigo-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white">修改密码</div>
                        <div className="mt-0.5 text-xs text-slate-400">定期更换密码，保障账户安全</div>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                    </button>
                    <button
                      onClick={() => router.push('/profile/game-history')}
                      className="flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-slate-800/60"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-purple-500/15">
                        <History className="h-4 w-4 text-purple-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white">游戏历史</div>
                        <div className="mt-0.5 text-xs text-slate-400">查看您的对局记录与回放</div>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
};

export default ProfilePage;