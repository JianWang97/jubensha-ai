import React from 'react';
import Layout from '@/components/Layout';
import Toolbar from '@/components/Toolbar';
import StatsGrid from '@/components/StatsGrid';
import ScriptList from '@/components/ScriptList';

const Header = () => (
  <div className="bg-white/90 backdrop-blur-md rounded-xl p-8 mb-8 shadow-lg">
    <h1 className="text-3xl font-bold text-gray-800 text-center mb-2">剧本管理系统</h1>
    <p className="text-gray-500 text-center">在这里创建、编辑和管理您的所有剧本。</p>
  </div>
);

const ScriptManagerPage = () => {
  return (
    <Layout>
      <Header />
      <Toolbar />
      <StatsGrid />
      <ScriptList />
    </Layout>
  );
};

export default ScriptManagerPage;