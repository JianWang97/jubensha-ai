// 剧本相关API服务
import { config } from '@/stores/configStore';

// 请求和响应类型定义
interface GenerateScriptInfoRequest {
  theme: string;
  script_type?: string;
  player_count?: string;
}

interface GeneratedScriptInfo {
  title: string;
  description: string;
  background: string;
  suggested_type: string;
  suggested_player_count: string;
}

interface CreateScriptRequest {
  title: string;
  description: string;
  player_count: number;
  estimated_duration?: number;
  difficulty_level?: string;
  tags?: string[];
  category?: string;
  // 自定义字段用于存储灵感信息
  inspiration_type?: string;
  inspiration_content?: string;
  background_story?: string;
}

interface CreatedScript {
  id: number;
  title: string;
  description: string;
  author?: string;
  player_count: number;
  estimated_duration: number;
  difficulty_level: string;
  tags: string[];
  status: string;
  cover_image_url?: string;
  is_public: boolean;
  price: number;
  rating: number;
  category: string;
  play_count: number;
  created_at: string;
  updated_at: string;
}

interface APIResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

class ScriptService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = config.api.baseUrl;
  }

  private getToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('access_token');
    }
    return null;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const token = this.getToken();
    
    const defaultHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      defaultHeaders['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Network error' }));
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  // 根据主题生成剧本基础信息
  async generateScriptInfo(request: GenerateScriptInfoRequest): Promise<GeneratedScriptInfo> {
    const response = await this.request<APIResponse<GeneratedScriptInfo>>('/api/scripts/generate-info', {
      method: 'POST',
      body: JSON.stringify(request),
    });
    return response.data;
  }

  // 创建新剧本
  async createScript(request: CreateScriptRequest): Promise<CreatedScript> {
    const response = await this.request<APIResponse<CreatedScript>>('/api/scripts/', {
      method: 'POST',
      body: JSON.stringify(request),
    });
    return response.data;
  }
}

export const scriptService = new ScriptService();
export default scriptService;
export type { GenerateScriptInfoRequest, GeneratedScriptInfo, CreateScriptRequest, CreatedScript };