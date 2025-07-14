import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// 默认配置常量
const DEFAULT_CONFIG = {
  api: {
    timeout: 100000,
    retries: 1,
  },
  app: {
    name: 'AI剧本杀游戏',
    version: '1.0.0',
  },
} as const;

// 配置接口定义
export interface ApiConfig {
  baseUrl: string;
  timeout: number;
  retries: number;
}

export interface AppConfig {
  environment: string;
  name: string;
  version: string;
  isDevelopment: boolean;
  isProduction: boolean;
}

export interface ConfigState {
  api: ApiConfig;
  app: AppConfig;
  warnings: string[];
}

export interface ConfigActions {
  updateApiConfig: (config: Partial<ApiConfig>) => void;
  updateAppConfig: (config: Partial<AppConfig>) => void;
  addWarning: (warning: string) => void;
  clearWarnings: () => void;
  validateEnvironment: () => void;
  resetToDefaults: () => void;
}

export type ConfigStore = ConfigState & ConfigActions;

// 环境变量验证函数
const validateEnvVars = (): string[] => {
  const warnings: string[] = [];
  
  if (!process.env.NEXT_PUBLIC_API_URL) {
    warnings.push('NEXT_PUBLIC_API_URL not set, using default backend port 8010');
  }
  
  return warnings;
};

// 初始配置生成
const createInitialConfig = (): ConfigState => {
  const warnings = validateEnvVars();
  
  // 在开发环境下输出警告
  if (warnings.length > 0 && process.env.NODE_ENV === 'development') {
    console.warn('Environment warnings:', warnings);
  }
  
  return {
    api: {
      baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8010/api',
      timeout: parseInt(process.env.NEXT_PUBLIC_API_TIMEOUT || String(DEFAULT_CONFIG.api.timeout)),
      retries: parseInt(process.env.NEXT_PUBLIC_API_RETRIES || String(DEFAULT_CONFIG.api.retries)),
    },
    app: {
      environment: process.env.NEXT_PUBLIC_ENV || 'development',
      name: DEFAULT_CONFIG.app.name,
      version: process.env.NEXT_PUBLIC_APP_VERSION || DEFAULT_CONFIG.app.version,
      isDevelopment: process.env.NODE_ENV === 'development',
      isProduction: process.env.NODE_ENV === 'production',
    },
    warnings,
  };
};

// 创建配置store
export const useConfigStore = create<ConfigStore>()(
  persist(
    (set, get) => ({
      ...createInitialConfig(),
      
      updateApiConfig: (config) => {
        set((state) => ({
          api: { ...state.api, ...config },
        }));
      },
      
      updateAppConfig: (config) => {
        set((state) => ({
          app: { ...state.app, ...config },
        }));
      },
      
      addWarning: (warning) => {
        set((state) => ({
          warnings: [...state.warnings, warning],
        }));
      },
      
      clearWarnings: () => {
        set({ warnings: [] });
      },
      
      validateEnvironment: () => {
        const warnings = validateEnvVars();
        set({ warnings });
        
        if (warnings.length > 0 && process.env.NODE_ENV === 'development') {
          console.warn('Environment warnings:', warnings);
        }
      },
      
      resetToDefaults: () => {
        set(createInitialConfig());
      },
    }),
    {
      name: 'config-store',
      partialize: (state) => ({
        api: {
          timeout: state.api.timeout,
          retries: state.api.retries,
        },
      }),
    }
  )
);

// 兼容性导出 - 保持与原config的兼容性
export const config = {
  get api() {
    return useConfigStore.getState().api;
  },
  get app() {
    return useConfigStore.getState().app;
  },
};

// 类型导出
export type { ConfigState as AppConfigType };

// Hook导出
export const useConfig = () => {
  const store = useConfigStore();
  return {
    config: {
      api: store.api,
      app: store.app,
    },
    warnings: store.warnings,
    actions: {
      updateApiConfig: store.updateApiConfig,
      updateAppConfig: store.updateAppConfig,
      addWarning: store.addWarning,
      clearWarnings: store.clearWarnings,
      validateEnvironment: store.validateEnvironment,
      resetToDefaults: store.resetToDefaults,
    },
  };
};