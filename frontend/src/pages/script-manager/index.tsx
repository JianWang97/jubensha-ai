import { useEffect } from 'react';
import { useRouter } from 'next/router';

// 重定向页面：将 /script-manager 重定向到 /script-center
export default function ScriptManagerRedirect() {
  const router = useRouter();

  useEffect(() => {
    // 立即重定向到新的剧本中心页面
    router.replace('/script-center');
  }, [router]);

  // 显示加载状态
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-400">正在跳转到剧本中心...</p>
      </div>
    </div>
  );
}