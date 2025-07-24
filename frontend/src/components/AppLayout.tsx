import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { 
  Home, 
  User, 
  Settings, 
  History, 
  BookOpen, 
  Menu, 
  X,
  ChevronRight,
  ChevronLeft,
  Library,
  Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import UserMenu from '@/components/UserMenu';
import TopBar from '@/components/TopBar';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
  showSidebar?: boolean;
  backgroundImage?: string;
  isGamePage?: boolean;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  requireAuth?: boolean;
}

const navItems: NavItem[] = [
  { href: '/', label: '首页', icon: Home },
  { href: '/scripts', label: '剧本库', icon: Library },
  // { href: '/rooms', label: '房间管理', icon: Users },
  { href: '/script-manager', label: '剧本管理', icon: BookOpen },
  { href: '/profile', label: '个人资料', icon: User, requireAuth: true },
  { href: '/profile/game-history', label: '游戏历史', icon: History, requireAuth: true },
  { href: '/profile/change-password', label: '设置', icon: Settings, requireAuth: true },
];

const AppLayout: React.FC<AppLayoutProps> = ({ 
  children, 
  title, 
  showSidebar = true,
  backgroundImage,
  isGamePage = false
}) => {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // 生成面包屑导航
  const generateBreadcrumbs = () => {
    const pathSegments = router.pathname.split('/').filter(Boolean);
    const breadcrumbs = [{ href: '/', label: '首页' }];

    let currentPath = '';
    pathSegments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      
      // 根据路径生成标签
      let label = segment;
      switch (segment) {
        case 'auth':
          label = '认证';
          break;
        case 'login':
          label = '登录';
          break;
        case 'register':
          label = '注册';
          break;
        case 'profile':
          label = '个人中心';
          break;
        case 'scripts':
          label = '剧本库';
          break;
        case 'rooms':
          label = '房间管理';
          break;
        case 'script-manager':
          label = '剧本管理';
          break;
        case 'game-history':
          label = '游戏历史';
          break;
        case 'change-password':
          label = '修改密码';
          break;
        case 'game':
          label = '游戏';
          break;
        default:
          label = segment.charAt(0).toUpperCase() + segment.slice(1);
      }

      breadcrumbs.push({ href: currentPath, label });
    });

    return breadcrumbs;
  };

  const breadcrumbs = generateBreadcrumbs();
  const filteredNavItems = navItems.filter(item => 
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

      {/* 统一顶部栏 - 始终显示 */}
      <TopBar 
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        showSidebarToggle={true}
        isGamePage={isGamePage}
      />

      {/* 左侧边栏 (桌面端) */}
      {showSidebar && !isGamePage && (
        <div className={cn(
          "hidden md:fixed md:z-40 md:flex md:flex-col transition-all duration-300",
          "md:top-14 md:bottom-0", // 为TopBar留出空间
          sidebarCollapsed ? "md:w-16" : "md:w-64"
        )}>
          <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-gray-900/95 backdrop-blur-sm border-r border-gray-800 px-3 pb-4">
            <div className="flex h-16 shrink-0 items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="text-white hover:bg-white/10 p-2"
              >
                {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-16" />}
              </Button>
            </div>
            <nav className="flex flex-1 flex-col">
              <ul role="list" className="flex flex-1 flex-col gap-y-7">
                <li>
                  <ul role="list" className="-mx-2 space-y-1">
                    {filteredNavItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = router.pathname === item.href || 
                        (item.href !== '/' && router.pathname.startsWith(item.href));
                      
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            className={cn(
                              "group flex gap-x-3 rounded-md p-3 text-sm leading-6 font-semibold transition-all duration-200",
                              isActive
                                ? "bg-purple-600/20 text-purple-300 border border-purple-500/30"
                                : "text-gray-300 hover:text-white hover:bg-white/10",
                              sidebarCollapsed ? "justify-center" : ""
                            )}
                            title={sidebarCollapsed ? item.label : undefined}
                          >
                            <Icon className="h-6 w-6 shrink-0" aria-hidden="true" />
                            {!sidebarCollapsed && item.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              </ul>
            </nav>
          </div>
        </div>
      )}

      {/* 移动端侧边栏 - 始终可用 */}
      <>
        {/* 遮罩层 */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 z-[55] bg-black/50 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        
        {/* 侧边栏 */}
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
                {filteredNavItems.map((item) => {
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
        "pt-14", // 为TopBar留出空间
        showSidebar && !isGamePage ? (sidebarCollapsed ? "md:pl-16" : "md:pl-64") : ""
      )}>
        {/* 面包屑导航 */}
        {breadcrumbs.length > 1 && (
          <div className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700">
            <div className="px-4 sm:px-6 lg:px-8 py-3">
              <nav className="flex items-center space-x-2 text-sm">
                {breadcrumbs.map((crumb, index) => (
                  <React.Fragment key={crumb.href}>
                    {index > 0 && <ChevronRight className="h-4 w-4 text-gray-500" />}
                    {index === breadcrumbs.length - 1 ? (
                      <span className="text-purple-300 font-medium">{crumb.label}</span>
                    ) : (
                      <Link 
                        href={crumb.href} 
                        className="text-gray-400 hover:text-white transition-colors"
                      >
                        {crumb.label}
                      </Link>
                    )}
                  </React.Fragment>
                ))}
              </nav>
            </div>
          </div>
        )}

        {/* 页面标题 */}
        {title && (
          <div className="bg-gray-800/30 backdrop-blur-sm border-b border-gray-700">
            <div className="px-4 sm:px-6 lg:px-8 py-6">
              <h1 className="text-2xl md:text-3xl font-bold text-white">{title}</h1>
            </div>
          </div>
        )}

        {/* 页面内容 */}
        <main className="px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AppLayout;