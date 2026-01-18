# 剧本杀项目开发规范

## 基础配置

该项目使用的是 Next.js 框架
修改完不用启动项目，可以直接在浏览器中查看
如果出现端口被占用，那么说明已经有项目在运行了，可以不必启动
请保持 TypeScript 的类型检查

## 项目架构规范

### 1. 目录结构

```
src/
├── client/          # API 客户端代码（自动生成）
├── components/      # 组件目录
│   ├── ui/         # 基础 UI 组件（shadcn/ui）
│   └── *.tsx       # 业务组件
├── hooks/          # 自定义 Hooks
├── lib/            # 工具函数
├── pages/          # Next.js 页面
├── services/       # 服务层
├── stores/         # 状态管理（Zustand）
├── styles/         # 样式文件
├── types/          # TypeScript 类型定义
└── utils/          # 工具函数
```

### 2. 技术栈

- **框架**: Next.js 15.3.5
- **语言**: TypeScript（严格模式）
- **状态管理**: Zustand
- **UI 组件库**: Radix UI + shadcn/ui
- **样式**: Tailwind CSS
- **图标**: Lucide React
- **API 客户端**: 自动生成（OpenAPI）

### 3. 组件架构

#### 3.1 组件分层

- **基础组件** (`src/components/ui/`): 使用 shadcn/ui 规范的可复用基础组件
- **业务组件** (`src/components/`): 包含业务逻辑的功能组件
- **布局组件**: `Layout.tsx`, `AppLayout.tsx` 等
- **页面组件** (`src/pages/`): Next.js 页面级组件

#### 3.2 组件命名规范

- 使用 PascalCase 命名组件文件和组件名
- 基础 UI 组件使用 kebab-case 文件名（如 `button.tsx`）
- 业务组件使用 PascalCase 文件名（如 `UserMenu.tsx`）

#### 3.3 组件结构

```typescript
// 组件 Props 接口定义
interface ComponentProps {
  children?: React.ReactNode;
  className?: string;
  // 其他 props
}

// 组件实现
const Component: React.FC<ComponentProps> = ({ 
  children, 
  className,
  ...props 
}) => {
  return (
    <div className={cn("base-styles", className)} {...props}>
      {children}
    </div>
  );
};

export default Component;
```

### 4. 状态管理规范

#### 4.1 Zustand Store 结构

```typescript
interface StoreState {
  // 状态定义
  data: DataType | null;
  isLoading: boolean;
  error: string | null;
  
  // 操作方法
  fetchData: () => Promise<void>;
  updateData: (data: DataType) => void;
  clearError: () => void;
}

export const useStore = create<StoreState>()(persist(
  (set, get) => ({
    // 实现
  }),
  {
    name: 'store-name',
    // 持久化配置
  }
));
```

#### 4.2 Store 命名规范

- Store 文件使用 camelCase + "Store" 后缀（如 `authStore.ts`）
- Hook 使用 "use" + PascalCase + "Store"（如 `useAuthStore`）

### 5. 服务层规范

- 所有 API 调用封装在 `services/` 目录
- 使用自动生成的 API 客户端
- 服务文件命名：`xxxService.ts`

### 6. 类型定义规范

- 业务类型定义在 `types/` 目录
- 使用自动生成的 API 类型（`src/client/`）
- 组件 Props 接口在组件文件内定义

## UI 设计规范

### 1. 设计系统

#### 1.1 颜色规范

- **主色调**: 深蓝紫色渐变 (`from-[#1a237e] via-[#311b92] to-[#4a148c]`)
- **按钮色彩**: 
  - 默认: `bg-slate-700/80`
  - 危险: `bg-red-600/80`
  - 次要: `bg-slate-600/80`
- **文本颜色**: 主要使用白色文本适配深色主题

#### 1.2 间距规范

- 使用 Tailwind CSS 标准间距系统
- 组件内边距: `px-4 py-2` (默认)
- 组件间距: `gap-2`, `gap-4`, `gap-6`

