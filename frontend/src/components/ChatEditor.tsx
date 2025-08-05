/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, Bot, User, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useWebSocketStore } from '@/stores/websocketStore';

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  status?: 'pending' | 'success' | 'error';
  data?: any;
}

// 添加编辑结果接口定义
interface EditResult {
  success: boolean;
  operation: string;
  message: string;
  data?: any;
}

// 添加完成数据接口定义
interface CompletedData {
  success_count: number;
  results?: Array<any>;
  script?: any;
  [key: string]: any;
}

// 添加消息数据接口定义
interface MessageData {
  success?: boolean;
  message?: string;
  updated_script?: any;
  script?: any;
  suggestion?: string;
  instruction?: string;
  result?: EditResult;
  data?: any;
  [key: string]: any;
}

interface ChatEditorProps {
  scriptId: string;
  onScriptUpdate?: (updatedScript: any) => void;
}

const ChatEditor: React.FC<ChatEditorProps> = ({ scriptId, onScriptUpdate }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      type: 'system',
      content: '👋 你好！我是剧本编辑助手。你可以用自然语言告诉我你想要对剧本进行的修改，比如：\n\n• "添加一个名叫张三的侦探角色"\n• "修改李四的背景故事"\n• "删除那个破损的花瓶证据"\n• "在客厅添加一个书架"\n\n我会帮你实时更新剧本内容！',
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { isConnected, sendMessage } = useWebSocketStore();

  // 自动滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 处理WebSocket消息 - 使用自定义事件监听
  useEffect(() => {
    const handleScriptEditResult = (event: CustomEvent<{type: string, data?: MessageData}>) => {
      const message = event.detail;
      
      switch (message.type) {
        case 'instruction_processing':
          // 指令处理中，显示处理状态
          const instruction = message.data?.instruction;
          if (instruction) {
            const processingMessage: ChatMessage = {
              id: Date.now().toString(),
              type: 'system',
              content: `正在处理指令: ${instruction}`,
              timestamp: new Date(),
              status: 'pending'
            };
            setMessages(prev => [...prev, processingMessage]);
          }
          break;
          
        case 'edit_result':
          // 单个编辑操作结果
          const result = message.data?.result;
          if (result) {
            const resultMessage: ChatMessage = {
              id: Date.now().toString(),
              type: 'assistant',
              content: result.success ? 
                `✅ ${result.message}` : 
                `❌ ${result.message}`,
              timestamp: new Date(),
              status: result.success ? 'success' : 'error',
              data: message.data
            };
            setMessages(prev => [...prev, resultMessage]);
          }
          break;
          
        case 'instruction_completed':
          // 指令完成
          const completedData = message.data;
          if (completedData) {
            const successCount = completedData.success_count || 0;
            const resultsLength = completedData.results?.length || 0;
            const completedMessage: ChatMessage = {
              id: Date.now().toString(),
              type: 'assistant',
              content: `🎉 指令执行完成！成功操作: ${successCount}/${resultsLength}`,
              timestamp: new Date(),
              status: 'success',
              data: completedData
            };
            setMessages(prev => [...prev, completedMessage]);
          }
          setIsProcessing(false);
          break;
          
        case 'script_data_update':
          // 剧本数据更新
          if (message.data?.script && onScriptUpdate) {
            onScriptUpdate(message.data.script);
          }
          break;
          
        case 'ai_suggestion':
          // AI建议
          const suggestion = message.data?.suggestion;
          if (suggestion) {
            const suggestionMessage: ChatMessage = {
              id: Date.now().toString(),
              type: 'assistant',
              content: `💡 AI建议:\n${suggestion}`,
              timestamp: new Date(),
              status: 'success',
              data: message.data
            };
            setMessages(prev => [...prev, suggestionMessage]);
          }
          break;
          
        case 'script_editing_started':
          // 编辑模式启动
          const startMessage: ChatMessage = {
            id: Date.now().toString(),
            type: 'system',
            content: '🎭 剧本编辑模式已启动，您可以开始编辑剧本了！',
            timestamp: new Date(),
            status: 'success',
            data: message.data
          };
          setMessages(prev => [...prev, startMessage]);
          break;
          
        case 'script_editing_stopped':
          // 编辑模式停止
          const stopMessage: ChatMessage = {
            id: Date.now().toString(),
            type: 'system',
            content: '⏹️ 剧本编辑模式已停止',
            timestamp: new Date(),
            status: 'success',
            data: message.data
          };
          setMessages(prev => [...prev, stopMessage]);
          break;
          
        case 'script_edit_result':
          // 保持向后兼容
          const messageId = message.data?.message_id;
          if (messageId) {
            setMessages(prev => prev.map(msg => 
              msg.id === messageId 
                ? { 
                    ...msg, 
                    status: message.data?.success ? 'success' : 'error'
                  }
                : msg
            ));
            
            // 添加AI回复
            const aiMessage: ChatMessage = {
              id: Date.now().toString(),
              type: 'assistant',
              content: message.data?.message || (message.data?.success ? '✅ 操作成功完成！' : '❌ 操作失败'),
              timestamp: new Date(),
              status: 'success',
              data: message.data
            };
            
            setMessages(prev => [...prev, aiMessage]);
            
            // 如果操作成功且有更新的剧本数据，通知父组件
            if (message.data?.success && message.data?.updated_script && onScriptUpdate) {
              onScriptUpdate(message.data.updated_script);
            }
            
            if (message.data?.success) {
              toast.success('剧本更新成功！');
            } else {
              toast.error('操作失败：' + (message.data?.message || '未知错误'));
            }
          }
          
          setIsProcessing(false);
          break;
          
        case 'script_edit_error':
          // 错误处理
          const errorMessage: ChatMessage = {
            id: Date.now().toString(),
            type: 'assistant',
            content: `❌ 错误: ${message.data?.message || '操作失败'}`,
            timestamp: new Date(),
            status: 'error',
            data: message.data
          };
          setMessages(prev => [...prev, errorMessage]);
          toast.error(`编辑失败: ${message.data?.message || '操作失败'}`);
          setIsProcessing(false);
          break;
      }
    };

    // 监听自定义事件
    window.addEventListener('script_edit_result', handleScriptEditResult as EventListener);
    
    return () => {
      window.removeEventListener('script_edit_result', handleScriptEditResult as EventListener);
    };
  }, [onScriptUpdate]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isProcessing) return;
    
    if (!isConnected) {
      toast.error('WebSocket未连接，请稍后重试');
      return;
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
      status: 'pending'
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsProcessing(true);

    try {
      // 发送编辑指令到WebSocket
      sendMessage({
        type: 'edit_instruction',
        instruction: userMessage.content,
        message_id: userMessage.id
      });
      
      // 更新消息状态为已发送
      setMessages(prev => prev.map(msg => 
        msg.id === userMessage.id 
          ? { ...msg, status: 'success' }
          : msg
      ));
      
    } catch (error) {
      console.error('发送消息失败:', error);
      setMessages(prev => prev.map(msg => 
        msg.id === userMessage.id 
          ? { ...msg, status: 'error' }
          : msg
      ));
      toast.error('发送失败，请重试');
      setIsProcessing(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getMessageIcon = (message: ChatMessage) => {
    if (message.status === 'error') {
      return <XCircle className="w-4 h-4" />;
    }
    
    switch (message.type) {
      case 'user':
        return <User className="w-4 h-4" />;
      case 'assistant':
        return <Bot className="w-4 h-4" />;
      case 'system':
        return <span className="text-sm">🤖</span>;
      default:
        return null;
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'pending':
        return <Loader2 className="w-3 h-3 animate-spin text-yellow-500" />;
      case 'success':
        return <CheckCircle className="w-3 h-3 text-green-500" />;
      case 'error':
        return <XCircle className="w-3 h-3 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <Card className="relative bg-gradient-to-br from-slate-900/90 via-slate-800/90 to-slate-900/90 backdrop-blur-xl border-r border-slate-700/50 h-full flex flex-col shadow-2xl overflow-hidden">
      {/* 背景装饰 */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-600/5 via-transparent to-blue-600/5 pointer-events-none"></div>
      <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-purple-500/10 to-transparent rounded-full blur-xl"></div>
      
      <div className="pb-2 relative flex flex-row items-center justify-between space-y-0 px-4 flex-shrink-0 border-b border-slate-700/50">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="bg-gradient-to-br from-purple-500 to-blue-600 p-2 rounded-xl shadow-lg flex-shrink-0">
            <span className="text-lg">💬</span>
          </div>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-lg font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent truncate">
              AI 对话编辑
            </CardTitle>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
            <Badge 
              variant="outline"
              className={`text-xs px-2 py-0.5 flex-shrink-0 ${isConnected ? 'border-green-400/50 text-green-300 bg-green-400/10' : 'border-red-400/50 text-red-300 bg-red-400/10'} backdrop-blur-sm`}
            >
              {isConnected ? '已连接' : '未连接'}
            </Badge>
          </div>
        </div>
      </div>
      
      <CardContent className="relative flex-1 flex flex-col p-6 space-y-6 min-h-0">
        {/* 消息列表 */}
        <ScrollArea className="flex-1 pr-2 custom-scrollbar h-full max-h-[calc(100vh-300px)]">
          <div className="space-y-6 pb-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex items-start gap-4 animate-in slide-in-from-bottom-2 duration-300 ${
                  message.type === 'user' ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                <div className={`flex-shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg border-2 ${
                  message.status === 'error'
                    ? 'bg-red-600/90 border-red-400/50'
                    : message.type === 'user' 
                    ? 'bg-gradient-to-br from-blue-500 to-blue-600 border-blue-400/50' 
                    : message.type === 'assistant'
                    ? 'bg-gradient-to-br from-purple-500 to-purple-600 border-purple-400/50'
                    : 'bg-gradient-to-br from-gray-500 to-gray-600 border-gray-400/50'
                }`}>
                  {getMessageIcon(message)}
                </div>
                
                <div className={`flex-1 max-w-[85%] ${
                  message.type === 'user' ? 'text-right' : 'text-left'
                }`}>
                  <div className={`inline-block p-4 rounded-2xl shadow-lg backdrop-blur-sm transition-all duration-200 hover:shadow-xl ${
                    message.status === 'error'
                      ? 'bg-red-700/60 text-red-100 border border-red-500/40'
                      : message.type === 'user'
                      ? 'bg-gradient-to-br from-blue-600/90 to-blue-700/90 text-white border border-blue-400/30'
                      : message.type === 'assistant'
                      ? 'bg-gradient-to-br from-purple-700/60 to-purple-800/60 text-purple-100 border border-purple-400/30'
                      : 'bg-gradient-to-br from-gray-700/60 to-gray-800/60 text-gray-200 border border-gray-400/30'
                  }`}>
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                      {message.content}
                    </div>
                    
                    {/* 显示操作结果数据 */}
                    {message.data && message.data.data && (
                      <div className="mt-3 p-3 bg-black/30 rounded-xl text-xs border border-white/10">
                        <div className="text-purple-300 font-medium mb-2">操作详情：</div>
                        <pre className="text-purple-200 overflow-x-auto text-xs leading-relaxed">
                          {JSON.stringify(message.data.data, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
                    <span>{message.timestamp.toLocaleTimeString()}</span>
                    {getStatusIcon(message.status)}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
        
        {/* 输入区域 */}
        <div className="relative pt-4 border-t border-slate-700/50 flex-shrink-0">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-purple-400/50 to-transparent"></div>
          
          <div className="flex items-end gap-3 mt-4">
            <div className="flex-1 relative">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="输入你的编辑指令，比如：添加一个侦探角色..."
                className="bg-slate-800/60 border-slate-600/50 text-white placeholder-slate-400 focus:border-purple-400/70 focus:bg-slate-800/80 transition-all duration-200 rounded-2xl py-3 px-4 pr-12 backdrop-blur-sm"
                disabled={isProcessing || !isConnected}
              />
              {inputValue && (
                <button
                  onClick={() => setInputValue('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                >
                  ×
                </button>
              )}
            </div>
            <Button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isProcessing || !isConnected}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl px-6 py-3 shadow-lg transition-all duration-200 hover:shadow-xl"
            >
              {isProcessing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>
        
        {/* 快捷指令 */}
        <div className="flex flex-wrap gap-2 flex-shrink-0">
          {[
            { text: '添加侦探角色', icon: '🕵️' },
            { text: '修改剧本标题', icon: '📝' },
            { text: '添加关键证据', icon: '🔍' },
            { text: '创建新场景', icon: '🎬' }
          ].map((suggestion) => (
            <Button
              key={suggestion.text}
              variant="outline"
              size="sm"
              onClick={() => setInputValue(suggestion.text)}
              className="text-xs bg-slate-800/40 border-slate-600/40 text-slate-300 hover:bg-purple-600/20 hover:border-purple-500/50 hover:text-white transition-all duration-200 rounded-xl backdrop-blur-sm"
              disabled={isProcessing}
            >
              <span className="mr-1.5">{suggestion.icon}</span>
              {suggestion.text}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default ChatEditor;