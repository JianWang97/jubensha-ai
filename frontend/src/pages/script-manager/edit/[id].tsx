import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import EvidenceManager from '@/components/EvidenceManager';
import CharacterManager from '@/components/CharacterManager';
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
    player_count: 0,
    duration_minutes: 0,
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
        setLoading(true);
        setError(null);
        try {
          const scriptData = await getScriptWithDetail(parseInt(id));
          if(!scriptData){
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
    }
  }, [id]);


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
        
        <div className="mt-6">
          {activeTab === 'basic' && <BasicInfoTab />}
          {activeTab === 'evidence' && (
            <EvidenceManager 
              generateEvidenceImage={generateEvidenceImage}
              scriptId={id as string}
            />
          )}
          {activeTab === 'characters' && (
            <CharacterManager 
              scriptId={id as string}
            />
          )}
          {activeTab === 'locations' && <LocationsTab />}
          {activeTab === 'background' && <BackgroundTab />}
        </div>
      </Tabs>
    </Layout>
  );
};

export default ScriptEditPage;