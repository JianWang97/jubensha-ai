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
    const handleScriptEditResult = (event: CustomEvent) => {
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
                `✅ ${result.operation}: ${result.message}` : 
                `❌ ${result.operation}: ${result.message}`,
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
            const completedMessage: ChatMessage = {
              id: Date.now().toString(),
              type: 'assistant',
              content: `🎉 指令执行完成！成功操作: ${completedData.success_count}/${completedData.results?.length || 0}`,
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
                    status: message.data.success ? 'success' : 'error'
                  }
                : msg
            ));
            
            // 添加AI回复
            const aiMessage: ChatMessage = {
              id: Date.now().toString(),
              type: 'assistant',
              content: message.data.message || (message.data.success ? '✅ 操作成功完成！' : '❌ 操作失败'),
              timestamp: new Date(),
              status: 'success',
              data: message.data
            };
            
            setMessages(prev => [...prev, aiMessage]);
            
            // 如果操作成功且有更新的剧本数据，通知父组件
            if (message.data.success && message.data.updated_script && onScriptUpdate) {
              onScriptUpdate(message.data.updated_script);
            }
            
            if (message.data.success) {
              toast.success('剧本更新成功！');
            } else {
              toast.error('操作失败：' + message.data.message);
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
    <Card className="bg-gradient-to-br from-slate-800/90 via-purple-900/90 to-slate-800/90 backdrop-blur-md border-purple-500/30 h-[700px] flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 flex-shrink-0">
        <CardTitle className="text-xl font-bold text-purple-200 flex items-center gap-2">
          💬 对话式编辑
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge 
            variant={isConnected ? "default" : "destructive"}
            className={isConnected ? "bg-green-600" : "bg-red-600"}
          >
            {isConnected ? '🟢 已连接' : '🔴 未连接'}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col p-4 space-y-4 min-h-0">
        {/* 消息列表 */}
        <ScrollArea className="flex-1 pr-4 h-[400px]">
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex items-start gap-3 ${
                  message.type === 'user' ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  message.status === 'error'
                    ? 'bg-red-600'
                    : message.type === 'user' 
                    ? 'bg-blue-600' 
                    : message.type === 'assistant'
                    ? 'bg-purple-600'
                    : 'bg-gray-600'
                }`}>
                  {getMessageIcon(message)}
                </div>
                
                <div className={`flex-1 max-w-[80%] ${
                  message.type === 'user' ? 'text-right' : 'text-left'
                }`}>
                  <div className={`inline-block p-3 rounded-lg ${
                    message.status === 'error'
                      ? 'bg-red-700/50 text-red-100 border border-red-500/30'
                      : message.type === 'user'
                      ? 'bg-blue-600 text-white'
                      : message.type === 'assistant'
                      ? 'bg-purple-700/50 text-purple-100 border border-purple-500/30'
                      : 'bg-gray-700/50 text-gray-200 border border-gray-500/30'
                  }`}>
                    <div className="whitespace-pre-wrap text-sm">
                      {message.content}
                    </div>
                    
                    {/* 显示操作结果数据 */}
                    {message.data && message.data.data && (
                      <div className="mt-2 p-2 bg-black/20 rounded text-xs">
                        <div className="text-purple-300">操作详情：</div>
                        <pre className="text-purple-200 overflow-x-auto">
                          {JSON.stringify(message.data.data, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
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
        <div className="flex items-center gap-2 pt-2 border-t border-purple-500/30 flex-shrink-0">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="输入你的编辑指令，比如：添加一个侦探角色..."
            className="flex-1 bg-slate-800/50 border-purple-500/30 text-purple-100 placeholder-purple-300/70"
            disabled={isProcessing || !isConnected}
          />
          <Button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isProcessing || !isConnected}
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-50"
          >
            {isProcessing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
        
        {/* 快捷指令 */}
        <div className="flex flex-wrap gap-2 flex-shrink-0">
          {[
            '添加一个侦探角色',
            '修改剧本标题',
            '添加关键证据',
            '创建新场景'
          ].map((suggestion) => (
            <Button
              key={suggestion}
              variant="outline"
              size="sm"
              onClick={() => setInputValue(suggestion)}
              className="text-xs bg-slate-700/50 border-purple-500/30 text-purple-200 hover:bg-purple-600/20"
              disabled={isProcessing}
            >
              {suggestion}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default ChatEditor;