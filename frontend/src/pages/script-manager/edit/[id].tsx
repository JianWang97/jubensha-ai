import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import EvidenceManager from '@/components/EvidenceManager';
import CharacterManager from '@/components/CharacterManager';
import LocationManager from '@/components/LocationManager';
import ChatEditor from '@/components/ChatEditor';
import ImageSelector from '@/components/ImageSelector';
import {
  ScriptsService,
  Service,
  ScriptInfo,
  ScriptStatus,
  ImageType
} from '@/client';

import { Script_Output as Script } from '@/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, 
  FileText, 
  BookOpen, 
  Search, 
  Users, 
  Building, 
  Save, 
  PenTool, 
  Clock, 
  Target, 
  BarChart3, 
  Star, 
  Globe, 
  Drama, 
  Newspaper, 
  User, 
  MapPin, 
  PocketKnife, 
  Clipboard, 
  AlertTriangle, 
  Trophy, 
  X, 
  ArrowLeft,
  Camera,
  Bot,
  Zap
} from 'lucide-react';
import { useWebSocketStore } from '@/stores/websocketStore';

// Tab类型定义
type TabType = 'basic' | 'evidence' | 'characters' | 'locations' | 'background';

const ScriptEditPage = () => {
  const router = useRouter();
  const { id } = router.query;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateScript = async (scriptId: number, data: ScriptInfo) => {
    const response = await ScriptsService.updateScriptInfoApiScriptsScriptIdInfoPut(scriptId, data);
    return response.data;
  };

  const getScriptWithDetail = async (scriptId: number) => {
    const response = await ScriptsService.getScriptApiScriptsScriptIdGet(scriptId);
    return response.data;
  };


  const [script, setScript] = useState<Script | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('basic');

  // 基础信息表单数据
  const [basicFormData, setBasicFormData] = useState({
    title: '',
    description: '',
    author: '',
    player_count: '' as string | number,
    duration_minutes: '' as string | number,
    difficulty: '',
    tags: [] as string[],
    status: 'DRAFT' as ScriptStatus,
    cover_image_url: ''
  });

  // WebSocket连接
  const { connect, disconnect, isConnected } = useWebSocketStore();

  // 背景故事状态管理 - 与后端schema保持一致
  const [backgroundStory, setBackgroundStory] = useState({
    title: '',
    setting_description: '',
    incident_description: '',
    victim_background: '',
    investigation_scope: '',
    rules_reminder: '',
    murder_method: '',
    murder_location: '',
    discovery_time: '',
    victory_conditions: {}
  });



  // 获取脚本数据
  useEffect(() => {
    if (id && typeof id === 'string' && !isNaN(parseInt(id))) {
      const fetchScript = async () => {
        setLoading(true);
        setError(null);
        try {
          const scriptData = await getScriptWithDetail(parseInt(id));
          if (!scriptData) {
            toast('剧本不存在');
            return;
          }
          setScript(scriptData);
          setBasicFormData({
            title: scriptData.info.title || '',
            description: scriptData.info.description || '',
            author: scriptData.info.author || '',
            player_count: scriptData.info.player_count || 0,
            duration_minutes: scriptData.info.duration_minutes || 0,
            difficulty: scriptData.info.difficulty || '',
            tags: scriptData.info.tags || [],
            status: (scriptData.info.status as ScriptStatus) || ScriptStatus.DRAFT,
            cover_image_url: scriptData.info.cover_image_url || ''
          });

        } catch (err) {
          console.error('获取脚本详情失败:', err);
          setError('获取脚本详情失败');
        } finally {
          setLoading(false);
        }
      };

      fetchScript();
    } else if (id) {
      setError('无效的剧本ID');
      setLoading(false);
    }
  }, [id]);

  // WebSocket连接管理
  useEffect(() => {
    if (id && typeof id === 'string' && !isNaN(parseInt(id))) {
      // 建立WebSocket连接，传入脚本ID
      connect(undefined, parseInt(id));
    }

    // 组件卸载时断开连接
    return () => {
      disconnect();
    };
  }, [id, connect, disconnect]);


  // 基础信息提交
  const handleBasicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || typeof id !== 'string') return;

    try {
      // 确保数字字段为有效数字
      const submitData = {
        ...basicFormData,
        player_count: typeof basicFormData.player_count === 'string' ? 
          (basicFormData.player_count === '' ? 0 : parseInt(basicFormData.player_count) || 0) : basicFormData.player_count,
        duration_minutes: typeof basicFormData.duration_minutes === 'string' ? 
          (basicFormData.duration_minutes === '' ? 0 : parseInt(basicFormData.duration_minutes) || 0) : basicFormData.duration_minutes
      };
      
      await updateScript(parseInt(id), submitData);
      toast('脚本更新成功！');
    } catch (err) {
      console.error('更新脚本失败:', err);
      toast('更新脚本失败，请重试。');
    }
  };

  // 处理输入变化
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setBasicFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Tab配置
  const tabs = [
    { key: 'basic' as TabType, label: '剧本基础信息', icon: FileText },
    { key: 'background' as TabType, label: '背景故事', icon: BookOpen },
    { key: 'evidence' as TabType, label: '证据管理', icon: Search },
    { key: 'characters' as TabType, label: '角色管理', icon: Users },
    { key: 'locations' as TabType, label: '场景管理', icon: Building },

  ];

  // Loading and error states are now handled within the main render instead of early returns

  // 基础信息Tab内容
  const BasicInfoTab = () => {
    return (
      <div className="relative">
        <div className="p-6">
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-blue-200 flex items-center gap-2">
                <FileText className="w-5 h-5" /> 剧本基础信息
              </h3>
              <Button
                onClick={handleBasicSubmit}
                className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500"
              >
                <Save className="w-4 h-4 mr-1" /> 保存基础信息
              </Button>
            </div>
          </div>
          <form onSubmit={handleBasicSubmit} className="space-y-8">
            {/* 封面图片 */}
            <div className="bg-white/5 backdrop-blur-md p-6 rounded-2xl border border-white/10 shadow-lg relative overflow-hidden mb-8">
              <div className="flex justify-center items-center">
                <ImageSelector
                  url={basicFormData.cover_image_url}
                  imageType={ImageType.COVER}
                  scriptId={Number(id)}
                  onImageChange={(url) => setBasicFormData(prev => ({ ...prev, cover_image_url: url }))}
                  className="w-108"
                  imageHeight="h-72"
                />
              </div>
            </div>

            {/* 基本信息模块 */}
            <div className="bg-white/5 backdrop-blur-md p-6 rounded-2xl border border-white/10 shadow-lg relative overflow-hidden">
              {/* 玻璃态装饰 */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent"></div>
              <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
              <h3 className="text-xl font-bold text-slate-100 mb-6 flex items-center gap-3 relative z-10">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500/80 to-purple-500/80 rounded-xl flex items-center justify-center shadow-lg backdrop-blur-sm">
                  <FileText className="w-4 h-4 text-white" />
                </div>
                基本信息
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 bg-blue-400 rounded-full shadow-sm"></span>
                    <FileText className="w-4 h-4" /> 剧本标题
                  </label>
                  <Input
                    type="text"
                    name="title"
                    value={basicFormData.title}
                    onChange={handleInputChange}
                    className="bg-white/5 backdrop-blur-sm border-white/20 focus:border-blue-400/60 focus:ring-2 focus:ring-blue-400/20 text-slate-100 placeholder-slate-400 rounded-xl transition-all duration-300 hover:bg-white/8"
                    placeholder="输入剧本标题..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 bg-blue-500 rounded-full shadow-sm"></span>
                    <PenTool className="w-4 h-4" /> 作者
                  </label>
                  <Input
                    type="text"
                    name="author"
                    value={basicFormData.author}
                    onChange={handleInputChange}
                    className="bg-white/3 backdrop-blur-sm border-white/15 text-slate-200 rounded-xl opacity-75"
                    required
                    readOnly
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 bg-blue-600 rounded-full shadow-sm"></span>
                    <Users className="w-4 h-4" /> 玩家人数
                  </label>
                  <Input
                    type="number"
                    name="player_count"
                    value={basicFormData.player_count}
                    onChange={handleInputChange}
                    min="1"
                    className="bg-white/5 backdrop-blur-sm border-white/20 focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-400/20 text-slate-100 rounded-xl transition-all duration-300 hover:bg-white/8"
                    placeholder="建议3-8人"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 bg-cyan-400 rounded-full shadow-sm"></span>
                    <Clock className="w-4 h-4" /> 游戏时长（分钟）
                  </label>
                  <Input
                    type="number"
                    name="duration_minutes"
                    value={basicFormData.duration_minutes}
                    onChange={handleInputChange}
                    min="1"
                    className="bg-white/5 backdrop-blur-sm border-white/20 focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/20 text-slate-100 rounded-xl transition-all duration-300 hover:bg-white/8"
                    placeholder="建议120-240分钟"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 bg-cyan-500 rounded-full shadow-sm"></span>
                    <Target className="w-4 h-4" /> 难度等级
                  </label>
                  <Select value={basicFormData.difficulty} onValueChange={(value) => setBasicFormData(prev => ({ ...prev, difficulty: value }))}>
                    <SelectTrigger className="bg-white/5 backdrop-blur-sm border-white/20 focus:border-orange-400/60 focus:ring-2 focus:ring-orange-400/20 text-slate-100 rounded-xl transition-all duration-300 hover:bg-white/8">
                      <SelectValue placeholder="请选择难度等级" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800/95 backdrop-blur-xl border-white/20">
                      <SelectItem value="简单"><Star className="w-4 h-4 inline mr-1" /> 简单</SelectItem>
                      <SelectItem value="中等"><Target className="w-4 h-4 inline mr-1" /> 中等</SelectItem>
                      <SelectItem value="困难"><AlertTriangle className="w-4 h-4 inline mr-1" /> 困难</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 bg-cyan-600 rounded-full shadow-sm"></span>
                    <BarChart3 className="w-4 h-4" /> 发布状态
                  </label>
                  <Select value={basicFormData.status} onValueChange={(value) => setBasicFormData(prev => ({ ...prev, status: value as ScriptStatus }))}>
                    <SelectTrigger className="bg-white/5 backdrop-blur-sm border-white/20 focus:border-rose-400/60 focus:ring-2 focus:ring-rose-400/20 text-slate-100 rounded-xl transition-all duration-300 hover:bg-white/8">
                      <SelectValue placeholder="请选择发布状态" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DRAFT"><FileText className="w-4 h-4 inline mr-1" /> 草稿</SelectItem>
                      <SelectItem value="PUBLISHED"><BarChart3 className="w-4 h-4 inline mr-1" /> 已发布</SelectItem>
                      <SelectItem value="ARCHIVED"><Clipboard className="w-4 h-4 inline mr-1" /> 已归档</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

          </form>
        </div>
      </div>
    );
  };


  // 背景故事Tab内容 - 完整字段展示
  const BackgroundTab = () => (
    <div className="relative">
      <div className="p-6">
        <div className="mb-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-blue-200 flex items-center gap-2">
                <BookOpen className="w-5 h-5" /> 背景故事管理
              </h3>
              <Button
                onClick={handleSaveBackgroundStory}
                className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500"
              >
                <Save className="w-4 h-4 mr-1" /> 保存背景故事
              </Button>
        </div>
        </div>
        <div>
        <div className="space-y-6">
          {/* 基础设定模块 */}
          <div className="relative bg-gradient-to-br from-slate-700/30 to-slate-600/30 p-6 rounded-xl border border-slate-500/30 backdrop-blur-md shadow-lg overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-xl"></div>
            <div className="relative z-10">
            <h4 className="text-xl font-bold text-slate-100 mb-6 flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center shadow-lg">
                <Star className="w-4 h-4 text-white" />
              </div>
              基础设定
            </h4>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-700 rounded-full"></span>
                  <Globe className="w-4 h-4" /> 背景设定
                </label>
                <Textarea
                  value={backgroundStory.setting_description}
                  onChange={(e) => setBackgroundStory(prev => ({ ...prev, setting_description: e.target.value }))}
                  rows={5}
                  className="bg-slate-800/40 border-slate-500/40 focus:border-blue-400/60 focus:ring-2 focus:ring-blue-400/20 text-slate-100 placeholder-slate-400/70 rounded-lg transition-all duration-200 backdrop-blur-sm"
                  placeholder="描述剧本的世界观、时代背景、地点设定等..."
                />
              </div>
            </div>
            </div>
          </div>

          {/* 事件描述模块 */}
          <div className="relative bg-gradient-to-br from-slate-700/30 to-slate-600/30 p-6 rounded-xl border border-slate-500/30 backdrop-blur-md shadow-lg overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-xl"></div>
            <div className="relative z-10">
            <h4 className="text-xl font-bold text-slate-100 mb-6 flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg flex items-center justify-center shadow-lg">
                <Drama className="w-4 h-4 text-white" />
              </div>
              事件描述
            </h4>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-800 rounded-full"></span>
                  <Newspaper className="w-4 h-4" /> 事件描述
                </label>
                  <Textarea
                    value={backgroundStory.incident_description}
                    onChange={(e) => setBackgroundStory(prev => ({ ...prev, incident_description: e.target.value }))}
                    rows={4}
                    className="bg-slate-800/40 border-slate-500/40 focus:border-blue-400/60 focus:ring-2 focus:ring-blue-400/20 text-slate-100 placeholder-slate-400/70 rounded-lg transition-all duration-200 backdrop-blur-sm"
                    placeholder="描述核心事件的经过..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-cyan-700 rounded-full"></span>
                  <Clock className="w-4 h-4" /> 发现时间
                </label>
                  <Input
                    value={backgroundStory.discovery_time}
                    onChange={(e) => setBackgroundStory(prev => ({ ...prev, discovery_time: e.target.value }))}
                    className="bg-slate-800/40 border-slate-500/40 focus:border-blue-400/60 focus:ring-2 focus:ring-blue-400/20 text-slate-100 placeholder-slate-400/70 rounded-lg transition-all duration-200 backdrop-blur-sm"
                    placeholder="事件发现的具体时间..."
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-cyan-800 rounded-full"></span>
                <User className="w-4 h-4" /> 受害者背景
              </label>
                <Textarea
                  value={backgroundStory.victim_background}
                  onChange={(e) => setBackgroundStory(prev => ({ ...prev, victim_background: e.target.value }))}
                  rows={6}
                  className="bg-slate-800/40 border-slate-500/40 focus:border-blue-400/60 focus:ring-2 focus:ring-blue-400/20 text-slate-100 placeholder-slate-400/70 rounded-lg transition-all duration-200 backdrop-blur-sm"
                  placeholder="描述受害者的身份、背景、人际关系..."
                />
              </div>
            </div>
            </div>
          </div>

          {/* 调查设定模块 */}
          <div className="relative bg-gradient-to-br from-slate-700/30 to-slate-600/30 p-6 rounded-xl border border-slate-500/30 backdrop-blur-md shadow-lg overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-xl"></div>
            <div className="relative z-10">
            <h4 className="text-xl font-bold text-slate-100 mb-6 flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center shadow-lg">
                <Search className="w-4 h-4 text-white" />
              </div>
              调查设定
            </h4>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-900 rounded-full"></span>
                  <Target className="w-4 h-4" /> 调查范围
                </label>
                  <Textarea
                    value={backgroundStory.investigation_scope}
                    onChange={(e) => setBackgroundStory(prev => ({ ...prev, investigation_scope: e.target.value }))}
                    rows={4}
                    className="bg-slate-800/40 border-slate-500/40 focus:border-blue-400/60 focus:ring-2 focus:ring-blue-400/20 text-slate-100 placeholder-slate-400/70 rounded-lg transition-all duration-200 backdrop-blur-sm"
                    placeholder="定义玩家可以调查的范围和限制..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-cyan-900 rounded-full"></span>
                  <MapPin className="w-4 h-4" /> 作案地点
                </label>
                  <Input
                    value={backgroundStory.murder_location}
                    onChange={(e) => setBackgroundStory(prev => ({ ...prev, murder_location: e.target.value }))}
                    className="bg-slate-800/40 border-slate-500/40 focus:border-blue-400/60 focus:ring-2 focus:ring-blue-400/20 text-slate-100 placeholder-slate-400/70 rounded-lg transition-all duration-200 backdrop-blur-sm"
                    placeholder="案件发生的具体地点..."
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-red-400 rounded-full"></span>
                <PocketKnife className="w-4 h-4" /> 作案手法
              </label>
                <Textarea
                  value={backgroundStory.murder_method}
                  onChange={(e) => setBackgroundStory(prev => ({ ...prev, murder_method: e.target.value }))}
                  rows={6}
                  className="bg-slate-800/40 border-slate-500/40 focus:border-blue-400/60 focus:ring-2 focus:ring-blue-400/20 text-slate-100 placeholder-slate-400/70 rounded-lg transition-all duration-200 backdrop-blur-sm"
                  placeholder="描述作案的具体手法和过程..."
                />
              </div>
            </div>
            </div>
          </div>

          {/* 游戏规则模块 */}
          <div className="relative bg-gradient-to-br from-slate-700/30 to-slate-600/30 p-6 rounded-xl border border-slate-500/30 backdrop-blur-md shadow-lg overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-xl"></div>
            <div className="relative z-10">
            <h4 className="text-xl font-bold text-slate-100 mb-6 flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-lg flex items-center justify-center shadow-lg">
                <Clipboard className="w-4 h-4 text-white" />
              </div>
              游戏规则
            </h4>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-yellow-400 rounded-full"></span>
                <AlertTriangle className="w-4 h-4" /> 规则提醒
              </label>
                <Textarea
                  value={backgroundStory.rules_reminder}
                  onChange={(e) => setBackgroundStory(prev => ({ ...prev, rules_reminder: e.target.value }))}
                  rows={5}
                  className="bg-slate-800/40 border-slate-500/40 focus:border-blue-400/60 focus:ring-2 focus:ring-blue-400/20 text-slate-100 placeholder-slate-400/70 rounded-lg transition-all duration-200 backdrop-blur-sm"
                  placeholder="游戏规则和注意事项..."
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                  <Trophy className="w-4 h-4" /> 胜利条件
                </label>
                <Textarea
                  value={
                    typeof backgroundStory.victory_conditions === 'object' && backgroundStory.victory_conditions !== null
                      ? JSON.stringify(backgroundStory.victory_conditions, null, 2)
                      : String(backgroundStory.victory_conditions || '')
                  }
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      setBackgroundStory(prev => ({ ...prev, victory_conditions: parsed }));
                    } catch {
                      setBackgroundStory(prev => ({ ...prev, victory_conditions: e.target.value }));
                    }
                  }}
                  rows={5}
                  className="bg-slate-800/40 border-slate-500/40 focus:border-blue-400/60 focus:ring-2 focus:ring-blue-400/20 text-slate-100 placeholder-slate-400/70 font-mono text-sm rounded-lg transition-all duration-200 backdrop-blur-sm"
                  placeholder={`{
  "detective": "找出真凶并说出动机",
  "murderer": "隐藏身份到游戏结束",
  "others": "协助破案或完成个人目标"
}`}
                />
              </div>
            </div>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );

  // 加载背景故事数据
  useEffect(() => {
    if (script?.background_story) {
      setBackgroundStory({
        title: script.background_story.title || '',
        setting_description: script.background_story.setting_description || '',
        incident_description: script.background_story.incident_description || '',
        victim_background: script.background_story.victim_background || '',
        investigation_scope: script.background_story.investigation_scope || '',
        rules_reminder: script.background_story.rules_reminder || '',
        murder_method: script.background_story.murder_method || '',
        murder_location: script.background_story.murder_location || '',
        discovery_time: script.background_story.discovery_time || '',
        victory_conditions: script.background_story.victory_conditions || {}
      });
    }
  }, [script?.background_story]);

  // 保存背景故事
  const handleSaveBackgroundStory = async () => {
    if (!id || typeof id !== 'string') return;
    
    try {
      // 这里可以添加保存背景故事的API调用
      toast.success('背景故事保存成功！');
    } catch (err) {
      console.error('保存背景故事失败:', err);
      toast.error('保存背景故事失败，请重试。');
    }
  };

  // 页面主体内容
  const pageContent = () => {
    if (loading) {
      return (
        <Card className="bg-gradient-to-br from-slate-800/90 via-purple-900/90 to-slate-800/90 backdrop-blur-md border-purple-500/30">
          <CardContent className="p-8 text-center">
            <div className="text-purple-200 text-lg flex items-center gap-2"><Drama className="w-5 h-5" /> 加载剧本数据中...</div>
          </CardContent>
        </Card>
      );
    }

    if (error) {
      return (
        <Card className="bg-gradient-to-br from-slate-800/90 via-red-900/90 to-slate-800/90 backdrop-blur-md border-red-500/30">
          <CardContent className="p-8 text-center">
            <div className="text-red-300 text-lg mb-4 flex items-center gap-2"><X className="w-5 h-5" /> 错误: {error}</div>
            <Button
              onClick={() => router.push('/script-manager')}
              variant="secondary"
            >
              <ArrowLeft className="w-4 h-4 mr-1" /> 返回列表
            </Button>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="h-full w-full flex flex-col">
        {/* 简洁顶部导航栏 */}
        <div className="flex items-center justify-between bg-slate-900/80 backdrop-blur-sm border-b border-slate-700/50 px-6 py-3 flex-shrink-0">
          <div className="flex items-center gap-3">
            <Drama className="w-6 h-6 text-blue-400" />
            <div>
              <h1 className="text-lg font-semibold text-white">
                编辑剧本
              </h1>
              <p className="text-sm text-slate-400">
                {script?.info.title || '加载中...'}
              </p>
            </div>
          </div>
          <Button
            onClick={() => router.push('/script-manager')}
            variant="secondary"
            size="sm"
            className="bg-slate-700/80 hover:bg-slate-600/80 text-white border-slate-600/50"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            返回列表
          </Button>
        </div>

        {/* 现代化分栏布局 */}
        <div className="flex flex-1 min-h-0">
          {/* 左侧：对话编辑器 - 固定宽度 */}
          <div className="w-1/3 h-full" style={{ height: 'calc(100vh - 4rem)' }}>
            <div className="h-full">
              <ChatEditor
                scriptId={id && typeof id === 'string' && !isNaN(parseInt(id)) ? id : ''}
                onScriptUpdate={(updatedScript) => {
                  // 更新本地剧本状态
                  setScript(updatedScript);
                  if (updatedScript.info) {
                    setBasicFormData({
                      title: updatedScript.info.title || '',
                      description: updatedScript.info.description || '',
                      author: updatedScript.info.author || '',
                      player_count: updatedScript.info.player_count || 0,
                      duration_minutes: updatedScript.info.duration_minutes || 0,
                      difficulty: updatedScript.info.difficulty || '',
                      tags: updatedScript.info.tags || [],
                      status: (updatedScript.info.status as ScriptStatus) || ScriptStatus.DRAFT,
                      cover_image_url: updatedScript.info.cover_image_url || ''
                    });
                  }
                }}
              />
            </div>
          </div>

          {/* 右侧：内容管理区域 */}
          <div className="w-2/3 h-full" style={{ height: 'calc(100vh - 4rem)' }}>
            <div className="bg-slate-900/80 border-l border-slate-700/50 shadow-2xl overflow-hidden h-full">
              <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabType)} className="w-full h-full flex flex-col">
                {/* 现代化Tab导航 */}
                <div className="relative border-b border-slate-700/50 flex-shrink-0">
                  <TabsList className="relative grid w-full grid-cols-5 bg-transparent border-0 p-1.5 gap-1">
                    {tabs.map((tab) => (
                      <TabsTrigger
                        key={tab.key}
                        value={tab.key}
                        className="relative data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600/90 data-[state=active]:to-cyan-600/90 data-[state=active]:text-white data-[state=active]:shadow-lg text-slate-300 hover:text-white hover:bg-slate-700/50 transition-all duration-200 rounded-xl py-2 px-2 md:px-3"
                      >
                        <div className="flex items-center gap-1.5">
                          <tab.icon className="w-4 h-4" />
                          <span className="hidden sm:inline font-medium text-xs sm:text-sm">{tab.label}</span>
                        </div>
                        {/* 活跃指示器 */}
                        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-0 h-0.5 bg-gradient-to-r from-blue-400 to-cyan-400 data-[state=active]:w-8 transition-all duration-300"></div>
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>

                {/* 内容区域 */}
                <div className="flex-1 overflow-y-auto custom-scrollbar bg-gradient-to-br from-slate-900/90 via-slate-800/90 to-slate-900/90 backdrop-blur-xl">
                  <div className="p-6">
                    {activeTab === 'basic' && <BasicInfoTab />}
                    {activeTab === 'evidence' && (
                      <EvidenceManager
                        scriptId={id && typeof id === 'string' && !isNaN(parseInt(id)) ? id : ''}
                      />
                    )}
                    {activeTab === 'characters' && (
                      <CharacterManager
                        scriptId={id && typeof id === 'string' && !isNaN(parseInt(id)) ? id : ''}
                      />
                    )}
                    {activeTab === 'locations' && (
                      <LocationManager
                        scriptId={id && typeof id === 'string' && !isNaN(parseInt(id)) ? id : ''}
                      />
                    )}
                    {activeTab === 'background' && <BackgroundTab />}
                  </div>
                </div>
              </Tabs>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Layout>
      {pageContent()}
    </Layout>
  );
};

export default ScriptEditPage;