import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import AppLayout from '@/components/AppLayout';
import { Users, Sparkles, TrendingUp, Library } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// 英雄区域组件
const HeroSection = () => {
  return (
    <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden">
      {/* 动态背景 */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#1a237e]/25 via-[#311b92]/20 to-[#4a148c]/25">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-indigo-500/5"></div>
        </div>
        {/* 浮动装饰元素 */}
        <div className="absolute top-20 left-10 w-20 h-20 bg-purple-500/10 rounded-full blur-xl animate-pulse"></div>
        <div className="absolute top-40 right-20 w-32 h-32 bg-indigo-500/10 rounded-full blur-xl animate-pulse delay-1000"></div>
        <div className="absolute bottom-20 left-1/4 w-16 h-16 bg-purple-400/10 rounded-full blur-xl animate-pulse delay-2000"></div>
      </div>
      
      {/* 主要内容 */}
      <div className="relative z-10 text-center max-w-4xl mx-auto px-4">
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/10 rounded-full border border-purple-400/30 backdrop-blur-sm mb-6">
            <Sparkles className="w-4 h-4 text-purple-300" />
            <span className="text-sm text-purple-200">AI 驱动的沉浸式体验</span>
          </div>
        </div>
        
        <h1 className="text-6xl md:text-8xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-purple-200 via-white to-purple-300">
          AI 剧本杀
        </h1>
        
        <p className="text-xl md:text-2xl text-slate-300 mb-8 leading-relaxed">
          进入 AI 驱动的推理世界，每个选择都影响剧情走向
          <br className="hidden md:block" />
          与智能角色互动，解开层层谜团，体验前所未有的沉浸感
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
          <Link href="/script-center">
            <Button size="lg" className="bg-gradient-to-r from-[#311b92] to-[#4a148c] hover:from-[#4527a0] hover:to-[#6a1b9a] text-white px-8 text-lg font-semibold rounded-md shadow-lg shadow-purple-900/30 transition-all duration-200">
              <Library className="w-5 h-5 mr-2" />
              立即开始游戏
            </Button>
          </Link>
        </div>
        
        {/* 统计数据 */}
        <div className="grid grid-cols-3 gap-8 max-w-md mx-auto">
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-300">10K+</div>
            <div className="text-sm text-slate-400">AI 角色</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-indigo-300">50+</div>
            <div className="text-sm text-slate-400">精品剧本</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-fuchsia-300">4.9</div>
            <div className="text-sm text-slate-400">用户评分</div>
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
      color: "from-purple-500 to-fuchsia-500"
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: "全自动演绎",
      description: "无需真人参与，AI 角色自行推动剧情发展",
      color: "from-indigo-500 to-purple-500"
    },
    {
      icon: <TrendingUp className="w-8 h-8" />,
      title: "动态剧情",
      description: "基于AI推理的动态剧情发展，每次游戏都是独特的故事",
      color: "from-violet-500 to-indigo-500"
    }
  ];

  return (
    <section className="py-20 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-white mb-4">为什么选择我们</h2>
          <p className="text-xl text-slate-400">体验下一代由AI驱动的剧本杀</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card key={index} className="bg-slate-900/50 border border-slate-700/30 backdrop-blur-sm rounded-lg hover:border-purple-500/40 hover:bg-slate-900/70 transition-all duration-300 group">
              <CardHeader>
                <div className={`w-16 h-16 rounded-lg bg-gradient-to-r ${feature.color} p-4 mb-4 shadow-lg shadow-purple-900/20 group-hover:scale-110 transition-transform duration-300`}>
                  <div className="text-white">{feature.icon}</div>
                </div>
                <CardTitle className="text-white text-xl">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-slate-400 text-base leading-relaxed">
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

  return (
    <AppLayout showSidebar={false}>
      <div className="min-h-screen">
        {/* 英雄区域 */}
        <HeroSection />
        
        {/* 特色功能 */}
        <FeaturesSection />
      
        
        {/* 页脚 */}
        <footer className="py-12 px-4 bg-slate-950/60 border-t border-slate-800/60 backdrop-blur-sm">
          <div className="max-w-6xl mx-auto text-center">
            <div className="mb-6">
              <h3 className="text-2xl font-bold text-white mb-2">AI 剧本杀</h3>
              <p className="text-slate-400">下一代沉浸式推理游戏平台</p>
            </div>
            <div className="flex justify-center space-x-6 mb-6">
              <Link href="/about" className="text-slate-400 hover:text-purple-400 transition-colors">
                关于我们
              </Link>
              <Link href="/privacy" className="text-slate-400 hover:text-purple-400 transition-colors">
                隐私政策
              </Link>
              <Link href="/terms" className="text-slate-400 hover:text-purple-400 transition-colors">
                服务条款
              </Link>
              <Link href="/contact" className="text-slate-400 hover:text-purple-400 transition-colors">
                联系我们
              </Link>
            </div>
            <p className="text-slate-500 text-sm">
              &copy; {new Date().getFullYear()} AI JUBENSHA. All rights reserved.
            </p>
          </div>
        </footer>
      </div>
    </AppLayout>
  );
}

