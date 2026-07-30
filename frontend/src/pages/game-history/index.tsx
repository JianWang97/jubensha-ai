import { useRouter } from 'next/router';
import { useEffect } from 'react';

// 游戏历史列表已统一为 /profile/game-history（深色 AppLayout 实现，含搜索/删除/详情抽屉）。
// 此路由保留以保证旧链接可用，直接重定向到统一实现。
export default function GameHistoryPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/profile/game-history');
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950/30 to-slate-900 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
    </div>
  );
}
