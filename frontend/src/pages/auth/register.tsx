import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Eye, EyeOff, Lock, Mail, Smile, User, UserPlus, Swords, BookOpen, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/stores/authStore';
import { UserRegister } from '@/types/auth';
import ProtectedRoute from '@/components/ProtectedRoute';
import StarField from '@/components/StarField';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const FEATURES = [
  { icon: Swords, text: 'AI 驱动的沉浸式剧情推进' },
  { icon: BookOpen, text: '海量精品剧本，随时开局' },
  { icon: Users, text: '多人联机，实时协作推理' },
];

interface FieldErrors {
  username?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

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
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  useEffect(() => {
    return () => { clearError(); };
  }, [clearError]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) clearError();
    if (fieldErrors[name as keyof FieldErrors]) {
      setFieldErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const validateField = (name: string, value: string): string | undefined => {
    switch (name) {
      case 'username':
        if (!value.trim()) return '请输入用户名';
        if (value.trim().length < 3) return '用户名至少需要 3 个字符';
        break;
      case 'email':
        if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return '请输入有效的邮箱地址';
        break;
      case 'password':
        if (!value.trim()) return '请输入密码';
        if (value.trim().length < 6) return '密码至少需要 6 个字符';
        break;
      case 'confirmPassword':
        if (!value.trim()) return '请再次输入密码';
        if (value !== formData.password) return '两次输入的密码不一致';
        break;
    }
    return undefined;
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const msg = validateField(e.target.name, e.target.value);
    setFieldErrors(prev => ({ ...prev, [e.target.name]: msg }));
  };

  const validateForm = (): boolean => {
    const errors: FieldErrors = {
      username: validateField('username', formData.username),
      email: validateField('email', formData.email ?? ''),
      password: validateField('password', formData.password),
      confirmPassword: validateField('confirmPassword', formData.confirmPassword),
    };
    setFieldErrors(errors);
    return !Object.values(errors).some(Boolean);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      const { confirmPassword, ...registerData } = formData;
      await register(registerData);
      toast.success('注册成功！请登录您的账户');
      router.push('/auth/login');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '注册失败');
    }
  };

  return (
    <ProtectedRoute requireAuth={false}>
      <div className="min-h-screen flex">
        {/* 左侧品牌面板 */}
        <div className="hidden md:flex w-[45%] relative flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#1a237e] via-[#311b92] to-[#4a148c]">
          <StarField />
          <div className="absolute inset-0 bg-black/20" />

          <div className="relative z-10 flex flex-col items-center text-center px-12 gap-8">
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
              <h2 className="text-3xl font-bold text-white">创建账户</h2>
              <p className="mt-1 text-gray-400 text-sm">填写以下信息，开始剧本杀之旅</p>
            </div>

            {/* 表单 */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* 用户名 */}
              <div className="space-y-1.5">
                <Label htmlFor="username" className="text-gray-300 text-sm">
                  用户名 <span className="text-red-400">*</span>
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
                    placeholder="请输入用户名（至少 3 个字符）"
                    className={cn(
                      'pl-10 bg-gray-900 border-gray-700 text-white placeholder:text-gray-600 focus:border-purple-500 focus:ring-purple-500/20',
                      fieldErrors.username && 'border-red-500 focus:border-red-500'
                    )}
                    disabled={isLoading}
                  />
                </div>
                {fieldErrors.username && (
                  <p className="text-red-400 text-xs">{fieldErrors.username}</p>
                )}
              </div>

              {/* 邮箱 */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-gray-300 text-sm">
                  邮箱地址 <span className="text-gray-500 text-xs font-normal">（可选）</span>
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    placeholder="请输入邮箱地址"
                    className={cn(
                      'pl-10 bg-gray-900 border-gray-700 text-white placeholder:text-gray-600 focus:border-purple-500 focus:ring-purple-500/20',
                      fieldErrors.email && 'border-red-500 focus:border-red-500'
                    )}
                    disabled={isLoading}
                  />
                </div>
                {fieldErrors.email && (
                  <p className="text-red-400 text-xs">{fieldErrors.email}</p>
                )}
              </div>

              {/* 昵称 */}
              <div className="space-y-1.5">
                <Label htmlFor="nickname" className="text-gray-300 text-sm">
                  昵称 <span className="text-gray-500 text-xs font-normal">（可选）</span>
                </Label>
                <div className="relative">
                  <Smile className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                  <Input
                    id="nickname"
                    name="nickname"
                    type="text"
                    value={formData.nickname}
                    onChange={handleInputChange}
                    placeholder="请输入昵称"
                    className="pl-10 bg-gray-900 border-gray-700 text-white placeholder:text-gray-600 focus:border-purple-500 focus:ring-purple-500/20"
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* 密码 */}
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-gray-300 text-sm">
                  密码 <span className="text-red-400">*</span>
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
                    placeholder="请输入密码（至少 6 个字符）"
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
                  <p className="text-red-400 text-xs">{fieldErrors.password}</p>
                )}
              </div>

              {/* 确认密码 */}
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword" className="text-gray-300 text-sm">
                  确认密码 <span className="text-red-400">*</span>
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    placeholder="请再次输入密码"
                    className={cn(
                      'pl-10 pr-10 bg-gray-900 border-gray-700 text-white placeholder:text-gray-600 focus:border-purple-500 focus:ring-purple-500/20',
                      fieldErrors.confirmPassword && 'border-red-500 focus:border-red-500'
                    )}
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                    disabled={isLoading}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {fieldErrors.confirmPassword && (
                  <p className="text-red-400 text-xs">{fieldErrors.confirmPassword}</p>
                )}
              </div>

              {/* 服务端错误 */}
              {error && (
                <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
                  {error}
                </div>
              )}

              {/* 注册按钮 */}
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-[#311b92] to-[#4a148c] hover:from-[#4527a0] hover:to-[#6a1b9a] text-white font-medium rounded-md transition-all duration-200"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    注册中...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <UserPlus className="h-4 w-4" />
                    注册账户
                  </span>
                )}
              </Button>

              {/* 登录链接 */}
              <p className="text-center text-gray-500 text-sm">
                已有账户？{' '}
                <Link
                  href="/auth/login"
                  className="text-purple-400 hover:text-purple-300 font-medium transition-colors"
                >
                  立即登录
                </Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default RegisterPage;