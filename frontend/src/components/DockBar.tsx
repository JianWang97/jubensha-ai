import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  History,
  BookOpen,
  Plus,
} from 'lucide-react';
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
  { href: '/script-manager/create', label: '创建剧本', icon: Plus, requireAuth: true },
  { href: '/profile/game-history', label: '游戏历史', icon: History, requireAuth: true },
];

const DockBar: React.FC<DockBarProps> = ({ className }) => {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const [expanded, setExpanded] = useState(false);

  const filteredNavItems = navItems.filter(item =>
    !item.requireAuth || isAuthenticated
  );

  const isActive = (href: string) =>
    router.pathname === href || (href !== '/' && router.pathname.startsWith(href));

  return (
    <div
      className={cn(
        "fixed left-0 top-0 z-50 h-screen flex flex-col overflow-hidden",
        "bg-gray-900/95 backdrop-blur-sm border-r border-gray-800",
        "transition-all duration-300",
        expanded ? "w-[220px]" : "w-20",
        className
      )}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      {/* Logo 区域 */}
      <div className="flex h-20 items-center border-b border-gray-800 px-4 shrink-0">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-12 h-12 shrink-0 bg-gradient-to-br from-purple-500 to-purple-700 rounded-xl flex items-center justify-center hover:from-purple-400 hover:to-purple-600 transition-all duration-200">
            <span className="text-white font-bold text-lg">AI</span>
          </div>
          <span className={cn(
            "text-white font-bold text-base whitespace-nowrap transition-opacity duration-300",
            expanded ? "opacity-100" : "opacity-0"
          )}>
            AI 剧本杀
          </span>
        </Link>
      </div>

      {/* 主要导航区域 */}
      <div className="flex-1 flex flex-col py-6 space-y-2 px-2">
        {filteredNavItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex h-12 items-center rounded-xl transition-all duration-300",
                expanded ? "w-full px-3 gap-3" : "w-12 mx-auto justify-center",
                active
                  ? "bg-purple-600/20 text-purple-300 border border-purple-500/30"
                  : "text-gray-400 hover:text-white hover:bg-white/10"
              )}
            >
              <Icon className="h-6 w-6 shrink-0" />
              <span className={cn(
                "text-sm font-medium whitespace-nowrap transition-opacity duration-300",
                expanded ? "opacity-100" : "opacity-0"
              )}>
                {item.label}
              </span>

              {/* 活跃状态指示器 */}
              {active && (
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-purple-400 rounded-full" />
              )}
            </Link>
          );
        })}
      </div>

      {/* 底部用户菜单 */}
      <div className="flex flex-col pb-6 border-t border-gray-800 pt-4 px-2">
        <div className={cn(
          "flex items-center gap-3 rounded-xl transition-all duration-300",
          expanded ? "w-full px-3" : "w-12 mx-auto justify-center"
        )}>
          <div className="shrink-0">
            <UserMenu variant="compact" />
          </div>
          {user && (
            <span className={cn(
              "text-sm font-medium text-white whitespace-nowrap transition-opacity duration-300 truncate",
              expanded ? "opacity-100" : "opacity-0"
            )}>
              {user.nickname || user.username}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default DockBar;