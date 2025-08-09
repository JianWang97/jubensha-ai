import { useRouter } from 'next/router';
import React, { useEffect } from 'react';
import { useGameHistoryStore } from '../../../stores/gameHistoryStore';
import Link from 'next/link';

export default function ResumePage(){
  const router = useRouter();
  const { sessionId } = router.query;
  const { resumeInfo, resume } = useGameHistoryStore();
  useEffect(()=> { if(sessionId && typeof sessionId==='string') resume(sessionId); }, [sessionId]);
  if(!sessionId) return <div className='p-6'>加载中...</div>;
  return <div className='p-6 space-y-4'>
    <h1 className='text-xl font-semibold'>继续游戏 - {sessionId}</h1>
    {!resumeInfo && <div>正在准备会话...</div>}
    {resumeInfo && <div className='space-y-3'>
      <div className='text-sm'>WebSocket URL: <code className='text-xs bg-slate-100 px-1 rounded'>{resumeInfo.websocket_url}</code></div>
      <div className='text-sm'>状态: {resumeInfo.current_state?.status}</div>
      <Link href={`/game`} className='inline-block bg-emerald-600 text-white text-xs px-4 py-2 rounded'>进入游戏</Link>
    </div>}
  </div>;
}
