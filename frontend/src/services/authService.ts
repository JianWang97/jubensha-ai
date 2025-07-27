// 用户认证API服务
import { config } from '@/stores/configStore';
import { 
  Token, 
  UserResponse as User, 
  UserRegister, 
  UserLogin as LoginData, 
  UserBrief,
  GameHistoryResponse as GameHistory,
  PasswordChange,
  UserUpdate
} from '@/client';
import { StoreApi } from 'zustand';

// 延迟导入authStore以避免循环依赖
let authStore: StoreApi<unknown> | null = null;
const getAuthStore = async () => {
  if (!authStore) {
    const { useAuthStore } = await import('@/stores/authStore');
    authStore = useAuthStore;
  }
  return authStore;
};

class AuthService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = config.api.baseUrl;
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
      // 401状态码拦截器：自动退出登录
      if (response.status === 401) {
        this.removeToken();
        // 重定向到登录页面
        if (typeof window !== 'undefined') {
          window.location.href = '/auth/login';
        }
      }
      
      const errorData = await response.json().catch(() => ({ detail: 'Network error' }));
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  // Token 管理
  getToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('access_token');
    }
    return null;
  }

  setToken(token: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('access_token', token);
    }
  }

  removeToken(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
    }
  }

  /**
   * 用户注册
   * @param registerData 注册数据
   * @returns 注册响应
   */
  async register(registerData: UserRegister): Promise<User> {
    try {
      return await this.request<User>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(registerData),
      });
    } catch (error) {
      console.error('注册失败:', error);
      throw error;
    }
  }

  /**
   * 用户登录
   * @param loginData 登录数据
   * @returns 登录响应
   */
  async login(loginData: LoginData): Promise<Token> {
    try {
      return await this.request<Token>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(loginData),
      });
    } catch (error) {
      console.error('登录失败:', error);
      throw error;
    }
  }

  // 用户登出
  async logout(): Promise<void> {
    try {
      await this.request('/api/auth/logout', {
        method: 'POST',
      });
    } finally {
      // 无论请求是否成功，都清除本地token
      this.removeToken();
    }
  }

  // 获取当前用户信息
  async getCurrentUser(): Promise<User> {
    return this.request<User>('/api/auth/me');
  }

  // 更新用户资料
  async updateProfile(userData: UserUpdate): Promise<User> {
    return this.request<User>('/api/auth/me', {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  }

  // 修改密码
  async changePassword(passwordData: PasswordChange): Promise<{ message: string }> {
    return this.request<{ message: string }>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(passwordData),
    });
  }

  // 获取用户列表
  async getUsers(skip: number = 0, limit: number = 20): Promise<UserBrief[]> {
    return this.request<UserBrief[]>(`/api/auth/users?skip=${skip}&limit=${limit}`);
  }

  // 获取指定用户信息
  async getUserById(userId: number): Promise<UserBrief> {
    return this.request<UserBrief>(`/api/auth/users/${userId}`);
  }

  // 获取用户游戏历史
  async getUserGameHistory(skip: number = 0, limit: number = 20): Promise<GameHistory[]> {
    return this.request<GameHistory[]>(`/api/users/game-history?skip=${skip}&limit=${limit}`);
  }

  // 检查是否已登录
  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  // 验证token是否有效
  async validateToken(): Promise<boolean> {
    try {
      await this.getCurrentUser();
      return true;
    } catch {
      this.removeToken();
      return false;
    }
  }
}

export const authService = new AuthService();
export default authService;