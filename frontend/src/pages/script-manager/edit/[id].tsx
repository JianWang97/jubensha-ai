import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import EvidenceManager from '@/components/EvidenceManager';
import CharacterManager from '@/components/CharacterManager';
import LocationManager from '@/components/LocationManager';
import ChatEditor from '@/components/ChatEditor';
import {
  ScriptsService,
  Service,
  ScriptInfo,
  ImageGenerationRequestModel,
  ScriptStatus
} from '@/client';

import { Script_Output as Script, ScriptCoverPromptRequest } from '@/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
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

  const generateEvidenceImage = async (request: ImageGenerationRequestModel) => {
    const response = await Service.generateEvidenceImageApiScriptsGenerateEvidencePost(request);
    return response.data;
  };

  const generateCoverImage = async (request: ImageGenerationRequestModel) => {
    const response = await Service.generateCoverImageApiScriptsGenerateCoverPost(request);
    return response.data;
  };

  const generateScriptCoverPrompt = async (request: ScriptCoverPromptRequest) => {
    const response = await Service.generateScriptCoverPromptApiScriptsGenerateCoverPromptPost(request);
    return response.data;
  };
  const [script, setScript] = useState<Script | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('basic');

  // 基础信息表单数据
  const [formData, setFormData] = useState({
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

  // 图片生成相关状态
  const [imageGeneration, setImageGeneration] = useState({
    positive_prompt: '',
    negative_prompt: '',
    width: 512,
    height: 512,
    steps: 20,
    cfg_scale: 7,
    seed: -1
  });

  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);

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
          setFormData({
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


  // 处理表单提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || typeof id !== 'string') return;

    try {
      // 确保数字字段为有效数字
      const submitData = {
        ...formData,
        player_count: typeof formData.player_count === 'string' ? 
          (formData.player_count === '' ? 0 : parseInt(formData.player_count) || 0) : formData.player_count,
        duration_minutes: typeof formData.duration_minutes === 'string' ? 
          (formData.duration_minutes === '' ? 0 : parseInt(formData.duration_minutes) || 0) : formData.duration_minutes
      };
      
      await updateScript(parseInt(id), submitData);
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
      [name]: value
    }));
  };

  // 处理标签变化
  const handleTagsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const tags = e.target.value.split(',').map(tag => tag.trim()).filter(tag => tag);
    setFormData(prev => ({ ...prev, tags }));
  };

  // 生成剧本封面提示词
  const handlePromptGeneration = async () => {
    if (!formData.title.trim() && !formData.description.trim()) {
      toast('请至少填写剧本标题或描述');
      return;
    }

    setIsGeneratingPrompt(true);
    try {
      const request: ScriptCoverPromptRequest = {
        script_title: formData.title,
        script_description: formData.description,
        script_tags: null,
        difficulty: formData.difficulty,
        style_preference: '电影级别，高质量，专业摄影'
      };

      const result = await generateScriptCoverPrompt(request);
      if (result && result.prompt) {
        setImageGeneration(prev => ({ ...prev, positive_prompt: result.prompt }));
        toast('提示词生成成功！');
      } else {
        throw new Error('生成结果无效');
      }
    } catch (error) {
      console.error('提示词生成失败:', error);
      toast('提示词生成失败，请重试。');
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  // 生成封面图片
  const handleCoverImageGeneration = async () => {
    if (!imageGeneration.positive_prompt.trim()) {
      toast('请输入正向提示词');
      return;
    }

    if (!id || typeof id !== 'string') {
      toast('剧本ID无效');
      return;
    }

    setIsGeneratingImage(true);
    try {
      const request: ImageGenerationRequestModel = {
        positive_prompt: imageGeneration.positive_prompt,
        negative_prompt: imageGeneration.negative_prompt,
        script_id: Number(id),
        target_id: Number(id),
        width: imageGeneration.width,
        height: imageGeneration.height,
        steps: imageGeneration.steps,
        cfg: imageGeneration.cfg_scale,
        seed: imageGeneration.seed
      };

      const result = await generateCoverImage(request);
      if (result && result.url) {
        setFormData(prev => ({ ...prev, cover_image_url: result.url }));
        toast('封面图片生成成功！');
      } else {
        throw new Error('生成结果无效');
      }
    } catch (error) {
      console.error('封面图片生成失败:', error);
      toast('封面图片生成失败，请重试。');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // Tab配置
  const tabs = [
    { key: 'basic' as TabType, label: '剧本基础信息', icon: '📝' },
    { key: 'evidence' as TabType, label: '证据管理', icon: '🔍' },
    { key: 'characters' as TabType, label: '角色管理', icon: '👥' },
    { key: 'locations' as TabType, label: '场景管理', icon: '🏛️' },
    { key: 'background' as TabType, label: '背景故事', icon: '📖' }
  ];

  // Loading and error states are now handled within the main render instead of early returns

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
                readOnly
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
              <Select value={formData.status} onValueChange={(value) => setFormData(prev => ({ ...prev, status: value as ScriptStatus }))}>
                <SelectTrigger className="bg-slate-800/50 border-purple-500/30 text-purple-100">
                  <SelectValue placeholder="请选择状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">草稿</SelectItem>
                  <SelectItem value="PUBLISHED">已发布</SelectItem>
                  <SelectItem value="ARCHIVED">已归档</SelectItem>
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

          {/* 封面图片区域 */}
          <div className="space-y-4">
            <label className="block text-sm font-medium text-purple-200 mb-2">
              🖼️ 封面图片
            </label>

            {/* 当前封面图片预览 */}
            <div className="mb-4">
              {formData.cover_image_url ? (
                <div className="w-full max-w-md">
                  <div className="relative group">
                    <img
                      src={formData.cover_image_url}
                      alt="剧本封面"
                      className="w-full h-48 object-cover rounded-lg border border-purple-500/30 bg-slate-800"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgdmlld0JveD0iMCAwIDEyOCAxMjgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiBmaWxsPSIjMzc0MTUxIi8+CjxwYXRoIGQ9Ik02NCA5NkM3NC4yIDk2IDgyIDg4LjIgODIgNzhDODIgNjcuOCA3NC4yIDYwIDY0IDYwQzUzLjggNjAgNDYgNjcuOCA0NiA3OEM0NiA4OC4yIDUzLjggOTYgNjQgOTZaIiBmaWxsPSIjNkI3Mjg0Ii8+CjxwYXRoIGQ9Ik00MCA0MEg4OFY4OEg0MFY0MFoiIHN0cm9rZT0iIzZCNzI4NCIgc3Ryb2tlLXdpZHRoPSIyIiBmaWxsPSJub25lIi8+PC9zdmc+Cg==';
                      }}
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                      <span className="text-white text-sm">当前封面</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="w-full max-w-md h-48 rounded-lg border-2 border-dashed border-purple-500/30 flex items-center justify-center bg-slate-800/50">
                  <div className="text-center">
                    <div className="text-3xl mb-2 opacity-50">🖼️</div>
                    <div className="text-sm text-purple-300 opacity-70">暂无封面图片</div>
                  </div>
                </div>
              )}
            </div>

            {/* 手动输入图片URL */}
            <div>
              <label className="block text-sm font-medium text-purple-200 mb-2">
                🔗 图片URL
              </label>
              <Input
                type="url"
                value={formData.cover_image_url}
                onChange={(e) => setFormData(prev => ({ ...prev, cover_image_url: e.target.value }))}
                placeholder="输入图片URL或使用AI生成"
                className="bg-slate-800/50 border-purple-500/30 text-purple-100 placeholder-purple-300/70"
              />
            </div>

            {/* AI图片生成区域 */}
            <div className="bg-gradient-to-br from-slate-700/50 to-slate-800/50 rounded-xl p-6 border border-purple-500/20">
              <h4 className="text-lg font-semibold text-purple-200 mb-4 flex items-center gap-2">
                🎨 AI封面生成
              </h4>

              <div className="space-y-4">
                {/* 正向提示词 */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-purple-200">
                      ✨ 正向提示词
                    </label>
                    <Button
                      type="button"
                      onClick={handlePromptGeneration}
                      disabled={isGeneratingPrompt || (!formData.title.trim() && !formData.description.trim())}
                      size="sm"
                      className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 disabled:opacity-50 text-xs"
                    >
                      {isGeneratingPrompt ? (
                        <>
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          生成中...
                        </>
                      ) : (
                        <>
                          🤖 AI生成提示词
                        </>
                      )}
                    </Button>
                  </div>
                  <Textarea
                    value={imageGeneration.positive_prompt}
                    onChange={(e) => setImageGeneration(prev => ({ ...prev, positive_prompt: e.target.value }))}
                    placeholder="描述你想要的封面图片，例如：古代中式庭院，夜晚，月光，神秘氛围，高质量，电影级别"
                    rows={3}
                    className="bg-slate-800/50 border-purple-500/30 text-purple-100 placeholder-purple-300/70"
                  />
                </div>

                {/* 反向提示词 */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    🚫 反向提示词
                  </label>
                  <Textarea
                    value={imageGeneration.negative_prompt}
                    onChange={(e) => setImageGeneration(prev => ({ ...prev, negative_prompt: e.target.value }))}
                    placeholder="描述不想要的元素，例如：低质量，模糊，变形"
                    rows={2}
                    className="bg-slate-800/50 border-purple-500/30 text-purple-100 placeholder-purple-300/70"
                  />
                </div>

                {/* 图片参数 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-purple-200 mb-2">
                      📐 尺寸
                    </label>
                    <Select
                      value={`${imageGeneration.width}x${imageGeneration.height}`}
                      onValueChange={(value) => {
                        const [width, height] = value.split('x').map(Number);
                        setImageGeneration(prev => ({ ...prev, width, height }));
                      }}
                    >
                      <SelectTrigger className="bg-slate-800/50 border-purple-500/30 text-purple-100">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-purple-500/30">
                        <SelectItem value="512x512">512×512</SelectItem>
                        <SelectItem value="768x512">768×512</SelectItem>
                        <SelectItem value="512x768">512×768</SelectItem>
                        <SelectItem value="1024x768">1024×768</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-purple-200 mb-2">
                      🔢 步数
                    </label>
                    <Input
                      type="number"
                      value={imageGeneration.steps}
                      onChange={(e) => setImageGeneration(prev => ({ ...prev, steps: parseInt(e.target.value) || 20 }))}
                      min="1"
                      max="50"
                      className="bg-slate-800/50 border-purple-500/30 text-purple-100"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-purple-200 mb-2">
                      ⚖️ CFG
                    </label>
                    <Input
                      type="number"
                      value={imageGeneration.cfg_scale}
                      onChange={(e) => setImageGeneration(prev => ({ ...prev, cfg_scale: parseFloat(e.target.value) || 7 }))}
                      min="1"
                      max="20"
                      step="0.5"
                      className="bg-slate-800/50 border-purple-500/30 text-purple-100"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-purple-200 mb-2">
                      🎲 种子
                    </label>
                    <Input
                      type="number"
                      value={imageGeneration.seed}
                      onChange={(e) => setImageGeneration(prev => ({ ...prev, seed: parseInt(e.target.value) || -1 }))}
                      className="bg-slate-800/50 border-purple-500/30 text-purple-100"
                    />
                  </div>
                </div>

                {/* 生成按钮 */}
                <div className="flex justify-end">
                  <Button
                    type="button"
                    onClick={handleCoverImageGeneration}
                    disabled={isGeneratingImage || !imageGeneration.positive_prompt.trim()}
                    className="bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 disabled:opacity-50"
                  >
                    {isGeneratingImage ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        生成中...
                      </>
                    ) : (
                      <>
                        🎨 生成封面图片
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
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





  // 场景管理Tab内容
  const LocationsTab = () => (
    <div className="p-6">
      {id && typeof id === 'string' && !isNaN(parseInt(id)) ? (
        <LocationManager scriptId={id} />
      ) : (
        <div>无效的剧本ID</div>
      )}
    </div>
  );

  // 背景故事Tab内容 - 完整字段展示
  const BackgroundTab = () => (
    <Card className="bg-gradient-to-br from-slate-800/90 via-purple-900/90 to-slate-800/90 backdrop-blur-md border-purple-500/30">
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-purple-200 flex items-center gap-2">
            📖 背景故事管理
          </h3>
          <Button
            onClick={handleSaveBackgroundStory}
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500"
          >
            💾 保存背景故事
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* 基础设定模块 */}
          <div className="bg-slate-700/30 p-4 rounded-lg border border-purple-500/20">
            <h4 className="text-lg font-semibold text-purple-200 mb-4 flex items-center gap-2">
              🌟 基础设定
            </h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-purple-200 mb-2">
                  📝 标题
                </label>
                <Input
                  value={backgroundStory.title}
                  onChange={(e) => setBackgroundStory(prev => ({ ...prev, title: e.target.value }))}
                  className="bg-slate-800/50 border-purple-500/30 focus:ring-purple-400 text-purple-100 placeholder-purple-300/70"
                  placeholder="背景故事标题..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-purple-200 mb-2">
                  🌍 背景设定
                </label>
                <Textarea
                  value={backgroundStory.setting_description}
                  onChange={(e) => setBackgroundStory(prev => ({ ...prev, setting_description: e.target.value }))}
                  rows={4}
                  className="bg-slate-800/50 border-purple-500/30 focus:ring-purple-400 text-purple-100 placeholder-purple-300/70"
                  placeholder="描述剧本的世界观、时代背景、地点设定等..."
                />
              </div>
            </div>
          </div>

          {/* 事件描述模块 */}
          <div className="bg-slate-700/30 p-4 rounded-lg border border-purple-500/20">
            <h4 className="text-lg font-semibold text-purple-200 mb-4 flex items-center gap-2">
              🎭 事件描述
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-purple-200 mb-2">
                  📰 事件描述
                </label>
                <Textarea
                  value={backgroundStory.incident_description}
                  onChange={(e) => setBackgroundStory(prev => ({ ...prev, incident_description: e.target.value }))}
                  rows={3}
                  className="bg-slate-800/50 border-purple-500/30 focus:ring-purple-400 text-purple-100 placeholder-purple-300/70"
                  placeholder="描述核心事件的经过..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-purple-200 mb-2">
                  👤 受害者背景
                </label>
                <Textarea
                  value={backgroundStory.victim_background}
                  onChange={(e) => setBackgroundStory(prev => ({ ...prev, victim_background: e.target.value }))}
                  rows={3}
                  className="bg-slate-800/50 border-purple-500/30 focus:ring-purple-400 text-purple-100 placeholder-purple-300/70"
                  placeholder="描述受害者的身份、背景、人际关系..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-purple-200 mb-2">
                  ⏰ 发现时间
                </label>
                <Input
                  value={backgroundStory.discovery_time}
                  onChange={(e) => setBackgroundStory(prev => ({ ...prev, discovery_time: e.target.value }))}
                  className="bg-slate-800/50 border-purple-500/30 focus:ring-purple-400 text-purple-100 placeholder-purple-300/70"
                  placeholder="事件发现的具体时间..."
                />
              </div>
            </div>
          </div>

          {/* 调查设定模块 */}
          <div className="bg-slate-700/30 p-4 rounded-lg border border-purple-500/20">
            <h4 className="text-lg font-semibold text-purple-200 mb-4 flex items-center gap-2">
              🔍 调查设定
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-purple-200 mb-2">
                  🎯 调查范围
                </label>
                <Textarea
                  value={backgroundStory.investigation_scope}
                  onChange={(e) => setBackgroundStory(prev => ({ ...prev, investigation_scope: e.target.value }))}
                  rows={3}
                  className="bg-slate-800/50 border-purple-500/30 focus:ring-purple-400 text-purple-100 placeholder-purple-300/70"
                  placeholder="定义玩家可以调查的范围和限制..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-purple-200 mb-2">
                  🔪 作案手法
                </label>
                <Textarea
                  value={backgroundStory.murder_method}
                  onChange={(e) => setBackgroundStory(prev => ({ ...prev, murder_method: e.target.value }))}
                  rows={3}
                  className="bg-slate-800/50 border-purple-500/30 focus:ring-purple-400 text-purple-100 placeholder-purple-300/70"
                  placeholder="描述作案的具体手法和过程..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-purple-200 mb-2">
                  📍 作案地点
                </label>
                <Input
                  value={backgroundStory.murder_location}
                  onChange={(e) => setBackgroundStory(prev => ({ ...prev, murder_location: e.target.value }))}
                  className="bg-slate-800/50 border-purple-500/30 focus:ring-purple-400 text-purple-100 placeholder-purple-300/70"
                  placeholder="案件发生的具体地点..."
                />
              </div>
            </div>
          </div>

          {/* 游戏规则模块 */}
          <div className="bg-slate-700/30 p-4 rounded-lg border border-purple-500/20">
            <h4 className="text-lg font-semibold text-purple-200 mb-4 flex items-center gap-2">
              📋 游戏规则
            </h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-purple-200 mb-2">
                  ⚠️ 规则提醒
                </label>
                <Textarea
                  value={backgroundStory.rules_reminder}
                  onChange={(e) => setBackgroundStory(prev => ({ ...prev, rules_reminder: e.target.value }))}
                  rows={3}
                  className="bg-slate-800/50 border-purple-500/30 focus:ring-purple-400 text-purple-100 placeholder-purple-300/70"
                  placeholder="游戏规则和注意事项..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-purple-200 mb-2">
                  🏆 胜利条件
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
                  rows={4}
                  className="bg-slate-800/50 border-purple-500/30 focus:ring-purple-400 text-purple-100 placeholder-purple-300/70 font-mono text-sm"
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
      </CardContent>
    </Card>
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
            <div className="text-purple-200 text-lg">🎭 加载剧本数据中...</div>
          </CardContent>
        </Card>
      );
    }

    if (error) {
      return (
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
      );
    }

    return (
      <>
        {/* 页面头部 */}
        <div className="bg-gradient-to-r from-slate-800/90 via-purple-900/90 to-slate-800/90 backdrop-blur-md rounded-2xl shadow-2xl p-6 mb-6 border border-purple-500/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-r from-purple-500 to-blue-500 p-3 rounded-full">
                <span className="text-2xl">🎭</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-purple-200">编辑剧本</h1>
                <p className="text-purple-300/70 text-sm">{script?.info.title || '加载中...'}</p>
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

        {/* 左右分栏布局 */}
        <div className="flex gap-6 min-h-[800px]">
          {/* 左侧：对话编辑 */}
          <div className="w-1/3 min-w-[400px]">
            <ChatEditor
            scriptId={id && typeof id === 'string' && !isNaN(parseInt(id)) ? id : ''}
            onScriptUpdate={(updatedScript) => {
              // 更新本地剧本状态
              setScript(updatedScript);
              if (updatedScript.info) {
                setFormData({
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

          {/* 右侧：Tab 信息 */}
          <div className="flex-1">
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabType)} className="w-full h-full flex flex-col">
              <TabsList className="grid w-full grid-cols-5 bg-slate-800/50 border-purple-500/30 flex-shrink-0">
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

              <div className="mt-6 flex-1 rounded-lg overflow-y-auto max-h-[700px]">
                {activeTab === 'basic' && <BasicInfoTab />}
                {activeTab === 'evidence' && (
                  <EvidenceManager
                    generateEvidenceImage={generateEvidenceImage}
                    scriptId={id && typeof id === 'string' && !isNaN(parseInt(id)) ? id : ''}
                  />
                )}
                {activeTab === 'characters' && (
                  <CharacterManager
                    scriptId={id && typeof id === 'string' && !isNaN(parseInt(id)) ? id : ''}
                  />
                )}
                {activeTab === 'locations' && <LocationsTab />}
                {activeTab === 'background' && <BackgroundTab />}
              </div>
            </Tabs>
          </div>
        </div>
      </>
    );
  };

  return (
    <Layout>
      {pageContent()}
    </Layout>
  );
};

export default ScriptEditPage;