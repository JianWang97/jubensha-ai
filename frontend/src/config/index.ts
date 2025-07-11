// 应用配置管理

// 默认配置常量
const DEFAULT_CONFIG = {
  api: {
    timeout: 10000,
    retries: 3,
  },
  app: {
    name: 'AI剧本杀游戏',
    version: '1.0.0',
  },
} as const;

// 环境变量验证
const validateEnvVars = () => {
  const warnings: string[] = [];
  
  if (!process.env.NEXT_PUBLIC_API_URL) {
    warnings.push('NEXT_PUBLIC_API_URL not set, using default backend port 8010');
  }
  
  if (warnings.length > 0 && process.env.NODE_ENV === 'development') {
    console.warn('Environment warnings:', warnings);
  }
};

// 应用配置
export const config = {
  api: {
    // 主要API基础URL，用于所有API调用
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
} as const;

// 初始化配置验证
if (typeof window === 'undefined') {
  validateEnvVars();
}

export type AppConfig = typeof config;