import AppLayout from '@/components/AppLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useRouter } from 'next/router';
import React, { useEffect } from 'react';
import { useGameHistoryStore } from '../../../stores/gameHistoryStore';

export default function ResumePage() {
  const router = useRouter();
  const { sessionId } = router.query;
  const { resumeInfo, resume } = useGameHistoryStore();

  useEffect(() => {
    if (sessionId && typeof sessionId === 'string') resume(sessionId);
  }, [sessionId, resume]);

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="min-h-screen bg-ink flex items-center justify-center px-6">
          <Card className="w-full max-w-lg">
            <CardContent className="pt-6 space-y-4">
              <h1 className="font-dossier text-xl font-bold text-paper">继续游戏</h1>
              <p className="text-sm text-mist font-data break-all">{sessionId}</p>
              {!resumeInfo ? (
                <div className="flex items-center gap-3 text-mist">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-brass" />
                  正在准备会话...
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-sm text-mist">
                    状态：<span className="text-paper">{resumeInfo.current_state?.status}</span>
                  </div>
                  <div className="text-sm text-mist break-all">
                    WebSocket：<code className="text-xs bg-raised border border-hairline px-1.5 py-0.5 rounded-sm font-data">{resumeInfo.websocket_url}</code>
                  </div>
                  <Button
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => router.push('/game')}
                  >
                    进入游戏
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