#### 1.3 圆角规范

- 默认圆角: `rounded-md` (0.375rem)
- 按钮圆角: `rounded-md`
- 卡片圆角: `rounded-lg`

#### 1.4 阴影规范

- 轻微阴影: `shadow-xs`
- 卡片阴影: `shadow-sm`
- 悬浮阴影: `shadow-md`

### 2. 组件设计规范

#### 2.1 按钮规范

```typescript
// 使用 CVA (Class Variance Authority) 定义变体
const buttonVariants = cva(
  "base-classes",
  {
    variants: {
      variant: {
        default: "bg-slate-700/80 text-white",
        destructive: "bg-red-600/80 text-white",
        outline: "border border-slate-600/50 bg-slate-700/30",
        // ...
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3",
        lg: "h-10 px-6",
        // ...
      }
    }
  }
);
```

#### 2.2 布局规范

- **全屏布局**: 使用 `h-screen w-screen` 占满视口
- **背景处理**: 支持背景图片 + 遮罩层设计
- **层级管理**: 使用 `z-index` 合理分层

```typescript
// 标准布局结构
<div className="relative h-screen w-screen">
  {/* 背景层 */}
  <div className="absolute inset-0 bg-cover bg-center" />
  
  {/* 遮罩层 */}
  <div className="absolute inset-0 bg-black/40" />
  
  {/* 内容层 */}
  <div className="relative z-10 h-full w-full">
    {children}
  </div>
</div>
```

#### 2.3 响应式设计

- **断点**: 使用 Tailwind 标准断点 + 自定义 `xs: 475px`
- **移动优先**: 默认移动端样式，向上适配
- **组件适配**: 重要组件需要提供移动端优化版本

### 3. 动画规范

#### 3.1 自定义动画

```css
/* 已定义的动画 */
'spin-slow': 'spin 3s linear infinite',
'float': 'float 6s ease-in-out infinite',
'glow': 'glow 2s ease-in-out infinite alternate',
```

#### 3.2 过渡效果

- 使用 `transition-[color,box-shadow]` 进行颜色和阴影过渡
- 悬停效果使用 `hover:` 前缀
- 焦点效果使用 `focus-visible:` 前缀

### 4. 可访问性规范

- **焦点管理**: 使用 `focus-visible:ring-[3px]` 提供清晰的焦点指示
- **语义化**: 使用适当的 HTML 语义标签
- **键盘导航**: 确保所有交互元素可通过键盘访问
- **屏幕阅读器**: 使用 `aria-*` 属性提供额外信息

### 5. 工具函数规范

#### 5.1 样式合并

```typescript
// 使用 cn 函数合并 className
import { cn } from "@/lib/utils";

<div className={cn("base-classes", conditionalClasses, className)} />
```

#### 5.2 条件样式

```typescript
// 推荐的条件样式写法
className={cn(
  "base-classes",
  {
    "active-classes": isActive,
    "disabled-classes": isDisabled,
  },
  className
)}
```

## 开发规范

### 1. 代码规范

- 使用 ESLint 进行代码检查
- 遵循 TypeScript 严格模式
- 使用 Prettier 进行代码格式化

### 2. 导入规范

```typescript
// 导入顺序
import React from 'react';           // React 相关
import { NextPage } from 'next';     // Next.js 相关
import { Button } from '@/components/ui/button';  // UI 组件
import { useAuthStore } from '@/stores/authStore'; // 状态管理
import { authService } from '@/services/authService'; // 服务
import { cn } from '@/lib/utils';     // 工具函数
import type { User } from '@/types/auth'; // 类型定义
```

### 3. 性能优化

- 使用 `React.memo` 优化组件重渲染
- 合理使用 `useCallback` 和 `useMemo`
- 图片使用 Next.js `Image` 组件
- 路由使用 Next.js `Link` 组件

### 4. 错误处理

- 使用 Error Boundary 捕获组件错误
- API 错误统一在 Store 中处理
- 提供用户友好的错误提示