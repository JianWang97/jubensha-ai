import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { 
  Home, 
  User, 
  Settings, 
  History, 
  BookOpen, 
  Users,
  Bell,
  Smartphone,
  Code,
  Menu
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import UserMenu from '@/components/UserMenu';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';

interface DockBarProps {
  className?: string;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  requireAuth?: boolean;
}

const navItems: NavItem[] = [
  { href: '/script-center', label: '剧本中心', icon: BookOpen },
  { href: '/profile/game-history', label: '游戏历史', icon: History, requireAuth: true },
];

const bottomNavItems: NavItem[] = [
];

const DockBar: React.FC<DockBarProps> = ({ className }) => {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  
  const filteredNavItems = navItems.filter(item => 
    !item.requireAuth || isAuthenticated
  );
  
  const filteredBottomNavItems = bottomNavItems.filter(item => 
    !item.requireAuth || isAuthenticated
  );

  const isActive = (href: string) => {
    return router.pathname === href || 
      (href !== '/' && router.pathname.startsWith(href));
  };

  return (
    <div className={cn(
      "fixed left-0 top-0 z-50 h-screen w-20 bg-gray-900/95 backdrop-blur-sm border-r border-gray-800 flex flex-col",
      className
    )}>
      {/* Logo区域 */}
      <div className="flex h-20 items-center justify-center border-b border-gray-800">
        <Link href="/" className="group">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-700 rounded-xl flex items-center justify-center group-hover:from-purple-400 group-hover:to-purple-600 transition-all duration-200">
            <span className="text-white font-bold text-lg">AI</span>
          </div>
        </Link>
      </div>

      {/* 主要导航区域 */}
      <div className="flex-1 flex flex-col items-center py-6 space-y-4">
        {filteredNavItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex h-12 w-12 items-center justify-center rounded-xl transition-all duration-200",
                active
                  ? "bg-purple-600/20 text-purple-300 border border-purple-500/30"
                  : "text-gray-400 hover:text-white hover:bg-white/10"
              )}
              title={item.label}
            >
              <Icon className="h-6 w-6" />
              
              {/* 活跃状态指示器 */}
              {active && (
                <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-1 h-6 bg-purple-400 rounded-full" />
              )}
              
              {/* Tooltip */}
              <div className="absolute left-full ml-3 px-2 py-1 bg-gray-800 text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                {item.label}
              </div>
            </Link>
          );
        })}
      </div>

      {/* 底部功能区域 */}
      <div className="flex flex-col items-center pb-6 space-y-4 border-t border-gray-800 pt-4">
        
        {/* 底部导航项 */}
        {filteredBottomNavItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex h-12 w-12 items-center justify-center rounded-xl transition-all duration-200",
                active
                  ? "bg-purple-600/20 text-purple-300 border border-purple-500/30"
                  : "text-gray-400 hover:text-white hover:bg-white/10"
              )}
              title={item.label}
            >
              <Icon className="h-5 w-5" />
              
              {/* 活跃状态指示器 */}
              {active && (
                <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-1 h-6 bg-purple-400 rounded-full" />
              )}
              
              {/* Tooltip */}
              <div className="absolute left-full ml-3 px-2 py-1 bg-gray-800 text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                {item.label}
              </div>
            </Link>
          );
        })}
        
        {/* 用户菜单 */}
        <div className="relative group">
          <UserMenu variant="compact" />
        </div>
      </div>
    </div>
  );
};

export default DockBar;