import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Send, Bot, User, Sparkles, Save, Eye, ArrowLeft, Plus, Edit3, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import AppLayout from '@/components/AppLayout';
import AuthGuard from '@/components/AuthGuard';

interface Message {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

interface Character {
  id: string;
  name: string;
  description: string;
  background: string;
}

interface PlotPoint {
  id: string;
  title: string;
  description: string;
  order: number;
}

interface ScriptData {
  title: string;
  background: string;
  characters: Character[];
  plotPoints: PlotPoint[];
}

export default function SmartScriptEditor() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'ai',
      content: '你好！我是你的AI创作助手。我会帮助你一步步完善剧本。让我们从故事背景开始吧！你希望故事发生在什么样的环境中？',
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState('chat');
  
  // 剧本数据
  const [scriptData, setScriptData] = useState<ScriptData>({
    title: '新剧本',
    background: '',
    characters: [],
    plotPoints: []
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsTyping(true);

    // 模拟AI回复
    setTimeout(() => {
      const aiResponse = generateAIResponse(inputMessage, messages.length);
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: aiResponse.content,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, aiMessage]);
      setIsTyping(false);
      
      // 更新剧本数据
      if (aiResponse.updateScript) {
        setScriptData(prev => ({ ...prev, ...aiResponse.updateScript }));
      }
    }, 1500);
  };

  const generateAIResponse = (userInput: string, messageCount: number) => {
    // 简单的AI回复逻辑，实际应该调用后端API
    const responses = [
      {
        content: '很好的想法！基于你的描述，我建议故事背景设定为：一座被迷雾笼罩的古老庄园，里面隐藏着百年前的秘密。现在让我们来创建一些角色吧！你希望有几个主要角色？',
        updateScript: { background: userInput }
      },
      {
        content: '完美！我为你生成了几个角色。现在让我们来设计一些关键情节点。故事的开端应该如何展开？',
        updateScript: {
          characters: [
            { id: '1', name: '神秘管家', description: '庄园的老管家，知道所有秘密', background: '在庄园工作了30年，见证了所有的变迁' },
            { id: '2', name: '年轻继承人', description: '刚刚继承庄园的年轻人', background: '从未来过庄园，对家族历史一无所知' }
          ]
        }
      },
      {
        content: '太棒了！我已经为你整理了完整的剧本框架。你可以在右侧查看和编辑具体内容。还有什么需要我帮助完善的吗？',
        updateScript: {
          plotPoints: [
            { id: '1', title: '神秘邀请', description: '继承人收到庄园的邀请函', order: 1 },
            { id: '2', title: '初入庄园', description: '第一次踏入神秘的古老庄园', order: 2 },
            { id: '3', title: '发现线索', description: '在庄园中发现奇怪的线索', order: 3 }
          ]
        }
      }
    ];
    
    return responses[Math.min(messageCount - 1, responses.length - 1)] || {
      content: '我理解了你的想法。让我们继续完善剧本的细节吧！',
      updateScript: null
    };
  };

  const addCharacter = () => {
    const newCharacter: Character = {
      id: Date.now().toString(),
      name: '新角色',
      description: '',
      background: ''
    };
    setScriptData(prev => ({
      ...prev,
      characters: [...prev.characters, newCharacter]
    }));
  };

  const updateCharacter = (id: string, field: keyof Character, value: string) => {
    setScriptData(prev => ({
      ...prev,
      characters: prev.characters.map(char => 
        char.id === id ? { ...char, [field]: value } : char
      )
    }));
  };

  const deleteCharacter = (id: string) => {
    setScriptData(prev => ({
      ...prev,
      characters: prev.characters.filter(char => char.id !== id)
    }));
  };

  const addPlotPoint = () => {
    const newPlotPoint: PlotPoint = {
      id: Date.now().toString(),
      title: '新情节点',
      description: '',
      order: scriptData.plotPoints.length + 1
    };
    setScriptData(prev => ({
      ...prev,
      plotPoints: [...prev.plotPoints, newPlotPoint]
    }));
  };

  const updatePlotPoint = (id: string, field: keyof PlotPoint, value: string | number) => {
    setScriptData(prev => ({
      ...prev,
      plotPoints: prev.plotPoints.map(plot => 
        plot.id === id ? { ...plot, [field]: value } : plot
      )
    }));
  };

  const deletePlotPoint = (id: string) => {
    setScriptData(prev => ({
      ...prev,
      plotPoints: prev.plotPoints.filter(plot => plot.id !== id)
    }));
  };

  const handleSave = () => {
    // 保存剧本逻辑
    console.log('Saving script:', scriptData);
    // 这里应该调用API保存到后端
  };

  const handlePreview = () => {
    // 跳转到预览页面
    router.push('/script-manager/preview/new');
  };

  return (
    <AuthGuard>
      <AppLayout title="智能剧本编辑器">
        <div className="min-h-screen bg-slate-900">
          {/* 顶部工具栏 */}
          <div className="bg-slate-800/80 backdrop-blur-sm border-b border-slate-700 p-4">
            <div className="flex items-center justify-between max-w-7xl mx-auto">
              <div className="flex items-center gap-4">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => router.push('/script-manager')}
                  className="text-slate-400 hover:text-white"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  返回
                </Button>
                <div>
                  <h1 className="text-xl font-semibold text-white">{scriptData.title}</h1>
                  <p className="text-slate-400 text-sm">AI智能创作中...</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleSave}
                  className="border-slate-600 text-slate-300 hover:text-white"
                >
                  <Save className="w-4 h-4 mr-2" />
                  保存
                </Button>
                <Button 
                  size="sm"
                  onClick={handlePreview}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  预览
                </Button>
              </div>
            </div>
          </div>

          <div className="flex h-[calc(100vh-80px)]">
            {/* 左侧：AI聊天界面 */}
            <div className="w-1/2 border-r border-slate-700 flex flex-col">
              <div className="bg-slate-800/50 p-4 border-b border-slate-700">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="text-white font-medium">AI创作助手</h3>
                    <p className="text-slate-400 text-sm">正在帮助你创作剧本</p>
                  </div>
                </div>
              </div>

              {/* 消息列表 */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((message) => (
                  <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`flex items-start gap-3 max-w-[80%] ${
                      message.type === 'user' ? 'flex-row-reverse' : 'flex-row'
                    }`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        message.type === 'user' 
                          ? 'bg-blue-600' 
                          : 'bg-gradient-to-r from-purple-500 to-pink-500'
                      }`}>
                        {message.type === 'user' ? 
                          <User className="w-4 h-4 text-white" /> : 
                          <Bot className="w-4 h-4 text-white" />
                        }
                      </div>
                      <div className={`rounded-lg p-3 ${
                        message.type === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-800 text-slate-100 border border-slate-700'
                      }`}>
                        <p className="text-sm leading-relaxed">{message.content}</p>
                        <p className={`text-xs mt-1 ${
                          message.type === 'user' ? 'text-blue-100' : 'text-slate-500'
                        }`}>
                          {message.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                        <Bot className="w-4 h-4 text-white" />
                      </div>
                      <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                          <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* 输入框 */}
              <div className="p-4 border-t border-slate-700">
                <div className="flex gap-2">
                  <Input
                    placeholder="输入你的想法或问题..."
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    className="bg-slate-800 border-slate-600 text-white"
                  />
                  <Button 
                    onClick={handleSendMessage}
                    disabled={!inputMessage.trim() || isTyping}
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* 右侧：内容编辑区域 */}
            <div className="w-1/2 flex flex-col">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
                <TabsList className="bg-slate-800 border-b border-slate-700 rounded-none justify-start p-0">
                  <TabsTrigger value="chat" className="data-[state=active]:bg-slate-700">实时预览</TabsTrigger>
                  <TabsTrigger value="background" className="data-[state=active]:bg-slate-700">故事背景</TabsTrigger>
                  <TabsTrigger value="characters" className="data-[state=active]:bg-slate-700">角色设定</TabsTrigger>
                  <TabsTrigger value="plot" className="data-[state=active]:bg-slate-700">关键情节</TabsTrigger>
                </TabsList>

                <TabsContent value="chat" className="flex-1 p-4 m-0">
                  <Card className="bg-slate-800/50 border-slate-700 h-full">
                    <CardHeader>
                      <CardTitle className="text-white flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-purple-400" />
                        剧本实时预览
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <h4 className="text-white font-medium mb-2">剧本标题</h4>
                        <Input
                          value={scriptData.title}
                          onChange={(e) => setScriptData(prev => ({...prev, title: e.target.value}))}
                          className="bg-slate-900/50 border-slate-600 text-white"
                        />
                      </div>
                      
                      {scriptData.background && (
                        <div>
                          <h4 className="text-white font-medium mb-2">故事背景</h4>
                          <div className="bg-slate-900/50 rounded-lg p-3">
                            <p className="text-slate-300 text-sm">{scriptData.background}</p>
                          </div>
                        </div>
                      )}
                      
                      {scriptData.characters.length > 0 && (
                        <div>
                          <h4 className="text-white font-medium mb-2">角色列表</h4>
                          <div className="space-y-2">
                            {scriptData.characters.map((character) => (
                              <div key={character.id} className="bg-slate-900/50 rounded-lg p-3">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-white font-medium">{character.name}</span>
                                  <Badge variant="secondary" className="bg-purple-600/20 text-purple-300">
                                    角色
                                  </Badge>
                                </div>
                                <p className="text-slate-400 text-sm">{character.description}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {scriptData.plotPoints.length > 0 && (
                        <div>
                          <h4 className="text-white font-medium mb-2">关键情节</h4>
                          <div className="space-y-2">
                            {scriptData.plotPoints.map((plot) => (
                              <div key={plot.id} className="bg-slate-900/50 rounded-lg p-3">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant="outline" className="border-blue-500 text-blue-400">
                                    {plot.order}
                                  </Badge>
                                  <span className="text-white font-medium">{plot.title}</span>
                                </div>
                                <p className="text-slate-400 text-sm">{plot.description}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="background" className="flex-1 p-4 m-0">
                  <Card className="bg-slate-800/50 border-slate-700 h-full">
                    <CardHeader>
                      <CardTitle className="text-white">故事背景设定</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Textarea
                        placeholder="描述故事发生的时间、地点、环境背景..."
                        value={scriptData.background}
                        onChange={(e) => setScriptData(prev => ({...prev, background: e.target.value}))}
                        className="bg-slate-900/50 border-slate-600 text-white min-h-[300px]"
                      />
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="characters" className="flex-1 p-4 m-0">
                  <Card className="bg-slate-800/50 border-slate-700 h-full">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-white">角色设定</CardTitle>
                        <Button 
                          size="sm" 
                          onClick={addCharacter}
                          className="bg-purple-600 hover:bg-purple-700 text-white"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          添加角色
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4 max-h-[500px] overflow-y-auto">
                      {scriptData.characters.map((character) => (
                        <div key={character.id} className="bg-slate-900/50 rounded-lg p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <Input
                              placeholder="角色名称"
                              value={character.name}
                              onChange={(e) => updateCharacter(character.id, 'name', e.target.value)}
                              className="bg-slate-800 border-slate-600 text-white flex-1 mr-2"
                            />
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => deleteCharacter(character.id)}
                              className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                          <Textarea
                            placeholder="角色描述和特征..."
                            value={character.description}
                            onChange={(e) => updateCharacter(character.id, 'description', e.target.value)}
                            className="bg-slate-800 border-slate-600 text-white"
                          />
                          <Textarea
                            placeholder="角色背景故事..."
                            value={character.background}
                            onChange={(e) => updateCharacter(character.id, 'background', e.target.value)}
                            className="bg-slate-800 border-slate-600 text-white"
                          />
                        </div>
                      ))}
                      {scriptData.characters.length === 0 && (
                        <div className="text-center py-8">
                          <p className="text-slate-400 mb-4">还没有添加角色</p>
                          <Button 
                            onClick={addCharacter}
                            className="bg-purple-600 hover:bg-purple-700 text-white"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            添加第一个角色
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="plot" className="flex-1 p-4 m-0">
                  <Card className="bg-slate-800/50 border-slate-700 h-full">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-white">关键情节</CardTitle>
                        <Button 
                          size="sm" 
                          onClick={addPlotPoint}
                          className="bg-purple-600 hover:bg-purple-700 text-white"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          添加情节
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4 max-h-[500px] overflow-y-auto">
                      {scriptData.plotPoints.map((plot) => (
                        <div key={plot.id} className="bg-slate-900/50 rounded-lg p-4 space-y-3">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="border-blue-500 text-blue-400">
                              {plot.order}
                            </Badge>
                            <Input
                              placeholder="情节标题"
                              value={plot.title}
                              onChange={(e) => updatePlotPoint(plot.id, 'title', e.target.value)}
                              className="bg-slate-800 border-slate-600 text-white flex-1"
                            />
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => deletePlotPoint(plot.id)}
                              className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                          <Textarea
                            placeholder="详细描述这个情节点的内容..."
                            value={plot.description}
                            onChange={(e) => updatePlotPoint(plot.id, 'description', e.target.value)}
                            className="bg-slate-800 border-slate-600 text-white"
                          />
                        </div>
                      ))}
                      {scriptData.plotPoints.length === 0 && (
                        <div className="text-center py-8">
                          <p className="text-slate-400 mb-4">还没有添加情节点</p>
                          <Button 
                            onClick={addPlotPoint}
                            className="bg-purple-600 hover:bg-purple-700 text-white"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            添加第一个情节
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </AppLayout>
    </AuthGuard>
  );
}