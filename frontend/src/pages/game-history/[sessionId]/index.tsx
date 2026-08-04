import AppLayout from '@/components/AppLayout';
import GameHistoryDetailContent from '@/components/GameHistoryDetailContent';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { useGameHistoryStore } from '../../../stores/gameHistoryStore';

export default function GameDetailPage() {
  const router = useRouter();
  const { sessionId } = router.query;
  const { loadDetail, detail } = useGameHistoryStore();

  useEffect(() => {
    if (sessionId && typeof sessionId === 'string') loadDetail(sessionId);
  }, [sessionId, loadDetail]);

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="min-h-screen bg-ink">
          <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/profile/game-history')}
                className="text-mist hover:text-paper hover:bg-raised/60"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                返回游戏历史
              </Button>
              <h1 className="font-dossier text-xl font-bold text-paper">游戏记录详情</h1>
            </div>

            {!detail ? (
              <div className="flex items-center justify-center py-24">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brass" />
              </div>
            ) : (
              <GameHistoryDetailContent
                detail={detail}
                scriptTitle={detail.script_info?.title}
              />
            )}
          </div>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
