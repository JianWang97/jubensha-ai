import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface MobileOptimizedProps {
  children: React.ReactNode;
  className?: string;
}

const MobileOptimized: React.FC<MobileOptimizedProps> = ({ children, className }) => {
  const [isMobile, setIsMobile] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);

  useEffect(() => {
    const checkDevice = () => {
      const mobile = window.innerWidth < 768;
      const landscape = window.innerWidth > window.innerHeight;
      setIsMobile(mobile);
      setIsLandscape(landscape);
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    window.addEventListener('orientationchange', checkDevice);

    return () => {
      window.removeEventListener('resize', checkDevice);
      window.removeEventListener('orientationchange', checkDevice);
    };
  }, []);

  return (
    <div 
      className={cn(
        "transition-all duration-300",
        isMobile && "mobile-optimized",
        isMobile && isLandscape && "mobile-landscape",
        className
      )}
      style={{
        // 移动端优化样式
        ...(isMobile && {
          fontSize: '16px', // 防止iOS缩放
          WebkitTextSizeAdjust: '100%',
          WebkitTapHighlightColor: 'transparent',
        }),
        // 横屏优化
        ...(isMobile && isLandscape && {
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
        })
      }}
    >
      {children}
    </div>
  );
};

export default MobileOptimized;