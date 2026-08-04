import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useScriptGenerationStore } from '@/stores/scriptGenerationStore';
import { useWebSocketStore } from '@/stores/websocketStore';
import { GENERATION_STEPS, GenEvent, GenerationStepKey } from '@/types/scriptGeneration';
import {
  Bot,
  Brain,
  CheckCircle,
  ChevronRight,
  Circle,
  Eye,
  Loader2,
  PartyPopper,
  Wrench,
  XCircle
} from 'lucide-react';
import { useRouter } from 'next/router';
import React, { useEffect, useMemo, useRef } from 'react';

type StepStatus = 'pending' | 'running' | 'done' | 'error';

interface ScriptGenerationPanelProps {
  /** 取消/出错后返回表单重新创作 */
  onReset?: () => void;
}

const StepStatusIcon: React.FC<{ status: StepStatus }> = ({ status }) => {
  switch (status) {
    case 'running':
      return <Loader2 className="w-4 h-4 animate-spin text-brass" />;
    case 'done':
      return <CheckCircle className="w-4 h-4 text-brass" />;
    case 'error':
      return <XCircle className="w-4 h-4 text-thread" />;
    default:
      return <Circle className="w-4 h-4 text-faint" />;
  }
};

/** 单条事件渲染 */
const EventItem: React.FC<{ event: GenEvent }> = ({ event }) => {
  switch (event.type) {
    case 'thought':
      if (event.kind === 'reasoning') {
        return (
          <div className="flex items-start gap-2">
            <Brain className="w-4 h-4 mt-1 flex-shrink-0 text-brass/70" />
            <div className="flex-1 rounded-sm px-3 py-2 bg-brass/10 border border-brass/15">
              <div className="text-xs text-brass/70 mb-1">思考</div>
              <p className="text-sm italic text-mist whitespace-pre-wrap leading-relaxed">
                {event.content}
              </p>
            </div>
          </div>
        );
      }
      return (
        <div className="flex items-start gap-2">
          <Bot className="w-4 h-4 mt-1 flex-shrink-0 text-brass" />
          <div className="flex-1 rounded-sm px-3 py-2 bg-raised border border-hairline">
            <p className="text-sm text-paper whitespace-pre-wrap leading-relaxed">
              {event.content}
            </p>
          </div>
        </div>
      );

    case 'action':
      return (
        <div className="flex items-start gap-2">
          <Wrench className="w-4 h-4 mt-1 flex-shrink-0 text-brass" />
          <div className="flex-1 rounded-sm px-3 py-2 bg-panel border border-line">
            <div className="flex items-center gap-2 flex-wrap">
              <code className="text-xs font-mono text-brass bg-brass/10 px-1.5 py-0.5 rounded">
                {event.data?.tool || 'tool'}
              </code>
              <span className="text-sm text-paper">{event.content}</span>
            </div>
            {event.data?.arguments && Object.keys(event.data.arguments).length > 0 && (
              <details className="mt-2 group">
                <summary className="text-xs text-faint cursor-pointer hover:text-mist select-none">
                  查看参数
                </summary>
                <pre className="mt-1 p-2 rounded bg-ink text-xs text-mist overflow-x-auto max-h-48">
                  {JSON.stringify(event.data.arguments, null, 2)}
                </pre>
              </details>
            )}
          </div>
        </div>
      );

    case 'observation': {
      const success = event.data?.success !== false;
      return (
        <div className="flex items-start gap-2 pl-6">
          <Eye className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${success ? 'text-brass/80' : 'text-thread/80'}`} />
          <p className={`text-xs whitespace-pre-wrap leading-relaxed ${success ? 'text-brass/90' : 'text-thread/90'}`}>
            {event.content}
          </p>
        </div>
      );
    }

    case 'step_end':
      return (
        <div className="flex items-center gap-2 py-1">
          <div className="h-px flex-1 bg-line" />
          <span className="text-xs text-mist flex items-center gap-1">
            <CheckCircle className="w-3 h-3 text-brass" />
            {event.step_name || ''} 完成
          </span>
          <div className="h-px flex-1 bg-line" />
        </div>
      );

    case 'step_start':
      return (
        <div className="flex items-center gap-2 pt-2">
          <ChevronRight className="w-4 h-4 text-brass" />
          <span className="text-sm font-medium text-brass">
            开始{event.step_name ? `「${event.step_name}」` : '新步骤'}
          </span>
        </div>
      );

    default:
      return null;
  }
};

const ScriptGenerationPanel: React.FC<ScriptGenerationPanelProps> = ({ onReset }) => {
  const router = useRouter();
  const { status, events, scriptId } = useScriptGenerationStore();
  const { sendMessage } = useWebSocketStore();
  const feedEndRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events.length]);

  // 推导每个步骤的状态
  const stepStatuses = useMemo(() => {
    const result: Record<GenerationStepKey, StepStatus> = {
      script_info: 'pending',
      background_story: 'pending',
      characters: 'pending',
      locations: 'pending',
      evidence: 'pending',
      game_phases: 'pending'
    };

    // 已完成步骤（completed_steps 是累积的，取并集以兼容重放）
    const completed = new Set<string>();
    events.forEach((e) => (e.completed_steps || []).forEach((s) => completed.add(s)));

    // 当前正在执行的步骤：最后一个带 step 的进行态事件
    let activeStep: GenerationStepKey | null = null;
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i];
      if (e.step && ['step_start', 'thought', 'action', 'observation'].includes(e.type)) {
        activeStep = e.step;
        break;
      }
      if (e.type === 'step_end' || e.type === 'done') break;
    }

    // 出错步骤：最后一个 error 事件的 step
    let errorStep: GenerationStepKey | null = null;
    if (status === 'error') {
      for (let i = events.length - 1; i >= 0; i--) {
        if (events[i].type === 'error') {
          errorStep = events[i].step;
          break;
        }
      }
    }

    GENERATION_STEPS.forEach(({ key }) => {
      if (completed.has(key)) {
        result[key] = 'done';
      } else if (errorStep === key) {
        result[key] = 'error';
      } else if (activeStep === key && status === 'running') {
        result[key] = 'running';
      }
    });

    return result;
  }, [events, status]);

  const lastEvent = events.length > 0 ? events[events.length - 1] : null;
  // 等待 LLM 响应：没有事件，或最后一个事件是 observation / step_end
  const isWaitingForLLM =
    status === 'running' && (!lastEvent || lastEvent.type === 'observation' || lastEvent.type === 'step_end');

  const doneEvent = status === 'done' ? events.find((e) => e.type === 'done') : null;
  const errorEvent = status === 'error' ? [...events].reverse().find((e) => e.type === 'error') : null;
  const finalScriptId = scriptId ?? doneEvent?.data?.script_id ?? null;

  const handleCancel = () => {
    sendMessage({ type: 'cancel_script_generation' });
  };

  const handleGoEditor = () => {
    if (finalScriptId) {
      router.push(`/script-manager/edit/${finalScriptId}`);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="rounded-sm border border-line bg-panel overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-line bg-ink/60">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brass/10 rounded-sm">
              <Bot className="w-5 h-5 text-brass" />
            </div>
            <div>
              <h3 className="text-paper font-dossier font-semibold">AI 创作 Agent</h3>
              <p className="text-xs text-mist">
                {status === 'running' && '正在逐步生成剧本内容…'}
                {status === 'done' && '剧本生成完成'}
                {status === 'error' && '生成过程中出现错误'}
                {status === 'cancelled' && '生成已取消'}
                {status === 'idle' && '准备就绪'}
              </p>
            </div>
          </div>
          {status === 'running' && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              className="border-thread/40 text-thread hover:bg-thread/10 hover:text-thread"
            >
              <XCircle className="w-4 h-4 mr-1" />
              取消生成
            </Button>
          )}
        </div>

        <div className="grid md:grid-cols-[220px,1fr]">
          {/* 步骤时间线 */}
          <div className="border-b md:border-b-0 md:border-r border-line p-4 sm:p-5">
            <div className="flex md:flex-col gap-3 md:gap-4 overflow-x-auto">
              {GENERATION_STEPS.map(({ key, label }, index) => {
                const stepStatus = stepStatuses[key];
                return (
                  <div key={key} className="flex items-center gap-2.5 flex-shrink-0">
                    <StepStatusIcon status={stepStatus} />
                    <span
                      className={`text-sm whitespace-nowrap ${
                        stepStatus === 'running'
                          ? 'text-paper font-medium border-brass/40'
                          : stepStatus === 'done'
                          ? 'text-brass'
                          : stepStatus === 'error'
                          ? 'text-thread'
                          : 'text-faint'
                      }`}
                    >
                      {index + 1}. {label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 事件流 */}
          <div className="flex flex-col min-h-0">
            <ScrollArea className="h-[420px] px-4 sm:px-5">
              <div className="space-y-3 py-4">
                {events.length === 0 && status === 'running' && (
                  <div className="flex items-center gap-2 text-mist text-sm">
                    <Loader2 className="w-4 h-4 animate-spin text-brass" />
                    正在启动创作 Agent…
                  </div>
                )}
                {events.map((event, index) => (
                  <EventItem key={index} event={event} />
                ))}
                {isWaitingForLLM && (
                  <div className="flex items-center gap-2 pl-1 text-sm text-brass/80 animate-pulse">
                    <Brain className="w-4 h-4" />
                    Agent 正在思考…
                  </div>
                )}
                <div ref={feedEndRef} />
              </div>
            </ScrollArea>

            {/* 结果横幅 */}
            {status === 'done' && (
              <div className="border-t border-line px-4 sm:px-5 py-4 bg-brass/10">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex items-center gap-2 flex-1">
                    <PartyPopper className="w-5 h-5 text-brass flex-shrink-0" />
                    <p className="text-sm text-brass">
                      {doneEvent?.content || '剧本生成完成！所有内容已保存。'}
                    </p>
                  </div>
                  <Button
                    onClick={handleGoEditor}
                    className="bg-brass/10 border border-brass/40 text-brass hover:bg-brass/20"
                  >
                    进入编辑器
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}

            {status === 'error' && (
              <div className="border-t border-line px-4 sm:px-5 py-4 bg-thread/10">
                <div className="flex items-start gap-2">
                  <XCircle className="w-5 h-5 text-thread flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-thread">
                      {errorEvent?.content || '生成过程中出现错误'}
                    </p>
                    <p className="text-xs text-mist mt-1">
                      已生成的内容会保留在剧本中，你可以进入编辑器查看并继续完善。
                    </p>
                    <div className="flex gap-2 mt-3">
                      {finalScriptId && (
                        <Button variant="outline" size="sm" onClick={handleGoEditor}>
                          进入编辑器查看
                        </Button>
                      )}
                      {onReset && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={onReset}
                          className="border-brass/40 text-brass hover:bg-brass/10"
                        >
                          重新创作
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {status === 'cancelled' && (
              <div className="border-t border-line px-4 sm:px-5 py-4 bg-panel">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <p className="text-sm text-mist flex-1">
                    生成已取消，已生成的内容会保留在剧本中。
                  </p>
                  <div className="flex gap-2">
                    {finalScriptId && (
                      <Button variant="outline" size="sm" onClick={handleGoEditor}>
                        进入编辑器查看
                      </Button>
                    )}
                    {onReset && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={onReset}
                        className="border-brass/40 text-brass hover:bg-brass/10"
                      >
                        重新创作
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScriptGenerationPanel;
