import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { ArrowLeft, Share2, Download, Edit3, Copy, Check, Users, Clock, BookOpen, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import AppLayout from '@/components/AppLayout';
import AuthGuard from '@/components/AuthGuard';

// 模拟剧本数据，实际应该从API获取
const mockScriptData = {
  id: 'new',
  title: '神秘古堡的秘密',
  type: '推理悬疑',
  playerCount: '6人',
  duration: '2-3小时',
  difficulty: '中等',
  description: '一座被迷雾笼罩的古老庄园，隐藏着百年前的秘密。当继承人踏入这片土地时，一场关于真相与复仇的游戏正式开始。',
  background: '故事发生在20世纪初的英国乡村，一座名为"乌鸦庄园"的古老建筑矗立在迷雾缭绕的山丘上。这座庄园曾经是贵族家族的居所，但在一场神秘的事件后被废弃了近百年。如今，庄园的新主人即将到来，而那些沉睡的秘密也将重见天日。',
  characters: [
    {
      id: '1',
      name: '艾德华·布莱克伍德',
      description: '庄园的年轻继承人，刚从伦敦赶来',
      background: '从未来过庄园，对家族历史一无所知，但内心深处总有一种莫名的不安感。'
    },
    {
      id: '2',
      name: '玛格丽特夫人',
      description: '庄园的老管家，在此工作了30年',
      background: '见证了庄园的兴衰，知道许多不为人知的秘密，但总是守口如瓶。'
    },
    {
      id: '3',
      name: '詹姆斯医生',
      description: '当地的医生，庄园事件的见证者',
      background: '曾经治疗过庄园中的病人，对那场神秘事件有着深刻的记忆。'
    },
    {
      id: '4',
      name: '安娜·罗斯',
      description: '神秘的访客，声称是家族朋友',
      background: '美丽而神秘的女子，似乎对庄园的历史了如指掌，但她的真实身份成谜。'
    },
    {
      id: '5',
      name: '托马斯·格雷',
      description: '庄园的园丁，沉默寡言',
      background: '在庄园工作多年，对庄园的每一个角落都了如指掌，但很少与人交流。'
    },
    {
      id: '6',
      name: '伊丽莎白小姐',
      description: '庄园前主人的侄女，突然出现',
      background: '声称对庄园有继承权，带着一些神秘的文件和证据。'
    }
  ],
  plotPoints: [
    {
      id: '1',
      title: '神秘邀请',
      description: '艾德华收到了一封来自庄园的邀请函，邀请他前来处理继承事宜。信件的内容简短而神秘，署名是一个他从未听说过的律师。',
      order: 1
    },
    {
      id: '2',
      title: '初入庄园',
      description: '在一个雾气弥漫的黄昏，艾德华抵达了乌鸦庄园。古老的建筑在夕阳下显得格外阴森，而迎接他的是神秘的管家玛格丽特夫人。',
      order: 2
    },
    {
      id: '3',
      title: '意外访客',
      description: '就在艾德华准备休息时，庄园里陆续来了几位不速之客。每个人都声称与庄园有着某种联系，但他们的真实目的却扑朔迷离。',
      order: 3
    },
    {
      id: '4',
      title: '发现线索',
      description: '在探索庄园的过程中，众人发现了一些奇怪的线索：一本神秘的日记、一幅被撕毁的画像、还有藏在密室中的古老文件。',
      order: 4
    },
    {
      id: '5',
      title: '真相大白',
      description: '随着调查的深入，一个关于复仇、爱情和背叛的故事逐渐浮出水面。原来，百年前的那场事件并非意外，而是一场精心策划的阴谋。',
      order: 5
    }
  ],
  createdAt: new Date(),
  updatedAt: new Date()
};

export default function ScriptPreview() {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleShare = async () => {
    try {
      const shareUrl = `${window.location.origin}/scripts/preview/${mockScriptData.id}`;
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success('分享链接已复制到剪贴板');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('复制失败，请手动复制链接');
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    
    // 模拟导出过程
    setTimeout(() => {
      // 创建文本内容
      const content = `
剧本名称：${mockScriptData.title}
剧本类型：${mockScriptData.type}
玩家人数：${mockScriptData.playerCount}
游戏时长：${mockScriptData.duration}
难度等级：${mockScriptData.difficulty}

剧本简介：
${mockScriptData.description}

故事背景：
${mockScriptData.background}

角色设定：
${mockScriptData.characters.map((char, index) => `
${index + 1}. ${char.name}
   描述：${char.description}
   背景：${char.background}`).join('')}

关键情节：
${mockScriptData.plotPoints.map((plot) => `
${plot.order}. ${plot.title}
   ${plot.description}`).join('')}

创建时间：${mockScriptData.createdAt.toLocaleString()}
      `;
      
      // 创建下载链接
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${mockScriptData.title}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setIsExporting(false);
      toast.success('剧本已导出为文本文件');
    }, 1500);
  };

  const handleEdit = () => {
    router.push('/script-manager/edit/new');
  };

  return (
    <AuthGuard>
      <AppLayout title="剧本预览">
        <div className="min-h-screen bg-slate-900">
          {/* 顶部工具栏 */}
          <div className="bg-slate-800/80 backdrop-blur-sm border-b border-slate-700 p-4">
            <div className="flex items-center justify-between max-w-6xl mx-auto">
              <div className="flex items-center gap-4">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => router.push('/script-manager/edit/new')}
                  className="text-slate-400 hover:text-white"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  返回编辑
                </Button>
                <div>
                  <h1 className="text-xl font-semibold text-white">{mockScriptData.title}</h1>
                  <p className="text-slate-400 text-sm">剧本预览</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleEdit}
                  className="border-slate-600 text-slate-300 hover:text-white"
                >
                  <Edit3 className="w-4 h-4 mr-2" />
                  编辑
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleShare}
                  className="border-slate-600 text-slate-300 hover:text-white"
                >
                  {copied ? <Check className="w-4 h-4 mr-2" /> : <Share2 className="w-4 h-4 mr-2" />}
                  {copied ? '已复制' : '分享'}
                </Button>
                <Button 
                  size="sm"
                  onClick={handleExport}
                  disabled={isExporting}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <Download className="w-4 h-4 mr-2" />
                  {isExporting ? '导出中...' : '导出'}
                </Button>
              </div>
            </div>
          </div>

          <div className="max-w-6xl mx-auto p-6 space-y-6">
            {/* 剧本概览卡片 */}
            <Card className="bg-gradient-to-r from-purple-900/50 to-pink-900/50 border-purple-500/30">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h1 className="text-3xl font-bold text-white mb-2">{mockScriptData.title}</h1>
                    <p className="text-slate-300 text-lg leading-relaxed">{mockScriptData.description}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star key={star} className="w-5 h-5 text-yellow-400 fill-current" />
                    ))}
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-3">
                  <Badge variant="secondary" className="bg-blue-600/20 text-blue-300 border-blue-500/30">
                    <BookOpen className="w-3 h-3 mr-1" />
                    {mockScriptData.type}
                  </Badge>
                  <Badge variant="secondary" className="bg-green-600/20 text-green-300 border-green-500/30">
                    <Users className="w-3 h-3 mr-1" />
                    {mockScriptData.playerCount}
                  </Badge>
                  <Badge variant="secondary" className="bg-orange-600/20 text-orange-300 border-orange-500/30">
                    <Clock className="w-3 h-3 mr-1" />
                    {mockScriptData.duration}
                  </Badge>
                  <Badge variant="secondary" className="bg-purple-600/20 text-purple-300 border-purple-500/30">
                    难度：{mockScriptData.difficulty}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <div className="grid lg:grid-cols-3 gap-6">
              {/* 故事背景 */}
              <div className="lg:col-span-2">
                <Card className="bg-slate-800/50 border-slate-700 h-full">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-blue-400" />
                      故事背景
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-slate-900/50 rounded-lg p-4">
                      <p className="text-slate-300 leading-relaxed">{mockScriptData.background}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* 游戏信息 */}
              <div>
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white">游戏信息</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">剧本类型</span>
                      <span className="text-white font-medium">{mockScriptData.type}</span>
                    </div>
                    <Separator className="bg-slate-700" />
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">玩家人数</span>
                      <span className="text-white font-medium">{mockScriptData.playerCount}</span>
                    </div>
                    <Separator className="bg-slate-700" />
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">游戏时长</span>
                      <span className="text-white font-medium">{mockScriptData.duration}</span>
                    </div>
                    <Separator className="bg-slate-700" />
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">难度等级</span>
                      <span className="text-white font-medium">{mockScriptData.difficulty}</span>
                    </div>
                    <Separator className="bg-slate-700" />
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">创建时间</span>
                      <span className="text-white font-medium">{mockScriptData.createdAt.toLocaleDateString()}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* 角色设定 */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-green-400" />
                  角色设定
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {mockScriptData.characters.map((character) => (
                    <div key={character.id} className="bg-slate-900/50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-white font-semibold">{character.name}</h4>
                        <Badge variant="outline" className="border-green-500 text-green-400 text-xs">
                          角色
                        </Badge>
                      </div>
                      <p className="text-slate-400 text-sm mb-2">{character.description}</p>
                      <p className="text-slate-500 text-xs">{character.background}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 关键情节 */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Star className="w-5 h-5 text-yellow-400" />
                  关键情节
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockScriptData.plotPoints.map((plot, index) => (
                    <div key={plot.id} className="flex gap-4">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                          <span className="text-white font-bold text-sm">{plot.order}</span>
                        </div>
                        {index < mockScriptData.plotPoints.length - 1 && (
                          <div className="w-px h-8 bg-slate-600 mx-auto mt-2"></div>
                        )}
                      </div>
                      <div className="flex-1 pb-6">
                        <h4 className="text-white font-semibold mb-2">{plot.title}</h4>
                        <p className="text-slate-400 text-sm leading-relaxed">{plot.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 底部操作区 */}
            <div className="flex justify-center gap-4 pt-6">
              <Button 
                variant="outline" 
                onClick={() => router.push('/script-manager')}
                className="border-slate-600 text-slate-300 hover:text-white"
              >
                返回剧本管理
              </Button>
              <Button 
                onClick={handleEdit}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                <Edit3 className="w-4 h-4 mr-2" />
                继续编辑
              </Button>
            </div>
          </div>
        </div>
      </AppLayout>
    </AuthGuard>
  );
}