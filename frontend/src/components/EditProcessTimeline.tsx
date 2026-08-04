import {
  Brain,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Loader2,
  Play,
  X,
  XCircle
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';

/** AI 对话编辑的单步执行事件（WS 消息 script_edit_event 的 data） */
export interface EditProcessEvent {
  type: 'step_start' | 'thought' | 'action' | 'observation' | 'step_end';
  /** 步骤标识：ReAct 编辑 Agent 的工具域（plan/characters/evidence/locations/script_info/background_story/game_phases/voice） */
  step: string;
  step_name: string;
  content: string;
  kind?: 'reasoning' | 'text' | null;
  data?: {
    index?: number;
    total?: number;
    instruction?: string;
    operations?: unknown[];
    success?: boolean;
    [key: string]: unknown;
  } | null;
  timestamp?: string;
}

export type EditProcessStatus = 'running' | 'done' | 'error';

interface EditProcessTimelineProps {
  events: EditProcessEvent[];
  /** 当前过程状态：running 进行中 / done 完成 / error 失败 */
  status: EditProcessStatus;
}

type StepStatus = 'running' | 'done' | 'error';

interface StepGroup {
  key: string;
  stepName: string;
  ended: boolean;
  items: EditProcessEvent[];
}

/** 按 step_start / step_end 把事件流分组为步骤 */
function buildStepGroups(events: EditProcessEvent[]): StepGroup[] {
  const groups: StepGroup[] = [];
  let current: StepGroup | null = null;
  let seq = 0;

  for (const ev of events) {
    if (ev.type === 'step_start') {
      current = {
        key: `${ev.step || 'step'}-${seq++}`,
        stepName: ev.step_name || ev.step || '步骤',
        ended: false,
        items: []
      };
      groups.push(current);
    } else if (ev.type === 'step_end') {
      if (current) {
        current.ended = true;
        current = null;
      }
    } else {
      // 容错：step_start 缺失时归入当前（或新建）分组；纯思考事件的分组标记为"思考过程"
      if (!current) {
        current = {
          key: `${ev.step || 'step'}-${seq++}`,
          stepName: ev.step_name || ev.step || (ev.type === 'thought' ? '思考过程' : '步骤'),
          ended: false,
          items: []
        };
        groups.push(current);
      }
      current.items.push(ev);
    }
  }
  return groups;
}

const StepStatusIcon: React.FC<{ status: StepStatus }> = ({ status }) => {
  switch (status) {
    case 'running':
      return <Loader2 className="h-3.5 w-3.5 animate-spin text-brass" />;
    case 'error':
      return <XCircle className="h-3.5 w-3.5 text-thread" />;
    default:
      return <CheckCircle className="h-3.5 w-3.5 text-brass" />;
  }
};

/** 思考内容块：弱化样式，长文本默认折叠 */
const ThoughtItem: React.FC<{ event: EditProcessEvent }> = ({ event }) => {
  const [expanded, setExpanded] = useState(false);
  const content = event.content || '';
  const isLong = content.length > 160 || content.split('\n').length > 3;

  return (
    <div className="rounded-sm border border-brass/15 bg-brass/5 px-2.5 py-2">
      <div className="flex items-center gap-1.5 font-data text-[10px] uppercase tracking-wider text-brass/60">
        <Brain className="h-3 w-3" />
        思考
      </div>
      <p
        className={`mt-1 whitespace-pre-wrap text-xs italic leading-relaxed text-mist ${
          !expanded && isLong ? 'line-clamp-3' : ''
        }`}
      >
        {content}
      </p>
      {isLong && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 font-data text-[11px] tracking-wide text-faint transition-colors hover:text-brass"
        >
          {expanded ? '收起思考' : '展开思考'}
        </button>
      )}
    </div>
  );
};

