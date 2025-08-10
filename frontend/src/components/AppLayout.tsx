import DockBar from '@/components/DockBar';
import { Button } from '@/components/ui/button';
import UserMenu from '@/components/UserMenu';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import {
  Menu,
  X
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import React, { useState } from 'react';

interface AppLayoutProps {
  children: React.ReactNode;
  showSidebar?: boolean;
  backgroundImage?: string;
  isGamePage?: boolean;
}

// 移动端导航项
interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  requireAuth?: boolean;
}

const mobileNavItems: NavItem[] = [
  { href: '/script-center', label: '剧本中心', icon: () => <span>🏠</span> },
  { href: '/profile', label: '个人资料', icon: () => <span>👤</span>, requireAuth: true },
  { href: '/profile/game-history', label: '游戏历史', icon: () => <span>📊</span>, requireAuth: true },
  { href: '/profile/change-password', label: '设置', icon: () => <span>⚙️</span>, requireAuth: true },
];

const AppLayout: React.FC<AppLayoutProps> = ({ 
  children, 
  showSidebar = true,
  backgroundImage,
  isGamePage = false,

}) => {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);


  const filteredMobileNavItems = mobileNavItems.filter(item => 
    !item.requireAuth || isAuthenticated
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* 背景层 */}
      <div className="fixed inset-0">
        {backgroundImage ? (
          <div 
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${backgroundImage})` }}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#1a237e] via-[#311b92] to-[#4a148c]" />
        )}
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" />
      </div>

      {/* DockBar - 桌面端显示 */}
      {showSidebar && !isGamePage && (
        <DockBar className="hidden md:flex" />
      )}

      {/* 移动端顶部栏 */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800 md:hidden">
        <div className="flex justify-between items-center h-14 px-4">
          {/* 左侧区域 */}
          <div className="flex items-center space-x-4">
            {/* 侧边栏切换按钮 */}
            {showSidebar && !isGamePage && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="text-white hover:bg-white/10"
              >
                {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            )}
            
            {/* Logo */}
            {!isGamePage && (
              <Link href="/" className="text-xl font-bold text-purple-400 hover:text-purple-300 transition-colors">
                AI 剧本杀
              </Link>
            )}
            
            {/* 游戏页面返回按钮 */}
            {isGamePage && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/')}
                className="text-white hover:bg-white/10"
              >
                ← 返回首页
              </Button>
            )}
          </div>

          {/* 右侧用户菜单 */}
          <div className="flex items-center">
            <UserMenu variant="compact" />
          </div>
        </div>
      </div>

      {/* 移动端侧边栏 - 始终可用 */}
      <>
        {/* 遮罩层 */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 z-[55] bg-black/50 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        
        {/* 移动端侧边栏 */}
        <div className={cn(
          "fixed top-14 left-0 z-[60] h-[calc(100vh-3.5rem)] w-64 bg-gray-900/95 backdrop-blur-sm border-r border-gray-800 transform transition-transform duration-300 md:hidden",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}>
            <div className="flex h-16 shrink-0 items-center px-6">
              <Link href="/" className="text-xl font-bold text-purple-400 hover:text-purple-300 transition-colors">
                AI 剧本杀
              </Link>
            </div>
            <div className="flex flex-col h-full">
              <div className="p-4 space-y-2 flex-1">
                {filteredMobileNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = router.pathname === item.href || 
                    (item.href !== '/' && router.pathname.startsWith(item.href));
                  
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={cn(
                        "flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 w-full",
                        isActive 
                          ? "bg-purple-600/20 text-purple-300 border border-purple-500/30" 
                          : "text-gray-300 hover:text-white hover:bg-white/10"
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
              {/* 移动端用户菜单 */}
              <div className="p-4 border-t border-gray-700">
                <UserMenu />
              </div>
            </div>
        </div>
      </>

      {/* 主要内容区域 */}
      <div className={cn(
        "relative z-10 transition-all duration-300",
        "pt-14 md:pt-0", // 移动端为顶部栏留出空间，桌面端不需要
        showSidebar && !isGamePage ? "md:pl-20" : "" // 为DockBar留出空间
      )}>




        {/* 页面内容 */}
        <main>
          {children}
        </main>
      </div>
    </div>
  );
};

export default AppLayout;