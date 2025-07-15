import { useState, useCallback } from 'react';
import { useConfigStore } from '@/stores/configStore';

export interface ScriptWithDetail{
  info:Script,
  background_story: BackgroundStory;
  characters: Character[];
  evidence: Evidence[];
  locations: Locations[];
  game_phases: GamePhases[];
}

export interface BackgroundStory{
  title: string;
  setting_description: string;
  incident_description: string;
  victim_background: string;
  investigation_scope: string;
  rules_reminder: string;
  murder_method: string;
  murder_location: string;
  discovery_time: string;
  victory_conditions: string;
}

export interface Evidence {
  id: number;
  name: string;
  location: string;
  description: string;
  related_to: string | null;
  significance: string;
  evidence_type: string;
  importance: string;
  image_url: string | null;
  is_hidden: boolean;
}

export interface Locations{
  id: number;
  name: string;
  description: string;
  searchable_items: any[];
  background_image_url: string | null;
  is_crime_scene: boolean;
}

export interface GamePhases{
  phase: string;
  name: string;
  description: string;
}

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

// 定义角色数据结构
export interface Character {
  id: number;
  name: string;
  personality_traits: string[];
  background: string;
  gender: string;
  age: number;
  profession: string;
  secret: string;
  objective: string;
  is_victim: boolean;
  is_murderer: boolean;
  avatar_url?: string;
}

// 定义游戏状态数据结构
export interface GameStatus {
  is_active: boolean;
  current_script?: Script;
  session_id?: string;
  players?: any[];
}

// 定义背景故事数据结构
export interface Background {
  content: string;
  script_id?: number;
}

// 定义声音分配数据结构
export interface VoiceAssignment {
  character_id: number;
  character_name: string;
  voice_id: string;
  voice_name: string;
}

// 定义TTS请求数据结构
export interface TTSRequest {
  text: string;
  character?: string;
}

// 定义剧本创建请求数据结构
export interface ScriptCreateRequest {
  script_data: string;
  cover_image?: File;
}

// 定义剧本更新请求数据结构
export interface ScriptUpdateRequest {
  title?: string;
  description?: string;
  author?: string;
  player_count?: number;
  duration_minutes?: number;
  difficulty?: string;
  tags?: string[];
  status?: string;
}

// 定义剧本统计数据结构
export interface ScriptStats {
  total_scripts: number;
  active_scripts: number;
  total_characters: number;
  average_duration: number;
}

// 定义API响应的数据结构
interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
}

export interface ImageGenerationRequest {
  positive_prompt: string;
  negative_prompt?: string;
  script_id: number;
  target_id: number;
  width?: number;
  height?: number;
  steps?: number;
  cfg?: number;
  seed?: number;
}

