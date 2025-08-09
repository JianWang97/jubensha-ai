import { create } from 'zustand';
import { fetchGameHistory, fetchGameDetail, fetchGameEvents, resumeGame, GameHistoryItem, GameEventItem } from '../services/gameHistoryService';

interface Filters { status?: string; script_id?: number; start_date?: string; end_date?: string }
interface GameHistoryState {
  list: GameHistoryItem[]; total: number; page: number; size: number; loading: boolean; filters: Filters;
  currentSessionId?: string; detail?: any; events: GameEventItem[]; eventsTotal:number; eventsPage:number; eventsSize:number; eventsLoading:boolean; resumeInfo?: any; error?: string|null;
  setFilters: (f: Filters)=>void;
  loadHistory: (page?:number)=>Promise<void>;
  loadDetail: (sessionId:string)=>Promise<void>;
  loadEvents: (sessionId:string, page?:number)=>Promise<void>;
  resume: (sessionId:string)=>Promise<void>;
  reset: ()=>void;
}

export const useGameHistoryStore = create<GameHistoryState>((set,get)=>({
  list:[], total:0, page:1, size:20, loading:false, filters:{},
  currentSessionId: undefined, detail: undefined, events:[], eventsTotal:0, eventsPage:1, eventsSize:50, eventsLoading:false, resumeInfo: undefined, error:null,
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
    try { const resp = await fetchGameDetail(sessionId); set({ detail: resp.data }); } catch(e:any){ set({ error:e.message }); }
  },
  loadEvents: async (sessionId, page=1)=> {
    set({ eventsLoading:true });
    try { const { eventsSize } = get(); const resp = await fetchGameEvents(sessionId, { page, size: eventsSize }); set({ events: resp.data.items, eventsTotal: resp.data.total, eventsPage: resp.data.page, eventsSize: resp.data.size, eventsLoading:false }); } catch(e:any){ set({ error:e.message, eventsLoading:false }); }
  },
  resume: async (sessionId)=> {
    try { const resp = await resumeGame(sessionId); set({ resumeInfo: resp.data }); } catch(e:any){ set({ error:e.message }); }
  },
  reset: ()=> set({ list:[], total:0, page:1, filters:{}, currentSessionId:undefined, detail:undefined, events:[], eventsTotal:0, eventsPage:1, resumeInfo:undefined, error:null })
}));
