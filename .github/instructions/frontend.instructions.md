---
applyTo: 'frontend/**'
---

# 前端开发规范

## 基础配置

- **框架**: Next.js 15（Pages Router），React 19，TypeScript 严格模式
- **状态管理**: Zustand 5
- **UI**: Radix UI + shadcn/ui + Tailwind CSS v4
- **图标**: Lucide React
- **API 客户端**: openapi-typescript-codegen 自动生成（axios）
- 修改完不用重启开发服务器，热更新会自动生效
- 如果端口被占用，说明已有实例在运行，不必再次启动

```bash
npm run dev               # 开发服务器（端口 3001）
npm run build && npm run start  # 生产构建（端口 8009）
npm run generate-api      # 重新生成 API 客户端（需后端运行在 8010）
```

## 项目结构

```
src/
├── client/           # 自动生成的 OpenAPI 客户端（禁止手动编辑）
│   ├── core/         # OpenAPI 配置、请求运行时（axios）
│   ├── models/       # 生成的类型定义
│   └── services/     # 生成的 API 服务类
├── components/
│   ├── ui/           # shadcn/ui 基础组件（kebab-case 文件名）
│   └── *.tsx         # 业务组件（PascalCase 文件名）
├── hooks/            # 自定义 Hooks
├── lib/              # 工具函数（cn 等）
├── pages/            # Next.js 页面（纯客户端渲染，无 SSR）
├── services/         # 手写 API 封装（fetch 方式）
├── stores/           # Zustand 状态管理
├── styles/           # 全局样式
└── types/            # 手写 TypeScript 类型定义
```

## 页面路由

项目使用 Pages Router，**纯客户端渲染**（不使用 `getServerSideProps` / `getStaticProps`）。

关键页面：
- `/` — 首页
- `/auth/login`、`/auth/register` — 认证
- `/script-center` — 剧本中心
- `/script-manager/create`、`/script-manager/edit/[id]` — 剧本编辑
- `/game` — 游戏房间
- `/game-history/[sessionId]` — 游戏记录详情/回放/续玩
- `/profile` — 个人中心

认证守卫通过 `AuthGuard` 或 `ProtectedRoute` 组件在客户端实现。

## API 调用

项目存在两种 API 调用方式：

### 1. 自动生成客户端（推荐用于新代码）

`src/client/` 由 `npm run generate-api` 从后端 OpenAPI schema 自动生成。客户端使用 axios，Base URL 和 Token 在 `src/client/core/OpenAPI.ts` 中从 `configStore` 读取。

```typescript
import { ScriptsService } from '@/client';

const scripts = await ScriptsService.getScripts();
```

### 2. 手写 Service（存量代码）

`src/services/` 中的服务使用 `fetch` 手动调用，从 `configStore` 读取 baseUrl，从 `localStorage` 读取 token。

```typescript
import { authService } from '@/services/authService';

const result = await authService.login(username, password);
```

**重要**：修改后端接口后需运行 `npm run generate-api` 重新生成客户端代码。

## 状态管理（Zustand）

### Store 命名约定
- 文件名: `xxxStore.ts`（camelCase）
- 导出 Hook: `useXxxStore`（PascalCase）

### 核心 Store

| Store | 用途 | 持久化 |
|-------|------|--------|
| `authStore` | 认证状态、用户信息 | ✅ partialize |
| `configStore` | API Base URL 配置 | ✅ partialize |
| `websocketStore` | WebSocket 连接、游戏运行时状态 | ❌ |
| `scriptsStore` | 剧本列表缓存 | 视情况 |
| `gameHistoryStore` | 游戏历史记录 | 视情况 |
| `ttsStore` | TTS 播放状态 | 视情况 |

### Store 模式

