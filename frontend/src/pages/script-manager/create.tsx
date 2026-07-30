import AppLayout from '@/components/AppLayout';
import AuthGuard from '@/components/AuthGuard';
import ScriptGenerationPanel from '@/components/ScriptGenerationPanel';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ScriptsService } from '@/client';
import { useAuthStore } from '@/stores/authStore';
import { useScriptGenerationStore } from '@/stores/scriptGenerationStore';
import { useWebSocketStore } from '@/stores/websocketStore';
import { ArrowRight, Lightbulb, Loader2, PenTool, Users, BookOpen } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

const scriptTypes = [
  { value: '推理', label: '推理悬疑' },
  { value: '情感', label: '情感治愈' },
  { value: '恐怖', label: '恐怖惊悚' },
  { value: '欢乐', label: '欢乐聚会' },
  { value: '古风', label: '古风历史' },
  { value: '现代', label: '现代都市' }
];

const playerCounts = ['4', '5', '6', '7', '8'];

export default function CreateScript() {
  const [theme, setTheme] = useState('');
  const [playerCount, setPlayerCount] = useState('6');
  const [scriptType, setScriptType] = useState('推理');
  const [isCreating, setIsCreating] = useState(false);
  const [phase, setPhase] = useState<'form' | 'generating'>('form');

  const hasRequestedReplay = useRef(false);
  const hasToastedDone = useRef(false);

  const { user } = useAuthStore();
  const { connect, sendMessage } = useWebSocketStore();
  const genStatus = useScriptGenerationStore((s) => s.status);

  // 页面挂载时：若有进行中的生成任务且 WS 已连接，请求状态重放（覆盖刷新/重连场景）
  useEffect(() => {
    if (hasRequestedReplay.current) return;
    const genState = useScriptGenerationStore.getState();
    const wsState = useWebSocketStore.getState();
    if (genState.status === 'running' && wsState.isConnected) {
      hasRequestedReplay.current = true;
      wsState.sendMessage({ type: 'get_script_generation_state' });
      setPhase('generating');
    }
  }, []);

  // 生成完成时提示一次
  useEffect(() => {
    if (genStatus === 'done' && !hasToastedDone.current) {
      hasToastedDone.current = true;
      toast.success('剧本生成完成！');
    }
    if (genStatus !== 'done') {
      hasToastedDone.current = false;
    }
  }, [genStatus]);

  const handleStartCreation = async () => {
    if (!theme.trim()) {
      toast.error('请先输入剧本主题');
      return;
    }

    setIsCreating(true);
    try {
      // 1. 创建剧本骨架（占位标题，后续由 Agent 填充正式内容）
      const placeholderTitle = theme.trim().slice(0, 20) || '未命名剧本';
      const response = await ScriptsService.createScriptApiScriptsPost({
        title: placeholderTitle,
        description: '',
        player_count: parseInt(playerCount, 10),
        estimated_duration: 180,
        difficulty: 'medium',
        category: scriptType,
        tags: [],
        author: user?.nickname || user?.username || null,
        inspiration_type: 'one-sentence',
        inspiration_content: theme.trim()
      });

      const scriptId = response.data?.id;
      if (!response.success || !scriptId) {
        throw new Error(response.message || '创建剧本失败');
      }

      // 2. 初始化生成状态并建立 WebSocket 连接（不自动进入编辑模式）
      const genStore = useScriptGenerationStore.getState();
      genStore.reset();
      genStore.setScriptId(scriptId);
      connect(scriptId, { autoEdit: false });
      setPhase('generating');

      // 3. 等待连接就绪后发送生成指令
      const startPayload = {
        type: 'start_script_generation',
        script_id: scriptId,
        theme: theme.trim(),
        player_count: parseInt(playerCount, 10),
        script_type: scriptType
      };
      const sendWhenOpen = (attempts: number) => {
        const ws = useWebSocketStore.getState().ws;
        if (ws && ws.readyState === WebSocket.OPEN) {
          sendMessage(startPayload);
          useScriptGenerationStore.getState().setStatus('running');
        } else if (attempts < 50) {
          setTimeout(() => sendWhenOpen(attempts + 1), 100);
        } else {
          toast.error('WebSocket 连接失败，请刷新页面重试');
        }
      };
      sendWhenOpen(0);
    } catch (error) {
      console.error('创建剧本失败:', error);
      toast.error('创建剧本失败，请稍后重试');
    } finally {
      setIsCreating(false);
    }
  };

  const handleBackToForm = () => {
    useScriptGenerationStore.getState().reset();
    setPhase('form');
  };

  const renderForm = () => (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full mb-4">
          <Lightbulb className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">开始你的创作之旅</h1>
        <p className="text-slate-400 text-lg">输入一句话主题，AI 创作 Agent 将为你逐步生成完整剧本</p>
      </div>

      <Card className="bg-slate-800/80 border-slate-700/60">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <PenTool className="w-5 h-5 text-green-400" />
            一句话开始
          </CardTitle>
          <CardDescription className="text-slate-400">
            描述你想要的剧本故事，AI 将实时展示创作过程
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Textarea
            placeholder="例如：一个雨夜，图书馆里发生了奇怪的事情..."
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            className="bg-slate-900/50 border-slate-600 text-white min-h-[120px]"
          />

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-1.5 text-white font-medium mb-2">
                <BookOpen className="w-4 h-4 text-purple-400" />
                剧本类型
              </label>
              <Select value={scriptType} onValueChange={setScriptType}>
                <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white">
                  <SelectValue placeholder="选择剧本类型" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800/95 border-slate-600 text-slate-100">
                  {scriptTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-white font-medium mb-2">
                <Users className="w-4 h-4 text-blue-400" />
                玩家人数
              </label>
              <Select value={playerCount} onValueChange={setPlayerCount}>
                <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white">
                  <SelectValue placeholder="选择人数" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800/95 border-slate-600 text-slate-100">
                  {playerCounts.map((count) => (
                    <SelectItem key={count} value={count}>
                      {count}人
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-center mt-8">
        <Button
          onClick={handleStartCreation}
          disabled={!theme.trim() || isCreating}
          className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-8"
        >
          {isCreating ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              正在创建剧本...
            </>
          ) : (
            <>
              开始创作
              <ArrowRight className="w-5 h-5 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );

  const renderGenerating = () => (
    <div>
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">AI 正在创作你的剧本</h1>
        <p className="text-slate-400">你可以实时看到 Agent 的每一步思考与操作</p>
      </div>
      <ScriptGenerationPanel onReset={handleBackToForm} />
    </div>
  );

  return (
    <AuthGuard>
      <AppLayout>
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 py-8 px-4">
          {phase === 'form' ? renderForm() : renderGenerating()}
        </div>
      </AppLayout>
    </AuthGuard>
  );
}
