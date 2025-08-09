import React, { useEffect } from 'react';
import { useGameHistoryStore } from '../../stores/gameHistoryStore';
import Link from 'next/link';

const StatusBadge: React.FC<{status:string}> = ({ status }) => {
  const color = { STARTED:'bg-green-600', PENDING:'bg-yellow-600', ENDED:'bg-gray-600', PAUSED:'bg-orange-600', CANCELED:'bg-red-600' }[status] || 'bg-slate-500';
  return <span className={`px-2 py-1 text-xs rounded text-white ${color}`}>{status}</span>;
};

export default function GameHistoryPage(){
  const { list, loadHistory, page, size, total, loading, setFilters, filters } = useGameHistoryStore();
  useEffect(()=>{ loadHistory(1); }, [filters.status, filters.script_id]);
  const pages = Math.ceil(total / size) || 1;
  return <div className="p-6 space-y-4">
    <h1 className="text-xl font-semibold">游戏历史</h1>
    <div className="flex gap-4 items-end flex-wrap">
      <div>
        <label className="block text-sm mb-1">状态</label>
        <select className="border rounded px-2 py-1" value={filters.status||''} onChange={e=> setFilters({ status: e.target.value || undefined })}>
          <option value=''>全部</option>
          {['PENDING','STARTED','PAUSED','ENDED','CANCELED'].map(s=> <option key={s}>{s}</option>)}
        </select>
      </div>
    </div>
    {loading && <div>加载中...</div>}
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {list.map(item => <div key={item.session_id} className="border rounded p-4 bg-white shadow-sm flex flex-col justify-between">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold text-sm truncate">会话 {item.session_id.slice(0,8)}</h2>
            <StatusBadge status={item.status} />
          </div>
          <div className="text-xs text-slate-600 space-y-1">
            <div>剧本ID: {item.script_id}</div>
            <div>创建: {item.created_at?.replace('T',' ').slice(0,16)}</div>
            <div>事件: {item.event_count} | 模式: AI 演绎</div>
            {item.duration_minutes!=null && <div>时长: {item.duration_minutes} 分钟</div>}
          </div>
        </div>
        <div className="flex gap-2 pt-3">
          <Link href={`/game-history/${item.session_id}`} className="text-xs px-3 py-1 rounded bg-blue-600 text-white">详情</Link>
          {['PAUSED','STARTED','PENDING'].includes(item.status) && <Link href={`/game?script_id=${item.script_id}`} className="text-xs px-3 py-1 rounded bg-emerald-600 text-white">继续</Link>}
          {item.status === 'ENDED' && <Link href={`/game-history/${item.session_id}/replay`} className="text-xs px-3 py-1 rounded bg-indigo-600 text-white">回放</Link>}
          {item.status === 'CANCELED' && <span className="text-xs px-3 py-1 rounded bg-gray-500 text-white opacity-50">已取消</span>}
        </div>
      </div>)}
    </div>
    <div className="flex gap-2 pt-4">
      <button disabled={page<=1} onClick={()=> loadHistory(page-1)} className="px-3 py-1 border rounded disabled:opacity-40">上一页</button>
      <span className="text-sm">{page} / {pages}</span>
      <button disabled={page>=pages} onClick={()=> loadHistory(page+1)} className="px-3 py-1 border rounded disabled:opacity-40">下一页</button>
    </div>
  </div>;
}
typescript
