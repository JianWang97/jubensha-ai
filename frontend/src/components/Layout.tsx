import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
  backgroundImage?: string;
}

const Layout = ({ children, backgroundImage }: LayoutProps) => {
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-ink font-sans text-paper antialiased">
      {/* 背景层 */}
      {backgroundImage ? (
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${backgroundImage})` }}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-b from-[#0C0F14] via-[#0E1116] to-[#11151D]" />
      )}

      {/* 遮罩层 */}
      {backgroundImage && <div className="absolute inset-0 bg-ink/70" />}

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