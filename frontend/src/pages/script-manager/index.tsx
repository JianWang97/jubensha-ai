import React from 'react';
import Layout from '@/components/Layout';
import Toolbar from '@/components/Toolbar';
import StatsGrid from '@/components/StatsGrid';
import ScriptList from '@/components/ScriptList';

const Header = () => (
  <div className="relative bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 rounded-2xl p-8 mb-8 shadow-2xl border border-purple-500/30 overflow-hidden">
    {/* 背景装饰 */}
    <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 to-blue-600/10 animate-pulse"></div>
    <div className="absolute top-4 right-4 text-6xl opacity-20 animate-bounce">🎭</div>
    <div className="absolute bottom-4 left-4 text-4xl opacity-20 animate-spin-slow">⚡</div>
    
    {/* 主要内容 */}
    <div className="relative z-10">
      <div className="flex items-center justify-center mb-4">
        <div className="bg-gradient-to-r from-purple-400 to-blue-400 p-3 rounded-full mr-4 shadow-lg">
          <span className="text-2xl">🎲</span>
        </div>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-300 via-blue-300 to-indigo-300 bg-clip-text text-transparent">
          剧本管理中心
        </h1>
        <div className="bg-gradient-to-r from-blue-400 to-purple-400 p-3 rounded-full ml-4 shadow-lg">
          <span className="text-2xl">📚</span>
        </div>
      </div>
      
      <div className="text-center">
        <p className="text-purple-200 text-lg mb-2 font-medium">
          🌟 探索无限可能的剧本世界 🌟
        </p>
        <p className="text-blue-300 text-sm opacity-90">
          创建、编辑和管理您的神秘剧本档案库
        </p>
      </div>
      
      {/* 装饰性元素 */}
      <div className="flex justify-center mt-6 space-x-8">
        <div className="flex items-center text-purple-300 text-sm">
          <span className="mr-2">🔮</span>
          <span>神秘探案</span>
        </div>
        <div className="flex items-center text-blue-300 text-sm">
          <span className="mr-2">⚔️</span>
          <span>角色扮演</span>
        </div>
        <div className="flex items-center text-indigo-300 text-sm">
          <span className="mr-2">🏰</span>
          <span>沉浸体验</span>
        </div>
      </div>
    </div>
    
    {/* 发光边框效果 */}
    <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-purple-500/20 to-blue-500/20 blur-xl -z-10"></div>
  </div>
);

const GameToolbar = () => (
  <div className="relative bg-gradient-to-r from-slate-800/90 via-purple-900/90 to-slate-800/90 backdrop-blur-md rounded-2xl p-6 mb-8 shadow-2xl border border-purple-500/30 overflow-hidden">
    {/* 背景装饰 */}
    <div className="absolute inset-0 bg-gradient-to-r from-purple-600/5 to-blue-600/5 animate-pulse"></div>
    <div className="absolute top-2 right-2 text-2xl opacity-20 animate-float">🔍</div>
    
    <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-4">
      {/* 搜索区域 */}
      <div className="relative flex-grow w-full sm:w-auto">
        <div className="relative">
          <input 
            type="text" 
            placeholder="🔮 搜索神秘剧本..." 
            className="w-full pl-6 pr-12 py-3 rounded-full bg-slate-800/50 border-2 border-purple-500/30 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20 transition-all duration-300 text-purple-100 placeholder-purple-300/70 backdrop-blur-sm" 
          />
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <div className="bg-gradient-to-r from-purple-500 to-blue-500 p-1.5 rounded-full">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>
      
      {/* 创建按钮 */}
      <div className="flex items-center gap-3">
        <button className="group relative bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 hover:from-purple-500 hover:via-blue-500 hover:to-indigo-500 text-white font-bold py-3 px-6 rounded-full shadow-lg transform hover:scale-105 transition-all duration-300 border border-purple-400/30">
          <div className="flex items-center gap-2">
            <span className="text-lg group-hover:animate-bounce">✨</span>
            <span>创建新剧本</span>
            <span className="text-lg group-hover:animate-pulse">🎭</span>
          </div>
          {/* 发光效果 */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-400/20 to-blue-400/20 blur-lg group-hover:blur-xl transition-all duration-300 -z-10"></div>
        </button>
      </div>
    </div>
  </div>
);

const ScriptManagerPage = () => {
  return (
    <Layout>
      <Header />
      <GameToolbar />
      <ScriptList />
    </Layout>
  );
};

export default ScriptManagerPage;