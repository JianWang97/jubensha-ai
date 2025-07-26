import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { Search, Plus, BookOpen, Users, Clock, Filter, Grid, List, Star, Download, Upload, Settings, BarChart3, FolderOpen, Archive, Edit3, Copy, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AppLayout from '@/components/AppLayout';
import AuthGuard from '@/components/AuthGuard';
import ScriptList from '@/components/ScriptList';

const Header = () => {
  const [activeTab, setActiveTab] = useState('all');
  
  return (
    <div className="bg-slate-800/80 backdrop-blur-sm rounded-lg p-4 mb-4 border border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-purple-400" />
          <h1 className="text-xl font-semibold text-white">剧本管理</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-slate-400">
            共 <span className="text-white font-medium">12</span> 个剧本
          </div>
          <button className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {/* 功能标签页 */}
      <div className="flex gap-1 bg-slate-900/50 p-1 rounded-lg">
        {[
          { id: 'all', label: '全部剧本', count: 12 },
          { id: 'published', label: '已发布', count: 8 },
          { id: 'draft', label: '草稿', count: 4 },
          { id: 'archived', label: '已归档', count: 2 }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
              activeTab === tab.id
                ? 'bg-purple-500 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            {tab.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              activeTab === tab.id ? 'bg-white/20' : 'bg-slate-600'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

const GameToolbar = () => {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('latest');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedScripts, setSelectedScripts] = useState<string[]>([]);

  return (
    <div className="bg-slate-800/80 backdrop-blur-sm rounded-lg p-4 mb-4 border border-slate-700">
      {/* 主工具栏 */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        {/* 左侧：搜索和操作 */}
        <div className="flex flex-col sm:flex-row gap-3 flex-1">
          {/* 搜索框 */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="搜索剧本名称、标签或描述..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
            />
          </div>
          
          {/* 批量操作 */}
          {selectedScripts.length > 0 && (
            <div className="flex gap-2">
              <button className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm flex items-center gap-1 transition-all">
                <Copy className="w-4 h-4" />
                复制 ({selectedScripts.length})
              </button>
              <button className="px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm flex items-center gap-1 transition-all">
                <Archive className="w-4 h-4" />
                归档
              </button>
              <button className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm flex items-center gap-1 transition-all">
                <Trash2 className="w-4 h-4" />
                删除
              </button>
            </div>
          )}
        </div>
        
        {/* 右侧：工具和创建 */}
        <div className="flex gap-2 items-center">
          {/* 筛选按钮 */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-2 rounded-lg text-sm flex items-center gap-1 transition-all ${
              showFilters 
                ? 'bg-purple-600 text-white' 
                : 'bg-slate-700 text-slate-300 hover:text-white hover:bg-slate-600'
            }`}
          >
            <Filter className="w-4 h-4" />
            筛选
          </button>
          
          {/* 排序 */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
          >
            <option value="latest">最新创建</option>
            <option value="updated">最近更新</option>
            <option value="name">名称排序</option>
            <option value="players">玩家人数</option>
            <option value="status">状态</option>
          </select>
          
          {/* 视图切换 */}
          <div className="flex bg-slate-700 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded transition-all ${
                viewMode === 'grid'
                  ? 'bg-purple-500 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded transition-all ${
                viewMode === 'list'
                  ? 'bg-purple-500 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          
          {/* 创建按钮组 */}
          <div className="flex gap-2">
            <button className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-1 transition-all">
              <Download className="w-4 h-4" />
              导入
            </button>
            <button 
              onClick={() => router.push('/script-manager/create')}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-all"
            >
              <Plus className="w-4 h-4" />
              新建剧本
            </button>
          </div>
        </div>
      </div>
      
      {/* 高级筛选面板 */}
      {showFilters && (
        <div className="mt-4 pt-4 border-t border-slate-600">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">玩家人数</label>
              <select className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white text-sm">
                <option>全部</option>
                <option>4-6人</option>
                <option>6-8人</option>
                <option>8+人</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">剧本类型</label>
              <select className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white text-sm">
                <option>全部</option>
                <option>推理</option>
                <option>情感</option>
                <option>欢乐</option>
                <option>恐怖</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">难度等级</label>
              <select className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white text-sm">
                <option>全部</option>
                <option>简单</option>
                <option>中等</option>
                <option>困难</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">游戏时长</label>
              <select className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white text-sm">
                <option>全部</option>
                <option>1小时内</option>
                <option>1-2小时</option>
                <option>2-3小时</option>
                <option>3小时以上</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">创建时间</label>
              <select className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white text-sm">
                <option>全部</option>
                <option>今天</option>
                <option>本周</option>
                <option>本月</option>
                <option>更早</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button className="px-3 py-1 text-slate-400 hover:text-white text-sm transition-all">
              重置筛选
            </button>
            <button className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm transition-all">
              应用筛选
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default function ScriptManager() {
  return (
    <AuthGuard>
      <AppLayout title="剧本管理中心">
        <div className="min-h-screen bg-slate-900">
          <div className="flex flex-col lg:flex-row gap-4 p-4">
            {/* 主要内容区域 */}
            <div className="flex-1 min-w-0 space-y-4">
              <Header />
              <GameToolbar />
              <ScriptList />
            </div>
            
            {/* 功能侧边栏 */}
            <div className="w-full lg:w-80 space-y-4">
              {/* 快捷操作 */}
              <div className="bg-slate-800/80 backdrop-blur-sm rounded-lg p-4 border border-slate-700">
                <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                  <Star className="w-4 h-4 text-purple-400" />
                  快捷操作
                </h3>
                <div className="space-y-2">
                  <button className="w-full text-left px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 hover:text-white transition-all text-sm flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    从模板创建
                  </button>
                  <button className="w-full text-left px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 hover:text-white transition-all text-sm flex items-center gap-2">
                    <Download className="w-4 h-4" />
                    导入剧本包
                  </button>
                  <button className="w-full text-left px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 hover:text-white transition-all text-sm flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    批量导出
                  </button>
                  <button className="w-full text-left px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 hover:text-white transition-all text-sm flex items-center gap-2">
                    <FolderOpen className="w-4 h-4" />
                    打开文件夹
                  </button>
                </div>
              </div>
              
              {/* 最近使用 */}
              <div className="bg-slate-800/80 backdrop-blur-sm rounded-lg p-4 border border-slate-700">
                <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-purple-400" />
                  最近编辑
                </h3>
                <div className="space-y-2">
                  <div className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg cursor-pointer transition-all group">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-white text-sm font-medium">神秘古堡</div>
                        <div className="text-slate-400 text-xs">2小时前</div>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-1 text-slate-400 hover:text-white">
                          <Edit3 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg cursor-pointer transition-all group">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-white text-sm font-medium">都市传说</div>
                        <div className="text-slate-400 text-xs">1天前</div>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-1 text-slate-400 hover:text-white">
                          <Edit3 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg cursor-pointer transition-all group">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-white text-sm font-medium">校园悬疑</div>
                        <div className="text-slate-400 text-xs">3天前</div>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-1 text-slate-400 hover:text-white">
                          <Edit3 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                <button className="w-full mt-3 px-3 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg text-slate-300 hover:text-white transition-all text-sm">
                  查看全部历史
                </button>
              </div>
              
              {/* 模板库 */}
              <div className="bg-slate-800/80 backdrop-blur-sm rounded-lg p-4 border border-slate-700">
                <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-purple-400" />
                  剧本模板
                </h3>
                <div className="space-y-2">
                  <div className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg cursor-pointer transition-all group">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-white text-sm font-medium">推理悬疑</div>
                        <div className="text-slate-400 text-xs">6-8人 · 2-3小时</div>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-1 text-slate-400 hover:text-purple-400">
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg cursor-pointer transition-all group">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-white text-sm font-medium">情感治愈</div>
                        <div className="text-slate-400 text-xs">4-6人 · 1-2小时</div>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-1 text-slate-400 hover:text-purple-400">
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg cursor-pointer transition-all group">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-white text-sm font-medium">欢乐聚会</div>
                        <div className="text-slate-400 text-xs">8+人 · 1小时</div>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-1 text-slate-400 hover:text-purple-400">
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg cursor-pointer transition-all group">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-white text-sm font-medium">恐怖惊悚</div>
                        <div className="text-slate-400 text-xs">6-8人 · 2小时</div>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-1 text-slate-400 hover:text-purple-400">
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button className="flex-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg text-slate-300 hover:text-white transition-all text-sm">
                    浏览全部
                  </button>
                  <button className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition-all">
                    上传模板
                  </button>
                </div>
              </div>
              
              {/* 统计信息 */}
              <div className="bg-slate-800/80 backdrop-blur-sm rounded-lg p-4 border border-slate-700">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-white font-medium flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-purple-400" />
                    数据统计
                  </h3>
                  <button className="p-1 text-slate-400 hover:text-white transition-all">
                    <Settings className="w-3 h-3" />
                  </button>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-sm">总剧本数</span>
                    <span className="text-white font-medium">12</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-sm">已发布</span>
                    <span className="text-green-400 font-medium">8</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-sm">草稿</span>
                    <span className="text-yellow-400 font-medium">4</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-sm">已归档</span>
                    <span className="text-slate-500 font-medium">2</span>
                  </div>
                  <div className="border-t border-slate-600 pt-3 mt-3">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-sm">本月新增</span>
                      <span className="text-blue-400 font-medium">3</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-sm">总游戏次数</span>
                      <span className="text-purple-400 font-medium">47</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-sm">平均评分</span>
                      <span className="text-orange-400 font-medium">4.6</span>
                    </div>
                  </div>
                </div>
                <button className="w-full mt-4 px-3 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg text-slate-300 hover:text-white transition-all text-sm flex items-center justify-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  查看详细报告
                </button>
              </div>
            </div>
          </div>
        </div>
      </AppLayout>
    </AuthGuard>
  );
}