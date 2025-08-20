import { create } from 'zustand';
import { fetchGameHistory, fetchGameDetail, fetchGameEvents, resumeGame, GameHistoryItem, GameEventItem } from '../services/gameHistoryService';
import { ScriptsService } from '../client';

interface Filters { status?: string; script_id?: number; start_date?: string; end_date?: string }
interface GameHistoryState {
  list: GameHistoryItem[]; total: number; page: number; size: number; loading: boolean; filters: Filters;
  currentSessionId?: string; detail?: any; events: GameEventItem[]; eventsTotal:number; eventsPage:number; eventsSize:number; eventsLoading:boolean; resumeInfo?: any; error?: string|null;
  setFilters: (f: Filters)=>void;
  loadHistory: (page?:number)=>Promise<void>;
  loadDetail: (sessionId:string)=>Promise<void>;
  loadEvents: (sessionId:string, page?:number)=>Promise<void>;
  loadAllEvents: (sessionId:string)=>Promise<void>;
  resume: (sessionId:string)=>Promise<void>;
  reset: ()=>void;
}

export const useGameHistoryStore = create<GameHistoryState>((set,get)=>({
  list:[], total:0, page:1, size:20, loading:false, filters:{},
  currentSessionId: undefined, detail: undefined, events:[], eventsTotal:0, eventsPage:1, eventsSize:100, eventsLoading:false, resumeInfo: undefined, error:null,
  setFilters: (f)=> set({ filters:{ ...get().filters, ...f } }),
  loadHistory: async (page=1)=> {
    set({ loading:true, error:null });
    try {
      const { filters, size } = get();
      const resp = await fetchGameHistory({ page, size, ...filters });
      set({ list: resp.data.items, total: resp.data.total, page: resp.data.page, size: resp.data.size, loading:false });
    } catch(e:any){ set({ error:e.message, loading:false }); }
  },
  loadDetail: async (sessionId)=> {
    set({ currentSessionId: sessionId });
    try { 
      const resp = await fetchGameDetail(sessionId); 
      let detail = resp.data;
      
      // 如果有script_id，获取剧本详细信息
      if (detail.session_info?.script_id) {
        try {
          const scriptResp = await ScriptsService.getScriptInfoApiScriptsScriptIdInfoGet(detail.session_info.script_id);
          if (scriptResp.success && scriptResp.data) {
            detail.script_info = scriptResp.data;
          }
        } catch (scriptError) {
          console.warn('获取剧本信息失败:', scriptError);
        }
      }
      
      set({ detail }); 
    } catch(e:any){ set({ error:e.message }); }
  },
  loadEvents: async (sessionId, page=1)=> {
    set({ eventsLoading:true });
    try { const { eventsSize } = get(); const size = Math.min(eventsSize || 100, 100); const resp = await fetchGameEvents(sessionId, { page, size }); set({ events: resp.data.items, eventsTotal: resp.data.total, eventsPage: resp.data.page, eventsSize: resp.data.size, eventsLoading:false }); } catch(e:any){ set({ error:e.message, eventsLoading:false }); }
  },
  loadAllEvents: async (sessionId)=> {
    set({ eventsLoading: true });
    try {
      const pageSize = Math.min(get().eventsSize || 100, 100);
      const first = await fetchGameEvents(sessionId, { page: 1, size: pageSize });
      let items = first.data.items || [];
      const total = first.data.total || items.length;
      const pages = Math.max(1, Math.ceil(total / pageSize));
      if (pages > 1) {
        for (let p = 2; p <= pages; p++) {
          const resp = await fetchGameEvents(sessionId, { page: p, size: pageSize });
          items = items.concat(resp.data.items || []);
        }
      }
      set({ events: items, eventsTotal: total, eventsPage: 1, eventsSize: pageSize, eventsLoading: false });
    } catch (e:any) {
      set({ error: e.message, eventsLoading: false });
    }
  },
  resume: async (sessionId)=> {
    try { const resp = await resumeGame(sessionId); set({ resumeInfo: resp.data }); } catch(e:any){ set({ error:e.message }); }
  },
  reset: ()=> set({ list:[], total:0, page:1, filters:{}, currentSessionId:undefined, detail:undefined, events:[], eventsTotal:0, eventsPage:1, resumeInfo:undefined, error:null })
}));
