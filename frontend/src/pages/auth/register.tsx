import AppLayout from '@/components/AppLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/stores/authStore';
import { UserRegister } from '@/types/auth';
import { Eye, EyeOff, Lock, Mail, Smile, User, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';

const RegisterPage: React.FC = () => {
  const router = useRouter();
  const { register, isLoading, error, clearError } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState<UserRegister & { confirmPassword: string }>({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    nickname: '',
  });

  // 清除错误信息
  useEffect(() => {
    return () => {
      clearError();
    };
  }, [clearError]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    // 清除错误信息
    if (error) {
      clearError();
    }
  };

  const validateForm = () => {
    if (!formData.username.trim()) {
      toast.error('请输入用户名');
      return false;
    }
    if (formData.username.length < 3) {
      toast.error('用户名至少需要3个字符');
      return false;
    }
    if (!formData.email.trim()) {
      toast.error('请输入邮箱地址');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      toast.error('请输入有效的邮箱地址');
      return false;
    }
    if (!formData.password.trim()) {
      toast.error('请输入密码');
      return false;
    }
    if (formData.password.length < 6) {
      toast.error('密码至少需要6个字符');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      toast.error('两次输入的密码不一致');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      const { confirmPassword, ...registerData } = formData;
      await register(registerData);
      toast.success('注册成功！请登录您的账户');
      router.push('/auth/login');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '注册失败');
    }
  };

  return (
    <ProtectedRoute requireAuth={false}>
      <AppLayout showSidebar={false}>
        <div className="min-h-[calc(100vh-12rem)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-md w-full space-y-8">
            <div className="text-center">
              <div className="mx-auto h-12 w-12 bg-gradient-to-r from-green-600 to-blue-600 rounded-full flex items-center justify-center mb-4">
                <UserPlus className="h-6 w-6 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-white mb-2">
                加入我们
              </h2>
              <p className="text-gray-300">
                创建您的账户开始剧本杀之旅
              </p>
            </div>

          <Card className="bg-white/10 backdrop-blur-md border-white/20">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl text-center text-white">
                用户注册
              </CardTitle>
              <CardDescription className="text-center text-gray-300">
                填写以下信息创建您的账户
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-white">
                    用户名 *
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="username"
                      name="username"
                      type="text"
                      value={formData.username}
                      onChange={handleInputChange}
                      placeholder="请输入用户名（至少3个字符）"
                      className="pl-10 bg-white/10 border-white/20 text-white placeholder-gray-400 focus:border-green-500"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-white">
                    邮箱地址 *
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="请输入邮箱地址"
                      className="pl-10 bg-white/10 border-white/20 text-white placeholder-gray-400 focus:border-green-500"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nickname" className="text-white">
                    昵称
                  </Label>
                  <div className="relative">
                    <Smile className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="nickname"
                      name="nickname"
                      type="text"
                      value={formData.nickname}
                      onChange={handleInputChange}
                      placeholder="请输入昵称（可选）"
                      className="pl-10 bg-white/10 border-white/20 text-white placeholder-gray-400 focus:border-green-500"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-white">
                    密码 *
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={handleInputChange}
                      placeholder="请输入密码（至少6个字符）"
                      className="pl-10 pr-10 bg-white/10 border-white/20 text-white placeholder-gray-400 focus:border-green-500"
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                      disabled={isLoading}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-white">
                    确认密码 *
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      placeholder="请再次输入密码"
                      className="pl-10 pr-10 bg-white/10 border-white/20 text-white placeholder-gray-400 focus:border-green-500"
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                      disabled={isLoading}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="text-red-400 text-sm text-center bg-red-500/10 border border-red-500/20 rounded-md p-2">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white font-medium py-2 px-4 rounded-md transition-all duration-200 transform hover:scale-105"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      注册中...
                    </div>
                  ) : (
                    <div className="flex items-center justify-center">
                      <UserPlus className="h-4 w-4 mr-2" />
                      注册账户
                    </div>
                  )}
                </Button>

                <div className="text-center space-y-2">
                  <p className="text-gray-300 text-sm">
                    已有账户？{' '}
                    <Link
                      href="/auth/login"
                      className="text-green-400 hover:text-green-300 font-medium transition-colors"
                    >
                      立即登录
                    </Link>
                  </p>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
};

export default RegisterPage;