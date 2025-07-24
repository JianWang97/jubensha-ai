import React from 'react';
import { Loader2, Gamepad2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PageLoaderProps {
  message?: string;
  fullScreen?: boolean;
  className?: string;
}

const PageLoader: React.FC<PageLoaderProps> = ({ 
  message = '正在加载...', 
  fullScreen = true,
  className 
}) => {
  const content = (
    <div className="flex flex-col items-center justify-center space-y-4">
      {/* 动画图标 */}
      <div className="relative">
        <div className="absolute inset-0 animate-ping">
          <Gamepad2 className="h-12 w-12 text-purple-500/30" />
        </div>
        <Gamepad2 className="h-12 w-12 text-purple-500 relative z-10" />
      </div>
      
      {/* 加载文字 */}
      <div className="text-center space-y-2">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-5 w-5 animate-spin text-purple-400" />
          <p className="text-lg font-medium text-white">{message}</p>
        </div>
        
        {/* 加载进度条 */}
        <div className="w-48 h-1 bg-gray-700 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full animate-pulse" />
        </div>
        
        <p className="text-sm text-gray-400">请稍候片刻...</p>
      </div>
    </div>
  );

  if (fullScreen) {
    return (
      <div className={cn(
        "fixed inset-0 z-50 bg-gray-900/95 backdrop-blur-sm flex items-center justify-center",
        className
      )}>
        {content}
      </div>
    );
  }

  return (
    <div className={cn(
      "flex items-center justify-center py-12",
      className
    )}>
      {content}
    </div>
  );
};

export default PageLoader;