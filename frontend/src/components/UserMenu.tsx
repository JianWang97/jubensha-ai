import React, { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { User, LogOut, Settings, History, ChevronDown, LogIn, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuthStore } from '@/stores/authStore';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface UserMenuProps {
  collapsed?: boolean;
  variant?: 'default' | 'compact';
}

const UserMenu: React.FC<UserMenuProps> = ({ collapsed = false, variant = 'default' }) => {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthStore();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logout();
      toast.success('已成功登出');
      router.push('/');
    } catch (error) {
      toast.error('登出失败');
    } finally {
      setIsLoggingOut(false);
    }
  };

  // 未登录状态
  if (!isAuthenticated || !user) {
    if (collapsed) {
      return (
        <div className="flex justify-center">
          <Link href="/auth/login">
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/10 p-2"
              title="登录"
            >
              <LogIn className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      );
    }
    return (
      <div className="flex items-center space-x-2">
        <Link href="/auth/login">
          <Button
            variant="outline"
            className="border-white/20 text-white hover:bg-white/10"
          >
            <LogIn className="h-4 w-4 mr-2" />
            登录
          </Button>
        </Link>
        <Link href="/auth/register">
          <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white">
            <UserPlus className="h-4 w-4 mr-2" />
            注册
          </Button>
        </Link>
      </div>
    );
  }

  // 已登录状态
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "text-white hover:bg-white/10",
            collapsed ? "p-2" : "flex items-center space-x-2 px-3 py-2 rounded-md",
            variant === 'compact' ? "p-2" : ""
          )}
        >
          <div className="h-8 w-8 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center">
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt="头像"
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <User className="h-4 w-4 text-white" />
            )}
          </div>
          {!collapsed && variant !== 'compact' && (
            <>
              <div className="hidden sm:block text-left">
                <div className="text-sm font-medium">
                  {user.nickname || user.username}
                </div>
                <div className="text-xs text-gray-300">
                  @{user.username}
                </div>
              </div>
              <ChevronDown className="h-4 w-4" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent 
        align="end" 
        className="w-56 bg-gray-900/95 backdrop-blur-md border-gray-700"
      >
        <DropdownMenuLabel className="text-white">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium">
              {user.nickname || user.username}
            </p>
            <p className="text-xs text-gray-400">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        
        <DropdownMenuSeparator className="bg-gray-700" />
        
        <DropdownMenuItem 
          className="text-white hover:bg-white/10 cursor-pointer"
          onClick={() => router.push('/profile')}
        >
          <Settings className="h-4 w-4 mr-2" />
          个人资料
        </DropdownMenuItem>
        
        <DropdownMenuItem 
          className="text-white hover:bg-white/10 cursor-pointer"
          onClick={() => router.push('/profile/game-history')}
        >
          <History className="h-4 w-4 mr-2" />
          游戏历史
        </DropdownMenuItem>
        
        <DropdownMenuSeparator className="bg-gray-700" />
        
        <DropdownMenuItem 
          className="text-red-400 hover:bg-red-500/10 cursor-pointer"
          onClick={handleLogout}
          disabled={isLoggingOut}
        >
          <LogOut className="h-4 w-4 mr-2" />
          {isLoggingOut ? '登出中...' : '登出'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserMenu;