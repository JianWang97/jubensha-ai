import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { ScriptsService, ScriptInfo } from '@/client';
import AppLayout from '@/components/AppLayout';
import { Play, Users, Clock, Star, Sparkles, ArrowRight, GamepadIcon, TrendingUp, Library } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// 剧本数据接口
interface ScriptDisplay {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  players: string;
  duration: string;
  rating?: number;
  playCount?: number;
}

// 将后端数据转换为显示格式
const convertScriptInfo = (scriptInfo: ScriptInfo): ScriptDisplay => {
  const duration = scriptInfo.duration_minutes || 0;
  const difficulty = scriptInfo.difficulty || '未知';
  
  return {
    id: scriptInfo.id?.toString() || '0',
    title: scriptInfo.title || '未命名剧本',
    description: scriptInfo.description || '暂无描述',
    difficulty,
    players: `AI 自主演绎`,
    duration: `${Math.floor(duration / 60)}小时${duration % 60 > 0 ? `${duration % 60}分钟` : ''}`,
    rating: Number(scriptInfo.rating) || 4.0,
    playCount: scriptInfo.play_count || 0
  };
};

// 英雄区域组件
const HeroSection = () => {
  return (
    <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden">
      {/* 动态背景 */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-blue-900/20 to-indigo-900/20">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-blue-500/5"></div>
        </div>
        {/* 浮动装饰元素 */}
        <div className="absolute top-20 left-10 w-20 h-20 bg-purple-500/10 rounded-full blur-xl animate-pulse"></div>
        <div className="absolute top-40 right-20 w-32 h-32 bg-blue-500/10 rounded-full blur-xl animate-pulse delay-1000"></div>
        <div className="absolute bottom-20 left-1/4 w-16 h-16 bg-indigo-500/10 rounded-full blur-xl animate-pulse delay-2000"></div>
      </div>
      
      {/* 主要内容 */}
      <div className="relative z-10 text-center max-w-4xl mx-auto px-4">
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/20 rounded-full border border-purple-500/30 mb-6">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span className="text-sm text-purple-300">AI 驱动的沉浸式体验</span>
          </div>
        </div>
        
        <h1 className="text-6xl md:text-8xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 animate-pulse">
          AI 剧本杀
        </h1>
        
        <p className="text-xl md:text-2xl text-gray-300 mb-8 leading-relaxed">
          进入 AI 驱动的推理世界，每个选择都影响剧情走向
          <br className="hidden md:block" />
          与智能角色互动，解开层层谜团，体验前所未有的沉浸感
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
          <Link href="/script-center">
            <Button size="lg" className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-8 py-4 text-lg font-semibold rounded-xl shadow-lg shadow-purple-500/25 transform hover:scale-105 transition-all duration-300">
              <Library className="w-5 h-5 mr-2" />
              立即开始游戏
            </Button>
          </Link>
        </div>
        
        {/* 统计数据 */}
        <div className="grid grid-cols-3 gap-8 max-w-md mx-auto">
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-400">10K+</div>
            <div className="text-sm text-gray-400">AI 角色</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-400">50+</div>
            <div className="text-sm text-gray-400">精品剧本</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-pink-400">4.9</div>
            <div className="text-sm text-gray-400">用户评分</div>
          </div>
        </div>
      </div>
    </section>
  );
};

// 特色功能组件
const FeaturesSection = () => {
  const features = [
    {
      icon: <Sparkles className="w-8 h-8" />,
      title: "AI 智能角色",
      description: "与具有独特性格的AI角色互动，每次游戏都有不同的体验",
      color: "from-purple-500 to-pink-500"
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: "全自动演绎",
      description: "无需真人参与，AI 角色自行推动剧情发展",
      color: "from-blue-500 to-cyan-500"
    },
    {
      icon: <TrendingUp className="w-8 h-8" />,
      title: "动态剧情",
      description: "基于AI推理的动态剧情发展，每次游戏都是独特的故事",
      color: "from-green-500 to-emerald-500"
    }
  ];

  return (
    <section className="py-20 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-white mb-4">为什么选择我们</h2>
-           <p className="text-xl text-gray-400">体验下一代剧本杀游戏的魅力</p>
+           <p className="text-xl text-gray-400">体验下一代由AI驱动的剧本杀</p>
          </div>
        
        <div className="grid md:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card key={index} className="bg-gray-800/50 border-gray-700 hover:border-purple-500/50 transition-all duration-300 group">
              <CardHeader>
                <div className={`w-16 h-16 rounded-xl bg-gradient-to-r ${feature.color} p-4 mb-4 group-hover:scale-110 transition-transform duration-300`}>
                  <div className="text-white">{feature.icon}</div>
                </div>
                <CardTitle className="text-white text-xl">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-gray-400 text-base leading-relaxed">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default function HomePage() {
  const router = useRouter();
  const [scriptId, setScriptId] = useState('1');
  const [scripts, setScripts] = useState<ScriptDisplay[]>([]);
  const [selectedScript, setSelectedScript] = useState<ScriptDisplay | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 检查是否已访问过首页，如果是则重定向到剧本库
  useEffect(() => {
    const hasVisitedHome = localStorage.getItem('hasVisitedHome');
    if (hasVisitedHome === 'true') {
      router.replace('/script-center');
      return;
    }
    // 标记已访问过首页
    localStorage.setItem('hasVisitedHome', 'true');
  }, [router]);

  // 获取剧本列表
  const fetchScripts = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await ScriptsService.getScriptsApiScriptsGet();
      
      if (response && response.items) {
        const convertedScripts = response.items.map(convertScriptInfo);
        setScripts(convertedScripts);
        
        // 设置默认选中的剧本
        const defaultScript = convertedScripts.find(s => s.id === scriptId) || convertedScripts[0];
        if (defaultScript) {
          setSelectedScript(defaultScript);
        }
      } else {
        setError('获取剧本列表失败');
      }
    } catch (err) {
      console.error('获取剧本列表失败:', err);
      setError('获取剧本列表失败，请检查网络连接');
    } finally {
      setLoading(false);
    }
  };

  // // 组件挂载时获取剧本列表
  // useEffect(() => {
  //   fetchScripts();
  // }, []);

  // // 当scriptId改变时更新selectedScript
  // useEffect(() => {
  //   if (scripts.length > 0) {
  //     const script = scripts.find(s => s.id === scriptId) || scripts[0];
  //     setSelectedScript(script);
  //   }
  // }, [scriptId, scripts]);

  const gameUrl = `/game?script_id=${scriptId}`;

  return (
    <AppLayout showSidebar={false}>
      <div className="min-h-screen">
        {/* 英雄区域 */}
        <HeroSection />
        
        {/* 特色功能 */}
        <FeaturesSection />
      
        
        {/* 页脚 */}
        <footer className="py-12 px-4 bg-gray-900/50 border-t border-gray-800">
          <div className="max-w-6xl mx-auto text-center">
            <div className="mb-6">
              <h3 className="text-2xl font-bold text-white mb-2">AI 剧本杀</h3>
              <p className="text-gray-400">下一代沉浸式推理游戏平台</p>
            </div>
            <div className="flex justify-center space-x-6 mb-6">
              <Link href="/about" className="text-gray-400 hover:text-purple-400 transition-colors">
                关于我们
              </Link>
              <Link href="/privacy" className="text-gray-400 hover:text-purple-400 transition-colors">
                隐私政策
              </Link>
              <Link href="/terms" className="text-gray-400 hover:text-purple-400 transition-colors">
                服务条款
              </Link>
              <Link href="/contact" className="text-gray-400 hover:text-purple-400 transition-colors">
                联系我们
              </Link>
            </div>
            <p className="text-gray-500 text-sm">
              &copy; {new Date().getFullYear()} AI JUBENSHA. All rights reserved.
            </p>
          </div>
        </footer>
      </div>
    </AppLayout>
  );
}

