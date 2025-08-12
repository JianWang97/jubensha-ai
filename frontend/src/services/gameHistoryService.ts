import authService from './authService';
import { config } from '@/stores/configStore';

export interface GameHistoryItem {
  id: number; session_id: string; script_id: number; script_title?: string|null; status: string;
  created_at?: string; started_at?: string; finished_at?: string; duration_minutes?: number;
  player_count?: number; event_count?: number;
}
export interface GameHistoryListResponse { success: boolean; data: { items: GameHistoryItem[]; total: number; page: number; size: number } }
export interface GameEventItem { id:number; session_id:string; event_type:string; character_name?:string; content:string; tts_file_url?:string; tts_voice?: string; tts_duration?: number; tts_status?: string; timestamp:string; event_metadata?: any }
export interface PaginatedEventsResponse { success:boolean; data:{ items: GameEventItem[]; total:number; page:number; size:number } }
export interface GameDetailResponse { success:boolean; data:{ session_info:any; statistics:any; players:any[] } }
export interface ResumeResponse { success:boolean; data:{ session_id:string; websocket_url:string; current_state:any } }

// Use configurable backend base URL
const base = `${config.api.baseUrl}/api/users/game-history`;

function authHeaders(): Record<string,string> { const t = authService.getToken(); return t ? { Authorization: `Bearer ${t}` } : {}; }

export async function fetchGameHistory(params: Record<string, any> = {}): Promise<GameHistoryListResponse> {
  const qs = new URLSearchParams(params as any).toString();
  const headers: HeadersInit = { 'Content-Type':'application/json', ...authHeaders() };
  const url = qs ? `${base}?${qs}` : base;
  const res = await fetch(url, { headers });
  if(!res.ok) throw new Error('Failed to load game history');
  return res.json();
}

export async function fetchGameDetail(sessionId: string): Promise<GameDetailResponse> {
  const res = await fetch(`${base}/${sessionId}`, { headers: authHeaders() });
  if(!res.ok) throw new Error('Failed to load game detail');
  return res.json();
}

export async function fetchGameEvents(sessionId: string, params: Record<string, any> = {}): Promise<PaginatedEventsResponse> {
  const qs = new URLSearchParams(params as any).toString();
  const res = await fetch(`${base}/${sessionId}/events?${qs}`, { headers: authHeaders() });
  if(!res.ok) throw new Error('Failed to load events');
  return res.json();
}

export async function resumeGame(sessionId: string): Promise<ResumeResponse> {
  const headers: HeadersInit = { 'Content-Type':'application/json', ...authHeaders() };
  const res = await fetch(`${base}/${sessionId}/resume`, { method:'POST', headers });
  if(!res.ok) throw new Error('Failed to resume game');
  return res.json();
}
