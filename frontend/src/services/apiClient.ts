import { config } from '@/config';

// 定义从后端获取的剧本数据结构
export interface Script {
  id: number;
  title: string;
  description: string;
  author: string;
  player_count: number;
  duration_minutes: number;
  difficulty: string;
  tags: string[];
  status: string;
  cover_image_url: string | null;
  created_at: string | null;
  updated_at: string | null;
}

// 定义API响应的数据结构
interface ApiResponse<T> {
  status: string;
  message?: string;
  data: T;
}

// API错误类
class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public response?: Response
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// 带重试的fetch函数
const fetchWithRetry = async (
  url: string,
  options: RequestInit = {},
  retries = config.api.retries
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.api.timeout);

  try {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            ...options.headers,
          },
        });

        if (response.ok) {
          clearTimeout(timeoutId);
          return response;
        }

        // 客户端错误不重试
        if (response.status >= 400 && response.status < 500) {
          throw new ApiError(`Client error: ${response.status}`, response.status, response);
        }

        if (i === retries - 1) {
          throw new ApiError(`HTTP error: ${response.status}`, response.status, response);
        }
      } catch (error) {
        if (error instanceof ApiError) throw error;
        if (i === retries - 1) throw error;
        
        // 等待后重试
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  } finally {
    clearTimeout(timeoutId);
  }
  
  throw new ApiError('Max retries exceeded');
};

// 通用API请求函数
const apiRequest = async <T>(endpoint: string): Promise<T> => {
  try {
    const response = await fetchWithRetry(`${config.api.baseUrl}${endpoint}`);
    const result: ApiResponse<T> = await response.json();
    
    if (result.status !== 'success') {
      throw new ApiError(result.message || 'API request failed');
    }
    
    return result.data;
  } catch (error) {
    if (config.app.isDevelopment) {
      console.error(`API request failed for ${endpoint}:`, error);
    }
    throw error;
  }
};

// 定义角色数据结构
export interface Character {
  id: number;
  name: string;
  background: string;
  gender: string;
  age: number;
  profession: string;
  secret: string;
  objective: string;
  is_victim: boolean;
  is_murderer: boolean;
}

/**
 * 获取剧本列表
 * @returns 剧本列表
 */
export const getScripts = async (): Promise<Script[]> => {
  const data = await apiRequest<Script[]>('/scripts');
  
  if (!Array.isArray(data)) {
    throw new ApiError('Invalid data format: expected an array of scripts');
  }
  
  return data;
};

/**
 * 获取指定剧本的角色列表
 * @param scriptId 剧本ID
 * @returns 角色列表
 */
export const getCharacters = async (scriptId: number): Promise<Character[]> => {
  const data = await apiRequest<Character[]>(`/characters/${scriptId}`);
  
  if (!Array.isArray(data)) {
    throw new ApiError('Invalid data format: expected an array of characters');
  }
  
  return data;
};

// 导出错误类供外部使用
export { ApiError };