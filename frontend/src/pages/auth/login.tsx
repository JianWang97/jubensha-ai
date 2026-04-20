import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import {
  Eye, EyeOff, LogIn, User, Lock, Compass,
  Swords, BookOpen, Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/stores/authStore';
import { UserLogin } from '@/types/auth';
import ProtectedRoute from '@/components/ProtectedRoute';
import StarField from '@/components/StarField';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const FEATURES = [
  { icon: Swords, text: 'AI 驱动的沉浸式剧情推进' },
  { icon: BookOpen, text: '海量精品剧本，随时开局' },
  { icon: Users, text: '多人联机，实时协作推理' },
];

const LoginPage: React.FC = () => {
  const router = useRouter();
  const { login, anonymousLogin, isLoading, error, isAuthenticated, clearError } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [formData, setFormData] = useState<UserLogin>({ username: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState<{ username?: string; password?: string }>({});

  useEffect(() => {
    if (isAuthenticated) router.push('/');
  }, [isAuthenticated, router]);

  useEffect(() => {
    return () => { clearError(); };
  }, [clearError]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) clearError();
    if (fieldErrors[name as keyof typeof fieldErrors]) {
      setFieldErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const validateField = (name: string, value: string) => {
    if (name === 'username' && !value.trim()) {
      setFieldErrors(prev => ({ ...prev, username: '请输入用户名或邮箱' }));
    }
    if (name === 'password' && !value.trim()) {
      setFieldErrors(prev => ({ ...prev, password: '请输入密码' }));
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    validateField(e.target.name, e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: typeof fieldErrors = {};
    if (!formData.username.trim()) errors.username = '请输入用户名或邮箱';
    if (!formData.password.trim()) errors.password = '请输入密码';
    if (Object.keys(errors).length) { setFieldErrors(errors); return; }

    try {
      await login(formData);
      toast.success('登录成功！');
      router.push('/');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '登录失败');
    }
  };

  const handleGuestExperience = () => {
    router.push('/script-center');
  };

  return (
    <ProtectedRoute requireAuth={false}>
      <div className="min-h-screen flex">
        {/* 左侧品牌面板 */}
        <div className="hidden md:flex w-[45%] relative flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#1a237e] via-[#311b92] to-[#4a148c]">
          <StarField />
          {/* 遮罩 */}
          <div className="absolute inset-0 bg-black/20" />

          <div className="relative z-10 flex flex-col items-center text-center px-12 gap-8">
            {/* Logo */}
            <div className="flex flex-col items-center gap-3">
              <div className="h-16 w-16 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center">
                <Swords className="h-8 w-8 text-white" />
              </div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-200 via-white to-purple-300 bg-clip-text text-transparent leading-tight">
                AI 剧本杀
              </h1>
              <p className="text-purple-200 text-lg font-light tracking-wide">
                沉浸式 AI 角色扮演推理游戏
              </p>
            </div>

            {/* 特色点 */}
            <div className="flex flex-col gap-4 w-full max-w-xs">
              {FEATURES.map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3 text-left">
                  <div className="shrink-0 h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center">
                    <Icon className="h-4 w-4 text-purple-200" />
                  </div>
                  <span className="text-purple-100 text-sm">{text}</span>
                </div>
              ))}
            </div>

            {/* 名言 */}
            <blockquote className="max-w-xs border-l-2 border-purple-400/50 pl-4 text-left">
              <p className="text-purple-200/80 text-sm italic leading-relaxed">
                "每一个谎言的背后，都藏着一段真实的故事。"
              </p>
              <footer className="mt-1 text-purple-400/60 text-xs">— 剧本杀玩家格言</footer>
            </blockquote>
          </div>
        </div>

        {/* 右侧表单面板 */}
        <div className="flex-1 flex items-center justify-center bg-gray-950 px-6 py-12">
          <div className="w-full max-w-md space-y-8">
            {/* 移动端 Logo */}
            <div className="flex md:hidden items-center gap-2 justify-center">
              <Swords className="h-6 w-6 text-purple-400" />
              <span className="text-white font-semibold text-lg">AI 剧本杀</span>
            </div>

            {/* 标题 */}
            <div>
              <h2 className="text-3xl font-bold text-white">欢迎回来</h2>
              <p className="mt-1 text-gray-400 text-sm">登录您的账户继续游戏</p>
            </div>

            {/* 表单 */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* 用户名 */}
              <div className="space-y-1.5">
                <Label htmlFor="username" className="text-gray-300 text-sm">
                  用户名或邮箱
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                  <Input
                    id="username"
                    name="username"
                    type="text"
                    value={formData.username}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    placeholder="请输入用户名或邮箱"
                    className={cn(
                      'pl-10 bg-gray-900 border-gray-700 text-white placeholder:text-gray-600 focus:border-purple-500 focus:ring-purple-500/20',
                      fieldErrors.username && 'border-red-500 focus:border-red-500'
                    )}
                    disabled={isLoading}
                  />
                </div>
                {fieldErrors.username && (
                  <p className="text-red-400 text-xs mt-1">{fieldErrors.username}</p>
                )}
              </div>

              {/* 密码 */}
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-gray-300 text-sm">
                  密码
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    placeholder="请输入密码"
                    className={cn(
                      'pl-10 pr-10 bg-gray-900 border-gray-700 text-white placeholder:text-gray-600 focus:border-purple-500 focus:ring-purple-500/20',
                      fieldErrors.password && 'border-red-500 focus:border-red-500'
                    )}
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                    disabled={isLoading}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {fieldErrors.password && (
                  <p className="text-red-400 text-xs mt-1">{fieldErrors.password}</p>
                )}
              </div>

              {/* 记住我 & 忘记密码 */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={e => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-900 text-purple-500 focus:ring-purple-500/20"
                  />
                  <span className="text-gray-400 text-sm">记住我</span>
                </label>
                <span className="text-gray-600 text-sm cursor-not-allowed select-none">
                  忘记密码？
                </span>
              </div>

              {/* 服务端错误 */}
              {error && (
                <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
                  {error}
                </div>
              )}

              {/* 登录按钮 */}
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-[#311b92] to-[#4a148c] hover:from-[#4527a0] hover:to-[#6a1b9a] text-white font-medium rounded-md transition-all duration-200"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    登录中...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <LogIn className="h-4 w-4" />
                    登录
                  </span>
                )}
              </Button>

              {/* 分隔线 */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-gray-800" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-gray-950 px-3 text-gray-600">或</span>
                </div>
              </div>

              {/* 游客体验 */}
              <Button
                type="button"
                variant="outline"
                className="w-full border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white transition-all duration-200"
                onClick={handleGuestExperience}
                disabled={isLoading}
              >
                <Compass className="h-4 w-4 mr-2" />
                游客体验
              </Button>

              {/* 注册链接 */}
              <p className="text-center text-gray-500 text-sm">
                还没有账户？{' '}
                <Link
                  href="/auth/register"
                  className="text-purple-400 hover:text-purple-300 font-medium transition-colors"
                >
                  立即注册
                </Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default LoginPage;