```typescript
interface MyState {
  data: DataType | null;
  isLoading: boolean;
  // actions 和 state 放在同一个对象
  fetchData: () => Promise<void>;
}

// 需要持久化
export const useMyStore = create<MyState>()(
  persist(
    (set, get) => ({ ... }),
    {
      name: 'my-storage',
      partialize: (state) => ({ data: state.data }),  // 只持久化必要字段
    }
  )
);

// 不需要持久化
export const useMyStore = create<MyState>((set, get) => ({ ... }));
```

### configStore 特殊用法

`configStore` 除了导出 `useConfigStore` Hook 外，还导出一个 `config` 对象供非 React 上下文使用（如生成客户端配置）：

```typescript
import { config } from '@/stores/configStore';
// config.api.baseUrl 可在 React 外使用
```

### WebSocket Store

`websocketStore` 解析后端消息并通过浏览器 `CustomEvent` 分发，供跨组件通信：

```typescript
// 监听游戏事件
window.addEventListener('game_event', handler);
```

## 组件规范

### 组件分层

- **UI 组件** (`components/ui/`): shadcn/ui 标准组件，kebab-case 文件名
- **业务组件** (`components/`): PascalCase 文件名，包含业务逻辑
- **布局组件**: `Layout.tsx`、`AppLayout.tsx`
- **页面组件** (`pages/`): Next.js 页面

### 组件结构

```typescript
interface MyComponentProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

const MyComponent: React.FC<MyComponentProps> = ({ value, onChange, className }) => {
  return (
    <div className={cn("base-styles", className)}>
      {/* ... */}
    </div>
  );
};

export default MyComponent;
```

### 样式合并

使用 `cn()` 函数（`clsx` + `tailwind-merge`）合并类名：

```typescript
import { cn } from "@/lib/utils";

<div className={cn("base-styles", { "active": isActive }, className)} />
```

## UI 设计规范

### 主题

- **深色主题**，主色调：深蓝紫渐变 `from-[#1a237e] via-[#311b92] to-[#4a148c]`
- 文本主要使用白色适配深色背景
- 按钮默认 `bg-slate-700/80`，危险 `bg-red-600/80`

### 关键 Tailwind 约定

- 自定义断点: `xs: 475px`（移动优先）
- 圆角: 按钮 `rounded-md`，卡片 `rounded-lg`
- 自定义动画: `spin-slow`、`float`、`glow`（定义在 `tailwind.config.ts`）
- 全屏布局: `h-screen w-screen` + 背景层/遮罩层/内容层分层

### 标准布局结构

```tsx
<div className="relative h-screen w-screen">
  <div className="absolute inset-0 bg-cover bg-center" />   {/* 背景层 */}
  <div className="absolute inset-0 bg-black/40" />           {/* 遮罩层 */}
  <div className="relative z-10 h-full w-full">{children}</div> {/* 内容层 */}
</div>
```

## 类型定义

- **生成类型**: `src/client/models/` — 从后端 OpenAPI schema 生成，禁止手动编辑
- **手写类型**: `src/types/` — 前端特有的业务类型（`auth.ts`、`game.ts`、`tts.ts`）
- **组件 Props**: 在组件文件内定义 interface

新代码优先使用生成的类型，避免与 `src/types/` 中的类型重复定义。

## 导入规范

```typescript
// 1. React / Next.js
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

// 2. UI 组件
import { Button } from '@/components/ui/button';

// 3. 状态管理
import { useAuthStore } from '@/stores/authStore';

// 4. 服务 / 客户端
import { ScriptsService } from '@/client';

// 5. 工具函数
import { cn } from '@/lib/utils';

// 6. 类型（type-only import）
import type { User } from '@/types/auth';
```

## 开发注意事项

- `src/client/` 目录是自动生成的，**禁止手动编辑**
- `next.config.ts` 从根目录 `.env` 加载环境变量并注入 `NEXT_PUBLIC_API_URL`
- 图片远程模式允许 `localhost:8010` 和任意 `https` 域名
- ESLint 在构建时已禁用（`eslint.ignoreDuringBuilds: true`）