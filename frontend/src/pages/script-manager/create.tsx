import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { Sparkles, Image, PenTool, ArrowRight, Lightbulb, Users, Clock, BookOpen, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import AppLayout from '@/components/AppLayout';
import AuthGuard from '@/components/AuthGuard';
import scriptService, { GeneratedScriptInfo, CreateScriptRequest, CreatedScript } from '@/services/scriptService';
import { toast } from 'sonner';

interface InspirationOption {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

const inspirationOptions: InspirationOption[] = [
  {
    id: 'random-theme',
    title: '随机主题生成',
    description: '让AI为你生成一个独特的剧本主题，激发创作灵感',
    icon: <Sparkles className="w-8 h-8" />,
    color: 'from-purple-500 to-pink-500'
  },
  {
    id: 'image-inspiration',
    title: '图片灵感',
    description: '从一张图片开始，构建你的故事世界',
    icon: <Image className="w-8 h-8" />,
    color: 'from-blue-500 to-cyan-500'
  },
  {
    id: 'one-sentence',
    title: '一句话开始',
    description: '输入一句话，让AI帮你扩展成完整的剧本',
    icon: <PenTool className="w-8 h-8" />,
    color: 'from-green-500 to-emerald-500'
  }
];

const scriptTypes = [
  { value: 'mystery', label: '推理悬疑' },
  { value: 'emotional', label: '情感治愈' },
  { value: 'horror', label: '恐怖惊悚' },
  { value: 'comedy', label: '欢乐聚会' },
  { value: 'historical', label: '古风历史' },
  { value: 'modern', label: '现代都市' }
];

const playerCounts = [
  { value: '4', label: '4人' },
  { value: '5', label: '5人' },
  { value: '6', label: '6人' },
  { value: '7', label: '7人' },
  { value: '8', label: '8人' },
  { value: '9+', label: '9人以上' }
];

export default function CreateScript() {
  const router = useRouter();
  const [step, setStep] = useState<'inspiration' | 'details'>('inspiration');
  const [selectedInspiration, setSelectedInspiration] = useState<string>('');
  const [inspirationInput, setInspirationInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedTheme, setGeneratedTheme] = useState('');
  const [isGeneratingInfo, setIsGeneratingInfo] = useState(false);
  const [generatedInfo, setGeneratedInfo] = useState<GeneratedScriptInfo | null>(null);
  
  // 基础信息表单
  const [formData, setFormData] = useState({
    title: '',
    type: '',
    playerCount: '',
    description: ''
  });

  const handleInspirationSelect = (inspirationId: string) => {
    setSelectedInspiration(inspirationId);
    
    if (inspirationId === 'random-theme') {
      generateRandomTheme();
    }
  };

  const generateRandomTheme = async () => {
    setIsGenerating(true);
    // 模拟AI生成主题
    const themes = [
      '神秘的古堡中发生了一起离奇的失踪案，每个人都有不可告人的秘密',
      '一场暴雨夜，几个陌生人被困在偏僻的山庄里，死神悄然降临',
      '校园里流传着诡异的都市传说，而真相比传说更加可怕',
      '豪华游轮上的假面舞会，面具下隐藏着复仇的怒火',
      '时光倒流的咖啡馆，每个顾客都在寻找失去的记忆'
    ];
    
    setTimeout(() => {
      const randomTheme = themes[Math.floor(Math.random() * themes.length)];
      setGeneratedTheme(randomTheme);
      setIsGenerating(false);
    }, 2000);
  };

  const generateScriptInfo = async () => {
    if (!generatedTheme && !inspirationInput) {
      toast.error('请先选择一个灵感主题');
      return;
    }

    setIsGeneratingInfo(true);
    try {
      const theme = generatedTheme || inspirationInput;
      const response = await scriptService.generateScriptInfo({
        theme,
        script_type: formData.type || undefined,
        player_count: formData.playerCount || undefined
      });
      
      setGeneratedInfo(response);
      // 自动填充表单
      setFormData({
        title: response.title,
        type: response.suggested_type,
        playerCount: response.suggested_player_count,
        description: response.description
      });
      
      toast.success('AI已为您生成剧本基础信息！');
    } catch (error) {
      console.error('生成剧本信息失败:', error);
      toast.error('生成失败，请稍后重试');
    } finally {
      setIsGeneratingInfo(false);
    }
  };

  const handleNextStep = () => {
    if (selectedInspiration) {
      setStep('details');
    }
  };

  const handleCreateScript = async () => {
    try {
      // 准备创建剧本的数据
      const scriptData = {
        title: formData.title,
        description: formData.description,
        player_count: parseInt(formData.playerCount),
        estimated_duration: 180, // 默认3小时
        difficulty_level: 'medium', // 默认中等难度
        category: formData.type || '推理', // 使用表单中的类型作为分类
        tags: [], // 默认空标签
        // 自定义字段用于存储灵感信息
        inspiration_type: selectedInspiration,
        inspiration_content: selectedInspiration === 'random-theme' ? generatedTheme : inspirationInput,
        background_story: generatedInfo?.background || ''
      };
      
      console.log('Creating script with data:', scriptData);
      
      // 调用API创建剧本
      const response = await scriptService.createScript(scriptData);
      
      if (response && response.id) {
        // 创建成功，跳转到编辑页面，传递剧本ID
        router.push(`/script-manager/edit/${response.id}`);
      } else {
        // 如果没有返回ID，跳转到新建编辑页面
        router.push('/script-manager/edit/new');
      }
    } catch (error) {
      console.error('创建剧本失败:', error);
      // 即使创建失败，也跳转到编辑页面，让用户可以继续编辑
      router.push('/script-manager/edit/new');
    }
  };

  const renderInspirationStep = () => (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full mb-4">
          <Lightbulb className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">开始你的创作之旅</h1>
        <p className="text-slate-400 text-lg">选择一个灵感启发方式，让创意自由流淌</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-8">
        {inspirationOptions.map((option) => (
          <Card 
            key={option.id}
            className={`cursor-pointer transition-all duration-300 hover:scale-105 border-2 ${
              selectedInspiration === option.id 
                ? 'border-purple-500 bg-slate-800/80' 
                : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
            }`}
            onClick={() => handleInspirationSelect(option.id)}
          >
            <CardHeader className="text-center pb-4">
              <div className={`inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r ${option.color} rounded-full mx-auto mb-4`}>
                <div className="text-white">{option.icon}</div>
              </div>
              <CardTitle className="text-white text-xl">{option.title}</CardTitle>
              <CardDescription className="text-slate-400">
                {option.description}
              </CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      {/* 根据选择的灵感类型显示不同的输入界面 */}
      {selectedInspiration === 'random-theme' && (
        <Card className="bg-slate-800/80 border-slate-700 mb-6">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-400" />
              AI生成的主题
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isGenerating ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                <span className="ml-3 text-slate-400">正在生成创意主题...</span>
              </div>
            ) : generatedTheme ? (
              <div className="bg-slate-900/50 rounded-lg p-4">
                <p className="text-white text-lg leading-relaxed">{generatedTheme}</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-3"
                  onClick={generateRandomTheme}
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  重新生成
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {selectedInspiration === 'one-sentence' && (
        <Card className="bg-slate-800/80 border-slate-700 mb-6">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <PenTool className="w-5 h-5 text-green-400" />
              输入你的创意起点
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="例如：一个雨夜，图书馆里发生了奇怪的事情..."
              value={inspirationInput}
              onChange={(e) => setInspirationInput(e.target.value)}
              className="bg-slate-900/50 border-slate-600 text-white min-h-[100px]"
            />
          </CardContent>
        </Card>
      )}

      {selectedInspiration === 'image-inspiration' && (
        <Card className="bg-slate-800/80 border-slate-700 mb-6">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Image className="w-5 h-5 text-blue-400" />
              上传灵感图片
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center hover:border-slate-500 transition-colors">
              <Image className="w-12 h-12 text-slate-500 mx-auto mb-4" />
              <p className="text-slate-400 mb-2">点击上传图片或拖拽到此处</p>
              <p className="text-slate-500 text-sm">支持 JPG、PNG 格式</p>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedInspiration && (
        <div className="flex justify-center">
          <Button 
            onClick={handleNextStep}
            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-8 py-3 text-lg"
            disabled={selectedInspiration === 'one-sentence' && !inspirationInput.trim()}
          >
            下一步：填写基础信息
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      )}
    </div>
  );

  const renderDetailsStep = () => (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full mb-4">
          <BookOpen className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">完善剧本信息</h1>
        <p className="text-slate-400 text-lg">填写一些基础信息，让你的剧本更加完整</p>
      </div>

      {/* AI生成基础信息按钮 */}
      <Card className="bg-slate-800/80 border-slate-700 mb-6">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-purple-400" />
            AI智能生成
          </CardTitle>
          <CardDescription className="text-slate-400">
            基于您选择的主题，让AI为您生成完整的剧本基础信息
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={generateScriptInfo}
            disabled={isGeneratingInfo || (!generatedTheme && !inspirationInput)}
            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
          >
            {isGeneratingInfo ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                AI正在生成中...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4 mr-2" />
                生成剧本基础信息
              </>
            )}
          </Button>
          
          {generatedInfo && (
            <div className="mt-4 p-4 bg-slate-900/50 rounded-lg">
              <h4 className="text-white font-medium mb-2">AI生成的背景故事：</h4>
              <p className="text-slate-300 text-sm leading-relaxed">{generatedInfo.background}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-slate-800/80 border-slate-700">
        <CardContent className="p-6 space-y-6">
          <div>
            <label className="block text-white font-medium mb-2">剧本标题 *</label>
            <Input
              placeholder="给你的剧本起个吸引人的名字"
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
              className="bg-slate-900/50 border-slate-600 text-white"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-white font-medium mb-2">剧本类型 *</label>
              <Select value={formData.type} onValueChange={(value) => setFormData({...formData, type: value})}>
                <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white">
                  <SelectValue placeholder="选择剧本类型" />
                </SelectTrigger>
                <SelectContent>
                  {scriptTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-white font-medium mb-2">玩家人数 *</label>
              <Select value={formData.playerCount} onValueChange={(value) => setFormData({...formData, playerCount: value})}>
                <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white">
                  <SelectValue placeholder="选择人数" />
                </SelectTrigger>
                <SelectContent>
                  {playerCounts.map((count) => (
                    <SelectItem key={count.value} value={count.value}>
                      {count.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="block text-white font-medium mb-2">剧本简介</label>
            <Textarea
              placeholder="简单描述一下你的剧本故事背景和特色..."
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              className="bg-slate-900/50 border-slate-600 text-white min-h-[120px]"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between mt-8">
        <Button 
          variant="outline" 
          onClick={() => setStep('inspiration')}
          className="border-slate-600 text-slate-300 hover:text-white"
        >
          上一步
        </Button>
        <Button 
          onClick={handleCreateScript}
          className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-8"
          disabled={!formData.title || !formData.type || !formData.playerCount}
        >
          开始创作
          <ArrowRight className="w-5 h-5 ml-2" />
        </Button>
      </div>
    </div>
  );

  return (
    <AuthGuard>
      <AppLayout title="创建新剧本">
        <div className="min-h-screen bg-slate-900 py-8 px-4">
          {step === 'inspiration' ? renderInspirationStep() : renderDetailsStep()}
        </div>
      </AppLayout>
    </AuthGuard>
  );
}