import React, { useState } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import { User, LogOut, Settings, ChevronDown, ArrowRight, UserCheck } from 'lucide-react';
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
    } catch {
      toast.error('登出失败');
    } finally {
      setIsLoggingOut(false);
    }
  };

  // 未登录状态
  if (!isAuthenticated || !user) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="text-mist hover:bg-raised/60 hover:text-paper p-2"
            title="登录/注册"
          >
            <User className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          align="end" 
          className="w-40"
        >
          <DropdownMenuItem 
            className="text-paper hover:bg-raised cursor-pointer"
            onClick={() => router.push('/auth/login')}
          >
            <ArrowRight className="h-4 w-4 mr-2" />
            登录
          </DropdownMenuItem>
          <DropdownMenuItem 
            className="text-paper hover:bg-raised cursor-pointer"
            onClick={() => router.push('/auth/register')}
          >
            <UserCheck className="h-4 w-4 mr-2" />
            注册
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // 已登录状态
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "text-mist hover:bg-raised/60 hover:text-paper",
            collapsed ? "p-2" : "flex items-center space-x-2 px-3 py-2 rounded-sm",
            variant === 'compact' ? "p-2" : ""
          )}
        >
          <div className="h-8 w-8 rounded-full bg-brass/20 border border-brass/40 flex items-center justify-center">
            {user.avatar_url ? (
              <Image
                src={user.avatar_url}
                alt="头像"
                width={32}
                height={32}
                unoptimized
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <User className="h-4 w-4 text-brass" />
            )}
          </div>
          {!collapsed && variant !== 'compact' && (
            <>
              <div className="hidden sm:block text-left">
                <div className="text-sm font-medium">
                  {user.nickname || user.username}
                </div>
                <div className="text-xs text-mist">
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
        className="w-56"
      >
        <DropdownMenuLabel className="text-paper">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium">
              {user.nickname || user.username}
            </p>
            <p className="text-xs text-faint">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem 
          className="text-paper hover:bg-raised cursor-pointer"
          onClick={() => router.push('/profile')}
        >
          <Settings className="h-4 w-4 mr-2" />
          个人资料
        </DropdownMenuItem>
        
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem 
          className="text-thread hover:bg-thread/10 cursor-pointer"
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