import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuthStore } from '@/stores/authStore';
import { Loader2 } from 'lucide-react';

interface AuthGuardProps {
  children: React.ReactNode;
  redirectTo?: string;
}

const AuthGuard: React.FC<AuthGuardProps> = ({ children, redirectTo = '/auth/login' }) => {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuthStore();


  useEffect(() => {
    // 如果未认证且不在加载中，重定向到登录页
    if (!isLoading && !isAuthenticated) {
      router.push(redirectTo);
    }
  }, [isAuthenticated, isLoading, router, redirectTo]);

  // 如果正在加载，显示加载状态
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-purple-600" />
          <p className="text-gray-600">正在验证身份...</p>
        </div>
      </div>
    );
  }

  // 如果未认证，不渲染内容（将重定向）
  if (!isAuthenticated) {
    return null;
  }

  // 如果已认证，渲染子组件
  return <>{children}</>;
};

export default AuthGuard;