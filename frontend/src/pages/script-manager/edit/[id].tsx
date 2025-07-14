import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import EvidenceManager from '@/components/EvidenceManager';
import { useApiClient, Script, Evidence, Character, Locations } from '@/hooks/useApiClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Tab类型定义
type TabType = 'basic' | 'evidence' | 'characters' | 'locations' | 'background';

const ScriptEditPage = () => {
  const router = useRouter();
  const { id } = router.query;
  const { loading, error, getScript, updateScript, getScriptWithDetail, generateEvidenceImage } = useApiClient();
  const [script, setScript] = useState<Script | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('basic');
  
  // 基础信息表单数据
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    author: '',
    player_count: 0,
    duration_minutes: 0,
    difficulty: '',
    tags: [] as string[],
    status: ''
  });

  const [backgroundStory, setBackgroundStory] = useState({
    main_story: '',
    timeline: '',
    key_events: '',
    murder_method: '',
    motive: ''
  });
  


  // 获取脚本数据
  useEffect(() => {
    if (id && typeof id === 'string') {
      const fetchScript = async () => {
        try {
          const scriptData = await getScriptWithDetail(parseInt(id));
          setScript(scriptData.info);
          setFormData({
            title: scriptData.info.title || '',
            description: scriptData.info.description || '',
            author: scriptData.info.author || '',
            player_count: scriptData.info.player_count || 0,
            duration_minutes: scriptData.info.duration_minutes || 0,
            difficulty: scriptData.info.difficulty || '',
            tags: scriptData.info.tags || [],
            status: scriptData.info.status || ''
          });

        } catch (err) {
          console.error('获取脚本详情失败:', err);
        }
      };

      fetchScript();
    }
  }, [id, getScript]);


  // 处理表单提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || typeof id !== 'string') return;

    try {
      await updateScript(parseInt(id), formData);
      alert('脚本更新成功！');
      router.push('/script-manager');
    } catch (err) {
      console.error('更新脚本失败:', err);
      alert('更新脚本失败，请重试。');
    }
  };

  // 处理输入变化
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'player_count' || name === 'duration_minutes' ? parseInt(value) || 0 : value
    }));
  };

  // 处理标签变化
  const handleTagsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const tags = e.target.value.split(',').map(tag => tag.trim()).filter(tag => tag);
    setFormData(prev => ({ ...prev, tags }));
  };

  // Tab配置
  const tabs = [
    { key: 'basic' as TabType, label: '剧本基础信息', icon: '📝' },
    { key: 'evidence' as TabType, label: '证据管理', icon: '🔍' },
    { key: 'characters' as TabType, label: '角色管理', icon: '👥' },
    { key: 'locations' as TabType, label: '场景管理', icon: '🏛️' },
    { key: 'background' as TabType, label: '背景故事', icon: '📖' }
  ];

  if (loading) {
    return (
      <Layout>
        <Card className="bg-gradient-to-br from-slate-800/90 via-purple-900/90 to-slate-800/90 backdrop-blur-md border-purple-500/30">
          <CardContent className="p-8 text-center">
            <div className="text-purple-200 text-lg">🎭 加载剧本数据中...</div>
          </CardContent>
        </Card>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <Card className="bg-gradient-to-br from-slate-800/90 via-red-900/90 to-slate-800/90 backdrop-blur-md border-red-500/30">
          <CardContent className="p-8 text-center">
            <div className="text-red-300 text-lg mb-4">❌ 错误: {error}</div>
            <Button 
              onClick={() => router.push('/script-manager')}
              variant="secondary"
            >
              🔙 返回列表
            </Button>
          </CardContent>
        </Card>
      </Layout>
    );
  }

  // 基础信息Tab内容
  const BasicInfoTab = () => (
    <Card className="bg-gradient-to-br from-slate-800/90 via-purple-900/90 to-slate-800/90 backdrop-blur-md border-purple-500/30">
      <CardContent className="p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-purple-200 mb-2">
                📝 标题
              </label>
              <Input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                className="bg-slate-800/50 border-purple-500/30 text-purple-100 placeholder-purple-300/70"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-purple-200 mb-2">
                ✍️ 作者
              </label>
              <Input
                type="text"
                name="author"
                value={formData.author}
                onChange={handleInputChange}
                className="bg-slate-800/50 border-purple-500/30 text-purple-100 placeholder-purple-300/70"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-purple-200 mb-2">
                👥 玩家人数
              </label>
              <Input
                type="number"
                name="player_count"
                value={formData.player_count}
                onChange={handleInputChange}
                min="1"
                className="bg-slate-800/50 border-purple-500/30 text-purple-100"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-purple-200 mb-2">
                ⏱️ 游戏时长（分钟）
              </label>
              <Input
                type="number"
                name="duration_minutes"
                value={formData.duration_minutes}
                onChange={handleInputChange}
                min="1"
                className="bg-slate-800/50 border-purple-500/30 text-purple-100"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-purple-200 mb-2">
                🎯 难度
              </label>
              <Select value={formData.difficulty} onValueChange={(value) => setFormData(prev => ({ ...prev, difficulty: value }))}>
                <SelectTrigger className="bg-slate-800/50 border-purple-500/30 text-purple-100">
                  <SelectValue placeholder="请选择难度" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-purple-500/30">
                  <SelectItem value="简单">⭐ 简单</SelectItem>
                  <SelectItem value="中等">⚡ 中等</SelectItem>
                  <SelectItem value="困难">🔥 困难</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-purple-200 mb-2">
                📊 状态
              </label>
              <Select value={formData.status} onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}>
                <SelectTrigger className="bg-slate-800/50 border-purple-500/30 text-purple-100">
                  <SelectValue placeholder="请选择状态" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-purple-500/30">
                  <SelectItem value="draft">📝 草稿</SelectItem>
                  <SelectItem value="active">✅ 已发布</SelectItem>
                  <SelectItem value="published">🌟 已发布</SelectItem>
                </SelectContent>
              </Select>
            </div>
        </div>

          <div>
            <label className="block text-sm font-medium text-purple-200 mb-2">
              📄 描述
            </label>
            <Textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={4}
              className="bg-slate-800/50 border-purple-500/30 text-purple-100 placeholder-purple-300/70"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-purple-200 mb-2">
              🏷️ 标签（用逗号分隔）
            </label>
            <Input
              type="text"
              value={formData.tags.join(', ')}
              onChange={handleTagsChange}
              placeholder="例如：悬疑, 推理, 古风"
              className="bg-slate-800/50 border-purple-500/30 text-purple-100 placeholder-purple-300/70"
            />
          </div>

          <div className="flex justify-end space-x-4 pt-4">
            <Button
              type="button"
              onClick={() => router.push('/script-manager')}
              variant="secondary"
            >
              🔙 取消
            </Button>
            <Button
              type="submit"
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500"
            >
              💾 保存更改
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );



  // 证据管理Tab内容
  const EvidenceTab = () => (
    <EvidenceManager 
      generateEvidenceImage={generateEvidenceImage}
      scriptId={id as string}
    />
  );

  // 角色管理Tab内容
  const CharactersTab = () => (
    <Card className="bg-gradient-to-br from-slate-800/90 via-purple-900/90 to-slate-800/90 backdrop-blur-md border-purple-500/30">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <h3 className="text-xl font-bold text-purple-200 flex items-center gap-2">
          👥 角色管理
        </h3>
        <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white">
          ➕ 添加角色
        </Button>
      </CardHeader>
      <CardContent>
        <div className="text-purple-300 text-center py-8">
          👥 角色管理功能开发中...
        </div>
      </CardContent>
    </Card>
  );

  // 场景管理Tab内容
  const LocationsTab = () => (
    <Card className="bg-gradient-to-br from-slate-800/90 via-purple-900/90 to-slate-800/90 backdrop-blur-md border-purple-500/30">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <h3 className="text-xl font-bold text-purple-200 flex items-center gap-2">
          🏛️ 场景管理
        </h3>
        <Button className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white">
          ➕ 添加场景
        </Button>
      </CardHeader>
      <CardContent>
        <div className="text-purple-300 text-center py-8">
          🏛️ 场景管理功能开发中...
        </div>
      </CardContent>
    </Card>
  );

  // 背景故事Tab内容
  const BackgroundTab = () => (
    <Card className="bg-gradient-to-br from-slate-800/90 via-purple-900/90 to-slate-800/90 backdrop-blur-md border-purple-500/30">
      <CardHeader>
        <h3 className="text-xl font-bold text-purple-200 flex items-center gap-2">
          📖 背景故事管理
        </h3>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-purple-200 mb-2">
              📚 主要故事线
            </label>
            <Textarea
              value={backgroundStory.main_story}
              onChange={(e) => setBackgroundStory(prev => ({ ...prev, main_story: e.target.value }))}
              rows={4}
              className="bg-slate-800/50 border-purple-500/30 focus:ring-purple-400 text-purple-100 placeholder-purple-300/70"
              placeholder="描述剧本的主要故事背景..."
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-purple-200 mb-2">
              ⏰ 时间线
            </label>
            <Textarea
              value={backgroundStory.timeline}
              onChange={(e) => setBackgroundStory(prev => ({ ...prev, timeline: e.target.value }))}
              rows={3}
              className="bg-slate-800/50 border-purple-500/30 focus:ring-purple-400 text-purple-100 placeholder-purple-300/70"
              placeholder="描述事件发生的时间顺序..."
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-purple-200 mb-2">
              🎯 关键事件
            </label>
            <Textarea
              value={backgroundStory.key_events}
              onChange={(e) => setBackgroundStory(prev => ({ ...prev, key_events: e.target.value }))}
              rows={3}
              className="bg-slate-800/50 border-purple-500/30 focus:ring-purple-400 text-purple-100 placeholder-purple-300/70"
              placeholder="列出剧本中的关键事件..."
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );



  return (
    <Layout>
      {/* 页面头部 */}
      <div className="bg-gradient-to-r from-slate-800/90 via-purple-900/90 to-slate-800/90 backdrop-blur-md rounded-2xl shadow-2xl p-6 mb-6 border border-purple-500/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-r from-purple-500 to-blue-500 p-3 rounded-full">
              <span className="text-2xl">🎭</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-purple-200">编辑剧本</h1>
              <p className="text-purple-300/70 text-sm">{script?.title || '加载中...'}</p>
            </div>
          </div>
          <Button 
            onClick={() => router.push('/script-manager')}
            variant="secondary"
            className="bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-500 hover:to-gray-600 text-white flex items-center gap-2"
          >
            🔙 <span className="hidden sm:inline">返回列表</span>
          </Button>
        </div>
      </div>

      {/* Tab导航和内容 */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabType)} className="w-full">
        <TabsList className="grid w-full grid-cols-5 bg-slate-800/50 border-purple-500/30">
          {tabs.map((tab) => (
            <TabsTrigger 
              key={tab.key} 
              value={tab.key}
              className="data-[state=active]:bg-purple-600 data-[state=active]:text-white text-purple-200"
            >
              <span className="mr-2">{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
        
        <TabsContent value="basic" className="mt-6">
          <BasicInfoTab />
        </TabsContent>
        
        <TabsContent value="evidence" className="mt-6">
          <EvidenceTab />
        </TabsContent>
        
        <TabsContent value="characters" className="mt-6">
          <CharactersTab />
        </TabsContent>
        
        <TabsContent value="locations" className="mt-6">
          <LocationsTab />
        </TabsContent>
        
        <TabsContent value="background" className="mt-6">
          <BackgroundTab />
        </TabsContent>
      </Tabs>
    </Layout>
  );
};

export default ScriptEditPage;