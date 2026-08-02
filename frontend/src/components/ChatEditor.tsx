/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useRef, useEffect } from 'react';
// Card components removed - using div layout for better control
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Send, Bot, User, CheckCircle, XCircle, MessageCircle, X } from 'lucide-react';
import { toast } from 'sonner';
import { useWebSocketStore } from '@/stores/websocketStore';
import EditProcessTimeline, {
  EditProcessEvent,
  EditProcessStatus
} from '@/components/EditProcessTimeline';

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
      content: '我是你的剧本编辑助手。用自然语言告诉我要怎么改，比如：\n\n"添加一个叫张三的侦探角色"\n"修改李四的背景故事"\n"删除破损的花瓶这个证据"\n"在客厅加一个书架"\n\n我会直接改好剧本。',
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  // AI 对话编辑的实时执行过程事件（script_edit_event），不进 messages 列表
  const [processEvents, setProcessEvents] = useState<EditProcessEvent[]>([]);
  const [processStatus, setProcessStatus] = useState<EditProcessStatus>('running');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { isConnected, sendMessage } = useWebSocketStore();

  // 自动滚动到底部（只滚动消息容器，避免 scrollIntoView 把整页容器一起卷上去）
  const scrollToBottom = () => {
    const el = messagesEndRef.current;
    if (!el) return;
    const viewport = el.closest('[data-slot="scroll-area-viewport"]');
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
      return;
    }
    let scroller = el.parentElement;
    while (scroller && scroller !== document.body) {
      const overflowY = getComputedStyle(scroller).overflowY;
      if (/(auto|scroll)/.test(overflowY)) {
        scroller.scrollTop = scroller.scrollHeight;
        return;
      }
      scroller = scroller.parentElement;
    }
    el.scrollIntoView();
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 执行过程时间线更新时跟随滚动（仅进行中，避免完成后展开/折叠打断阅读）
  useEffect(() => {
    if (processStatus === 'running' && processEvents.length > 0) {
      scrollToBottom();
    }
  }, [processEvents, processStatus]);

  // 移除"正在处理指令"的临时系统消息：终态由结果消息与执行时间线呈现，避免错误/成功图标重复
  const clearProcessingMessage = () => {
    setMessages(prev => prev.filter(msg => !(msg.type === 'system' && msg.status === 'pending')));
  };

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
              content: `正在处理指令：${instruction}`,
              timestamp: new Date(),
              status: 'pending'
            };
            setMessages(prev => [...prev, processingMessage]);
          }
          // 新指令开始：清空上一次的执行过程时间线
          setProcessEvents([]);
          setProcessStatus('running');
          // 确保处理状态设置为true
          setIsProcessing(true);
          break;

        case 'script_edit_event':
          // 实时执行过程事件（思考/工具调用/结果），追加到时间线
          const editEvent = message.data as unknown as EditProcessEvent;
          if (editEvent && editEvent.type) {
            setProcessEvents(prev => [...prev, editEvent]);
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
                result.message : 
                `操作失败：${result.message}`,
              timestamp: new Date(),
              status: result.success ? 'success' : 'error',
              data: message.data
            };
            setMessages(prev => [...prev, resultMessage]);
          }
          break;
          
        case 'instruction_completed':
          // 指令完成
          clearProcessingMessage();
          const completedData = message.data;
          if (completedData) {
            const successCount = completedData.success_count || 0;
            const resultsLength = completedData.results?.length || 0;
            const completedMessage: ChatMessage = {
              id: Date.now().toString(),
              type: 'assistant',
              content: `指令执行完成，成功 ${successCount} / ${resultsLength} 项`,
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
          // 标记执行过程结束（时间线保留在最后一条结果下方，默认折叠）
          setProcessStatus('done');
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
              content: `建议：${suggestion}`,
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
            content: '剧本编辑模式已启动。',
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
            content: '剧本编辑模式已停止。',
            timestamp: new Date(),
            status: 'success',
            data: message.data
          };
          setMessages(prev => [...prev, stopMessage]);
          break;
          
        case 'script_edit_result':
          // 保持向后兼容
          clearProcessingMessage();
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
              content: message.data?.message || (message.data?.success ? '操作完成。' : '操作失败'),
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
              toast.success('剧本更新成功。');
            } else {
              toast.error('操作失败：' + (message.data?.message || '未知错误'));
            }
          }
          
          // 清除超时定时器并重置处理状态
          if (processingTimeoutRef.current) {
            clearTimeout(processingTimeoutRef.current);
            processingTimeoutRef.current = null;
          }
          setProcessStatus(message.data?.success === false ? 'error' : 'done');
          setIsProcessing(false);
          break;

        case 'script_edit_error':
          // 错误处理
          clearProcessingMessage();
          const errorMessage: ChatMessage = {
            id: Date.now().toString(),
            type: 'assistant',
            content: `错误：${message.data?.message || '操作失败'}`,
            timestamp: new Date(),
            status: 'error',
            data: message.data
          };
          setMessages(prev => [...prev, errorMessage]);
          // 清除超时定时器并重置处理状态
          if (processingTimeoutRef.current) {
            clearTimeout(processingTimeoutRef.current);
            processingTimeoutRef.current = null;
          }
          setProcessStatus('error');
          setIsProcessing(false);
          break;

        case 'error':
          // 后端通用错误（如指令处理被拒绝/失败），聊天内展示一次即可，不再重复 toast
          clearProcessingMessage();
          const serverErrorMessage: ChatMessage = {
            id: Date.now().toString(),
            type: 'system',
            content: `处理失败：${message.data?.message || '服务器处理失败'}`,
            timestamp: new Date(),
            status: 'error',
            data: message.data
          };
          setMessages(prev => [...prev, serverErrorMessage]);
          // 清除超时定时器并重置处理状态
          if (processingTimeoutRef.current) {
            clearTimeout(processingTimeoutRef.current);
            processingTimeoutRef.current = null;
          }
          setProcessStatus('error');
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

  const handleSendMessage = () => {
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

    // 发送编辑指令到WebSocket；发送失败时立即反馈，不进入处理状态
    const sent = sendMessage({
      type: 'edit_instruction',
      instruction: userMessage.content,
      message_id: userMessage.id
    });

    if (!sent) {
      setMessages(prev => prev.map(msg => 
        msg.id === userMessage.id 
          ? { ...msg, status: 'error' }
          : msg
      ));
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
        processingTimeoutRef.current = null;
      }
      toast.error('发送失败，请检查连接');
      return;
    }

    // 更新消息状态为已发送
    setMessages(prev => prev.map(msg => 
      msg.id === userMessage.id 
        ? { ...msg, status: 'success' }
        : msg
    ));
    setIsProcessing(true);

    // 设置30秒超时，防止处理状态卡住
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
    }
    processingTimeoutRef.current = setTimeout(() => {
      console.warn('指令处理超时，自动重置状态');
      clearProcessingMessage();
      setProcessStatus('error');
      setIsProcessing(false);
      toast.error('指令处理超时，请重试');
    }, 30000);
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
        return <Loader2 className="h-3 w-3 animate-spin text-mist" />;
      case 'success':
        return <CheckCircle className="h-3 w-3 text-brass" />;
      case 'error':
        return <XCircle className="h-3 w-3 text-thread" />;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-full w-full flex-col border-l border-line bg-panel">
      {/* 抽屉头 */}
      <div className="flex flex-shrink-0 flex-row items-center justify-between border-b border-line bg-ink/40 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-sm border border-brass/40 bg-brass/10">
            <MessageCircle className="h-4 w-4 text-brass" />
          </div>
          <h3 className="truncate font-dossier text-base font-semibold tracking-wide text-paper">
            AI 助手
          </h3>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <span
            className={`h-1.5 w-1.5 rounded-full transition-colors duration-300 ${
              isConnected ? 'bg-brass' : 'bg-faint'
            }`}
          />
          <span className="font-data text-[11px] tracking-wider text-mist">
            {isConnected ? '已连接' : '未连接'}
          </span>
        </div>
      </div>

      {/* 消息列表 */}
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
                {/* 头像 */}
                <div
                  className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[11px] ${
                    message.status === 'error'
                      ? 'bg-thread-dim text-thread'
                      : message.type === 'user'
                      ? 'bg-brass/15 text-brass'
                      : message.type === 'assistant'
                      ? 'bg-panel text-mist ring-1 ring-line'
                      : 'text-faint'
                  }`}
                >
                  {getMessageIcon(message)}
                </div>

                <div
                  className={`flex max-w-[85%] flex-col sm:max-w-[80%] ${
                    message.type === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  {/* 消息主体 */}
                  {message.type === 'system' ? (
                    <div className="rounded-sm border border-hairline bg-ink/60 px-3 py-2.5 text-[13px] leading-relaxed text-mist">
                      <div className="whitespace-pre-wrap">{message.content}</div>
                      {message.status === 'pending' && (
                        <span className="mt-1.5 flex items-center gap-1" aria-label="处理中">
                          <span className="h-1 w-1 animate-pulse rounded-full bg-brass" />
                          <span className="h-1 w-1 animate-pulse rounded-full bg-brass [animation-delay:150ms]" />
                          <span className="h-1 w-1 animate-pulse rounded-full bg-brass [animation-delay:300ms]" />
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="relative w-full">
                      {/* 红线批注：助手消息的左边线 */}
                      {message.type === 'assistant' && (
                        <div
                          className={`absolute -left-3 top-1 bottom-1 w-px ${
                            message.status === 'error' ? 'bg-thread' : 'bg-brass/50'
                          }`}
                        />
                      )}
                      <div
                        className={`inline-block rounded-sm px-3.5 py-2.5 text-sm leading-relaxed ${
                          message.status === 'error'
                            ? 'border border-thread/30 bg-thread-dim/15 text-thread'
                            : message.type === 'user'
                            ? 'border border-brass/25 bg-brass/10 text-paper'
                            : 'bg-raised text-paper'
                        }`}
                      >
                        <div className="whitespace-pre-wrap">{message.content}</div>
                        {message.type === 'assistant' && message.status === 'pending' && (
                          <span
                            className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse align-middle bg-brass"
                            aria-label="正在生成"
                          />
                        )}

                        {/* 操作详情 */}
                        {message.data && message.data.data && (
                          <div className="mt-2.5 rounded-sm border border-hairline bg-ink/60 px-2.5 py-2">
                            <div className="mb-1 font-data text-[10px] uppercase tracking-wider text-mist">
                              操作详情
                            </div>
                            <pre className="overflow-x-auto font-data text-[11px] text-paper/80">
                              {JSON.stringify(message.data.data, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 时间戳与状态 */}
                  <div
                    className={`mt-1.5 flex items-center gap-2 font-data text-[10px] tracking-wider text-faint ${
                      message.type === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <span>{message.timestamp.toLocaleTimeString('zh-CN', { hour12: false })}</span>
                    {getStatusIcon(message.status)}
                  </div>
                </div>
              </div>
            ))}
            {/* 实时执行过程时间线：进行中默认展开，完成后保留在最后一条结果下方（默认折叠） */}
            {processEvents.length > 0 && (
              <EditProcessTimeline events={processEvents} status={processStatus} />
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </div>

      {/* 输入区 */}
      <div className="flex-shrink-0 space-y-2.5 border-t border-line bg-ink/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="输入编辑指令…"
              className="h-9 rounded-sm border-line bg-panel pr-8 text-sm text-paper placeholder:text-faint"
              disabled={isProcessing || !isConnected}
            />
            {inputValue && (
              <button
                onClick={() => setInputValue('')}
                aria-label="清空输入"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-faint transition-colors hover:text-paper"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isProcessing || !isConnected}
            aria-label="发送指令"
            className="h-9 rounded-sm border border-brass/40 bg-brass/15 px-3 text-paper hover:bg-brass/25 disabled:opacity-40"
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* 快捷指令 */}
        <div className="flex flex-wrap gap-1.5">
          {[
            { text: '添加角色', fullText: '添加一个侦探角色' },
            { text: '修改标题', fullText: '修改剧本标题' },
            { text: '添加证据', fullText: '添加一条关键证据' },
            { text: '创建场景', fullText: '创建一个新场景' }
          ].map((suggestion) => (
            <button
              key={suggestion.fullText}
              onClick={() => setInputValue(suggestion.fullText)}
              disabled={isProcessing}
              className="h-7 rounded-sm border border-line px-2.5 font-data text-[11px] tracking-wide text-mist transition-colors hover:border-brass/40 hover:text-brass disabled:opacity-40"
            >
              {suggestion.text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ChatEditor;