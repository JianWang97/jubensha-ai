// AI 剧本生成 Agent 相关类型定义

/** 生成步骤 key */
export type GenerationStepKey =
  | 'script_info'
  | 'background_story'
  | 'characters'
  | 'locations'
  | 'evidence'
  | 'game_phases';

/** 生成步骤（固定顺序，key → 中文标签） */
export const GENERATION_STEPS: Array<{ key: GenerationStepKey; label: string }> = [
  { key: 'script_info', label: '基础信息' },
  { key: 'background_story', label: '背景故事' },
  { key: 'characters', label: '角色设计' },
  { key: 'locations', label: '场景设计' },
  { key: 'evidence', label: '证据设计' },
  { key: 'game_phases', label: '游戏阶段' }
];

/** 生成流程状态 */
export type GenerationStatus = 'idle' | 'running' | 'done' | 'error' | 'cancelled';

/** Agent 执行过程事件 */
export interface GenEvent {
  type:
    | 'step_start'
    | 'thought'
    | 'action'
    | 'observation'
    | 'step_end'
    | 'done'
    | 'error'
    | 'cancelled';
  /** 当前步骤 key，无则为 null */
  step: GenerationStepKey | null;
  /** 当前步骤中文标签，无则为 null */
  step_name: string | null;
  /** 当前步骤下标（0 起），无则为 null */
  step_index: number | null;
  /** 当前迭代次数 */
  iteration: number;
  /** 思考文本 / 动作摘要 / 观察文本 / 错误信息 */
  content: string;
  /** 仅 thought 事件有效：reasoning = 模型思考，text = 正式输出 */
  kind: 'reasoning' | 'text' | null;
  data: {
    tool?: string;
    arguments?: Record<string, unknown>;
    success?: boolean;
    script_id?: number;
    completed_steps?: string[];
  } | null;
  /** 到目前为止已完成的步骤 key 列表 */
  completed_steps: string[];
  /** ISO 时间戳 */
  timestamp: string;
}

/** Client → Server：开始生成 */
export interface StartScriptGenerationPayload {
  type: 'start_script_generation';
  script_id: number;
  theme: string;
  player_count: number;
  script_type: string;
}

/** Client → Server：取消生成 */
export interface CancelScriptGenerationPayload {
  type: 'cancel_script_generation';
}

/** Client → Server：获取生成状态（断线/刷新重放） */
export interface GetScriptGenerationStatePayload {
  type: 'get_script_generation_state';
}

/** Server → Client：生成事件 */
export interface ScriptGenerationEventMessage {
  type: 'script_generation_event';
  session_id?: string;
  data: GenEvent;
}

/** Server → Client：生成状态（重放） */
export interface ScriptGenerationStateMessage {
  type: 'script_generation_state';
  session_id?: string;
  data: {
    status: GenerationStatus;
    script_id: number | null;
    events: GenEvent[];
  };
}
