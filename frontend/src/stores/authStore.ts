// 用户认证状态管理
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { UserLogin, UserRegister } from '@/types/auth';
import { UserResponse as User, UserUpdate, PasswordChange } from '@/client';
import { authService } from '@/services/authService';

interface AuthState {
  // 状态
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // 操作
  login: (credentials: UserLogin) => Promise<void>;
  register: (userData: UserRegister) => Promise<void>;
  logout: () => Promise<void>;
  getCurrentUser: () => Promise<void>;
  updateProfile: (userData: UserUpdate) => Promise<void>;
  changePassword: (passwordData: PasswordChange) => Promise<void>;
  clearError: () => void;
  setLoading: (loading: boolean) => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // 初始状态
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // 登录
      login: async (credentials: UserLogin) => {
        try {
          set({ isLoading: true, error: null });
          const response = await authService.login(credentials);
          set({
            user: response.user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: error instanceof Error ? error.message : '登录失败',
          });
          throw error;
        }
      },

      // 注册
      register: async (userData: UserRegister) => {
        try {
          set({ isLoading: true, error: null });
          const response = await authService.register(userData);
          set({
            user: response,
            isAuthenticated: false, // 注册后需要登录
            isLoading: false,
            error: null,
          });
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : '注册失败',
          });
          throw error;
        }
      },

      // 登出
      logout: async () => {
        try {
          set({ isLoading: true });
          await authService.logout();
        } catch (error) {
          console.error('Logout error:', error);
        } finally {
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
        }
      },

      // 获取当前用户信息
      getCurrentUser: async () => {
        const currentState = get();
        // 如果正在加载中，避免重复调用
        if (currentState.isLoading) {
          return;
        }
        
        try {
          set({ isLoading: true, error: null });
          const user = await authService.getCurrentUser();
          set({
            user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: error instanceof Error ? error.message : '获取用户信息失败',
          });
          // 清除无效token
          authService.removeToken();
        }
      },

      // 更新用户资料
      updateProfile: async (userData: UserUpdate) => {
        try {
          set({ isLoading: true, error: null });
          const updatedUser = await authService.updateProfile(userData);
          set({
            user: updatedUser,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : '更新资料失败',
          });
          throw error;
        }
      },

      // 修改密码
      changePassword: async (passwordData: PasswordChange) => {
        try {
          set({ isLoading: true, error: null });
          await authService.changePassword(passwordData);
          set({
            isLoading: false,
            error: null,
          });
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : '修改密码失败',
          });
          throw error;
        }
      },

      // 清除错误
      clearError: () => set({ error: null }),

      // 设置加载状态
      setLoading: (loading: boolean) => set({ isLoading: loading }),

      // 检查认证状态
      checkAuth: async () => {
        const token = authService.getToken();
        if (token) {
          await get().getCurrentUser();
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ 
        user: state.user, 
        isAuthenticated: state.isAuthenticated,
        // 不持久化isLoading和error状态
      }),
    }
  )
);
