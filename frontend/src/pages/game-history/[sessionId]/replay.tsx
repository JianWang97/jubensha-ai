import { useRouter } from 'next/router';
import React, { useEffect } from 'react';
import { useGameHistoryStore } from '../../../stores/gameHistoryStore';

export default function ReplayPage(){
  const router = useRouter();
  const { sessionId } = router.query;
  const { loadEvents, events, eventsPage, eventsSize, eventsTotal, loadDetail, detail, eventsLoading } = useGameHistoryStore();
  useEffect(()=> { if(sessionId && typeof sessionId==='string'){ loadDetail(sessionId); loadEvents(sessionId, 1);} }, [sessionId]);
  const pages = Math.ceil(eventsTotal / eventsSize) || 1;
  return <div className='p-6 space-y-4'>
    <h1 className='text-xl font-semibold'>回放 - {sessionId}</h1>
    {eventsLoading && <div>加载事件...</div>}
    <div className='space-y-2 max-h-[70vh] overflow-y-auto pr-2 border rounded p-3 bg-white'>
      {events.map(ev => <div key={ev.id} className='border-b pb-2 text-xs'>
        <div className='flex items-center gap-2'><span className='font-semibold'>{ev.character_name||'系统'}</span><span className='text-[10px] text-slate-500'>{ev.event_type}</span><span className='text-[10px] text-slate-400'>{ev.timestamp.replace('T',' ').slice(0,19)}</span></div>
        <div className='whitespace-pre-wrap text-slate-700'>{ev.content}</div>
        {ev.tts_file_url && <audio controls src={ev.tts_file_url} className='mt-1 w-full'/>}
      </div>)}
    </div>
    <div className='flex gap-2 pt-2'>
      <button disabled={eventsPage<=1} onClick={()=> sessionId && typeof sessionId==='string' && loadEvents(sessionId, eventsPage-1)} className='px-3 py-1 border rounded disabled:opacity-40'>上一页</button>
      <span className='text-sm'>{eventsPage} / {pages}</span>
      <button disabled={eventsPage>=pages} onClick={()=> sessionId && typeof sessionId==='string' && loadEvents(sessionId, eventsPage+1)} className='px-3 py-1 border rounded disabled:opacity-40'>下一页</button>
    </div>
  </div>;
}
