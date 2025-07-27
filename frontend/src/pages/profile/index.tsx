import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { User, Mail, Smile, Calendar, MapPin, Globe, Phone, Edit3, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuthStore } from '@/stores/authStore';
import { UserUpdate } from '@/types/auth';
import AppLayout from '@/components/AppLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
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

  // 检查认证状态
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login');
      return;
    }
    // 移除getCurrentUser调用，因为ProtectedRoute已经处理了认证状态
  }, [isAuthenticated, router]);

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
    setIsEditing(false);
  };

  if (!isAuthenticated) {
    return null;
  }

  if (!user) {
    return (
      <ProtectedRoute>
        <AppLayout title="个人资料">
          <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          </div>
        </AppLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <AppLayout title="个人资料">
        <div className="max-w-4xl mx-auto space-y-6">

          <Tabs defaultValue="profile" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 bg-white/10 backdrop-blur-md border-white/20">
              <TabsTrigger value="profile" className="text-white data-[state=active]:bg-white/20">
                基本信息
              </TabsTrigger>
              <TabsTrigger value="settings" className="text-white data-[state=active]:bg-white/20">
                账户设置
              </TabsTrigger>
            </TabsList>

            <TabsContent value="profile">
              <Card className="bg-white/10 backdrop-blur-md border-white/20">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-white">基本信息</CardTitle>
                      <CardDescription className="text-gray-300">
                        更新您的个人资料信息
                      </CardDescription>
                    </div>
                    <div className="flex space-x-2">
                      {isEditing ? (
                        <>
                          <Button
                            onClick={handleSave}
                            disabled={isLoading}
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            <Save className="h-4 w-4 mr-2" />
                            保存
                          </Button>
                          <Button
                            onClick={handleCancel}
                            variant="outline"
                            className="border-white/20 text-white hover:bg-white/10"
                          >
                            <X className="h-4 w-4 mr-2" />
                            取消
                          </Button>
                        </>
                      ) : (
                        <Button
                          onClick={() => setIsEditing(true)}
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          <Edit3 className="h-4 w-4 mr-2" />
                          编辑
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* 头像 */}
                  <div className="flex items-center space-x-4">
                    <div className="h-20 w-20 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center">
                      {user.avatar_url ? (
                        <img
                          src={user.avatar_url}
                          alt="头像"
                          className="h-20 w-20 rounded-full object-cover"
                        />
                      ) : (
                        <User className="h-10 w-10 text-white" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-white">
                        {user.nickname || user.username}
                      </h3>
                      <p className="text-gray-300 text-sm">
                        @{user.username}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* 用户名 */}
                    <div className="space-y-2">
                      <Label className="text-white">用户名</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          value={user.username}
                          disabled
                          className="pl-10 bg-white/5 border-white/20 text-gray-400"
                        />
                      </div>
                      <p className="text-xs text-gray-400">用户名不可修改</p>
                    </div>

                    {/* 昵称 */}
                    <div className="space-y-2">
                      <Label className="text-white">昵称</Label>
                      <div className="relative">
                        <Smile className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          name="nickname"
                          value={formData.nickname}
                          onChange={handleInputChange}
                          disabled={!isEditing}
                          placeholder="请输入昵称"
                          className={`pl-10 ${isEditing ? 'bg-white/10 border-white/20 text-white' : 'bg-white/5 border-white/20 text-gray-300'}`}
                        />
                      </div>
                    </div>

                    {/* 邮箱 */}
                    <div className="space-y-2">
                      <Label className="text-white">邮箱地址</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          name="email"
                          type="email"
                          value={formData.email}
                          onChange={handleInputChange}
                          disabled={!isEditing}
                          placeholder="请输入邮箱地址"
                          className={`pl-10 ${isEditing ? 'bg-white/10 border-white/20 text-white' : 'bg-white/5 border-white/20 text-gray-300'}`}
                        />
                      </div>
                    </div>

                    {/* 头像URL */}
                    <div className="space-y-2">
                      <Label className="text-white">头像URL</Label>
                      <div className="relative">
                        <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          name="avatar_url"
                          value={formData.avatar_url}
                          onChange={handleInputChange}
                          disabled={!isEditing}
                          placeholder="请输入头像URL"
                          className={`pl-10 ${isEditing ? 'bg-white/10 border-white/20 text-white' : 'bg-white/5 border-white/20 text-gray-300'}`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* 账户信息 */}
                  <div className="border-t border-white/20 pt-6">
                    <h4 className="text-lg font-medium text-white mb-4">账户信息</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-400">注册时间：</span>
                        <span className="text-white ml-2">
                          {new Date(user.created_at).toLocaleDateString('zh-CN')}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400">最后更新：</span>
                        <span className="text-white ml-2">
                          {new Date(user.updated_at).toLocaleDateString('zh-CN')}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400">账户状态：</span>
                        <span className={`ml-2 px-2 py-1 rounded-full text-xs ${
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
              <Card className="bg-white/10 backdrop-blur-md border-white/20">
                <CardHeader>
                  <CardTitle className="text-white">账户设置</CardTitle>
                  <CardDescription className="text-gray-300">
                    管理您的账户安全和偏好设置
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <Button
                      onClick={() => router.push('/profile/change-password')}
                      className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                    >
                      修改密码
                    </Button>
                    
                    <Button
                      onClick={() => router.push('/profile/game-history')}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      游戏历史
                    </Button>
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