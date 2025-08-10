import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { useGameHistoryStore } from '../../../stores/gameHistoryStore';

export default function GameDetailPage(){
  const router = useRouter();
  const { sessionId } = router.query;
  const { loadDetail, detail } = useGameHistoryStore();
  useEffect(()=> { if(sessionId && typeof sessionId==='string') loadDetail(sessionId); }, [sessionId]);
  if(!sessionId) return <div className='p-6'>加载中...</div>;
  if(!detail) return <div className='p-6'>加载中或未找到...</div>;
  const { session_info, statistics } = detail;
  const status = session_info.status;

  const isActive = ['STARTED','PENDING','PAUSED'].includes(status);
  const isEnded = status === 'ENDED';
  const isCanceled = status === 'CANCELED';

  return <div className='p-6 space-y-4'>
    <div className='flex items-center gap-4'>
      <h1 className='text-xl font-semibold'>会话详情 {session_info.session_id}</h1>
      {isEnded && <Link href={`/game-history/${session_info.session_id}/replay`} className='text-xs px-3 py-1 rounded bg-indigo-600 text-white'>回放</Link>}
      {isActive && <Link href={`/game?script_id=${session_info.script_id}`} className='text-xs px-3 py-1 rounded bg-emerald-600 text-white'>进入游戏</Link>}
      {isCanceled && <span className='text-xs px-3 py-1 rounded bg-gray-500 text-white opacity-50'>已取消</span>}
    </div>
    <section className='grid md:grid-cols-2 gap-6'>
      <div className='border rounded p-4 bg-white shadow'>
        <h2 className='font-semibold mb-2 text-sm'>基本信息</h2>
        <div className='text-xs space-y-1 text-slate-700'>
          <div>剧本ID: {session_info.script_id}</div>
          <div>状态: {session_info.status}</div>
          <div>开始: {session_info.started_at?.replace('T',' ').slice(0,16)}</div>
          <div>结束: {session_info.finished_at?.replace('T',' ').slice(0,16)}</div>
        </div>
      </div>
      <div className='border rounded p-4 bg-white shadow'>
        <h2 className='font-semibold mb-2 text-sm'>统计</h2>
        <div className='text-xs space-y-1 text-slate-700'>
          <div>事件总数: {statistics.total_events}</div>
          <div>聊天消息: {statistics.chat_messages}</div>
            <div>系统事件: {statistics.system_events}</div>
            <div>TTS完成: {statistics.tts_generated}</div>
            <div>时长: {statistics.duration_minutes} 分钟</div>
        </div>
      </div>
    </section>
    <section className='border rounded p-4 bg-white shadow'>
      <div className="grid md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>基本信息</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-700 space-y-2">
            <div>会话ID: {session_info?.session_id}</div>
            <div>剧本ID: {session_info?.script_id}</div>
            <div>状态: {session_info?.status}</div>
            <div>模式: AI 演绎</div>
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>演绎说明</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-slate-700 text-sm">
              本会话为 AI 自主演绎，所有角色均由智能体驱动，无需真人参与。
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
    {/* 已移除玩家列表，AI 自主演绎模式 */}
  </div>;
}
