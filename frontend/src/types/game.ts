// 游戏详情类型定义
export interface GameDetail {
  script_name?: string;
  script_info?: {
    id: number;
    title?: string;
    cover_image_url?: string;
  };
  session_info?: {
    session_id: string;
    script_id: number;
    status: string;
    started_at?: string;
    finished_at?: string;
    created_at: string;
  };
  statistics?: {
    total_events: number;
    chat_messages: number;
    system_events: number;
    tts_generated: number;
    duration_minutes: number;
  };
  players?: any[];
  created_at?: string;
  status?: string;
}