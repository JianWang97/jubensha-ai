import "@/styles/globals.css";
import "@/styles/custom-scrollbar.css";
import React from 'react';
import type { AppProps } from "next/app";
import { Toaster } from 'sonner';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useEffect, useState, useCallback } from 'react';

// SSR安全的hooks
const useSSRSafeState = (initialValue: any) => {
  const [state, setState] = useState(initialValue);
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  return [isClient ? state : initialValue, setState, isClient];
};

// 错误边界组件
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('应用错误:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white mb-4">出现了一些问题</h2>
            <p className="text-gray-400 mb-6">页面遇到了错误，请刷新页面重试</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            >
              刷新页面
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App({ Component, pageProps }: AppProps) {
  const [isInitialized, setIsInitialized, isClient] = useSSRSafeState(false);
  const [authLoading, setAuthLoading] = useSSRSafeState(true);
  
  // 始终调用useAuthStore，但只在客户端使用其功能
  const authStore = useAuthStore();
  
  const safeCheckAuth = useCallback(async () => {
    if (isClient) {
      return authStore.checkAuth();
    }
    return Promise.resolve();
  }, [isClient, authStore.checkAuth]);

  // 初始化认证状态
  useEffect(() => {
    if (!isClient) return;
    
    const initAuth = async () => {
      try {
        await safeCheckAuth();
      } catch (error) {
        console.error('认证初始化失败:', error);
      } finally {
        setIsInitialized(true);
        setAuthLoading(false);
      }
    };

    initAuth();
  }, [isClient, safeCheckAuth]);

  // 显示加载状态
  if (!isClient || !isInitialized || authLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-purple-500 mx-auto mb-4" />
          <p className="text-gray-400">正在初始化应用...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Component {...pageProps} />
      <Toaster
        position="top-right"
        theme="dark"
        toastOptions={{
          style: {
            background: '#1e293b',
            color: '#e2e8f0',
            border: '1px solid #7c3aed',
          },
        }}
      />
    </ErrorBoundary>
  );
}