/** 工具调用行：▶ 操作摘要，execute 阶段带 i/N 进度 */
const ActionItem: React.FC<{ event: EditProcessEvent }> = ({ event }) => {
  const index = event.data?.index;
  const total = event.data?.total;
  const showProgress =
    typeof index === 'number' && typeof total === 'number' && total > 0;

  return (
    <div className="flex items-start gap-2">
      <Play className="mt-0.5 h-3 w-3 flex-shrink-0 text-brass" />
      <span className="flex-1 text-xs leading-relaxed text-paper">
        {event.content}
      </span>
      {showProgress && (
        <span className="flex-shrink-0 rounded-sm border border-line bg-ink/60 px-1.5 py-0.5 font-data text-[10px] tracking-wider text-mist">
          {index}/{total}
        </span>
      )}
    </div>
  );
};

/** 结果行：成功 ✓ / 失败 ✗ */
const ObservationItem: React.FC<{ event: EditProcessEvent }> = ({ event }) => {
  const success = event.data?.success !== false;
  return (
    <div className="flex items-start gap-2 pl-5">
      {success ? (
        <Check className="mt-0.5 h-3 w-3 flex-shrink-0 text-brass/80" />
      ) : (
        <X className="mt-0.5 h-3 w-3 flex-shrink-0 text-thread" />
      )}
      <p
        className={`text-xs leading-relaxed whitespace-pre-wrap ${
          success ? 'text-mist' : 'text-thread/90'
        }`}
      >
        {event.content}
      </p>
    </div>
  );
};

const ProcessEventItem: React.FC<{ event: EditProcessEvent }> = ({ event }) => {
  switch (event.type) {
    case 'thought':
      return <ThoughtItem event={event} />;
    case 'action':
      return <ActionItem event={event} />;
    case 'observation':
      return <ObservationItem event={event} />;
    default:
      return null;
  }
};

const EditProcessTimeline: React.FC<EditProcessTimelineProps> = ({
  events,
  status
}) => {
  const isRunning = status === 'running';
  // 处理中默认展开，结束后默认折叠为一行
  const [collapsed, setCollapsed] = useState(!isRunning);
  const prevRunningRef = useRef(isRunning);

  useEffect(() => {
    if (isRunning !== prevRunningRef.current) {
      prevRunningRef.current = isRunning;
      setCollapsed(!isRunning);
    }
  }, [isRunning]);

  const groups = useMemo(() => buildStepGroups(events), [events]);

  // 步骤显示状态：未收到 step_end 的步骤在过程结束后按整体状态收尾
  const groupStatus = (group: StepGroup): StepStatus => {
    if (group.ended) return 'done';
    if (isRunning) return 'running';
    return status === 'error' ? 'error' : 'done';
  };

  return (
    <div className="ml-9 rounded-sm border border-hairline bg-ink/60">
      {/* 标题行（始终可见，点击折叠/展开） */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
        aria-expanded={!collapsed}
      >
        {isRunning ? (
          <Loader2 className="h-3.5 w-3.5 flex-shrink-0 animate-spin text-brass" />
        ) : status === 'error' ? (
          <XCircle className="h-3.5 w-3.5 flex-shrink-0 text-thread" />
        ) : (
          <CheckCircle className="h-3.5 w-3.5 flex-shrink-0 text-brass" />
        )}
        <span className="font-data text-[11px] uppercase tracking-wider text-mist">
          执行过程
        </span>
        <span className="flex-1" />
        {collapsed && (
          <span className="font-data text-[11px] tracking-wide text-faint">
            查看执行过程
          </span>
        )}
        {collapsed ? (
          <ChevronRight className="h-3.5 w-3.5 text-faint" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-faint" />
        )}
      </button>

      {/* 步骤时间线 */}
      {!collapsed && (
        <div className="space-y-3 border-t border-hairline px-3 py-2.5">
          {groups.map((group) => (
            <div key={group.key}>
              <div className="flex items-center gap-2">
                <StepStatusIcon status={groupStatus(group)} />
                <span className="text-xs font-medium text-paper">
                  {group.stepName}
                </span>
              </div>
              {group.items.length > 0 && (
                <div className="mt-1.5 space-y-1.5 pl-[22px]">
                  {group.items.map((ev, i) => (
                    <ProcessEventItem key={i} event={ev} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EditProcessTimeline;
