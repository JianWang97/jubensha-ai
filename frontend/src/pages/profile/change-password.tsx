import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Eye, EyeOff, Lock, ArrowLeft, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/stores/authStore';
import { PasswordChange } from '@/client';
import AppLayout from '@/components/AppLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { toast } from 'sonner';

const ChangePasswordPage: React.FC = () => {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, changePassword } = useAuthStore();
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState<PasswordChange & { confirmPassword: string }>({
    old_password: '',
    new_password: '',
    confirmPassword: '',
  });

  // 检查认证状态
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login');
    }
  }, [isAuthenticated, router]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateForm = () => {
    if (!formData.old_password.trim()) {
      toast.error("请输入当前密码");
      return false;
    }
    
    if (!formData.new_password.trim()) {
      toast.error("请输入新密码");
      return false;
    }
    
    if (formData.new_password.length < 6) {
      toast.error("新密码至少需要6个字符");
      return false;
    }
    
    if (formData.new_password !== formData.confirmPassword) {
      toast.error("两次输入的密码不一致");
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
      const { confirmPassword, ...passwordData } = formData;
      await changePassword(passwordData);
      toast.success('密码修改成功！');
      router.push('/profile');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '密码修改失败');
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <ProtectedRoute>
      <AppLayout title="修改密码">
        <div className="max-w-md mx-auto">
          {/* 返回按钮 */}
          <div className="mb-6">
          </div>

          {/* 页面标题 */}
          <div className="text-center mb-8">
            <div className="mx-auto h-12 w-12 bg-gradient-to-r from-orange-600 to-red-600 rounded-full flex items-center justify-center mb-4">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">
              修改密码
            </h1>
            <p className="text-gray-300">
              为了您的账户安全，请定期更换密码
            </p>
          </div>

          <Card className="bg-white/10 backdrop-blur-md border-white/20">
            <CardHeader>
              <CardTitle className="text-white text-center">
                密码修改
              </CardTitle>
              <CardDescription className="text-gray-300 text-center">
                请输入当前密码和新密码
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* 当前密码 */}
                <div className="space-y-2">
                  <Label htmlFor="old_password" className="text-white">
                    当前密码 *
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="old_password"
                      name="old_password"
                      type={showCurrentPassword ? "text" : "password"}
                      value={formData.old_password}
                      onChange={handleInputChange}
                      placeholder="请输入当前密码"
                      className="pl-10 pr-10 bg-white/10 border-white/20 text-white placeholder-gray-400 focus:border-orange-500"
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                      disabled={isLoading}
                    >
                      {showCurrentPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* 新密码 */}
                <div className="space-y-2">
                  <Label htmlFor="new_password" className="text-white">
                    新密码 *
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="new_password"
                      name="new_password"
                      type={showNewPassword ? "text" : "password"}
                      value={formData.new_password}
                      onChange={handleInputChange}
                      placeholder="请输入新密码（至少6个字符）"
                      className="pl-10 pr-10 bg-white/10 border-white/20 text-white placeholder-gray-400 focus:border-orange-500"
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                      disabled={isLoading}
                    >
                      {showNewPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* 确认新密码 */}
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-white">
                    确认新密码 *
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      placeholder="请再次输入新密码"
                      className="pl-10 pr-10 bg-white/10 border-white/20 text-white placeholder-gray-400 focus:border-orange-500"
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

                {/* 密码安全提示 */}
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-md p-3">
                  <h4 className="text-blue-400 text-sm font-medium mb-2">密码安全建议：</h4>
                  <ul className="text-blue-300 text-xs space-y-1">
                    <li>• 至少包含6个字符</li>
                    <li>• 建议包含大小写字母、数字和特殊字符</li>
                    <li>• 不要使用常见的密码或个人信息</li>
                    <li>• 定期更换密码以保证账户安全</li>
                  </ul>
                </div>

                <div className="flex space-x-3 pt-4">
                  <Button
                    type="button"
                    onClick={() => router.push('/profile')}
                    variant="outline"
                    className="flex-1 border-white/20 text-white hover:bg-white/10"
                    disabled={isLoading}
                  >
                    取消
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        修改中...
                      </div>
                    ) : (
                      <div className="flex items-center justify-center">
                        <Shield className="h-4 w-4 mr-2" />
                        修改密码
                      </div>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
};

export default ChangePasswordPage;