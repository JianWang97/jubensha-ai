import { PasswordChange } from '@/client';
import AppLayout from '@/components/AppLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/stores/authStore';
import { Eye, EyeOff, Lock, Shield } from 'lucide-react';
import { useRouter } from 'next/router';
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';

const ChangePasswordPage: React.FC = () => {
  const router = useRouter();
  const { isAuthenticated, isLoading, changePassword } = useAuthStore();
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
      const { old_password, new_password } = formData;
      await changePassword({ old_password, new_password });
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
      <AppLayout>
        <div className="max-w-md mx-auto px-4 sm:px-6 py-8 md:py-12">
          {/* 页面标题 */}
          <div className="text-center mb-8">
            <div className="mx-auto h-12 w-12 bg-gradient-to-br from-[#311b92] to-[#4a148c] rounded-full flex items-center justify-center mb-4">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">
              修改密码
            </h1>
            <p className="text-slate-400 text-sm">
              为了您的账户安全，请定期更换密码
            </p>
          </div>

          <Card className="bg-slate-900/50 backdrop-blur-md border border-slate-700/30 rounded-lg">
            <CardHeader>
              <CardTitle className="text-white text-center">
                密码修改
              </CardTitle>
              <CardDescription className="text-slate-400 text-center">
                请输入当前密码和新密码
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* 当前密码 */}
                <div className="space-y-1.5">
                  <Label htmlFor="old_password" className="text-slate-300">
                    当前密码 *
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      id="old_password"
                      name="old_password"
                      type={showCurrentPassword ? "text" : "password"}
                      value={formData.old_password}
                      onChange={handleInputChange}
                      placeholder="请输入当前密码"
                      className="pl-10 pr-10 bg-slate-800/50 border border-slate-700/50 text-white placeholder:text-slate-400 focus:border-purple-500 focus:ring-purple-500/20"
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
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
                <div className="space-y-1.5">
                  <Label htmlFor="new_password" className="text-slate-300">
                    新密码 *
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      id="new_password"
                      name="new_password"
                      type={showNewPassword ? "text" : "password"}
                      value={formData.new_password}
                      onChange={handleInputChange}
                      placeholder="请输入新密码（至少6个字符）"
                      className="pl-10 pr-10 bg-slate-800/50 border border-slate-700/50 text-white placeholder:text-slate-400 focus:border-purple-500 focus:ring-purple-500/20"
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
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
                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword" className="text-slate-300">
                    确认新密码 *
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      placeholder="请再次输入新密码"
                      className="pl-10 pr-10 bg-slate-800/50 border border-slate-700/50 text-white placeholder:text-slate-400 focus:border-purple-500 focus:ring-purple-500/20"
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
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
                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-md p-3">
                  <h4 className="text-indigo-400 text-sm font-medium mb-2">密码安全建议：</h4>
                  <ul className="text-indigo-300 text-xs space-y-1">
                    <li>• 至少包含6个字符</li>
                    <li>• 建议包含大小写字母、数字和特殊字符</li>
                    <li>• 不要使用常见的密码或个人信息</li>
                    <li>• 定期更换密码以保证账户安全</li>
                  </ul>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    onClick={() => router.push('/profile')}
                    variant="outline"
                    className="flex-1 border-slate-600/50 text-slate-300 hover:bg-slate-800/50 hover:text-white"
                    disabled={isLoading}
                  >
                    取消
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-gradient-to-r from-[#311b92] to-[#4a148c] hover:from-[#4527a0] hover:to-[#6a1b9a] text-white"
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