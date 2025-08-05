import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
  backgroundImage?: string;
}

const Layout = ({ children, backgroundImage }: LayoutProps) => {
  return (
    <div className="relative h-screen w-screen text-white font-sans overflow-hidden">
      {/* 背景图片层 */}
      {backgroundImage ? (
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${backgroundImage})` }}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a237e] via-[#311b92] to-[#4a148c]" />
      )}
      
      {/* 遮罩层 */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" />
      
      {/* 内容层 */}
      <div className="relative z-10 h-full w-full">
        <main className="h-full w-full">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;