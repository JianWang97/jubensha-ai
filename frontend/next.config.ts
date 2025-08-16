import type { NextConfig } from "next";
import path from "path";
import { config } from "dotenv";

// 加载根目录的.env文件
config({ path: path.resolve(__dirname, "../.env") });

// 配置常量
const DEFAULT_BACKEND_PORT = 8010;

// 构建API URL
const buildApiUrl = () => {
  // 优先使用环境变量中的 NEXT_PUBLIC_API_URL
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  // 回退到默认的后端端口（注意：这里应该使用后端端口，不是前端端口）
  const backendPort = process.env.BACKEND_PORT || DEFAULT_BACKEND_PORT;
  return `http://localhost:${backendPort}/api`;
};

const nextConfig: NextConfig = {
  reactStrictMode: true,
  
  // ESLint配置 - 在构建时忽略警告（仅在必要时使用）
  eslint: {
    ignoreDuringBuilds: true, // 允许警告存在时继续构建
  },
  
  // 环境变量配置
  env: {
    NEXT_PUBLIC_API_URL: buildApiUrl(),
  },

  // 图片配置
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8010',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

export default nextConfig;
