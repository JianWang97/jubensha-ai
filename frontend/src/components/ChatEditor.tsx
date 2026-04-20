/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useRef, useEffect } from 'react';
// Card components removed - using div layout for better control
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, Bot, User, CheckCircle, XCircle, MessageCircle } from 'lucide-react';
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

const ChatEditor: React.FC<ChatEditorProps> = ({ onScriptUpdate }) => {
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
  const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
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
          // 确保处理状态设置为true
          setIsProcessing(true);
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
          // 清除超时定时器并重置处理状态
          if (processingTimeoutRef.current) {
            clearTimeout(processingTimeoutRef.current);
            processingTimeoutRef.current = null;
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
          
          // 清除超时定时器并重置处理状态
          if (processingTimeoutRef.current) {
            clearTimeout(processingTimeoutRef.current);
            processingTimeoutRef.current = null;
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
          // 清除超时定时器并重置处理状态
          if (processingTimeoutRef.current) {
            clearTimeout(processingTimeoutRef.current);
            processingTimeoutRef.current = null;
          }
          setIsProcessing(false);
          break;
      }
    };

    // 监听自定义事件
    window.addEventListener('script_edit_result', handleScriptEditResult as EventListener);
    
    return () => {
      window.removeEventListener('script_edit_result', handleScriptEditResult as EventListener);
      // 清理超时定时器
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
        processingTimeoutRef.current = null;
      }
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

    // 设置30秒超时，防止处理状态卡住
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
    }
    processingTimeoutRef.current = setTimeout(() => {
      console.warn('指令处理超时，自动重置状态');
      setIsProcessing(false);
      toast.error('指令处理超时，请重试');
    }, 30000);

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
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
      }
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
    <div className="h-full w-full flex flex-col bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      {/* 固定头部 */}
      <div className="flex-shrink-0 flex flex-row items-center justify-between space-y-0 p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="p-1.5 sm:p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex-shrink-0">
            <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white truncate">
            AI 对话编辑
          </h3>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <Badge 
            variant="outline"
            className={`text-xs px-1.5 sm:px-2 py-0.5 ${isConnected ? 'border-green-200 text-green-700 bg-green-50 dark:border-green-800 dark:text-green-300 dark:bg-green-900/20' : 'border-red-200 text-red-700 bg-red-50 dark:border-red-800 dark:text-red-300 dark:bg-red-900/20'}`}
          >
            <span className="hidden sm:inline">{isConnected ? '已连接' : '未连接'}</span>
            <span className="sm:hidden">{isConnected ? '连接' : '断开'}</span>
          </Badge>
        </div>
      </div>
      
      {/* 消息列表区域 - 使用固定高度计算 */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full px-4">
          <div className="space-y-4 py-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex items-start gap-3 ${
                  message.type === 'user' ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                {/* 简化的头像 */}
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm ${
                  message.status === 'error'
                    ? 'bg-red-500'
                    : message.type === 'user' 
                    ? 'bg-blue-500' 
                    : message.type === 'assistant'
                    ? 'bg-purple-500'
                    : 'bg-gray-500'
                }`}>
                  {getMessageIcon(message)}
                </div>
                
                <div className={`flex-1 max-w-[85%] sm:max-w-[75%] md:max-w-[70%] ${
                   message.type === 'user' ? 'text-right' : 'text-left'
                 }`}>
                  {/* 简化的消息气泡 */}
                   <div className={`inline-block p-3 sm:p-4 rounded-lg text-sm sm:text-base ${
                    message.status === 'error'
                      ? 'bg-red-50 text-red-800 border border-red-200 dark:bg-red-900/20 dark:text-red-200 dark:border-red-800'
                      : message.type === 'user'
                      ? 'bg-blue-500 text-white'
                      : message.type === 'assistant'
                      ? 'bg-gradient-to-br from-purple-900/30 to-blue-900/30 border border-purple-500/20 text-gray-100 dark:text-gray-100'
                      : 'bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                  }`}>
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                      {message.content}
                      {message.type === 'assistant' && message.status === 'pending' && (
                        <span className="inline-block w-0.5 h-4 bg-purple-400 animate-pulse ml-0.5 align-middle" />
                      )}
                    </div>
                    
                    {/* 操作结果数据 */}
                    {message.data && message.data.data && (
                      <div className="mt-3 p-2 bg-black/10 dark:bg-white/10 rounded text-xs border">
                        <div className="font-medium mb-1">操作详情：</div>
                        <pre className="overflow-x-auto text-xs">
                          {JSON.stringify(message.data.data, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                  
                  {/* 时间戳和状态 */}
                  <div className={`flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400 ${
                    message.type === 'user' ? 'justify-end' : 'justify-start'
                  }`}>
                    <span>{message.timestamp.toLocaleTimeString()}</span>
                    {getStatusIcon(message.status)}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </div>
        
      {/* 固定底部输入区域 */}
      <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 p-3 sm:p-4 space-y-3 bg-white dark:bg-gray-900">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="输入编辑指令..."
              className="pr-10 text-sm sm:text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isProcessing || !isConnected}
            />
            {inputValue && (
              <button
                onClick={() => setInputValue('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-lg"
              >
                ×
              </button>
            )}
          </div>
          <Button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isProcessing || !isConnected}
            className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 px-3 sm:px-4 py-2 min-w-[44px]"
          >
            {isProcessing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
        
        {/* 快捷指令 */}
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {[
            { text: '添加角色', fullText: '添加侦探角色', icon: '🕵️' },
            { text: '修改标题', fullText: '修改剧本标题', icon: '📝' },
            { text: '添加证据', fullText: '添加关键证据', icon: '🔍' },
            { text: '创建场景', fullText: '创建新场景', icon: '🎬' }
          ].map((suggestion) => (
            <Button
              key={suggestion.fullText}
              variant="outline"
              size="sm"
              onClick={() => setInputValue(suggestion.fullText)}
              className="text-xs h-7 sm:h-8 px-2 sm:px-3 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 flex-shrink-0"
              disabled={isProcessing}
            >
              <span className="mr-1">{suggestion.icon}</span>
              <span className="hidden sm:inline">{suggestion.fullText}</span>
              <span className="sm:hidden">{suggestion.text}</span>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ChatEditor;