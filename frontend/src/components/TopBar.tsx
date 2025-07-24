import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Menu, X, Bell, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import UserMenu from '@/components/UserMenu';
import { cn } from '@/lib/utils';

interface TopBarProps {
  sidebarOpen?: boolean;
  setSidebarOpen?: (open: boolean) => void;
  showSidebarToggle?: boolean;
  isGamePage?: boolean;
  className?: string;
}

const TopBar: React.FC<TopBarProps> = ({
  sidebarOpen = false,
  setSidebarOpen,
  showSidebarToggle = true,
  isGamePage = false,
  className
}) => {
  const router = useRouter();

  return (
    <div className={cn(
      "fixed top-0 left-0 right-0 z-50 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800",
      className
    )}>
      <div className="flex justify-between items-center h-14 px-4">
        {/* 左侧区域 */}
        <div className="flex items-center space-x-4">
          {/* 侧边栏切换按钮 */}
          {showSidebarToggle && setSidebarOpen && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-white hover:bg-white/10 md:hidden"
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          )}
          
          {/* Logo */}
          <Link href="/" className="text-xl font-bold text-purple-400 hover:text-purple-300 transition-colors">
            AI 剧本杀
          </Link>
          
          {/* 游戏页面返回按钮 */}
          {isGamePage && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/')}
              className="text-white hover:bg-white/10 hidden md:flex"
            >
              返回首页
            </Button>
          )}
        </div>

        {/* 右侧区域 */}
        <div className="flex items-center space-x-2">
          {/* 桌面端功能按钮 */}
          <div className="hidden md:flex items-center space-x-2">
            {/* 通知按钮 */}
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/10 p-2"
              title="通知"
            >
              <Bell className="h-4 w-4" />
            </Button>
            
            {/* 设置按钮 */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/profile')}
              className="text-white hover:bg-white/10 p-2"
              title="设置"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
          
          {/* 用户菜单 */}
          <div className="flex items-center">
            <UserMenu variant="compact" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TopBar;