// API错误类
export class ApiError extends Error {
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
  retries?: number
): Promise<Response> => {
  const config = useConfigStore.getState();
  const maxRetries = retries ?? config.api.retries;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.api.timeout);

  try {
    for (let i = 0; i < maxRetries; i++) {
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

        if (i === maxRetries - 1) {
          throw new ApiError(`HTTP error: ${response.status}`, response.status, response);
        }
      } catch (error) {
        if (error instanceof ApiError) throw error;
        if (i === maxRetries - 1) throw error;
        
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
const apiRequest = async <T>(
  endpoint: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: any;
    headers?: Record<string, string>;
    isFormData?: boolean;
  } = {}
): Promise<T> => {
  try {
    const config = useConfigStore.getState();
    const { method = 'GET', body, headers = {}, isFormData = false } = options;
    
    const requestOptions: RequestInit = {
      method,
      headers: isFormData ? headers : {
        'Content-Type': 'application/json',
        ...headers,
      },
    };
    
    if (body) {
      requestOptions.body = isFormData ? body : JSON.stringify(body);
    }
    
    const response = await fetch(`${config.api.baseUrl}${endpoint}`, requestOptions);
    const result: ApiResponse<T> = await response.json();
    
    if (!result.success) {
      throw new ApiError(result.message || 'API request failed');
    }
    
    return result.data!;
  } catch (error) {
    const config = useConfigStore.getState();
    if (config.app.isDevelopment) {
      console.error(`API request failed for ${endpoint}:`, error);
    }
    throw error;
  }
};

export const useApiClient = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 获取剧本列表
   */
  const getScripts = useCallback(async (): Promise<Script[]> => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await apiRequest<any>('/scripts/');
      
      // 后端返回的数据结构包含scripts字段，需要提取
      const scripts = data.scripts;
      if (!Array.isArray(scripts)) {
        throw new ApiError('Invalid data format: expected an array of scripts');
      }
      
      return scripts;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 获取单个剧本详细信息
   */
  const getScript = useCallback(async (scriptId: number): Promise<Script> => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await apiRequest<any>(`/scripts/${scriptId}`);
      // 后端返回的数据结构包含info字段，需要提取
      return data.info;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 获取指定剧本的角色列表
   */
  const getCharacters = useCallback(async (scriptId: number): Promise<Character[]> => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await apiRequest<Character[]>(`/characters/${scriptId}`);
      
      if (!Array.isArray(data)) {
        throw new ApiError('Invalid data format: expected an array of characters');
      }
      
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 创建角色
   */
  const createCharacter = useCallback(async (characterData: {
    script_id: number;
    name: string;
    age?: number;
    profession?: string;
    background?: string;
    secret?: string;
    objective?: string;
    gender?: string;
    is_murderer?: boolean;
    is_victim?: boolean;
    personality_traits?: string[];
  }): Promise<any> => {
    setLoading(true);
    setError(null);
    
    try {
      return await apiRequest<any>('/scripts/characters', {
        method: 'POST',
        body: characterData
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 更新角色
   */
  const updateCharacter = useCallback(async (characterId: number, characterData: {
    name?: string;
    age?: number;
    profession?: string;
    background?: string;
    secret?: string;
    objective?: string;
    gender?: string;
    is_murderer?: boolean;
    is_victim?: boolean;
    personality_traits?: string[];
    avatar_url?: string;
  }): Promise<any> => {
    setLoading(true);
    setError(null);
    
    try {
      return await apiRequest<any>(`/scripts/characters/${characterId}`, {
        method: 'PUT',
        body: characterData
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 删除角色
   */
  const deleteCharacter = useCallback(async (characterId: number): Promise<any> => {
    setLoading(true);
    setError(null);
    
    try {
      return await apiRequest<any>(`/scripts/characters/${characterId}`, {
        method: 'DELETE'
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 创建新剧本
   */
  const createScript = useCallback(async (scriptData: ScriptCreateRequest): Promise<any> => {
    setLoading(true);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append('script_data', scriptData.script_data);
      if (scriptData.cover_image) {
        formData.append('cover_image', scriptData.cover_image);
      }
      
      return await apiRequest<any>('/scripts/', {
        method: 'POST',
        body: formData,
        isFormData: true,
        headers: {}
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 更新剧本
   */
  const updateScript = useCallback(async (scriptId: number, updateData: ScriptUpdateRequest): Promise<any> => {
    setLoading(true);
    setError(null);
    
    try {
      return await apiRequest<any>(`/scripts/${scriptId}`, {
        method: 'PUT',
        body: updateData
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 删除剧本
   */
  const deleteScript = useCallback(async (scriptId: number): Promise<any> => {
    setLoading(true);
    setError(null);
    
    try {
      return await apiRequest<any>(`/scripts/${scriptId}`, {
        method: 'DELETE'
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 搜索剧本
   */
  const searchScripts = useCallback(async (keyword: string, limit: number = 20): Promise<Script[]> => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await apiRequest<any>(`/scripts/search/${encodeURIComponent(keyword)}/?limit=${limit}`);
      return data.scripts || data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 获取剧本统计信息
   */
  const getScriptStats = useCallback(async (): Promise<ScriptStats> => {
    setLoading(true);
    setError(null);
    
    try {
      return await apiRequest<ScriptStats>('/scripts/stats/overview/');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 生成封面图片
   */
  const generateCoverImage = useCallback(async (request: ImageGenerationRequest): Promise<any> => {
    setLoading(true);
    setError(null);
    
    try {
      return await apiRequest<any>('/scripts/generate/cover/', {
        method: 'POST',
        body: request
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 生成角色头像
   */
  const generateAvatarImage = useCallback(async (request: ImageGenerationRequest): Promise<any> => {
    setLoading(true);
    setError(null);
    
    try {
      return await apiRequest<any>('/scripts/generate/avatar/', {
        method: 'POST',
        body: request
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 生成证据图片
   */
  const generateEvidenceImage = useCallback(async (request: ImageGenerationRequest): Promise<any> => {
    setLoading(true);
    setError(null);
    
    try {
      return await apiRequest<any>('/scripts/generate/evidence/', {
        method: 'POST',
        body: request
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 生成场景背景图
   */
  const generateSceneImage = useCallback(async (request: ImageGenerationRequest): Promise<any> => {
    setLoading(true);
    setError(null);
    
    try {
      return await apiRequest<any>('/scripts/generate/scene/', {
        method: 'POST',
        body: request
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 获取游戏状态
   */
  const getGameStatus = useCallback(async (sessionId?: string): Promise<GameStatus> => {
    setLoading(true);
    setError(null);
    
    try {
      const queryParam = sessionId ? `?session_id=${sessionId}` : '';
      return await apiRequest<GameStatus>(`/game/status/${queryParam}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 启动游戏
   */
  const startGame = useCallback(async (sessionId?: string, scriptId: number = 1): Promise<any> => {
    setLoading(true);
    setError(null);
    
    try {
      const queryParams = new URLSearchParams();
      if (sessionId) queryParams.append('session_id', sessionId);
      queryParams.append('script_id', scriptId.toString());
      
      return await apiRequest<any>(`/game/start/?${queryParams.toString()}`, {
        method: 'POST'
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 重置游戏
   */
  const resetGame = useCallback(async (sessionId?: string): Promise<any> => {
    setLoading(true);
    setError(null);
    
    try {
      const queryParam = sessionId ? `?session_id=${sessionId}` : '';
      return await apiRequest<any>(`/game/reset/${queryParam}`, {
        method: 'POST'
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 获取背景故事（通过剧本ID）
   */
  const getBackgroundByScript = useCallback(async (scriptId: number): Promise<Background> => {
    setLoading(true);
    setError(null);
    
    try {
      return await apiRequest<Background>(`/background/${scriptId}/`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 获取背景故事（兼容旧版本）
   */
  const getBackground = useCallback(async (): Promise<Background> => {
    setLoading(true);
    setError(null);
    
    try {
      return await apiRequest<Background>('/background/');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 获取指定剧本的全部信息
   */
  const getScriptWithDetail = useCallback(async (scriptId: number): Promise<ScriptWithDetail> => {
    setLoading(true);
    setError(null);
    
    try {
      const scriptData = await apiRequest<ScriptWithDetail>(`/scripts/${scriptId}`);
      return scriptData;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 获取声音分配信息
   */
  const getVoiceAssignments = useCallback(async (sessionId?: string): Promise<VoiceAssignment[]> => {
    setLoading(true);
    setError(null);
    
    try {
      const queryParam = sessionId ? `?session_id=${sessionId}` : '';
      return await apiRequest<VoiceAssignment[]>(`/voices${queryParam}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * TTS流式音频生成
   */
  const streamTTS = useCallback(async (ttsRequest: TTSRequest): Promise<any> => {
    setLoading(true);
    setError(null);
    
    try {
      return await apiRequest<any>('/tts/stream/', {
        method: 'POST',
        body: ttsRequest
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 获取剧本列表（带分页和过滤）
   */
  const getScriptsWithFilters = useCallback(async (params: {
    status?: string;
    author?: string;
    page?: number;
    page_size?: number;
  } = {}): Promise<any> => {
    setLoading(true);
    setError(null);
    
    try {
      const queryParams = new URLSearchParams();
      if (params.status) queryParams.append('status', params.status);
      if (params.author) queryParams.append('author', params.author);
      if (params.page) queryParams.append('page', params.page.toString());
      if (params.page_size) queryParams.append('page_size', params.page_size.toString());
      
      const queryString = queryParams.toString();
      const endpoint = queryString ? `/scripts/?${queryString}` : '/scripts/';
      
      return await apiRequest<any>(endpoint);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 创建证据
   */
  const createEvidence = useCallback(async (evidenceData: {
    script_id: number;
    name: string;
    description?: string;
    evidence_type?: string;
    location?: string;
    significance?: string;
    related_to?: string | null;
    importance?: string;
    is_hidden?: boolean;
  }): Promise<{ evidence_id: number }> => {
    setLoading(true);
    setError(null);
    
    try {
      return await apiRequest<{ evidence_id: number }>('/scripts/evidence', {
        method: 'POST',
        body: evidenceData
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 更新证据
   */
  const updateEvidence = useCallback(async (evidenceId: number, evidenceData: {
    name?: string;
    description?: string;
    evidence_type?: string;
    location?: string;
    significance?: string;
    related_to?: string | null;
    importance?: string;
    is_hidden?: boolean;
  }): Promise<any> => {
    setLoading(true);
    setError(null);
    
    try {
      return await apiRequest<any>(`/scripts/evidence/${evidenceId}`, {
        method: 'PUT',
        body: evidenceData
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 删除证据
   */
  const deleteEvidence = useCallback(async (evidenceId: number): Promise<any> => {
    setLoading(true);
    setError(null);
    
    try {
      return await apiRequest<any>(`/scripts/evidence/${evidenceId}`, {
        method: 'DELETE'
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 生成证据图片提示词
   */
  const generateEvidencePrompt = useCallback(async (data: {
    evidence_name: string;
    evidence_description: string;
    evidence_type: string;
    location?: string;
    related_to?: string;
    script_context?: string;
  }): Promise<{
    prompt: string,
    evidence_name: string
  }> => {
    setLoading(true);
    setError(null);
    
    try {
      return await apiRequest<{
        prompt: string;
        evidence_name: string;
      }>('/scripts/evidence/generate-prompt', {
        method: 'POST',
        body: data
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 生成角色头像提示词
   */
  const generateCharacterPrompt = useCallback(async (data: {
    character_name: string;
    character_description: string;
    profession?: string;
    age?: number;
    gender?: string;
    personality_traits?: string[];
    script_context?: string;
  }): Promise<{
    prompt: string;
    character_name: string;
  }> => {
    setLoading(true);
    setError(null);
    
    try {
      return await apiRequest<{
        prompt: string;
        character_name: string;
      }>('/scripts/characters/generate-prompt', {
        method: 'POST',
        body: data
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    // 剧本相关API
    getScripts,
    getScript,
    createScript,
    updateScript,
    deleteScript,
    searchScripts,
    getScriptStats,
    getScriptsWithFilters,
    getScriptWithDetail,
    // 角色相关API
    getCharacters,
    createCharacter,
    updateCharacter,
    deleteCharacter,
    generateCharacterPrompt,
    // 证据相关API
    createEvidence,
    updateEvidence,
    deleteEvidence,
    generateEvidencePrompt,
    // 游戏相关API
    getGameStatus,
    startGame,
    resetGame,
    // 背景故事API
    getBackground,
    getBackgroundByScript,
    // 声音相关API
    getVoiceAssignments,
    streamTTS,
    // 图片生成API
    generateCoverImage,
    generateAvatarImage,
    generateEvidenceImage,
    generateSceneImage,
    // 工具方法
    clearError: () => setError(null)
  };
};