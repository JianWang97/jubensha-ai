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
      {/* 案卷背景 */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0C0F14] via-ink to-[#11151D]">
        <div className="absolute top-0 left-0 right-0 h-px bg-thread/30" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-hairline" />
      </div>

      {/* 主要内容 */}
      <div className="relative z-10 text-center max-w-4xl mx-auto px-4">
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-sm border border-brass/40 bg-brass/10 mb-6">
            <Sparkles className="w-4 h-4 text-brass" />
            <span className="text-sm text-brass">AI 驱动的沉浸式体验</span>
          </div>
        </div>

        <h1 className="font-dossier text-6xl md:text-8xl font-bold mb-6 text-paper">
          AI 剧本杀
        </h1>

        <div className="mx-auto mb-8 h-px w-24 bg-brass/40" />

        <p className="text-xl md:text-2xl text-mist mb-8 leading-relaxed">
          进入 AI 驱动的推理世界，每个选择都影响剧情走向
          <br className="hidden md:block" />
          与智能角色互动，解开层层谜团，体验前所未有的沉浸感
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
          <Link href="/script-center">
            <Button size="lg" className="border border-brass/40 bg-brass/10 text-brass hover:bg-brass/20 px-8 text-lg font-semibold">
              <Library className="w-5 h-5 mr-2" />
              立即开始游戏
            </Button>
          </Link>
        </div>

        {/* 统计数据 */}
        <div className="grid grid-cols-3 gap-8 max-w-md mx-auto">
          <div className="text-center">
            <div className="font-data text-2xl font-bold text-brass">10K+</div>
            <div className="text-sm text-mist">AI 角色</div>
          </div>
          <div className="text-center">
            <div className="font-data text-2xl font-bold text-brass">50+</div>
            <div className="text-sm text-mist">精品剧本</div>
          </div>
          <div className="text-center">
            <div className="font-data text-2xl font-bold text-brass">4.9</div>
            <div className="text-sm text-mist">用户评分</div>
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
      description: "与具有独特性格的AI角色互动，每次游戏都有不同的体验"
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: "全自动演绎",
      description: "无需真人参与，AI 角色自行推动剧情发展"
    },
    {
      icon: <TrendingUp className="w-8 h-8" />,
      title: "动态剧情",
      description: "基于AI推理的动态剧情发展，每次游戏都是独特的故事"
    }
  ];

  return (
    <section className="py-20 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="font-dossier text-4xl font-bold text-paper mb-4">为什么选择我们</h2>
          <p className="text-xl text-mist">体验下一代由AI驱动的剧本杀</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card key={index} className="bg-panel border-line hover:border-brass/40 transition-all duration-300 group">
              <CardHeader>
                <div className="w-16 h-16 rounded-sm bg-brass/10 border border-brass/30 text-brass p-4 mb-4 group-hover:scale-110 transition-transform duration-300">
                  {feature.icon}
                </div>
                <CardTitle className="font-dossier text-paper text-xl">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-mist text-base leading-relaxed">
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
        <footer className="py-12 px-4 bg-ink border-t border-line">
          <div className="max-w-6xl mx-auto text-center">
            <div className="mb-6">
              <h3 className="font-dossier text-2xl font-bold text-paper mb-2">AI 剧本杀</h3>
              <p className="text-mist">下一代沉浸式推理游戏平台</p>
            </div>
            <div className="flex justify-center space-x-6 mb-6">
              <Link href="/about" className="text-mist hover:text-brass transition-colors">
                关于我们
              </Link>
              <Link href="/privacy" className="text-mist hover:text-brass transition-colors">
                隐私政策
              </Link>
              <Link href="/terms" className="text-mist hover:text-brass transition-colors">
                服务条款
              </Link>
              <Link href="/contact" className="text-mist hover:text-brass transition-colors">
                联系我们
              </Link>
            </div>
            <p className="text-faint text-sm">
              &copy; {new Date().getFullYear()} AI JUBENSHA. All rights reserved.
            </p>
          </div>
        </footer>
      </div>
    </AppLayout>
  );
}
