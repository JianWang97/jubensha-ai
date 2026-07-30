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
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950/30 to-slate-900 flex items-center justify-center px-6">
          <Card className="w-full max-w-lg bg-gray-800/50 border-gray-700/50">
            <CardContent className="pt-6 space-y-4">
              <h1 className="text-xl font-bold text-gray-100">继续游戏</h1>
              <p className="text-sm text-gray-400 font-mono break-all">{sessionId}</p>
              {!resumeInfo ? (
                <div className="flex items-center gap-3 text-gray-400">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-500" />
                  正在准备会话...
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-sm text-gray-300">
                    状态：<span className="text-gray-100">{resumeInfo.current_state?.status}</span>
                  </div>
                  <div className="text-sm text-gray-400 break-all">
                    WebSocket：<code className="text-xs bg-gray-700/50 px-1.5 py-0.5 rounded">{resumeInfo.websocket_url}</code>
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
